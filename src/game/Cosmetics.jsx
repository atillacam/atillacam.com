import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { findItem } from './shop.js'
import { vehicleState } from './input.js'
import { world } from './time.js'
import { heightAt } from './terrain.js'
import { useStore } from '../store.js'
import { Flag } from './Istanbul.jsx'

// Garaj dükkânının görsel eşyaları: neon taban ışığı, tavan aksesuarları ve iz efektleri.

// Araç izdüşümü biçiminde yumuşak ışık: yuvarlatılmış dikdörtgene uzaklığa göre sönen beyaz leke
// (renk malzemeden gelir). Elips yerine arabanın altına düşen gerçek bir neon havuzu gibi görünür.
let glowTexture = null
function getGlowTexture() {
  if (glowTexture) return glowTexture
  const w = 192
  const h = 128
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(w, h)
  // Kutu yarı ölçüleri ve köşe yarıçapı (piksel), dışa doğru sönme mesafesi
  const hx = w * 0.28
  const hy = h * 0.2
  const corner = h * 0.14
  const fade = h * 0.3
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const qx = Math.abs(x + 0.5 - w / 2) - (hx - corner)
      const qy = Math.abs(y + 0.5 - h / 2) - (hy - corner)
      const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - corner
      // İçeride dolu, kenarda parlak bir hale, dışarıda yumuşak sönme
      const inside = d < 0 ? 0.55 : 0
      const rim = Math.exp(-((d / (fade * 0.35)) ** 2)) * 0.55
      const outside = d > 0 ? Math.max(0, 1 - d / fade) ** 2 : 1
      const alpha = Math.min(1, Math.max(inside, 0.6 * outside + rim))
      const i = (y * w + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
      img.data[i + 3] = Math.round(alpha * 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  glowTexture = new THREE.CanvasTexture(canvas)
  return glowTexture
}

const _glow = new THREE.Color()
const POLICE = [new THREE.Color('#ff2a3a'), new THREE.Color('#2a6bff')]
const SUNSET = [new THREE.Color('#ff7a2e'), new THREE.Color('#ff3fa4')]

// Modlar: sabit renk, rainbow (renk döngüsü), pulse (nefes alır), sunset (turuncu↔pembe), police (kırmızı/mavi çakar)
function glowColor(item, t, out) {
  if (item.mode === 'rainbow') return { color: out.setHSL((t * 0.25) % 1, 0.9, 0.55), power: 1 }
  if (item.mode === 'police') return { color: out.copy(POLICE[Math.floor(t * 5) % 2]), power: 0.75 + 0.25 * Math.abs(Math.sin(t * 15.7)) }
  if (item.mode === 'sunset') return { color: out.copy(SUNSET[0]).lerp(SUNSET[1], 0.5 + 0.5 * Math.sin(t * 1.4)), power: 1 }
  if (item.mode === 'pulse') return { color: out.set(item.color), power: 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 3)) }
  return { color: out.set(item.color), power: 1 }
}

// Neon taban: zemine düşen araç biçimli ışık havuzu + gövde altında iki parlak neon tüp
export function Underglow({ id, y }) {
  const item = findItem('glow', id)
  const pool = useRef()
  const pool2 = useRef()
  const glowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: getGlowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    [],
  )
  const tubeMaterial = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), [])
  useFrame((state) => {
    if (!item) return
    const { color, power } = glowColor(item, state.clock.elapsedTime, _glow)
    glowMaterial.color.copy(color)
    glowMaterial.opacity = (0.5 + world.night * 0.5) * power
    // Tüpler doygun renkte parlar (HDR: bloom olmadan da canlı)
    tubeMaterial.color.copy(color).multiplyScalar(1.4 + power)
    // Işık gövdenin altında değil zeminde görünsün: yerel yükseklik zemine göre ayarlanır
    const p = vehicleState.position
    const local = THREE.MathUtils.clamp(heightAt(p.x, p.z) + 0.04 - (p.y + vehicleState.modelOffsetY), y - 0.7, y)
    if (pool.current) pool.current.position.y = local
    if (pool2.current) pool2.current.position.y = local + 0.01
  })
  if (!item) return null
  return (
    <group>
      {/* Geniş, yumuşak havuz ve daha sıkı, parlak çekirdek */}
      <mesh ref={pool} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} scale={[4.6, 3.1, 1]} material={glowMaterial} renderOrder={2}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh ref={pool2} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} scale={[3.2, 2.1, 1]} material={glowMaterial} renderOrder={2}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      {/* Yan neon tüpler: gövdenin alt kenarı boyunca */}
      {[0.5, -0.5].map((z) => (
        <mesh key={z} position={[0.02, y + 0.05, z]} rotation={[0, 0, Math.PI / 2]} material={tubeMaterial}>
          <capsuleGeometry args={[0.018, 1.7, 4, 8]} />
        </mesh>
      ))}
    </group>
  )
}

// Tavan aksesuarları (taksi lambası Vehicle.jsx'te, vardiya ile ortak)
export function RoofItem({ id, x, y }) {
  if (id === 'roof-police') return <LightBar x={x} y={y} />
  if (id === 'roof-surf') return <Surfboard x={x} y={y} />
  if (id === 'roof-crown') return <Crown x={x} y={y} />
  if (id === 'roof-flag') return <FlagPole x={x} y={y} />
  return null
}

function Crown({ x, y }) {
  const crown = useRef()
  useFrame((state) => {
    if (crown.current) crown.current.position.y = y + 0.09 + Math.sin(state.clock.elapsedTime * 2.4) * 0.015
  })
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e7b947', metalness: 0.85, roughness: 0.22, emissive: '#5a3c08', emissiveIntensity: 0.4 }), [])
  return (
    <group ref={crown} position={[x, y + 0.09, 0]}>
      <mesh material={gold} castShadow>
        <cylinderGeometry args={[0.24, 0.22, 0.14, 24, 1, true]} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2
        return (
          <group key={i} position={[Math.cos(a) * 0.23, 0.13, Math.sin(a) * 0.23]}>
            <mesh material={gold} castShadow>
              <coneGeometry args={[0.055, 0.14, 8]} />
            </mesh>
            <mesh position={[0, 0.09, 0]}>
              <sphereGeometry args={[0.028, 10, 8]} />
              <meshStandardMaterial color={i % 2 ? '#e84a5f' : '#3d7bff'} emissive={i % 2 ? '#e84a5f' : '#3d7bff'} emissiveIntensity={0.6} roughness={0.2} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function FlagPole({ x, y }) {
  return (
    <group position={[x - 0.45, y, 0]} scale={0.62}>
      <Flag position={[0, 0.3, 0]} />
    </group>
  )
}

function LightBar({ x, y }) {
  const red = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7a1010', emissive: '#ff2a3a', emissiveIntensity: 0, toneMapped: false }), [])
  const blue = useMemo(() => new THREE.MeshStandardMaterial({ color: '#10207a', emissive: '#2a6bff', emissiveIntensity: 0, toneMapped: false }), [])
  useFrame((state) => {
    // Sırayla çakan kırmızı-mavi
    const phase = Math.floor(state.clock.elapsedTime * 6) % 4
    red.emissiveIntensity = phase === 0 || phase === 1 ? 2.4 : 0.15
    blue.emissiveIntensity = phase === 2 || phase === 3 ? 2.4 : 0.15
  })
  return (
    <group position={[x, y + 0.08, 0]}>
      <mesh>
        <boxGeometry args={[0.2, 0.06, 0.86]} />
        <meshStandardMaterial color="#1d1f24" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.08, 0.22]} material={red}>
        <boxGeometry args={[0.18, 0.1, 0.38]} />
      </mesh>
      <mesh position={[0, 0.08, -0.22]} material={blue}>
        <boxGeometry args={[0.18, 0.1, 0.38]} />
      </mesh>
    </group>
  )
}

function Surfboard({ x, y }) {
  return (
    <group position={[x + 0.05, y + 0.07, 0]}>
      {/* Portbagaj çubukları */}
      {[0.32, -0.32].map((bx) => (
        <mesh key={bx} position={[bx, 0, 0]}>
          <boxGeometry args={[0.05, 0.05, 1.05]} />
          <meshStandardMaterial color="#2a2c31" roughness={0.6} metalness={0.5} />
        </mesh>
      ))}
      <group position={[0, 0.06, 0]} scale={[1, 1, 1]}>
        <RoundedBox args={[2.1, 0.06, 0.5]} radius={0.03} smoothness={2}>
          <meshStandardMaterial color="#f6f3ec" roughness={0.45} />
        </RoundedBox>
        <mesh position={[0, 0.032, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.0, 0.09]} />
          <meshStandardMaterial color="#2ec4b6" roughness={0.5} />
        </mesh>
      </group>
    </group>
  )
}

// İz efekti: araç hızlandıkça arkasından parçacık bırakır (dünya uzayında)
const TRAIL_MAX = 180
const TRAILS = {
  'trail-smoke': { rate: 40, life: 1.4, size: 0.9, grow: 1.6, rise: 0.8, gravity: 0, spread: 0.6, additive: false },
  'trail-sparks': { rate: 60, life: 0.5, size: 0.22, grow: -0.2, rise: 1.6, gravity: -9, spread: 2.6, additive: true },
  'trail-rainbow': { rate: 55, life: 1.0, size: 0.45, grow: 0.2, rise: 0.2, gravity: 0, spread: 0.25, additive: true },
  // Alev: sarıdan kırmızıya döner, yükselir ve küçülür
  'trail-fire': { rate: 75, life: 0.45, size: 0.55, grow: -0.7, rise: 2.4, gravity: 3, spread: 0.7, additive: true, ramp: ['#ffe08a', '#ff3a1f'] },
  // Yıldız tozu: küçük, altın-beyaz, pırıl pırıl
  'trail-stardust': { rate: 50, life: 1.3, size: 0.2, grow: -0.3, rise: 0.4, gravity: -0.4, spread: 1.3, additive: true, twinkle: true, palette: ['#ffffff', '#ffe7a3', '#ffd27a', '#bfe0ff'] },
  // Lale yaprakları: pembe-kırmızı yapraklar havada süzülüp düşer
  'trail-tulip': { rate: 26, life: 2.0, size: 0.32, grow: 0, rise: 1.8, gravity: -1.6, spread: 1.8, additive: false, palette: ['#ff5f8f', '#e8335d', '#ff8fb1', '#c8102e'] },
}
const _ramp = [new THREE.Color(), new THREE.Color()]

const trailVertex = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * 320.0 / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`
const trailFragment = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5 || vAlpha < 0.01) discard;
    gl_FragColor = vec4(vColor, vAlpha * smoothstep(0.5, 0.1, d));
  }
`

const _fwd = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _c = new THREE.Color()

export function Trail() {
  const id = useStore((s) => s.equipped.trail)
  const mode = useStore((s) => s.mode)
  const style = TRAILS[id]
  const color = findItem('trail', id)?.color
  const sim = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const position = new Float32Array(TRAIL_MAX * 3)
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(TRAIL_MAX), 1))
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(TRAIL_MAX), 1))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(TRAIL_MAX * 3), 3))
    const parts = Array.from({ length: TRAIL_MAX }, () => ({ age: 1e9, life: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1 }))
    return { geometry, parts, next: 0, carry: 0 }
  }, [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: trailVertex,
        fragmentShader: trailFragment,
        transparent: true,
        depthWrite: false,
      }),
    [],
  )

  useFrame((state, delta) => {
    if (!style) return
    const dt = Math.min(delta, 0.05)
    material.blending = style.additive ? THREE.AdditiveBlending : THREE.NormalBlending
    const speed = Math.abs(vehicleState.speed)
    // Hızla orantılı doğum; yavaşken iz bırakmaz
    if (speed > 4 && mode === 'car') {
      sim.carry += dt * style.rate * Math.min(speed / 12, 1.5)
      const q = vehicleState.quaternion
      _q.set(q.x, q.y, q.z, q.w)
      _fwd.set(1, 0, 0).applyQuaternion(_q)
      const p = vehicleState.position
      const t = state.clock.elapsedTime
      while (sim.carry >= 1) {
        sim.carry -= 1
        const part = sim.parts[sim.next]
        sim.next = (sim.next + 1) % TRAIL_MAX
        const side = (Math.random() - 0.5) * 0.9
        part.x = p.x - _fwd.x * 1.25 - _fwd.z * side
        part.y = p.y - 0.15
        part.z = p.z - _fwd.z * 1.25 + _fwd.x * side
        part.vx = (Math.random() - 0.5) * style.spread - _fwd.x * speed * 0.15
        part.vy = style.rise * (0.5 + Math.random())
        part.vz = (Math.random() - 0.5) * style.spread - _fwd.z * speed * 0.15
        part.age = 0
        part.life = style.life * (0.7 + Math.random() * 0.6)
        if (color === 'rainbow') _c.setHSL((t * 0.5 + Math.random() * 0.08) % 1, 0.95, 0.6)
        else if (style.palette) _c.set(style.palette[Math.floor(Math.random() * style.palette.length)])
        else _c.set(color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.15)
        part.r = _c.r
        part.g = _c.g
        part.b = _c.b
      }
    }
    const pos = sim.geometry.attributes.position.array
    const size = sim.geometry.attributes.aSize.array
    const alpha = sim.geometry.attributes.aAlpha.array
    const col = sim.geometry.attributes.aColor.array
    sim.parts.forEach((part, i) => {
      part.age += dt
      const k = part.age / part.life
      if (k >= 1) {
        alpha[i] = 0
        return
      }
      part.vy += style.gravity * dt
      part.x += part.vx * dt
      part.y += part.vy * dt
      part.z += part.vz * dt
      pos[i * 3] = part.x
      pos[i * 3 + 1] = part.y
      pos[i * 3 + 2] = part.z
      size[i] = Math.max(0.02, style.size * (1 + style.grow * k))
      alpha[i] = (1 - k) * (style.additive ? 1 : style.palette ? 0.9 : 0.5) * (style.twinkle ? 0.4 + 0.6 * Math.abs(Math.sin(part.age * 18 + i)) : 1)
      if (style.ramp) {
        // Ömür boyunca renk geçişi (alev: sarı → kırmızı)
        _ramp[0].set(style.ramp[0]).lerp(_ramp[1].set(style.ramp[1]), k)
        col[i * 3] = _ramp[0].r
        col[i * 3 + 1] = _ramp[0].g
        col[i * 3 + 2] = _ramp[0].b
      } else {
        col[i * 3] = part.r
        col[i * 3 + 1] = part.g
        col[i * 3 + 2] = part.b
      }
    })
    for (const name of ['position', 'aSize', 'aAlpha', 'aColor']) sim.geometry.attributes[name].needsUpdate = true
  })

  if (!style) return null
  return <points geometry={sim.geometry} material={material} frustumCulled={false} />
}
