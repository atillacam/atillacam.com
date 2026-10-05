import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CylinderCollider, CuboidCollider, RigidBody } from '@react-three/rapier'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { AREAS } from './layout.js'
import { heightAt } from './terrain.js'
import { lampPlacements } from './scatter.js'
import { fontBlack } from './fonts.js'
import { world } from './time.js'
import { useT } from '../i18n.js'

// Gece ve gökyüzü detayları: fener dizileri, neon tabela, kayan yıldızlar ve bulut gölgeleri.

// Yumuşak, yuvarlak parıltı dokusu (ampul ve neon haleleri için)
let glowTexture = null
function getGlowTexture() {
  if (glowTexture) return glowTexture
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.3, 'rgba(255,255,255,0.45)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  glowTexture = new THREE.CanvasTexture(canvas)
  return glowTexture
}

// ================= Fener dizileri =================
const BULB_COLORS = ['#ffcf6b', '#ff7a59', '#7ad7ff', '#b98bff', '#7dffb0'].map((c) => new THREE.Color(c))
const HOME = AREAS.find((a) => a.id === 'home')
const POLE_HEIGHT = 4.2

// Sarkan ip: iki uç arasında parabolik eğri
function catenary(a, b, sag, steps) {
  const pts = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0)))
  }
  return pts
}

function useStrands() {
  return useMemo(() => {
    const strands = []
    // Yollardaki birbirine yakın lamba çiftleri arasında
    const lamps = lampPlacements()
    for (let i = 0; i < lamps.length; i++) {
      for (let j = i + 1; j < lamps.length; j++) {
        const a = lamps[i]
        const b = lamps[j]
        const d = Math.hypot(a.x - b.x, a.z - b.z)
        if (d > 8.5 && d < 12) strands.push([new THREE.Vector3(a.x, a.y + 3.35, a.z), new THREE.Vector3(b.x, b.y + 3.35, b.z)])
      }
    }
    // Ana meydanın çevresinde, yolları kesmeyen 8 direk arasında çelenk
    const poles = Array.from({ length: 8 }, (_, i) => {
      const ang = (i / 8) * Math.PI * 2 + Math.PI / 8
      const x = HOME.center[0] + Math.cos(ang) * (HOME.radius + 0.8)
      const z = HOME.center[2] + Math.sin(ang) * (HOME.radius + 0.8)
      return new THREE.Vector3(x, heightAt(x, z), z)
    })
    poles.forEach((p, i) => {
      const q = poles[(i + 1) % poles.length]
      strands.push([p.clone().setY(p.y + POLE_HEIGHT), q.clone().setY(q.y + POLE_HEIGHT)])
    })
    return { strands, poles }
  }, [])
}

function StringLights() {
  const { strands, poles } = useStrands()
  const { wire, bulbs } = useMemo(() => {
    const wirePts = []
    const bulbs = []
    let k = 0
    for (const [a, b] of strands) {
      const len = a.distanceTo(b)
      const pts = catenary(a, b, 0.35 + len * 0.04, 24)
      for (let i = 0; i < pts.length - 1; i++) wirePts.push(pts[i], pts[i + 1])
      const count = Math.max(4, Math.round(len / 0.8))
      for (let i = 1; i < count; i++) {
        const t = i / count
        const p = new THREE.Vector3().lerpVectors(a, b, t)
        p.y -= (0.35 + len * 0.04) * 4 * t * (1 - t) + 0.12
        bulbs.push({ p, color: BULB_COLORS[k++ % BULB_COLORS.length], phase: k * 1.7 })
      }
    }
    return { wire: new THREE.BufferGeometry().setFromPoints(wirePts), bulbs }
  }, [strands])

  const bulbMesh = useRef()
  const glow = useRef()
  const bulbMaterial = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), [])
  const glowGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(bulbs.flatMap((b) => [b.p.x, b.p.y, b.p.z]), 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(bulbs.flatMap((b) => [b.color.r, b.color.g, b.color.b]), 3))
    return g
  }, [bulbs])
  const _m = useMemo(() => new THREE.Matrix4(), [])
  const _c = useMemo(() => new THREE.Color(), [])
  const ready = useRef(false)

  useFrame((state) => {
    const im = bulbMesh.current
    if (!im) return
    if (!ready.current) {
      bulbs.forEach((b, i) => {
        im.setMatrixAt(i, _m.makeTranslation(b.p.x, b.p.y, b.p.z))
        im.setColorAt(i, b.color)
      })
      im.instanceMatrix.needsUpdate = true
      // Örnek renkleri sonradan eklendi: shader'ın renk desteğiyle yeniden derlenmesi gerekir
      bulbMaterial.needsUpdate = true
      ready.current = true
    }
    // Gündüz sönük renkli cam, gece parlak; hafif dalgalanan parlaklık
    const t = state.clock.elapsedTime
    const on = THREE.MathUtils.smoothstep(world.night, 0.25, 0.7)
    bulbs.forEach((b, i) => {
      const twinkle = 0.85 + 0.15 * Math.sin(t * 2.2 + b.phase)
      im.setColorAt(i, _c.copy(b.color).multiplyScalar(0.35 + on * 1.4 * twinkle))
    })
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    if (glow.current) glow.current.material.opacity = on * 0.85
  })

  return (
    <group>
      <lineSegments geometry={wire}>
        <lineBasicMaterial color="#1c1f26" />
      </lineSegments>
      <instancedMesh ref={bulbMesh} args={[null, bulbMaterial, bulbs.length]} frustumCulled={false}>
        <sphereGeometry args={[0.075, 8, 6]} />
      </instancedMesh>
      <points ref={glow} geometry={glowGeometry} frustumCulled={false}>
        <pointsMaterial map={getGlowTexture()} vertexColors size={0.9} sizeAttenuation transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </points>
      {/* Meydan çevresindeki direkler (araba çarpınca durur) */}
      {poles.map((p, i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={[p.x, p.y, p.z]}>
          <CylinderCollider args={[POLE_HEIGHT / 2, 0.09]} position={[0, POLE_HEIGHT / 2, 0]} />
          <mesh position={[0, POLE_HEIGHT / 2, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, POLE_HEIGHT, 8]} />
            <meshStandardMaterial color="#2a2e38" metalness={0.5} roughness={0.5} />
          </mesh>
        </RigidBody>
      ))}
    </group>
  )
}

// ================= Neon tabela =================
const CONTACT = AREAS.find((a) => a.id === 'contact')

function NeonSign() {
  const { t } = useT()
  // Meydanın batı kenarında, batı yolunu kapatmadan; sabit kamera güneyden baktığı için güneye dönük
  const x = CONTACT.center[0] - 11
  const z = CONTACT.center[2] - 7
  const y = heightAt(x, z)
  const textMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff5fd2', toneMapped: false }), [])
  const glowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: getGlowTexture(), color: '#ff4fc8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    [],
  )
  const flicker = useRef({ was: false, until: 0 })
  const OFF = useMemo(() => new THREE.Color('#5a3550'), [])
  const ON = useMemo(() => new THREE.Color('#ff5fd2').multiplyScalar(2.2), [])

  useFrame((state) => {
    const time = state.clock.elapsedTime
    const f = flicker.current
    const lit = world.night > 0.35
    // Yanarken eski bir neon gibi kısa süre titrer
    if (lit && !f.was) f.until = time + 1.4
    f.was = lit
    let k = lit ? 1 : 0
    if (lit && time < f.until) k = Math.random() > 0.45 ? 1 : 0.15
    textMaterial.color.copy(OFF).lerp(ON, k)
    glowMaterial.opacity = k * 0.55
  })

  return (
    <RigidBody type="fixed" colliders={false} position={[x, y, z]}>
      {[-3.3, 3.3].map((px) => <CuboidCollider key={px} args={[0.1, 2.0, 0.1]} position={[px, 2.0, -0.05]} />)}
      {/* Ayaklar ve arka pano */}
      {[-3.3, 3.3].map((px) => (
        <mesh key={px} position={[px, 2.0, -0.05]} castShadow>
          <boxGeometry args={[0.14, 4.0, 0.14]} />
          <meshStandardMaterial color="#20232b" metalness={0.4} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 3.4, -0.08]} castShadow>
        <boxGeometry args={[7, 1.5, 0.1]} />
        <meshStandardMaterial color="#14161c" roughness={0.8} />
      </mesh>
      <mesh position={[0, 3.4, 0.02]} material={glowMaterial}>
        <planeGeometry args={[9, 3.4]} />
      </mesh>
      <Text font={fontBlack} fontSize={0.52} maxWidth={6.6} position={[0, 3.42, 0.04]} anchorX="center" anchorY="middle" material={textMaterial} letterSpacing={0.04}>
        {t('neonOpen')}
      </Text>
    </RigidBody>
  )
}

// ================= Kayan yıldızlar =================
function ShootingStars() {
  const line = useRef()
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 0, 0, 0], 3))
    return g
  }, [])
  const star = useRef({ next: 4, life: 0, head: new THREE.Vector3(), dir: new THREE.Vector3() })

  useFrame((state, delta) => {
    const s = star.current
    const dt = Math.min(delta, 0.1)
    const l = line.current
    if (!l) return
    if (s.life <= 0) {
      l.visible = false
      if (world.night < 0.75 || world.wet > 0.3) return
      s.next -= dt
      if (s.next > 0) return
      s.next = 5 + Math.random() * 9
      s.life = 0.9
      // Kameranın etrafında, ufkun üstünde rastgele bir yerden başla
      const az = Math.random() * Math.PI * 2
      const el = 0.45 + Math.random() * 0.5
      const cam = state.camera.position
      s.head.set(cam.x + Math.cos(az) * Math.cos(el) * 320, cam.y + Math.sin(el) * 320, cam.z + Math.sin(az) * Math.cos(el) * 320)
      s.dir.set(-Math.sin(az) + (Math.random() - 0.5) * 0.6, -0.45, Math.cos(az) + (Math.random() - 0.5) * 0.6).normalize()
    }
    s.life -= dt
    s.head.addScaledVector(s.dir, 170 * dt)
    const tail = 30 * Math.min(1, (0.9 - s.life) * 4)
    const pos = geometry.attributes.position
    pos.setXYZ(0, s.head.x, s.head.y, s.head.z)
    pos.setXYZ(1, s.head.x - s.dir.x * tail, s.head.y - s.dir.y * tail, s.head.z - s.dir.z * tail)
    pos.needsUpdate = true
    l.visible = true
    l.material.opacity = Math.min(1, s.life * 3)
  })

  return (
    <lineSegments ref={line} geometry={geometry} frustumCulled={false} visible={false}>
      <lineBasicMaterial vertexColors transparent opacity={1} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} toneMapped={false} />
    </lineSegments>
  )
}

// ================= Bulut gölgeleri =================
// Gölgenin kendisi arazi ve çimen shader'larında çizilir; burada yalnızca gücü ayarlanır:
// güneşli gündüz belirgin, gece, yağmur ve karda kaybolur.
function CloudShadowControl() {
  useFrame(() => {
    const day = 1 - world.night
    world.uniforms.uCloud.value = day * day * (1 - world.wet * 0.85) * (1 - world.snowy * 0.6)
  })
  return null
}

export default function NightSky() {
  return (
    <>
      <StringLights />
      <NeonSign />
      <ShootingStars />
      <CloudShadowControl />
    </>
  )
}
