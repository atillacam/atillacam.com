import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ConvexHullCollider, CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { SUMO } from './layout.js'
import { heightAt } from './terrain.js'
import { vehicleState } from './input.js'
import { useStore } from '../store.js'
import { translate } from '../i18n.js'
import { playBoom, playCountdown, playChime, playThud } from '../audio.js'
import { formatTime } from '../format.js'

// Sumo arenası: yükseltilmiş yuvarlak platformda üç çarpışan arabaya karşı.
// Platformun dışına çıkan elenir; üç rakibi de dışarı iten kazanır.
const GROUND = heightAt(SUMO.x, SUMO.z)
const TOP = GROUND + SUMO.height
const OUT = SUMO.radius + 0.8 // merkezden bu uzaklığı geçen elenir
const BOT_COLORS = ['#e84a5f', '#3d7bff', '#9b7bff']
const BOT_MASS = 7
const BOT_ACCEL = 13 // m/s²

// Dört renkli direk (platformun eğimli kenarının dışında)
const PILLARS = ['#1f6fe0', '#e84a5f', '#f2f2f0', '#16181d'].map((color, i) => {
  // Ana yönlerde: güneybatıdaki durak ve yol girişleriyle çakışmaz
  const a = (i * Math.PI) / 2
  const r = SUMO.radius + 2.6
  return { color, x: Math.cos(a) * r, z: Math.sin(a) * r }
})

// Kenarı eğimli platform: araçlar rampadan çıkar gibi üstüne tırmanabilir
function platformHull() {
  const g = new THREE.CylinderGeometry(SUMO.radius, SUMO.radius + 1.4, SUMO.height, 40, 1, false)
  g.translate(0, SUMO.height / 2, 0)
  return g
}

function Ring() {
  const geometry = useMemo(() => platformHull(), [])
  const hull = useMemo(() => geometry.attributes.position.array, [geometry])
  return (
    <group position={[SUMO.x, GROUND, SUMO.z]}>
      <RigidBody type="fixed" colliders={false}>
        <ConvexHullCollider args={[hull]} friction={0.9} />
        {PILLARS.map((p) => (
          <CylinderCollider key={p.color} args={[1.6, 0.2]} position={[p.x, 1.6, p.z]} />
        ))}
      </RigidBody>
      <mesh geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial color="#cdae7f" roughness={0.95} />
      </mesh>
      {/* Halat çember (tawara) ve başlangıç çizgileri */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, SUMO.height + 0.01, 0]}>
        <ringGeometry args={[SUMO.radius - 0.55, SUMO.radius - 0.2, 64]} />
        <meshStandardMaterial color="#f2ead6" roughness={0.9} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      {[-1.6, 1.6].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, SUMO.height + 0.012, 0]}>
          <planeGeometry args={[0.18, 1.6]} />
          <meshBasicMaterial color="#ffffff" polygonOffset polygonOffsetFactor={-3} />
        </mesh>
      ))}
      {/* Dört köşede renkli direkler */}
      {PILLARS.map(({ color, x, z }) => {
        return (
          <group key={color} position={[x, 0, z]}>
            <mesh position={[0, 1.6, 0]} castShadow>
              <cylinderGeometry args={[0.16, 0.18, 3.2, 10]} />
              <meshStandardMaterial color="#8a6a45" roughness={0.8} />
            </mesh>
            <mesh position={[0, 3.25, 0]} castShadow>
              <sphereGeometry args={[0.38, 14, 10]} />
              <meshStandardMaterial color={color} roughness={0.6} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

// Çarpışan araba: gövde, kauçuk tampon, sürücü kafası
function Bot({ index, onOut }) {
  const body = useRef()
  const a = (index - 1) * 2.1 // 0, ±2.1 rad: oyuncu batıda başlar
  const start = [SUMO.x + Math.cos(a) * 6, TOP + 0.6, SUMO.z + Math.sin(a) * 6]
  const color = BOT_COLORS[index % BOT_COLORS.length]
  const gone = useRef(false)

  useFrame((_, delta) => {
    const rb = body.current
    if (!rb || gone.current) return
    const dt = Math.min(delta, 0.05)
    const { sumo } = useStore.getState()
    const p = rb.translation()
    const r = Math.hypot(p.x - SUMO.x, p.z - SUMO.z)
    if (r > OUT || p.y < TOP - 1.2) {
      gone.current = true
      onOut(index)
      return
    }
    if (sumo.countdown > 0 || !sumo.start) {
      rb.setLinvel({ x: 0, y: rb.linvel().y, z: 0 }, true)
      return
    }

    // İki aşama: önce oyuncunun merkez tarafına geç, sonra onu dışarı doğru toslayarak it.
    // Her bot biraz farklı açıdan yaklaşır; üçü aynı noktaya yığılıp birbirini dengelemez.
    const car = vehicleState.position
    let ox = car.x - SUMO.x
    let oz = car.z - SUMO.z
    let ol = Math.hypot(ox, oz)
    if (ol < 0.5) {
      // Oyuncu tam ortada: botun bulunduğu yönün tersine it
      ox = car.x - p.x
      oz = car.z - p.z
      ol = Math.hypot(ox, oz) || 1
    }
    ox /= ol
    oz /= ol
    const spread = (index - 1) * 0.45
    const ux = ox * Math.cos(spread) - oz * Math.sin(spread)
    const uz = ox * Math.sin(spread) + oz * Math.cos(spread)
    const bx = car.x - p.x
    const bz = car.z - p.z
    const behind = (bx * ux + bz * uz) / (Math.hypot(bx, bz) || 1) > 0.55
    const charge = behind && Math.hypot(bx, bz) < 7
    let tx = (charge ? car.x + ux * 3 : car.x - ux * 3.2) - p.x
    let tz = (charge ? car.z + uz * 3 : car.z - uz * 3.2) - p.z
    const tl = Math.hypot(tx, tz) || 1
    tx /= tl
    tz /= tl
    const edge = THREE.MathUtils.smoothstep(r, SUMO.radius - 3, SUMO.radius)
    tx = tx * (1 - edge) - ((p.x - SUMO.x) / (r || 1)) * edge
    tz = tz * (1 - edge) - ((p.z - SUMO.z) / (r || 1)) * edge

    // Zamanla sinirlenir: hızı artar
    const elapsed = (performance.now() - sumo.start) / 1000
    const speed = Math.min(5.5 + elapsed * 0.08, 9) * (charge ? 1.45 : 1)
    const v = rb.linvel()
    const max = BOT_ACCEL * dt
    const dvx = THREE.MathUtils.clamp(tx * speed - v.x, -max, max)
    const dvz = THREE.MathUtils.clamp(tz * speed - v.z, -max, max)
    rb.applyImpulse({ x: dvx * BOT_MASS, y: 0, z: dvz * BOT_MASS }, true)

    // Burnunu gittiği yöne çevir
    const yaw = Math.atan2(-(v.z || tz), v.x || tx)
    const q = rb.rotation()
    const current = 2 * Math.atan2(q.y, q.w)
    const diff = Math.atan2(Math.sin(yaw - current), Math.cos(yaw - current))
    rb.setAngvel({ x: 0, y: diff * 6, z: 0 }, true)
  })

  return (
    <RigidBody
      ref={body}
      name="sumoBot"
      position={start}
      rotation={[0, Math.PI - a, 0]}
      enabledRotations={[false, true, false]}
      linearDamping={0.4}
      angularDamping={2}
      colliders={false}
      ccd
    >
      <CuboidCollider args={[1.05, 0.42, 0.68]} position={[0, 0.42, 0]} mass={BOT_MASS} friction={0.25} restitution={0.35} />
      <RoundedBox args={[2.2, 0.34, 1.46]} radius={0.15} position={[0, 0.25, 0]} castShadow>
        <meshStandardMaterial color="#1d1f24" roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[1.9, 0.44, 1.2]} radius={0.14} position={[0, 0.58, 0]} castShadow>
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.2} />
      </RoundedBox>
      <mesh position={[-0.25, 1.05, 0]} castShadow>
        <sphereGeometry args={[0.26, 16, 12]} />
        <meshStandardMaterial color="#e8b48a" roughness={0.8} />
      </mesh>
      {/* Kızgın kaşlar: yönü belli etsin */}
      {[0.11, -0.11].map((z) => (
        <mesh key={z} position={[-0.02, 1.13, z]} rotation={[z > 0 ? 0.5 : -0.5, 0, 0]}>
          <boxGeometry args={[0.04, 0.04, 0.14]} />
          <meshBasicMaterial color="#16181d" />
        </mesh>
      ))}
      <mesh position={[0.6, 1.0, 0]} rotation={[0, 0, -0.3]}>
        <cylinderGeometry args={[0.02, 0.02, 0.9, 6]} />
        <meshStandardMaterial color="#9aa4b8" metalness={0.6} roughness={0.4} />
      </mesh>
    </RigidBody>
  )
}

export default function Sumo() {
  const active = useStore((s) => s.sumo.active)
  const out = useStore((s) => s.sumo.out)
  const clock = useRef({ next: 0 })

  useFrame(() => {
    const store = useStore.getState()
    const sumo = store.sumo
    const c = clock.current
    if (!sumo.active) {
      c.next = 0
      return
    }
    const now = performance.now()

    // Geri sayım: oyuncu platformun batısına alınır
    if (sumo.countdown > 0) {
      if (!c.next) {
        vehicleState.teleport = { position: [SUMO.x - 5, TOP + 1.2, SUMO.z], yaw: 0 }
        c.next = now + 1000
        if (!store.muted) playCountdown()
      } else if (now >= c.next) {
        const n = sumo.countdown - 1
        c.next = n > 0 ? now + 1000 : 0
        store.setSumo(n > 0 ? { countdown: n } : { countdown: 0, start: now })
        if (!store.muted) playCountdown(n === 0)
      }
      return
    }

    const p = vehicleState.position
    const lost = Math.hypot(p.x - SUMO.x, p.z - SUMO.z) > OUT || p.y < TOP - 1.5 || store.mode !== 'car'
    const timeUp = now - sumo.start > SUMO.limit * 1000
    if (lost || timeUp) {
      store.endSumo(false)
      store.toast(translate('sumoLost', store.lang), translate(timeUp ? 'sumoTimeUp' : 'sumoOut', store.lang))
      if (!store.muted) playThud(2)
    }
  })

  const onOut = (index) => {
    const store = useStore.getState()
    if (!store.sumo.active) return
    const next = [...store.sumo.out, index]
    store.setSumo({ out: next })
    if (!store.muted) playBoom()
    if (next.length >= SUMO.bots) {
      const best = store.sumoBest
      store.endSumo(true)
      const { sumo } = useStore.getState()
      store.toast(translate(!best || sumo.time < best ? 'sumoRecord' : 'sumoWon', store.lang), formatTime(sumo.time))
      useStore.setState({ celebrate: performance.now() }) // zafer havai fişeği
      if (!store.muted) playChime()
    } else store.toast(translate('sumoBotOut', store.lang), `${next.length} / ${SUMO.bots}`)
  }

  return (
    <>
      <Ring />
      {active &&
        Array.from({ length: SUMO.bots }, (_, i) => i)
          .filter((i) => !out.includes(i))
          .map((i) => <Bot key={i} index={i} onOut={onOut} />)}
    </>
  )
}
