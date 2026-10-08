import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TAXI_PLACES } from './layout.js'
import { heightAt } from './terrain.js'
import { vehicleState } from './input.js'
import { useStore } from '../store.js'
import { translate } from '../i18n.js'
import { playChime, playCoin } from '../audio.js'

// Taksi modu: duraktan vardiyaya başla, bekleyen yolcuyu al, istediği yere götür.
// Ücret mesafeye göre; hedefe hızlı varırsan bahşiş. Yolcu binip inerken araç yavaşlamalı.
const PICK_RADIUS = 5.5
const STOP_SPEED = 3.5 // m/s: bu hızın altında yolcu biner/iner
const PICKUP_COLOR = '#f2c230'
const DEST_COLOR = '#4fd99a'

const QUOTES = {
  tr: ['{p}, lütfen!', '{p}! Acelem var, bas gaza!', 'Hedef: {p}. Bahşişim hazır!', 'Simit aldım, şimdi {p}!', 'Kaptan, {p} lütfen. Kısa yoldan!'],
  en: ['{p}, please!', '{p} — and step on it!', 'Take me to {p}, I am late!', 'Got my simit, now {p}!', '{p}, captain. Shortest route!'],
}

const pickRandom = (list) => list[Math.floor(Math.random() * list.length)]
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)

// Uzaklığı belli aralıkta olan rastgele bir yer (yoksa en uzak olan)
function choosePlace(from, min, max, exclude) {
  const options = TAXI_PLACES.filter((p) => p.id !== exclude && dist(p, from) >= min && dist(p, from) <= max)
  if (options.length) return pickRandom(options)
  return TAXI_PLACES.filter((p) => p.id !== exclude).sort((a, b) => dist(b, from) - dist(a, from))[0]
}

function navTo(place, color) {
  useStore.getState().setNavTarget({ id: `taxi:${place.id}:${color}`, x: place.x, z: place.z, radius: PICK_RADIUS, label: place.label, color, silent: true })
}

// Bekleyen yolcu: basit bir figür, el sallar
function Passenger({ group, arm }) {
  return (
    <group ref={group} visible={false}>
      <mesh position={[0, 0.75, 0]} castShadow>
        <capsuleGeometry args={[0.24, 0.6, 4, 10]} />
        <meshStandardMaterial color="#3d7bff" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.42, 0]} castShadow>
        <sphereGeometry args={[0.2, 14, 10]} />
        <meshStandardMaterial color="#e8b48a" roughness={0.8} />
      </mesh>
      <group ref={arm} position={[0.24, 1.08, 0]}>
        <mesh position={[0, 0.25, 0]} castShadow>
          <capsuleGeometry args={[0.07, 0.38, 3, 6]} />
          <meshStandardMaterial color="#3d7bff" roughness={0.7} />
        </mesh>
      </group>
    </group>
  )
}

// Hedef işareti: yerde halka ve gökyüzüne uzanan ışık sütunu
function Beacon({ group, color }) {
  return (
    <group ref={group} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <ringGeometry args={[PICK_RADIUS - 0.6, PICK_RADIUS, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.65} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 7, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 14, 16, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  )
}

export default function Taxi() {
  const passenger = useRef()
  const arm = useRef()
  const pickupBeacon = useRef()
  const destBeacon = useRef()
  const busy = useRef(false) // aynı karede iki kez tetiklenmesin
  const wasActive = useRef(false)
  const spots = useMemo(() => Object.fromEntries(TAXI_PLACES.map((p) => [p.id, heightAt(p.x, p.z)])), [])

  useFrame((state) => {
    const store = useStore.getState()
    const taxi = store.taxi
    const show = (ref, place) => {
      const g = ref.current
      if (!g) return
      g.visible = !!place
      if (place) g.position.set(place.x, spots[place.id], place.z)
    }
    if (!taxi.active) {
      // Vardiya bitti (süre, durak, helikopter ya da kapat düğmesi): özet bildirimi
      if (wasActive.current) {
        wasActive.current = false
        store.toast(translate('taxiShiftOver', store.lang), `${translate('taxiEarned', store.lang)}: ₺${taxi.last}`)
        if (!store.muted) playChime()
      }
      show(passenger, null)
      show(pickupBeacon, null)
      show(destBeacon, null)
      return
    }
    wasActive.current = true
    show(passenger, taxi.stage === 'pickup' ? taxi.pickup : null)
    show(pickupBeacon, taxi.stage === 'pickup' ? taxi.pickup : null)
    show(destBeacon, taxi.stage === 'ride' ? taxi.dest : null)
    if (arm.current) arm.current.rotation.z = -0.4 + Math.sin(state.clock.elapsedTime * 7) * 0.5
    if (passenger.current?.visible) {
      // Yolcu araca dönük bekler
      const p = vehicleState.position
      passenger.current.rotation.y = Math.atan2(p.x - taxi.pickup.x, p.z - taxi.pickup.z)
    }

    const now = performance.now()
    const lang = store.lang
    // Vardiya bitti ya da helikoptere geçildi
    if (now > taxi.endsAt || store.mode !== 'car') {
      store.endTaxi()
      return
    }

    const car = vehicleState.position
    const slow = Math.abs(vehicleState.speed) < STOP_SPEED
    if (busy.current) return

    if (taxi.stage === 'pickup') {
      if (!taxi.pickup) {
        const pickup = choosePlace(car, 25, 95, taxi.dest?.id)
        store.setTaxi({ pickup })
        navTo(pickup, PICKUP_COLOR)
        return
      }
      if (dist(car, taxi.pickup) < PICK_RADIUS && slow) {
        busy.current = true
        const dest = choosePlace(taxi.pickup, 35, 120, taxi.pickup.id)
        // Bahşiş süresi: kuş uçuşu mesafeye göre, yol kıvrımları için pay bırakılır
        const par = dist(taxi.pickup, dest) / 9 + 6
        store.setTaxi({ stage: 'ride', dest, rideStart: now, par })
        navTo(dest, DEST_COLOR)
        const place = translate(dest.label, lang)
        store.toast(translate('taxiPassengerIn', lang), pickRandom(QUOTES[lang] ?? QUOTES.tr).replaceAll('{p}', place))
        if (!store.muted) playChime()
        busy.current = false
      }
      return
    }

    if (taxi.stage === 'ride' && dist(car, taxi.dest) < PICK_RADIUS && slow) {
      busy.current = true
      const seconds = (now - taxi.rideStart) / 1000
      const fare = 40 + Math.round(dist(taxi.pickup, taxi.dest) * 1.2)
      const tip = Math.max(0, Math.round((taxi.par - seconds) * 6))
      const fares = taxi.fares + 1
      store.setTaxi({ stage: 'pickup', pickup: null, fares, earned: taxi.earned + fare + tip })
      store.setNavTarget(null)
      store.toast(`+₺${fare + tip}`, tip ? `${translate('taxiTip', lang)}: ₺${tip}` : translate('taxiNoTip', lang))
      if (!store.muted) playCoin()
      if (fares >= 5) store.unlock('cabbie')
      busy.current = false
    }
  })

  return (
    <>
      <Passenger group={passenger} arm={arm} />
      <Beacon group={pickupBeacon} color={PICKUP_COLOR} />
      <Beacon group={destBeacon} color={DEST_COLOR} />
    </>
  )
}
