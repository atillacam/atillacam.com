import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { findItem } from './shop.js'
import { vehicleState } from './input.js'
import { world } from './time.js'
import { heightAt } from './terrain.js'
import { useStore } from '../store.js'

// Garaj dükkânının görsel eşyaları: neon taban ışığı, tavan aksesuarları ve iz efektleri.

// Yumuşak, beyaz radyal leke: renk malzemeden gelir
let glowTexture = null
function getGlowTexture() {
  if (glowTexture) return glowTexture
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.45)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  glowTexture = new THREE.CanvasTexture(canvas)
  return glowTexture
}

// Neon taban: aracın altında zemine düşen renkli ışık (gece daha belirgin)
export function Underglow({ id, y }) {
  const item = findItem('glow', id)
  const mesh = useRef()
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ map: getGlowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    [],
  )
  useFrame((state) => {
    if (!item) return
    if (item.color === 'rainbow') material.color.setHSL((state.clock.elapsedTime * 0.25) % 1, 0.9, 0.55)
    else material.color.set(item.color)
    material.opacity = 0.55 + world.night * 0.45
    // Işık gövdenin altında değil zeminde görünsün: yerel yükseklik zemine göre ayarlanır
    const m = mesh.current
    if (m) {
      const p = vehicleState.position
      const local = heightAt(p.x, p.z) + 0.04 - (p.y + vehicleState.modelOffsetY)
      m.position.y = THREE.MathUtils.clamp(local, y - 0.7, y)
    }
  })
  if (!item) return null
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} scale={[4.4, 2.9, 1]} material={material} renderOrder={2}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
}

// Tavan aksesuarları (taksi lambası Vehicle.jsx'te, vardiya ile ortak)
export function RoofItem({ id, x, y }) {
  if (id === 'roof-police') return <LightBar x={x} y={y} />
  if (id === 'roof-surf') return <Surfboard x={x} y={y} />
  return null
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
}

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
      alpha[i] = (1 - k) * (style.additive ? 1 : 0.5)
      col[i * 3] = part.r
      col[i * 3 + 1] = part.g
      col[i * 3 + 2] = part.b
    })
    for (const name of ['position', 'aSize', 'aAlpha', 'aColor']) sim.geometry.attributes[name].needsUpdate = true
  })

  if (!style) return null
  return <points geometry={sim.geometry} material={material} frustumCulled={false} />
}
