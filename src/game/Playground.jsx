import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BallCollider, CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { RoundedBox, Text } from '@react-three/drei'
import * as THREE from 'three'
import { AREAS, COLORS } from './layout.js'
import { fontBlack } from './fonts.js'
import { useStore } from '../store.js'
import { useT } from '../i18n.js'

const _up = new THREE.Vector3()
const _q = new THREE.Quaternion()

function Bowling({ position }) {
  const pins = useMemo(() => {
    const list = []
    const spacing = 0.75
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i <= row; i++) {
        list.push([(i - row / 2) * spacing, 0, -row * spacing * 0.9])
      }
    }
    return list
  }, [])
  const refs = useRef([])
  const timer = useRef(0)

  useFrame((_, delta) => {
    timer.current += delta
    if (timer.current < 0.5) return
    timer.current = 0
    const store = useStore.getState()
    if (store.unlocked.strike || !store.started) return
    const allDown = refs.current.every((b) => {
      if (!b) return false
      const r = b.rotation()
      _up.set(0, 1, 0).applyQuaternion(_q.set(r.x, r.y, r.z, r.w))
      return _up.y < 0.6
    })
    if (allDown) store.unlock('strike')
  })

  return (
    <group position={position}>
      {/* Pist */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 4]} receiveShadow>
        <planeGeometry args={[4.4, 14]} />
        <meshStandardMaterial color="#e8c48f" roughness={0.6} />
      </mesh>
      {[-2.3, 2.3].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.035, 4]}>
          <planeGeometry args={[0.2, 14]} />
          <meshStandardMaterial color={COLORS.ink} />
        </mesh>
      ))}
      {pins.map((p, i) => (
        <RigidBody key={i} ref={(el) => (refs.current[i] = el)} colliders={false} position={[p[0], 0.55, p[2]]} friction={0.4} restitution={0.2}>
          <CylinderCollider args={[0.55, 0.2]} mass={0.25} />
          <mesh castShadow>
            <cylinderGeometry args={[0.12, 0.2, 1.1, 12]} />
            <meshStandardMaterial color={COLORS.cream} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.135, 0.15, 0.12, 12]} />
            <meshStandardMaterial color={COLORS.coral} />
          </mesh>
          <mesh position={[0, 0.6, 0]} castShadow>
            <sphereGeometry args={[0.14, 12, 10]} />
            <meshStandardMaterial color={COLORS.cream} roughness={0.35} />
          </mesh>
        </RigidBody>
      ))}
      {/* Top */}
      <RigidBody colliders={false} position={[0, 0.7, 8.5]} restitution={0.3} friction={0.6}>
        <BallCollider args={[0.7]} mass={1.5} />
        <mesh castShadow>
          <sphereGeometry args={[0.7, 24, 18]} />
          <meshStandardMaterial color={COLORS.blue} roughness={0.25} />
        </mesh>
      </RigidBody>
    </group>
  )
}

function Ramp({ position, rotation = 0 }) {
  const angle = 0.28
  const length = 9
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.4, 0.2, length / 2]} rotation={[angle, 0, 0]} position={[0, Math.sin(angle) * (length / 2) - 0.15, 0]} />
      </RigidBody>
      <mesh rotation={[angle, 0, 0]} position={[0, Math.sin(angle) * (length / 2) - 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.8, 0.4, length]} />
        <meshStandardMaterial color={COLORS.amber} roughness={0.7} />
      </mesh>
      {[-1.2, 0, 1.2].map((x) => (
        <mesh key={x} rotation={[angle - Math.PI / 2, 0, 0]} position={[x, Math.sin(angle) * (length / 2) + 0.08, 0]}>
          <planeGeometry args={[0.3, length * 0.8]} />
          <meshStandardMaterial color={COLORS.coral} />
        </mesh>
      ))}
    </group>
  )
}

function Crates({ position }) {
  const size = 1.1
  const crates = []
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 3 - row; i++) {
      crates.push([(i - (2 - row) / 2) * (size + 0.04), size / 2 + row * size + 0.01, 0])
    }
  }
  return (
    <group position={position}>
      {crates.map((c, i) => (
        <RigidBody key={i} colliders={false} position={c} friction={0.8}>
          <CuboidCollider args={[size / 2, size / 2, size / 2]} mass={0.5} />
          <RoundedBox args={[size, size, size]} radius={0.05} smoothness={2} castShadow receiveShadow>
            <meshStandardMaterial color="#c98b52" roughness={0.9} />
          </RoundedBox>
          <mesh>
            <boxGeometry args={[size + 0.02, 0.16, size + 0.02]} />
            <meshStandardMaterial color="#8a5a3b" />
          </mesh>
        </RigidBody>
      ))}
    </group>
  )
}

export default function Playground() {
  const { t, lang } = useT()
  const [cx, , cz] = AREAS.find((a) => a.id === 'playground').center
  return (
    <group>
      <Bowling position={[cx + 9, 0, cz + 2]} />
      {/* Rampa güneye doğru yükselir; kuzeyden gelince zıplatır */}
      <Ramp position={[cx - 8, 0, cz]} rotation={Math.PI} />
      <Crates position={[cx - 8, 0, cz + 12]} />
      <Text font={fontBlack} fontSize={1.6} color={COLORS.cream} rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.07, cz - 8]} outlineWidth={0.06} outlineColor={COLORS.coral}>
        {t('areaPlayground').toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : 'en-US')}
      </Text>
    </group>
  )
}
