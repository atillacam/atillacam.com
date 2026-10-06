import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BallCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { HIDDEN_LOGOS, LAKE } from './layout.js'
import { heightAt } from './terrain.js'
import { vehicleState } from './input.js'
import { useStore } from '../store.js'
import { translate } from '../i18n.js'
import { playChime, playFirework } from '../audio.js'
import { fontBlack } from './fonts.js'
import Halo from './Halo.jsx'

// Haritaya saklanmış AÇ logoları. Veri çekirdeklerinden farklı olarak küçük ve sessizdir:
// uzaktan fark edilmez, yalnızca yakından parıldar. Hepsi bulununca altın boya açılır.
const NONE = []
const GOLD = '#d6a53a'
const INK = '#121726'

function logoY(l) {
  const ground = heightAt(l.x, l.z)
  if (l.y != null) return ground + l.y
  // Göldeki logo su yüzeyinin üstünde durur
  const inLake = Math.hypot(l.x - LAKE.x, l.z - LAKE.z) < LAKE.radius + 1
  return Math.max(ground, inLake ? LAKE.waterLevel : -Infinity) + 1.15
}

function Token({ logo }) {
  const spin = useRef()
  const y = useMemo(() => logoY(logo), [logo])
  useFrame((state) => {
    const g = spin.current
    if (!g) return
    const t = state.clock.elapsedTime + logo.x * 0.1
    g.rotation.y = t * 1.1
    g.position.y = Math.sin(t * 1.8) * 0.12
  })

  const onEnter = (p) => {
    if (p.other.rigidBodyObject?.name !== 'vehicle') return
    const store = useStore.getState()
    if ((store.progress.logoHunter ?? NONE).includes(logo.id)) return
    store.findLogo(logo.id)
    if (!store.muted) playChime()
    const found = (useStore.getState().progress.logoHunter ?? NONE).length
    // Sonuncusunda başarım bildirimi zaten çıkar
    if (found < HIDDEN_LOGOS.length) store.toast(translate('logoFound', store.lang), `${found} / ${HIDDEN_LOGOS.length}`)
  }

  return (
    <group position={[logo.x, y, logo.z]}>
      <RigidBody type="fixed" colliders={false}>
        {/* Yerdekiler: araç gövdesi yüksekliğinden bağımsız alınabilsin diye uzun silindir; havadaki: küre */}
        {logo.air ? (
          <BallCollider sensor args={[1.3]} onIntersectionEnter={onEnter} />
        ) : (
          <CylinderCollider sensor args={[3, 1.4]} onIntersectionEnter={onEnter} />
        )}
      </RigidBody>
      <group ref={spin}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.5, 0.5, 0.1, 40]} />
          <meshStandardMaterial color={GOLD} emissive="#7a5410" emissiveIntensity={0.35} metalness={0.6} roughness={0.3} />
        </mesh>
        {/* Kenar halkası: torus zaten paranın yüzüyle aynı (x-y) düzlemde */}
        <mesh>
          <torusGeometry args={[0.5, 0.045, 8, 40]} />
          <meshStandardMaterial color="#f3d27a" metalness={0.7} roughness={0.25} />
        </mesh>
        {[1, -1].map((side) => (
          <Text
            key={side}
            font={fontBlack}
            fontSize={0.42}
            letterSpacing={-0.04}
            color={INK}
            position={[0, 0.02, side * 0.056]}
            rotation={[0, side > 0 ? 0 : Math.PI, 0]}
            anchorX="center"
            anchorY="middle"
          >
            AÇ
          </Text>
        ))}
      </group>
      <Halo position={[0, 0, 0]} scale={1.6} color="#ffd27a" dayOpacity={0.12} />
    </group>
  )
}

// Son logo bulununca aracın üstünde havai fişek gösterisi
const BURSTS = 7
const SPARKS = 90
const SHOW = 6.5 // saniye
const PALETTE = ['#ffd27a', '#3d7bff', '#ff5d5d', '#2ec4b6', '#9b7bff', '#ffffff'].map((c) => new THREE.Color(c))

function Fireworks() {
  const points = useRef()
  const show = useRef({ started: 0, bursts: [] })
  const { geometry, positions, colors } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const positions = new Float32Array(BURSTS * SPARKS * 3)
    const colors = new Float32Array(BURSTS * SPARKS * 3)
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return { geometry: g, positions, colors }
  }, [])

  useFrame(() => {
    const p = points.current
    if (!p) return
    const { celebrate, muted } = useStore.getState()
    const s = show.current
    if (celebrate !== s.started) {
      // Yeni gösteri: patlama noktaları aracın çevresinde, sırayla
      s.started = celebrate
      const c = vehicleState.position
      s.bursts = Array.from({ length: BURSTS }, (_, i) => {
        const a = Math.random() * Math.PI * 2
        const r = 4 + Math.random() * 8
        return {
          at: i * 0.75 + Math.random() * 0.3,
          origin: [c.x + Math.cos(a) * r, c.y + 13 + Math.random() * 7, c.z + Math.sin(a) * r],
          color: PALETTE[i % PALETTE.length],
          dirs: Array.from({ length: SPARKS }, () => new THREE.Vector3().randomDirection().multiplyScalar(7 + Math.random() * 3)),
          popped: false,
        }
      })
    }
    const t = (performance.now() - s.started) / 1000
    const active = s.started > 0 && t < SHOW
    p.visible = active
    if (!active) return
    let k = 0
    for (const b of s.bursts) {
      const bt = t - b.at
      if (bt > 0 && !b.popped) {
        b.popped = true
        if (!muted) playFirework()
      }
      // Sürtünmeli genişleme + yerçekimi; renk sönerek kaybolur (toplamalı karışım)
      const life = bt > 0 ? Math.max(0, 1 - bt / 2.2) : 0
      const spread = bt > 0 ? (1 - Math.exp(-bt * 2.2)) / 2.2 : 0
      const fall = bt > 0 ? 2.5 * bt * bt : 0
      for (const d of b.dirs) {
        positions[k * 3] = b.origin[0] + d.x * spread
        positions[k * 3 + 1] = b.origin[1] + d.y * spread - fall
        positions[k * 3 + 2] = b.origin[2] + d.z * spread
        const f = life * life
        colors[k * 3] = b.color.r * f
        colors[k * 3 + 1] = b.color.g * f
        colors[k * 3 + 2] = b.color.b * f
        k++
      }
    }
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.color.needsUpdate = true
  })

  return (
    <points ref={points} geometry={geometry} frustumCulled={false} visible={false}>
      <pointsMaterial size={0.85} vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} fog={false} />
    </points>
  )
}

export default function HiddenLogos() {
  const found = useStore((s) => s.progress.logoHunter ?? NONE)
  return (
    <>
      {HIDDEN_LOGOS.filter((l) => !found.includes(l.id)).map((l) => (
        <Token key={l.id} logo={l} />
      ))}
      <Fireworks />
    </>
  )
}
