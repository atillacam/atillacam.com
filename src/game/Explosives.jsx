import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody, useRapier } from '@react-three/rapier'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { heightAt } from './terrain.js'
import { fontBlack } from './fonts.js'
import { useStore } from '../store.js'
import { playBoom } from '../audio.js'

// Patlayan TNT kasaları: sert çarpmada patlar, çevredeki her cismi iter (zincirleme patlama olur)
const SIZE = 1.1
const RADIUS = 7.5
const RESPAWN = 25000

// Patlama görselleri bileşenler arasında paylaşılır
const blasts = []

function Blasts() {
  const flashes = useRef([])
  const pool = useMemo(() => Array.from({ length: 6 }, () => ({ t: 9, x: 0, y: 0, z: 0 })), [])
  const smoke = useMemo(() => {
    const COUNT = 240
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3).fill(-999), 3))
    return { g, vel: new Float32Array(COUNT * 3), life: new Float32Array(COUNT), cursor: 0, COUNT }
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    while (blasts.length) {
      const b = blasts.shift()
      const slot = pool.find((p) => p.t > 1) ?? pool[0]
      Object.assign(slot, { t: 0, x: b.x, y: b.y, z: b.z })
      const pos = smoke.g.attributes.position
      for (let i = 0; i < 40; i++) {
        const k = smoke.cursor
        smoke.cursor = (smoke.cursor + 1) % smoke.COUNT
        pos.setXYZ(k, b.x, b.y, b.z)
        smoke.vel.set([(Math.random() - 0.5) * 8, 2 + Math.random() * 6, (Math.random() - 0.5) * 8], k * 3)
        smoke.life[k] = 1.2 + Math.random() * 0.8
      }
    }
    pool.forEach((p, i) => {
      const m = flashes.current[i]
      if (!m) return
      p.t += dt
      const k = Math.min(p.t / 0.55, 1)
      m.visible = k < 1
      m.position.set(p.x, p.y, p.z)
      m.scale.setScalar(0.5 + k * 6)
      m.material.opacity = (1 - k) * 0.95
    })
    const pos = smoke.g.attributes.position
    for (let i = 0; i < smoke.COUNT; i++) {
      if (smoke.life[i] <= 0) continue
      smoke.life[i] -= dt
      smoke.vel[i * 3 + 1] -= 4 * dt
      pos.setXYZ(i, pos.getX(i) + smoke.vel[i * 3] * dt, pos.getY(i) + smoke.vel[i * 3 + 1] * dt, pos.getZ(i) + smoke.vel[i * 3 + 2] * dt)
      if (smoke.life[i] <= 0) pos.setY(i, -999)
    }
    pos.needsUpdate = true
  })

  return (
    <>
      {pool.map((_, i) => (
        <mesh key={i} ref={(el) => {
            flashes.current[i] = el
          }} visible={false}>
          <sphereGeometry args={[1, 20, 14]} />
          <meshBasicMaterial color="#ffb347" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
      <points geometry={smoke.g} frustumCulled={false}>
        <pointsMaterial size={0.55} color="#5b5550" transparent opacity={0.7} depthWrite={false} sizeAttenuation />
      </points>
    </>
  )
}

function Crate({ id, position }) {
  const { world } = useRapier()
  const body = useRef()
  const [alive, setAlive] = useState(true)
  const exploded = useRef(false)

  const explode = () => {
    if (exploded.current) return
    exploded.current = true
    const b = body.current
    const c = b ? b.translation() : { x: position[0], y: position[1], z: position[2] }
    // Çevredeki dinamik cisimlere uzaklıkla azalan itme uygula
    world.bodies.forEach((rb) => {
      if (!rb.isDynamic() || rb === b) return
      const p = rb.translation()
      const dx = p.x - c.x
      const dy = p.y - c.y
      const dz = p.z - c.z
      const d = Math.hypot(dx, dy, dz)
      if (d > RADIUS || d < 0.01) return
      const k = (1 - d / RADIUS) * rb.mass() * 14
      rb.applyImpulse({ x: (dx / d) * k, y: Math.max(dy / d, 0.35) * k + rb.mass() * 3, z: (dz / d) * k }, true)
      rb.applyTorqueImpulse({ x: (Math.random() - 0.5) * k * 0.3, y: 0, z: (Math.random() - 0.5) * k * 0.3 }, true)
    })
    blasts.push({ x: c.x, y: c.y, z: c.z })
    const store = useStore.getState()
    store.addToSet('boom', id)
    if (!store.muted) playBoom()
    setAlive(false)
    setTimeout(() => {
      exploded.current = false
      setAlive(true)
    }, RESPAWN)
  }

  if (!alive) return null
  return (
    <RigidBody ref={body} colliders={false} position={position} friction={0.8}>
      <CuboidCollider
        args={[SIZE / 2, SIZE / 2, SIZE / 2]}
        mass={0.6}
        contactForceEventThreshold={90}
        onContactForce={(e) => {
          if (e.totalForceMagnitude > 140) explode()
        }}
      />
      <mesh castShadow receiveShadow>
        <boxGeometry args={[SIZE, SIZE, SIZE]} />
        <meshStandardMaterial color="#c8282a" roughness={0.55} />
      </mesh>
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((r) => (
        <group key={r} rotation={[0, r, 0]}>
          <mesh position={[0, 0, SIZE / 2 + 0.005]}>
            <planeGeometry args={[SIZE * 0.82, SIZE * 0.3]} />
            <meshStandardMaterial color="#f2e6c8" roughness={0.8} />
          </mesh>
          <Text font={fontBlack} fontSize={0.26} color="#2a1810" position={[0, 0, SIZE / 2 + 0.012]} anchorX="center" anchorY="middle">
            TNT
          </Text>
        </group>
      ))}
    </RigidBody>
  )
}

export default function Explosives({ origin }) {
  const crates = useMemo(() => {
    const [ox, oz] = origin
    const y = heightAt(ox, oz)
    const list = []
    // İki küçük piramit
    for (const [dx, dz] of [
      [0, 0],
      [0, 5],
    ]) {
      list.push([ox + dx - 0.6, y + SIZE / 2 + 0.01, oz + dz])
      list.push([ox + dx + 0.6, y + SIZE / 2 + 0.01, oz + dz])
      list.push([ox + dx, y + SIZE * 1.5 + 0.02, oz + dz])
    }
    list.push([ox + 3, y + SIZE / 2 + 0.01, oz + 2.5])
    list.push([ox - 3, y + SIZE / 2 + 0.01, oz + 2.5])
    return list
  }, [origin])
  return (
    <>
      {crates.map((p, i) => (
        <Crate key={i} id={`tnt-${i}`} position={p} />
      ))}
      <Blasts />
    </>
  )
}
