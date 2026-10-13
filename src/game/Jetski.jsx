import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { input, vehicleState } from './input.js'
import { BRIDGE, JETSKI, PIERS, SLALOM, STRAIT, WORLD } from './layout.js'
import { heightAt } from './terrain.js'
import { world } from './time.js'
import { ferryLive, FERRY_LENGTH, passengerLive } from './ferry.js'
import { fontBlack } from './fonts.js'
import { useStore } from '../store.js'
import { playCheckpoint, playSplash, playThud } from '../audio.js'
import StaticMerge from './StaticMerge.jsx'
import Halo from './Halo.jsx'

// Jet-ski: Asya kumsalındaki kulübeden kiralanır, Boğaz'da serbestçe sürülür. Suda kayar (yanal kayma yavaş
// söner), dalgalarla sallanır, dönüşte yatar, arkasından su fışkırtır ve köpüklü iz bırakır. Boşluk: zıpla.
// Kıyılara, iskelelere, köprü ayaklarına, vapurlara ve şamandıralara çarpar (sekerek).
// Slalom: ilk şamandıra kapısından geçince süre başlar, kapılar sırayla geçilir.

const SHALLOW = STRAIT.seaLevel - 0.45 // bundan sığ yerde jet-ski karaya oturur
const GRAVITY = 14
const HOP = 5.2
const _fwd = new THREE.Vector3()
const _right = new THREE.Vector3()
const _cam = new THREE.Vector3()
const _look = new THREE.Vector3()
const _e = new THREE.Euler(0, 0, 0, 'YXZ')
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _c = new THREE.Color()

// Model: yerel eksen arabayla aynı (ileri = +x). rider: sürücü figürü
function buildJetski(rider) {
  const root = new THREE.Group()
  const white = new THREE.MeshPhysicalMaterial({ color: '#f4f6fa', roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.2 })
  const teal = new THREE.MeshPhysicalMaterial({ color: '#16b3a3', roughness: 0.35, metalness: 0.2, clearcoat: 1 })
  const dark = new THREE.MeshStandardMaterial({ color: '#1d2230', roughness: 0.6, metalness: 0.3 })
  const add = (geometry, material, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geometry, material)
    m.position.set(x, y, z)
    m.rotation.set(rx, ry, rz)
    m.castShadow = true
    root.add(m)
    return m
  }
  add(new RoundedBoxGeometry(2.7, 0.5, 1.05, 3, 0.2), white, -0.1, 0.22, 0)
  add(new RoundedBoxGeometry(1.1, 0.4, 0.9, 3, 0.18), white, 1.25, 0.32, 0, 0, 0, -0.22) // burun
  add(new RoundedBoxGeometry(2.75, 0.14, 1.1, 2, 0.06), teal, -0.1, 0.06, 0) // alt şerit
  add(new RoundedBoxGeometry(1.25, 0.26, 0.55, 2, 0.1), dark, -0.35, 0.58, 0) // sele
  add(new THREE.CylinderGeometry(0.07, 0.09, 0.55, 8), dark, 0.62, 0.7, 0, 0, 0, -0.5) // direksiyon kolonu
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.85, 8), dark, 0.75, 0.95, 0, Math.PI / 2, 0, 0) // gidon
  add(new RoundedBoxGeometry(0.45, 0.22, 0.75, 2, 0.08), teal, 0.62, 0.55, 0) // gösterge kaputu
  if (rider) {
    const vest = new THREE.MeshStandardMaterial({ color: '#ff7a1a', roughness: 0.7 })
    const skin = new THREE.MeshStandardMaterial({ color: '#d9a07a', roughness: 0.8 })
    const helmet = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.25, clearcoat: 1 })
    const legs = new THREE.MeshStandardMaterial({ color: '#23324d', roughness: 0.8 })
    add(new THREE.CapsuleGeometry(0.24, 0.45, 4, 10), vest, -0.15, 1.15, 0, 0, 0, -0.35) // gövde (öne eğik)
    add(new THREE.SphereGeometry(0.19, 14, 10), skin, 0.08, 1.62, 0)
    add(new THREE.SphereGeometry(0.205, 14, 10, 0, Math.PI * 2, 0, Math.PI / 1.8), helmet, 0.06, 1.66, 0, 0, 0, -0.2)
    for (const side of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.065, 0.06, 0.6, 6), skin, 0.38, 1.12, side * 0.3, side * 0.35, 0, -1.05) // kollar
      add(new THREE.CapsuleGeometry(0.1, 0.42, 4, 8), legs, -0.05, 0.72, side * 0.3, 0, 0, -1.25) // bacaklar
    }
  }
  return root
}

// ---------- Kiralama kulübesi ve yüzer iskele ----------
export function JetskiDock() {
  const { hut, launch } = JETSKI
  const y = heightAt(hut.x, hut.z)
  const moored = useMemo(() => [buildJetski(false), buildJetski(false)], [])
  const dock = { from: STRAIT.beachEast + 0.5, to: launch.x + 2.4, z: launch.z, deck: STRAIT.seaLevel + 0.55 }
  const dockLen = dock.from - dock.to
  const bob = useRef([])
  useFrame(() => {
    const t = performance.now() / 1000
    bob.current.forEach((g, i) => {
      if (!g) return
      g.position.y = STRAIT.seaLevel - 0.12 + Math.sin(t * 1.6 + i * 1.7) * 0.06
      g.rotation.x = Math.sin(t * 1.3 + i) * 0.04
    })
  })
  return (
    <group>
      {/* Kulübe: ahşap, çizgili tente, sörf tahtaları */}
      <group position={[hut.x, y, hut.z]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[1.3, 1.3, 1.6]} position={[0, 1.3, 0]} />
        </RigidBody>
        <StaticMerge>
          <mesh position={[0, 1.25, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.6, 2.5, 3.2]} />
            <meshStandardMaterial color="#c98f5a" roughness={0.85} />
          </mesh>
          <mesh position={[0, 2.62, 0]} castShadow>
            <boxGeometry args={[3, 0.22, 3.6]} />
            <meshStandardMaterial color="#f4f1ea" roughness={0.8} />
          </mesh>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <mesh key={i} position={[1.85, 2.2, -1.5 + i * 0.6]} rotation={[0, 0, -0.45]} castShadow>
              <boxGeometry args={[1.1, 0.05, 0.6]} />
              <meshStandardMaterial color={i % 2 ? '#f4f1ea' : '#16b3a3'} roughness={0.8} />
            </mesh>
          ))}
          {[['#ff5d73', -0.9], ['#ffb547', -0.3], ['#5bb8ff', 0.3]].map(([color, dz]) => (
            <mesh key={color} position={[-1.5, 1.2, dz]} rotation={[0, 0, 0.18]} castShadow>
              <capsuleGeometry args={[0.24, 1.9, 4, 8]} />
              <meshStandardMaterial color={color} roughness={0.5} />
            </mesh>
          ))}
        </StaticMerge>
        <Text font={fontBlack} fontSize={0.42} color="#16b3a3" position={[1.31, 1.75, 0]} rotation={[0, Math.PI / 2, 0]} anchorX="center" anchorY="middle">
          JET-SKİ
        </Text>
      </group>
      {/* Yüzer iskele: kumsaldan denize */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[dockLen / 2, 0.15, 1.1]} position={[(dock.from + dock.to) / 2, dock.deck - 0.15, dock.z]} />
      </RigidBody>
      <StaticMerge>
        <mesh position={[(dock.from + dock.to) / 2, dock.deck - 0.15, dock.z]} castShadow receiveShadow>
          <boxGeometry args={[dockLen, 0.3, 2.2]} />
          <meshStandardMaterial color="#a9825e" roughness={0.9} />
        </mesh>
        {Array.from({ length: Math.floor(dockLen / 1.6) }, (_, i) => (
          <mesh key={i} position={[dock.to + 0.8 + i * 1.6, dock.deck - 0.45, dock.z + 1.15]}>
            <cylinderGeometry args={[0.22, 0.22, 0.5, 10]} />
            <meshStandardMaterial color="#f4f1ea" roughness={0.6} />
          </mesh>
        ))}
      </StaticMerge>
      {/* İskeleye bağlı iki jet-ski */}
      {moored.map((model, i) => (
        <group
          key={i}
          ref={(el) => {
            bob.current[i] = el
          }}
          position={[dock.to + 1.5 + i * 3.2, STRAIT.seaLevel, dock.z - 2.1]}
          rotation={[0, Math.PI, 0]}
        >
          <primitive object={model} />
        </group>
      ))}
    </group>
  )
}

// ---------- Slalom şamandıraları ----------
// Her kapı iki şamandıra; sıradaki kapının üstünde parlayan pankart
const BUOYS = SLALOM.flatMap((g, i) => [-1, 1].map((side) => ({ x: g.x + side * g.half, z: g.z, gate: i })))

export function SlalomCourse() {
  const buoys = useRef()
  const tops = useRef()
  const banner = useRef()
  const next = useStore((s) => s.slalom.next)
  const text = next === 0 ? 'START' : next === SLALOM.length - 1 ? 'FINISH' : `${next + 1}/${SLALOM.length}`
  useLayoutEffect(() => {
    BUOYS.forEach((b, i) => {
      buoys.current.setColorAt(i, _c.set(b.gate % 2 ? '#ff5d3d' : '#ffb547'))
    })
    buoys.current.instanceColor.needsUpdate = true
  }, [])
  useFrame(() => {
    const t = performance.now() / 1000
    BUOYS.forEach((b, i) => {
      const y = STRAIT.seaLevel + Math.sin(t * 1.8 + i * 0.9) * 0.08
      _q.setFromEuler(_e.set(Math.sin(t * 1.4 + i) * 0.08, 0, Math.cos(t * 1.2 + i) * 0.08))
      buoys.current.setMatrixAt(i, _m.compose(_p.set(b.x, y + 0.35, b.z), _q, _s.set(1, 1, 1)))
      tops.current.setMatrixAt(i, _m.compose(_p.set(b.x, y + 1.15, b.z), _q, _s.set(1, 1, 1)))
    })
    buoys.current.instanceMatrix.needsUpdate = true
    tops.current.instanceMatrix.needsUpdate = true
    // Sıradaki kapı (yalnızca jet-skideyken)
    const store = useStore.getState()
    const g = banner.current
    if (!g) return
    g.visible = store.mode === 'jetski'
    if (!g.visible) return
    const gate = SLALOM[Math.min(store.slalom.next, SLALOM.length - 1)]
    g.position.set(gate.x, STRAIT.seaLevel + Math.sin(t * 2) * 0.05, gate.z)
    const pulse = 0.65 + 0.35 * Math.sin(t * 6)
    g.children[0].material.emissiveIntensity = 1.2 + pulse * 1.5
  })
  const width = SLALOM[0].half * 2
  return (
    <>
      <instancedMesh ref={buoys} args={[undefined, undefined, BUOYS.length]} castShadow>
        <cylinderGeometry args={[0.55, 0.65, 0.9, 14]} />
        <meshStandardMaterial roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={tops} args={[undefined, undefined, BUOYS.length]}>
        <coneGeometry args={[0.4, 0.8, 12]} />
        <meshStandardMaterial color="#ffffff" roughness={0.5} />
      </instancedMesh>
      <group ref={banner} visible={false}>
        <mesh position={[0, 3.2, 0]}>
          <boxGeometry args={[width, 0.55, 0.12]} />
          <meshStandardMaterial color="#16b3a3" emissive="#2ee6d0" emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[(side * width) / 2, 2.2, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 2.4, 6]} />
            <meshStandardMaterial color="#ffffff" roughness={0.4} />
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <Text key={side} font={fontBlack} fontSize={0.42} color="#ffffff" position={[0, 3.2, side * 0.08]} rotation={[0, side > 0 ? 0 : Math.PI, 0]} anchorX="center" anchorY="middle">
            {text}
          </Text>
        ))}
        <Halo position={[0, 3.2, 0]} scale={7} color="#2ee6d0" dayOpacity={0.35} />
      </group>
    </>
  )
}

// ---------- Engeller ----------
const BOXES = [
  // İskeleler (x aralığı, z aralığı)
  [PIERS.europe.from, PIERS.europe.to, PIERS.z - PIERS.width / 2, PIERS.z + PIERS.width / 2],
  [PIERS.asia.to, PIERS.asia.from, PIERS.z - PIERS.width / 2, PIERS.z + PIERS.width / 2],
  // Kiralama iskelesi
  [JETSKI.launch.x + 2.4, STRAIT.beachEast + 0.5, JETSKI.launch.z - 1.1, JETSKI.launch.z + 1.1],
]
const CIRCLES = [
  ...BRIDGE.towers.flatMap((x) => [-1, 1].map((side) => ({ x, z: BRIDGE.z + side * (BRIDGE.width / 2 + 1.4), r: 1.3 }))),
  ...BUOYS.map((b) => ({ x: b.x, z: b.z, r: 0.75 })),
]

// Konumu engellerin dışına iter; çarpma hızını döndürür (ses ve köpük için)
function collide(p, v, radius) {
  let hit = 0
  const push = (nx, nz, depth) => {
    p.x += nx * depth
    p.z += nz * depth
    const vn = v.x * nx + v.z * nz
    if (vn < 0) {
      v.x -= 1.4 * vn * nx
      v.z -= 1.4 * vn * nz
      hit = Math.max(hit, -vn)
    }
  }
  for (const c of CIRCLES) {
    const dx = p.x - c.x
    const dz = p.z - c.z
    const d = Math.hypot(dx, dz)
    if (d < c.r + radius && d > 1e-4) push(dx / d, dz / d, c.r + radius - d)
  }
  const box = (x0, x1, z0, z1) => {
    if (p.x < x0 - radius || p.x > x1 + radius || p.z < z0 - radius || p.z > z1 + radius) return
    const pen = [
      [-1, 0, p.x - (x0 - radius)],
      [1, 0, x1 + radius - p.x],
      [0, -1, p.z - (z0 - radius)],
      [0, 1, z1 + radius - p.z],
    ].sort((a, b) => a[2] - b[2])[0]
    push(pen[0], pen[1], pen[2])
  }
  for (const [x0, x1, z0, z1] of BOXES) box(x0, x1, z0, z1)
  // Araba vapurları (x ekseni boyunca) ve yolcu vapurları (yönlü)
  for (const f of ferryLive) box(f.x - FERRY_LENGTH / 2, f.x + FERRY_LENGTH / 2, f.z - 2.2, f.z + 2.2)
  for (const f of passengerLive) {
    const fx = Math.cos(f.yaw)
    const fz = -Math.sin(f.yaw)
    const dx = p.x - f.x
    const dz = p.z - f.z
    const along = dx * fx + dz * fz
    const across = -dx * fz + dz * fx
    const pa = f.half + radius - Math.abs(along)
    const pc = f.beam + radius - Math.abs(across)
    if (pa > 0 && pc > 0) {
      if (pa < pc) push(fx * Math.sign(along), fz * Math.sign(along), pa)
      else push(-fz * Math.sign(across), fx * Math.sign(across), pc)
    }
  }
  return hit
}

// ---------- Köpük: fışkıran damlalar ve iz halkaları ----------
const SPRAY = 90
const WAKE = 36

// ---------- Sürüş ----------
export default function Jetski() {
  const camera = useThree((s) => s.camera)
  const group = useRef()
  const tilt = useRef()
  const spray = useRef()
  const wake = useRef()
  const model = useMemo(() => buildJetski(true), [])
  const s = useRef({
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    y: 0,
    vy: 0,
    yaw: 0,
    yawRate: 0,
    roll: 0,
    pitch: 0,
    active: false,
    hopHeld: false,
    look: new THREE.Vector3(),
    wakeClock: 0,
  })
  const drops = useMemo(() => Array.from({ length: SPRAY }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, size: 0 })), [])
  const rings = useMemo(() => Array.from({ length: WAKE }, () => ({ x: 0, z: 0, yaw: 0, life: 0 })), [])
  const cursor = useRef({ drop: 0, ring: 0 })

  // Geliştirmede test için durum erişimi
  useEffect(() => {
    if (import.meta.env.DEV && window.__portfolio) window.__portfolio.jetski = s.current
  }, [])

  // Moda girince iskelenin ucundan başla
  useEffect(
    () =>
      useStore.subscribe((st, prev) => {
        if (st.mode === 'jetski' && prev.mode !== 'jetski') {
          const j = s.current
          j.pos.set(JETSKI.launch.x, STRAIT.seaLevel, JETSKI.launch.z)
          j.vel.set(0, 0, 0)
          j.y = 0
          j.vy = 0
          j.yaw = JETSKI.launch.yaw
          j.yawRate = 0
          j.active = true
          j.look.copy(j.pos)
          if (!st.muted) playSplash()
        }
      }),
    [],
  )

  const emitDrop = (x, y, z, vx, vy, vz, size) => {
    const d = drops[cursor.current.drop]
    cursor.current.drop = (cursor.current.drop + 1) % SPRAY
    d.p.set(x, y, z)
    d.v.set(vx, vy, vz)
    d.life = 1
    d.size = size
  }

  useFrame((_, delta) => {
    const dt = THREE.MathUtils.clamp(delta, 0, 0.05)
    const store = useStore.getState()
    const j = s.current
    const g = group.current
    const on = store.mode === 'jetski'
    if (g) g.visible = on
    if (!on) {
      j.active = false
      if (spray.current) spray.current.visible = false
      if (wake.current) wake.current.visible = false
      return
    }
    spray.current.visible = true
    wake.current.visible = true

    const usable = store.started && !store.modal
    const k = input.keys
    let throttle = usable ? (k.forward ? 1 : 0) - (k.backward ? 1 : 0) : 0
    let turn = usable ? (k.left ? 1 : 0) - (k.right ? 1 : 0) : 0
    let boost = usable && k.boost
    if (input.touch.active && usable) {
      throttle = input.touch.throttle
      turn = input.touch.steer
      boost ||= input.touch.boost
    }
    const hop = usable && k.up
    const airborne = j.y > 0.02

    // İleri hız istenen hıza yaklaşır; yanal kayma yavaşça söner (suda kayma hissi)
    _fwd.set(Math.cos(j.yaw), 0, -Math.sin(j.yaw))
    _right.set(-_fwd.z, 0, _fwd.x)
    const max = boost ? JETSKI.boost : JETSKI.top
    let along = j.vel.dot(_fwd)
    let side = j.vel.dot(_right)
    const target = throttle > 0 ? throttle * max : throttle < 0 ? throttle * 6 : 0
    if (!airborne) along += (target - along) * (1 - Math.exp(-(throttle ? (boost ? 1.4 : 1.0) : 0.55) * dt))
    side *= Math.exp(-(airborne ? 0.3 : 2.4) * dt)
    j.vel.copy(_fwd).multiplyScalar(along).addScaledVector(_right, side)

    // Dönüş: hızla güçlenir, çok hızlıyken biraz yumuşar; geri giderken ters
    const grip = Math.min(1, Math.abs(along) / 4 + 0.25) * (1 - Math.min(Math.abs(along) / max, 1) * 0.3)
    const yawTarget = turn * 1.9 * grip * (along < -0.5 ? -1 : 1) * (airborne ? 0.4 : 1)
    j.yawRate += (yawTarget - j.yawRate) * (1 - Math.exp(-5 * dt))
    j.yaw += j.yawRate * dt

    // Zıplama
    if (hop && !j.hopHeld && !airborne) {
      j.vy = HOP + Math.min(Math.abs(along), max) * 0.06
      if (!store.muted) playSplash()
    }
    j.hopHeld = hop
    j.vy -= GRAVITY * dt
    j.y += j.vy * dt
    if (j.y <= 0) {
      if (j.vy < -5) {
        if (!store.muted) playSplash()
        for (let i = 0; i < 14; i++) emitDrop(j.pos.x, STRAIT.seaLevel + 0.2, j.pos.z, (Math.random() - 0.5) * 6, 2 + Math.random() * 3, (Math.random() - 0.5) * 6, 0.14)
      }
      j.y = 0
      j.vy = 0
    }

    // Hareket ve engeller
    const prevZ = j.pos.z
    const prevX = j.pos.x
    j.pos.addScaledVector(j.vel, dt)
    // Sığ su: kıyıya çıkamaz (kanal x ekseninde; kıyıya doğru hız sıfırlanır, biraz seker)
    if (heightAt(j.pos.x, j.pos.z) > SHALLOW) {
      const toCenter = Math.sign(STRAIT.centerX - j.pos.x)
      j.pos.x = prevX
      if (heightAt(j.pos.x, j.pos.z) > SHALLOW) j.pos.x += toCenter * 0.3
      if (j.vel.x * toCenter < 0) {
        if (Math.abs(j.vel.x) > 5 && !store.muted) playThud(Math.min(1, Math.abs(j.vel.x) / 15))
        j.vel.x *= -0.3
      }
    }
    const limit = WORLD.maxZ - 6
    if (Math.abs(j.pos.z) > limit) {
      j.pos.z = Math.sign(j.pos.z) * limit
      j.vel.z *= -0.3
    }
    const hit = j.y < 2 ? collide(j.pos, j.vel, 0.9) : 0
    if (hit > 4 && !store.muted) playThud(Math.min(1, hit / 14))

    // Slalom kapıları: güneye (+z) doğru, iki şamandıranın arasından geçiş
    const crossed = (gate) => prevZ < gate.z && j.pos.z >= gate.z && Math.abs(THREE.MathUtils.lerp(prevX, j.pos.x, (gate.z - prevZ) / (j.pos.z - prevZ)) - gate.x) < gate.half
    if (crossed(SLALOM[0])) store.startSlalom()
    else if (store.slalom.next > 0 && crossed(SLALOM[store.slalom.next])) {
      if (!store.muted) playCheckpoint()
      store.passGate(store.slalom.next)
    }

    // Dalgalarla sallanma, dönüşte yatma, hızlanırken burun kalkması
    const t = performance.now() / 1000
    const speed = Math.hypot(j.vel.x, j.vel.z)
    const chop = Math.sin(t * 2.3 + j.pos.x * 0.3) * 0.06 + Math.sin(t * 3.7 + j.pos.z * 0.4) * 0.04
    const bounce = speed > 6 && !airborne ? Math.abs(Math.sin(t * (6 + speed * 0.25))) * Math.min(speed / 30, 1) * 0.12 : 0
    j.roll += (-j.yawRate * Math.min(speed / 14, 1) * 0.42 - j.roll) * (1 - Math.exp(-6 * dt))
    const pitchTarget = airborne ? THREE.MathUtils.clamp(j.vy * 0.05, -0.3, 0.25) : Math.min(speed / max, 1) * 0.1 + throttle * 0.05
    j.pitch += (pitchTarget - j.pitch) * (1 - Math.exp(-5 * dt))
    const baseY = STRAIT.seaLevel - 0.1 + chop + bounce + j.y
    g.position.set(j.pos.x, baseY, j.pos.z)
    _e.set(0, j.yaw, 0)
    g.quaternion.setFromEuler(_e)
    tilt.current.rotation.set(j.roll + Math.sin(t * 1.7) * 0.03, 0, j.pitch + Math.sin(t * 2.1) * 0.02)

    // Fışkıran su: arkadan horoz kuyruğu, dönüşte yandan perde
    if (!airborne && speed > 2) {
      const n = Math.random() < 0.5 + Math.min(speed / 40, 0.5) ? 1 : 0
      for (let i = 0; i < n; i++) {
        emitDrop(j.pos.x - _fwd.x * 1.4, STRAIT.seaLevel + 0.2, j.pos.z - _fwd.z * 1.4, -_fwd.x * speed * 0.25 + (Math.random() - 0.5) * 1.5, 1.5 + speed * 0.16 * Math.random() + (boost ? 2 : 0), -_fwd.z * speed * 0.25 + (Math.random() - 0.5) * 1.5, 0.09 + Math.random() * 0.09)
      }
      if (Math.abs(j.yawRate) > 0.6 && speed > 8) {
        const out = -Math.sign(j.yawRate)
        if (Math.random() < 0.6) emitDrop(j.pos.x + _right.x * out * 0.6, STRAIT.seaLevel + 0.25, j.pos.z + _right.z * out * 0.6, _right.x * out * 5 + (Math.random() - 0.5), 2.5 + Math.random() * 2, _right.z * out * 5 + (Math.random() - 0.5), 0.12)
      }
    }
    // İz halkaları
    j.wakeClock += dt
    if (!airborne && speed > 3 && j.wakeClock > 0.07) {
      j.wakeClock = 0
      const r = rings[cursor.current.ring]
      cursor.current.ring = (cursor.current.ring + 1) % WAKE
      r.x = j.pos.x - _fwd.x * 1.2
      r.z = j.pos.z - _fwd.z * 1.2
      r.yaw = j.yaw
      r.life = 1
    }
    for (let i = 0; i < SPRAY; i++) {
      const d = drops[i]
      if (d.life > 0) {
        d.life -= dt * 1.8
        d.v.y -= 9.8 * dt
        d.p.addScaledVector(d.v, dt)
        if (d.p.y < STRAIT.seaLevel) d.life = 0
      }
      const sc = d.life > 0 ? d.size * (0.6 + d.life * 0.6) : 0
      spray.current.setMatrixAt(i, _m.compose(d.p, _q.identity(), _s.set(sc, sc, sc)))
    }
    spray.current.instanceMatrix.needsUpdate = true
    for (let i = 0; i < WAKE; i++) {
      const r = rings[i]
      if (r.life > 0) r.life -= dt * 0.55
      const life = Math.max(0, r.life)
      const grow = 1 + (1 - life) * 3.2
      _q.setFromEuler(_e.set(0, r.yaw, 0))
      wake.current.setMatrixAt(i, _m.compose(_p.set(r.x, STRAIT.seaLevel + 0.03 + i * 0.0004, r.z), _q, _s.set(life > 0 ? 0.9 + (1 - life) * 1.2 : 0, 1, life > 0 ? grow : 0)))
      wake.current.setColorAt(i, _c.setScalar(life * 0.55))
    }
    wake.current.instanceMatrix.needsUpdate = true
    wake.current.instanceColor.needsUpdate = true

    // Canlı durum: harita, GPS, hız göstergesi, motor sesi
    vehicleState.position.x = j.pos.x
    vehicleState.position.y = baseY
    vehicleState.position.z = j.pos.z
    vehicleState.heading = j.yaw
    vehicleState.speed = along
    vehicleState.jetThrottle = Math.abs(throttle)
    vehicleState.altitude = j.y
    vehicleState.grounded = !airborne
    world.uniforms.uCar.value.set(j.pos.x, baseY, j.pos.z)

    // Takip kamerası: arkadan, alçaktan; hızlandıkça biraz uzaklaşır
    const dist = 8 + Math.min(speed, JETSKI.boost) * 0.12
    _cam.set(j.pos.x - _fwd.x * dist, baseY + 3.1 + dist * 0.08, j.pos.z - _fwd.z * dist)
    _cam.y = Math.max(_cam.y, heightAt(_cam.x, _cam.z) + 1.2, STRAIT.seaLevel + 1.2)
    camera.position.lerp(_cam, 1 - Math.exp(-4 * dt))
    _look.set(j.pos.x + _fwd.x * 5, baseY + 0.8, j.pos.z + _fwd.z * 5)
    j.look.lerp(_look, 1 - Math.exp(-6 * dt))
    camera.lookAt(j.look)
    vehicleState.cameraYaw = Math.atan2(j.look.x - camera.position.x, j.look.z - camera.position.z)
  })

  const wakeGeo = useMemo(() => new THREE.RingGeometry(0.55, 0.85, 20).rotateX(-Math.PI / 2), [])
  return (
    <>
      <group ref={group} visible={false}>
        <group ref={tilt}>
          <primitive object={model} />
        </group>
      </group>
      <instancedMesh ref={spray} args={[undefined, undefined, SPRAY]} frustumCulled={false} visible={false}>
        <sphereGeometry args={[1, 6, 5]} />
        <meshStandardMaterial color="#f4fbff" roughness={0.3} transparent opacity={0.7} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={wake} args={[wakeGeo, undefined, WAKE]} frustumCulled={false} visible={false}>
        <meshBasicMaterial color="#ffffff" transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </>
  )
}
