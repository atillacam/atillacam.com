import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { BRIDGE, ROUNDABOUTS, TRAFFIC } from './layout.js'
import { heightAt } from './terrain.js'
import { vehicleState } from './input.js'
import { world } from './time.js'
import { useStore } from '../store.js'
import { fontBlack } from './fonts.js'
import StaticMerge from './StaticMerge.jsx'

// Çevre yolunda kendi şeridinde dolaşan araçlar. Önlerinde oyuncu ya da başka araç
// varsa yavaşlayıp durur, yol açılınca devam eder. Yarış sırasında yoldan çekilir.
const CRUISE = 8.5 // m/s
const LOOK_AHEAD = 11 // m
const STOP_GAP = 4.2 // m: önündeki engelle bırakılan mesafe
const HIDDEN_Y = -40

const _q = new THREE.Quaternion()
const _up = new THREE.Vector3(0, 1, 0)

function CarModel({ color, taxi, lights }) {
  return (
    <StaticMerge>
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.3, 0.5, 1.12]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.2} />
      </mesh>
      <mesh position={[-0.15, 0.98, 0]} castShadow>
        <boxGeometry args={[1.2, 0.4, 0.98]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.2} />
      </mesh>
      {/* Camlar */}
      <mesh position={[-0.15, 1.0, 0]}>
        <boxGeometry args={[1.22, 0.26, 1.0]} />
        <meshStandardMaterial color="#1c2430" roughness={0.15} metalness={0.4} />
      </mesh>
      {/* Tekerlekler */}
      {[
        [0.72, 0.56],
        [0.72, -0.56],
        [-0.72, 0.56],
        [-0.72, -0.56],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.3, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.2, 14]} />
          <meshStandardMaterial color="#1d1f24" roughness={0.85} />
        </mesh>
      ))}
      {/* Farlar ve stop lambaları */}
      {[0.36, -0.36].map((z) => (
        <group key={z}>
          <mesh position={[1.16, 0.6, z]} material={lights.head}>
            <boxGeometry args={[0.04, 0.12, 0.24]} />
          </mesh>
          <mesh position={[-1.16, 0.62, z]} material={lights.tail}>
            <boxGeometry args={[0.04, 0.1, 0.24]} />
          </mesh>
        </group>
      ))}
      {taxi && (
        <group position={[-0.1, 1.27, 0]}>
          <mesh>
            <boxGeometry args={[0.24, 0.16, 0.56]} />
            <meshStandardMaterial color="#16181d" roughness={0.5} />
          </mesh>
          {[1, -1].map((side) => (
            <Text
              key={side}
              font={fontBlack}
              fontSize={0.11}
              color="#f2c230"
              position={[side * 0.125, 0, 0]}
              rotation={[0, side * (Math.PI / 2), 0]}
              anchorX="center"
              anchorY="middle"
            >
              TAKSİ
            </Text>
          ))}
        </group>
      )}
    </StaticMerge>
  )
}

function NpcCar({ spec, s, cars, lights }) {
  const body = useRef()

  useFrame((_, delta) => {
    const rb = body.current
    if (!rb) return
    const dt = Math.min(delta, 0.05)
    const { race } = useStore.getState()
    const p = vehicleState.position
    // Yarışta yol yarışçıya kalır; dönüşte oyuncunun üstünde belirmesin diye yol açılmasını bekler
    const blocked = s.hidden && Math.hypot(p.x - s.x, p.z - s.z) < 6
    if (race.active || race.countdown > 0 || blocked) {
      s.hidden = true
      s.speed = 0
      rb.setNextKinematicTranslation({ x: s.x, y: HIDDEN_Y, z: s.z })
      return
    }
    s.hidden = false

    // Önümüzde engel var mı? (oyuncu ve diğer araçlar)
    let target = CRUISE
    const check = (ox, oz, width) => {
      const dx = ox - s.x
      const dz = oz - s.z
      const along = dx * s.fx + dz * s.fz
      const side = Math.abs(dx * -s.fz + dz * s.fx)
      if (along > 0 && along < LOOK_AHEAD && side < width) target = Math.min(target, Math.max(0, (along - STOP_GAP) * 1.6))
    }
    check(p.x, p.z, 2.6)
    for (const other of cars) if (other !== s && other.dir === s.dir && !other.hidden) check(other.x, other.z, 1.6)

    // Yumuşak hızlanma, kararlı fren
    const rate = target > s.speed ? 3 : 9
    s.speed += THREE.MathUtils.clamp(target - s.speed, -rate * dt, rate * dt)
    s.angle += (s.dir * s.speed * dt) / s.lane

    const c = Math.cos(s.angle)
    const n = Math.sin(s.angle)
    s.x = c * s.lane
    s.z = n * s.lane
    // Teğet: açı artarken (-sin, cos); ters yönde işaret değişir
    s.fx = -n * s.dir
    s.fz = c * s.dir
    _q.setFromAxisAngle(_up, Math.atan2(-s.fz, s.fx))
    rb.setNextKinematicTranslation({ x: s.x, y: heightAt(s.x, s.z), z: s.z })
    rb.setNextKinematicRotation(_q)
  })

  return (
    <RigidBody ref={body} name="npc" type="kinematicPosition" colliders={false} position={[Math.cos(spec.angle) * spec.lane, HIDDEN_Y, Math.sin(spec.angle) * spec.lane]}>
      <CuboidCollider args={[1.15, 0.55, 0.58]} position={[0, 0.65, 0]} />
      <CarModel color={spec.color} taxi={spec.taxi} lights={lights} />
    </RigidBody>
  )
}

export default function Traffic() {
  // Araçların canlı durumu (her kare güncellenir, React render'ı tetiklemez)
  const cars = useMemo(() => TRAFFIC.map((t) => ({ angle: t.angle, speed: CRUISE, hidden: false, x: Math.cos(t.angle) * t.lane, z: Math.sin(t.angle) * t.lane, fx: 0, fz: 0, lane: t.lane, dir: t.dir })), [])
  const lights = useMemo(
    () => ({
      head: new THREE.MeshStandardMaterial({ color: '#fff6dc', emissive: '#fff2c6', emissiveIntensity: 0.2, toneMapped: false }),
      tail: new THREE.MeshStandardMaterial({ color: '#7a1010', emissive: '#ff2a2a', emissiveIntensity: 0.3, toneMapped: false }),
    }),
    [],
  )
  // Gece farlar ve stoplar parlar
  useFrame(() => {
    lights.head.emissiveIntensity = 0.2 + world.night * 2.4
    lights.tail.emissiveIntensity = 0.3 + world.night * 1.6
  })
  return TRAFFIC.map((spec, i) => <NpcCar key={i} spec={spec} s={cars[i]} cars={cars} lights={lights} />)
}

// ---------- Köprü trafiği ----------
// Kapalı döngü: Avrupa kavşağı → köprü (doğuya, +z şeridi) → Asya meydanında çeşmenin çevresi →
// köprü (batıya, -z şeridi) → Avrupa kavşağı. Araçlar hiç kaybolmaz; göbek kavşaklarda U dönüşü yapar.
// Sağdan akış: göbek her zaman sürücünün solunda kalır.
const BRIDGE_CRUISE = 9.5
const LANE = 1.8

function bridgeProfile(x, z) {
  const { startX, deckStart, deckEnd, endX, deckY } = BRIDGE
  if (Math.abs(z - BRIDGE.z) > 3 || x <= startX || x >= endX) return heightAt(x, z)
  if (x < deckStart) return ((x - startX) / (deckStart - startX)) * deckY
  if (x > deckEnd) return ((endX - x) / (endX - deckEnd)) * deckY
  return deckY
}

// Rota noktaları (1 m aralık) ve birikimli uzunluk
const LOOP = (() => {
  const pts = []
  const line = (x0, x1, z) => {
    const n = Math.ceil(Math.abs(x1 - x0))
    for (let i = 0; i < n; i++) pts.push([x0 + ((x1 - x0) * i) / n, z])
  }
  // Çember yayı: açı a0'dan a1'e (atan2(z, x) uzayında azalarak)
  const arc = (c, r, a0, a1) => {
    const n = Math.ceil((Math.abs(a1 - a0) * r) / 1)
    for (let i = 0; i < n; i++) {
      const a = a0 + ((a1 - a0) * i) / n
      pts.push([c.x + Math.cos(a) * r, c.z + Math.sin(a) * r])
    }
  }
  const eu = ROUNDABOUTS.europe
  const as = ROUNDABOUTS.asia
  const euEnter = Math.asin(LANE / eu.lane) // kavşağa giriş/çıkış açısı
  const asEnter = Math.asin(LANE / as.lane)
  const euEdge = eu.x + Math.cos(euEnter) * eu.lane
  const asEdge = as.x - Math.cos(asEnter) * as.lane
  line(euEdge, asEdge, BRIDGE.z + LANE) // doğuya
  arc(as, as.lane, Math.PI - asEnter, -Math.PI + asEnter) // çeşmenin çevresi (güneyden doğuya, kuzeye)
  line(asEdge, euEdge, BRIDGE.z - LANE) // batıya
  arc(eu, eu.lane, -euEnter, -2 * Math.PI + euEnter) // Avrupa kavşağı (kuzeyden batıya, güneye)
  const cum = [0]
  for (let i = 1; i <= pts.length; i++) {
    const [ax, az] = pts[i - 1]
    const [bx, bz] = pts[i % pts.length]
    cum.push(cum[i - 1] + Math.hypot(bx - ax, bz - az))
  }
  return { pts, cum, length: cum[pts.length] }
})()

// Döngüde d mesafesindeki nokta ve yön
function loopAt(d, out) {
  const { pts, cum, length } = LOOP
  d = ((d % length) + length) % length
  let lo = 0
  let hi = pts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (cum[mid] <= d) lo = mid
    else hi = mid - 1
  }
  const [ax, az] = pts[lo]
  const [bx, bz] = pts[(lo + 1) % pts.length]
  const t = (d - cum[lo]) / Math.max(cum[lo + 1] - cum[lo], 1e-6)
  out.x = ax + (bx - ax) * t
  out.z = az + (bz - az) * t
  const len = Math.hypot(bx - ax, bz - az) || 1
  out.fx = (bx - ax) / len
  out.fz = (bz - az) / len
  return out
}

const BRIDGE_COLORS = [
  { color: '#d8322f' },
  { color: '#f2c230', taxi: true },
  { color: '#2f6fe0' },
  { color: '#f2f2f0' },
  { color: '#2fae8a' },
  { color: '#24262c' },
  { color: '#e0a98a' },
  { color: '#f2c230', taxi: true },
]

function BridgeCar({ s, cars, lights }) {
  const body = useRef()
  const here = useMemo(() => ({}), [])
  const ahead = useMemo(() => ({}), [])
  useFrame((_, delta) => {
    const rb = body.current
    if (!rb) return
    const dt = Math.min(delta, 0.05)
    loopAt(s.d, here)
    // Önde engel varsa yavaşla: oyuncu (yön ve şerit genişliğine göre) ve döngüde öndeki araç
    let target = BRIDGE_CRUISE
    const p = vehicleState.position
    const dx = p.x - here.x
    const dz = p.z - here.z
    const along = dx * here.fx + dz * here.fz
    const side = Math.abs(dx * -here.fz + dz * here.fx)
    if (along > 0 && along < LOOK_AHEAD && side < 2.4) target = Math.max(0, (along - STOP_GAP) * 1.6)
    for (const o of cars) {
      if (o === s) continue
      const gap = (((o.d - s.d) % LOOP.length) + LOOP.length) % LOOP.length
      if (gap < LOOK_AHEAD) target = Math.min(target, Math.max(0, (gap - STOP_GAP) * 1.6))
    }
    const rate = target > s.speed ? 3 : 9
    s.speed += THREE.MathUtils.clamp(target - s.speed, -rate * dt, rate * dt)
    s.d = (s.d + s.speed * dt) % LOOP.length
    loopAt(s.d, here)
    loopAt(s.d + 1.2, ahead)
    // Yükseklik ve eğim: köprü profili ya da arazi
    const y = bridgeProfile(here.x, here.z)
    const yAhead = bridgeProfile(ahead.x, ahead.z)
    const pitch = Math.atan2(yAhead - y, 1.2)
    _e.set(0, Math.atan2(-here.fz, here.fx), pitch, 'YXZ')
    _q.setFromEuler(_e)
    rb.setNextKinematicTranslation({ x: here.x, y, z: here.z })
    rb.setNextKinematicRotation(_q)
  })
  return (
    <RigidBody ref={body} name="npc" type="kinematicPosition" colliders={false} position={[0, -40, 0]}>
      <CuboidCollider args={[1.15, 0.55, 0.58]} position={[0, 0.65, 0]} />
      <CarModel color={s.color} taxi={s.taxi} lights={lights} />
    </RigidBody>
  )
}

const _e = new THREE.Euler()

export function BridgeTraffic() {
  // Araçlar döngüye eşit aralıkla dizilir
  const cars = useMemo(() => BRIDGE_COLORS.map((c, i) => ({ ...c, d: (i / BRIDGE_COLORS.length) * LOOP.length, speed: BRIDGE_CRUISE })), [])
  const lights = useMemo(
    () => ({
      head: new THREE.MeshStandardMaterial({ color: '#fff6dc', emissive: '#fff2c6', emissiveIntensity: 0.2, toneMapped: false }),
      tail: new THREE.MeshStandardMaterial({ color: '#7a1010', emissive: '#ff2a2a', emissiveIntensity: 0.3, toneMapped: false }),
    }),
    [],
  )
  useFrame(() => {
    lights.head.emissiveIntensity = 0.2 + world.night * 2.4
    lights.tail.emissiveIntensity = 0.3 + world.night * 1.6
  })
  return cars.map((s, i) => <BridgeCar key={i} s={s} cars={cars} lights={lights} />)
}
