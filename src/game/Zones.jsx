import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BallCollider, CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { AREAS, COLORS } from './layout.js'
import { heightAt } from './terrain.js'
import { fontBlack } from './fonts.js'
import { vehicleState } from './input.js'
import { useStore } from '../store.js'
import { translate, useT } from '../i18n.js'
import { playCheckpoint, playChime } from '../audio.js'

const area = (id) => AREAS.find((a) => a.id === id)
const isBall = (p) => p.other.rigidBodyObject?.name === 'football'

// ---------- Futbol ----------
const FIELD = { w: 36, d: 22 }

function fieldTexture() {
  const W = 1024
  const H = Math.round((W * FIELD.d) / FIELD.w)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  // Biçilmiş çim şeritleri
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 ? '#4e8a3e' : '#5a9846'
    ctx.fillRect((i * W) / 12, 0, W / 12 + 1, H)
  }
  const px = W / FIELD.w
  ctx.strokeStyle = 'rgba(255,255,255,0.92)'
  ctx.lineWidth = 0.18 * px
  const m = 0.8 * px
  ctx.strokeRect(m, m, W - 2 * m, H - 2 * m)
  ctx.beginPath()
  ctx.moveTo(W / 2, m)
  ctx.lineTo(W / 2, H - m)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(W / 2, H / 2, 3.5 * px, 0, Math.PI * 2)
  ctx.stroke()
  for (const side of [0, 1]) {
    const bw = 5 * px
    const bh = 10 * px
    const x = side ? W - m - bw : m
    ctx.strokeRect(x, H / 2 - bh / 2, bw, bh)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

// İkosahedron yüzlerinden siyah-beyaz futbol topu deseni
function ballGeometry(radius) {
  const g = new THREE.IcosahedronGeometry(radius, 2).toNonIndexed()
  const ico = new THREE.IcosahedronGeometry(1, 0)
  const corners = []
  const p = ico.attributes.position
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i).normalize()
    if (!corners.some((c) => c.distanceTo(v) < 0.01)) corners.push(v)
  }
  const pos = g.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const a = new THREE.Vector3()
  for (let i = 0; i < pos.count; i += 3) {
    a.set(0, 0, 0)
    for (let k = 0; k < 3; k++) a.add(new THREE.Vector3().fromBufferAttribute(pos, i + k))
    a.normalize()
    const dark = corners.some((c) => c.dot(a) > 0.93)
    const c = dark ? 0.08 : 0.95
    for (let k = 0; k < 3; k++) colors.set([c, c, c], (i + k) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.computeVertexNormals()
  return g
}

function Goal({ side, center }) {
  const x = center[0] + side * (FIELD.w / 2 + 0.2)
  const z = center[2]
  const y = heightAt(center[0], center[2])
  const depth = 2.4
  const width = 7.4
  const height = 2.6
  const back = x + side * depth
  const lastGoal = useRef(0)

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {/* Direkler ve üst direk */}
        <CylinderCollider args={[height / 2, 0.14]} position={[x, y + height / 2, z - width / 2]} />
        <CylinderCollider args={[height / 2, 0.14]} position={[x, y + height / 2, z + width / 2]} />
        <CuboidCollider args={[0.14, 0.14, width / 2]} position={[x, y + height, z]} />
        {/* Ağ: arka ve yan duvarlar topu tutar */}
        <CuboidCollider args={[0.1, height / 2, width / 2]} position={[back, y + height / 2, z]} />
        <CuboidCollider args={[depth / 2, height / 2, 0.1]} position={[(x + back) / 2, y + height / 2, z - width / 2]} />
        <CuboidCollider args={[depth / 2, height / 2, 0.1]} position={[(x + back) / 2, y + height / 2, z + width / 2]} />
        <CuboidCollider args={[depth / 2, 0.1, width / 2]} position={[(x + back) / 2, y + height, z]} />
        {/* Gol çizgisinin arkasında algılayıcı */}
        <CuboidCollider
          sensor
          args={[depth / 2 - 0.4, height / 2 - 0.2, width / 2 - 0.3]}
          position={[(x + back) / 2 + side * 0.3, y + height / 2, z]}
          onIntersectionEnter={(p) => {
            if (!isBall(p)) return
            const now = performance.now()
            if (now - lastGoal.current < 2500) return
            lastGoal.current = now
            const store = useStore.getState()
            store.scoreGoal()
            store.toast(translate('goalToast', store.lang), `${translate('goals', store.lang)}: ${useStore.getState().soccerSession}`)
            if (!store.muted) playChime()
            goalEvents.push({ x: (x + back) / 2, y: y + 1.5, z, at: now })
            goalResetAt.value = now + 1800
          }}
        />
      </RigidBody>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[x, y + height / 2, z + (s * width) / 2]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, height, 12]} />
          <meshStandardMaterial color="#f4f4f4" roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[x, y + height, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, width + 0.24, 12]} />
        <meshStandardMaterial color="#f4f4f4" roughness={0.4} />
      </mesh>
      {/* Ağ görseli */}
      <mesh position={[back, y + height / 2, z]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[width, height, 14, 6]} />
        <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.45} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={`n${s}`} position={[(x + back) / 2, y + height / 2, z + (s * width) / 2]}>
          <planeGeometry args={[depth, height, 5, 6]} />
          <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.45} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

// Gol olayları (konfeti için) ve top sıfırlama zamanı bileşenler arasında paylaşılır
const goalEvents = []
const goalResetAt = { value: 0 }

function Confetti() {
  const COUNT = 260
  const points = useRef()
  const state = useMemo(
    () => ({ pos: new Float32Array(COUNT * 3).fill(-999), vel: new Float32Array(COUNT * 3), life: new Float32Array(COUNT), col: new Float32Array(COUNT * 3) }),
    [],
  )
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(state.pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(state.col, 3))
    return g
  }, [state])
  const palette = useMemo(() => ['#ffb547', '#3d7bff', '#ff5d5d', '#4fd99a', '#ffffff', '#9b7bff'].map((c) => new THREE.Color(c)), [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    while (goalEvents.length) {
      const e = goalEvents.shift()
      for (let i = 0; i < COUNT; i++) {
        state.pos.set([e.x, e.y, e.z], i * 3)
        state.vel.set([(Math.random() - 0.5) * 9, 5 + Math.random() * 7, (Math.random() - 0.5) * 9], i * 3)
        state.life[i] = 2.5 + Math.random()
        const c = palette[i % palette.length]
        state.col.set([c.r, c.g, c.b], i * 3)
      }
      geometry.attributes.color.needsUpdate = true
    }
    for (let i = 0; i < COUNT; i++) {
      if (state.life[i] <= 0) continue
      state.life[i] -= dt
      state.vel[i * 3 + 1] -= 9 * dt
      state.vel[i * 3] *= 0.985
      state.vel[i * 3 + 2] *= 0.985
      for (let k = 0; k < 3; k++) state.pos[i * 3 + k] += state.vel[i * 3 + k] * dt
      if (state.life[i] <= 0) state.pos[i * 3 + 1] = -999
    }
    geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <pointsMaterial size={0.22} vertexColors sizeAttenuation />
    </points>
  )
}

function Football({ center }) {
  const body = useRef()
  const geometry = useMemo(() => ballGeometry(0.8), [])
  const home = useMemo(() => [center[0], heightAt(center[0], center[2]) + 1.4, center[2]], [center])
  const outside = useRef(0)

  // Gol sonrası ya da sahadan çok uzaklaşınca top ortaya döner
  useFrame((_, delta) => {
    const b = body.current
    if (!b) return
    const t = b.translation()
    const far = Math.hypot(t.x - center[0], t.z - center[2]) > 28 || t.y < -5
    const scoredRecently = goalResetAt.value && performance.now() > goalResetAt.value
    outside.current = far ? outside.current + delta : 0
    if (outside.current > 3 || scoredRecently) {
      b.setTranslation({ x: home[0], y: home[1], z: home[2] }, true)
      b.setLinvel({ x: 0, y: 0, z: 0 }, true)
      b.setAngvel({ x: 0, y: 0, z: 0 }, true)
      outside.current = 0
      goalResetAt.value = 0
    }
  })

  return (
    <RigidBody ref={body} name="football" colliders={false} position={home} restitution={0.7} friction={0.4} linearDamping={0.3} angularDamping={0.4} ccd>
      <BallCollider args={[0.8]} mass={0.35} />
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial vertexColors roughness={0.45} flatShading />
      </mesh>
    </RigidBody>
  )
}

function Soccer() {
  const { t } = useT()
  const a = area('soccer')
  const y = heightAt(a.center[0], a.center[2])
  const texture = useMemo(() => fieldTexture(), [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[a.center[0], y + 0.03, a.center[2]]} receiveShadow>
        <planeGeometry args={[FIELD.w + 3, FIELD.d + 3]} />
        <meshStandardMaterial map={texture} roughness={0.95} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      <Goal side={-1} center={a.center} />
      <Goal side={1} center={a.center} />
      <Football center={a.center} />
      <Confetti />
      {/* Saha kenarında alçak bantlar: top kolay kaçmaz, araba üstünden atlayabilir */}
      <RigidBody type="fixed" colliders={false}>
        {[-1, 1].map((s) => (
          <CuboidCollider key={s} args={[FIELD.w / 2 + 1.5, 0.35, 0.15]} position={[a.center[0], y + 0.35, a.center[2] + s * (FIELD.d / 2 + 1.5)]} />
        ))}
      </RigidBody>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[a.center[0], y + 0.35, a.center[2] + s * (FIELD.d / 2 + 1.5)]} castShadow>
          <boxGeometry args={[FIELD.w + 3, 0.7, 0.3]} />
          <meshStandardMaterial color={s > 0 ? '#3d7bff' : '#ffb547'} roughness={0.6} />
        </mesh>
      ))}
      <Text font={fontBlack} fontSize={1.4} color="#ffffff" rotation={[-Math.PI / 2, 0, 0]} position={[a.center[0], y + 0.06, a.center[2] - FIELD.d / 2 + 2.2]} anchorX="center">
        {t('areaSoccer').toLocaleUpperCase()}
      </Text>
    </group>
  )
}

// ---------- Drift pisti ----------
function DriftPad() {
  const a = area('drift')
  const y = heightAt(a.center[0], a.center[2])
  const cones = useMemo(() => {
    const list = []
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2
      list.push([a.center[0] + Math.cos(ang) * 7, a.center[2] + Math.sin(ang) * 7])
    }
    for (let i = 0; i < 6; i++) list.push([a.center[0] - 12 + i * 4.8, a.center[2] + 14])
    return list
  }, [a])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[a.center[0], y + 0.03, a.center[2]]} receiveShadow>
        <circleGeometry args={[a.radius - 0.5, 72]} />
        <meshStandardMaterial color="#3d424e" roughness={0.85} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      {[7, 13].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[a.center[0], y + 0.045, a.center[2]]}>
          <ringGeometry args={[r - 0.12, r + 0.12, 96]} />
          <meshStandardMaterial color="#f2efe6" roughness={0.8} polygonOffset polygonOffsetFactor={-3} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[a.center[0], y + 0.04, a.center[2]]}>
        <ringGeometry args={[a.radius - 1.1, a.radius - 0.5, 96]} />
        <meshStandardMaterial color={COLORS.coral} roughness={0.8} polygonOffset polygonOffsetFactor={-3} />
      </mesh>
      {cones.map(([x, z], i) => (
        <RigidBody key={i} colliders={false} position={[x, y + 0.4, z]} friction={0.6}>
          <CylinderCollider args={[0.38, 0.22]} mass={0.08} />
          <mesh castShadow>
            <coneGeometry args={[0.24, 0.76, 14]} />
            <meshStandardMaterial color="#ff6a1f" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.15, 0.18, 0.12, 14]} />
            <meshStandardMaterial color="#ffffff" roughness={0.5} />
          </mesh>
        </RigidBody>
      ))}
      <DriftScorer center={a.center} radius={a.radius} />
    </group>
  )
}

// Pist içinde yan kayarak puan toplanır; kayma bitince puan kasaya geçer
function DriftScorer({ center, radius }) {
  const state = useRef({ combo: 0, calm: 0, sent: 0 })
  useFrame((_, delta) => {
    const s = state.current
    const dt = Math.min(delta, 0.1)
    const inside = Math.hypot(vehicleState.position.x - center[0], vehicleState.position.z - center[2]) < radius
    const speed = Math.abs(vehicleState.speed)
    const sliding = inside && vehicleState.grounded && vehicleState.slip > 2 && speed > 5
    const store = useStore.getState()
    if (sliding) {
      const multiplier = 1 + Math.min(s.combo / 1500, 3)
      s.combo += vehicleState.slip * speed * dt * 4 * multiplier
      s.calm = 0
    } else if (s.combo > 0) {
      s.calm += dt
      if (s.calm > 0.9 || !inside) {
        if (s.combo > 150) {
          store.bankDrift(s.combo)
          store.toast(translate('driftLabel', store.lang), `${Math.round(s.combo)}`)
          if (!store.muted) playCheckpoint()
        } else store.setDrift({ combo: 0, active: false })
        s.combo = 0
        s.calm = 0
      }
    }
    // HUD'u saniyede ~10 kez güncelle
    s.sent += dt
    if (s.sent > 0.1) {
      s.sent = 0
      const active = s.combo > 0
      if (active || store.drift.active) store.setDrift({ combo: Math.round(s.combo), active })
    }
  })
  return null
}

// ---------- Arazi parkuru ----------
function OffroadRamp({ x, z, rot, length = 8, height = 2.2 }) {
  const y = heightAt(x, z)
  const angle = Math.atan2(height, length)
  const real = Math.hypot(height, length)
  return (
    <group position={[x, y, z]} rotation={[0, rot, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.2, 0.2, real / 2]} rotation={[angle, 0, 0]} position={[0, height / 2 - 0.15, 0]} />
      </RigidBody>
      <mesh rotation={[angle, 0, 0]} position={[0, height / 2 - 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.4, 0.4, real]} />
        <meshStandardMaterial color="#8a5a3b" roughness={0.9} />
      </mesh>
      {[-1.4, 0, 1.4].map((px) => (
        <mesh key={px} rotation={[angle - Math.PI / 2, 0, 0]} position={[px, height / 2 + 0.06, 0]}>
          <planeGeometry args={[0.25, real * 0.9]} />
          <meshStandardMaterial color="#ffb547" />
        </mesh>
      ))}
    </group>
  )
}

function Offroad() {
  const { t } = useT()
  const a = area('offroad')
  const [cx, , cz] = a.center
  const logs = useMemo(
    () => [
      [cx + 6, cz + 9, 0.3],
      [cx - 9, cz + 4, 1.2],
      [cx + 2, cz - 10, 2.1],
    ],
    [cx, cz],
  )
  return (
    <group>
      <OffroadRamp x={cx + 8} z={cz - 2} rot={Math.PI / 2} />
      <OffroadRamp x={cx - 6} z={cz - 8} rot={-Math.PI / 4} height={2.8} />
      <OffroadRamp x={cx - 2} z={cz + 10} rot={Math.PI} length={7} height={1.6} />
      {logs.map(([x, z, r], i) => (
        <RigidBody key={i} colliders={false} position={[x, heightAt(x, z) + 0.5, z]} rotation={[0, r, Math.PI / 2]} friction={0.8}>
          <CylinderCollider args={[1.6, 0.42]} mass={1.5} />
          <mesh castShadow>
            <cylinderGeometry args={[0.42, 0.42, 3.2, 12]} />
            <meshStandardMaterial color="#6b4a33" roughness={0.95} />
          </mesh>
        </RigidBody>
      ))}
      <Text font={fontBlack} fontSize={0.8} color="#fff6e6" outlineWidth={0.05} outlineColor="#6b4a33" position={[cx + 12, heightAt(cx + 12, cz + 12) + 2.2, cz + 12]} rotation={[0, Math.PI / 4, 0]}>
        {t('areaOffroad').toLocaleUpperCase()}
      </Text>
    </group>
  )
}

// ---------- Gözlem tepesi ----------
function Flag({ position }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(COLORS.blue) } },
        vertexShader: /* glsl */ `
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 p = position;
            p.z += sin(uv.x * 6.0 - uTime * 5.0) * 0.18 * uv.x;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          varying vec2 vUv;
          void main() {
            vec3 c = mix(uColor, vec3(1.0), step(0.42, vUv.y) * step(vUv.y, 0.58));
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }
        `,
      }),
    [],
  )
  useFrame((_, delta) => (material.uniforms.uTime.value += delta))
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[3, 0.1]} position={[0, 3, 0]} />
      </RigidBody>
      <mesh position={[0, 3, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 6, 10]} />
        <meshStandardMaterial color="#e8e8e8" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[1.1, 5.3, 0]} material={material}>
        <planeGeometry args={[2.2, 1.3, 16, 4]} />
      </mesh>
    </group>
  )
}

function Lookout() {
  const a = area('lookout')
  const [cx, , cz] = a.center
  const visited = useRef(false)
  useFrame(() => {
    if (visited.current) return
    if (Math.hypot(vehicleState.position.x - cx, vehicleState.position.z - cz) < 7) {
      visited.current = true
      useStore.getState().unlock('summit')
    }
  })
  return <Flag position={[cx - 4, heightAt(cx - 4, cz - 3), cz - 3]} />
}

export default function Zones() {
  return (
    <>
      <Soccer />
      <DriftPad />
      <Offroad />
      <Lookout />
    </>
  )
}
