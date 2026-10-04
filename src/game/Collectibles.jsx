import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BallCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { COLLECTIBLES } from './layout.js'
import { heightAt } from './terrain.js'
import { useStore } from '../store.js'
import { translate } from '../i18n.js'
import { playCoin } from '../audio.js'
import Halo from './Halo.jsx'

const NONE = []

function Core({ core, collected }) {
  const group = useRef()
  const y = useMemo(() => heightAt(core.x, core.z) + 1.3, [core])
  useFrame((state) => {
    const g = group.current
    if (!g) return
    const t = state.clock.elapsedTime + core.x
    g.rotation.y = t * 1.4
    g.position.y = y + Math.sin(t * 2) * 0.18
  })
  if (collected) return null
  return (
    <group position={[core.x, 0, core.z]}>
      <RigidBody type="fixed" colliders={false} position={[0, y, 0]}>
        <BallCollider
          sensor
          args={[1.2]}
          onIntersectionEnter={(p) => {
            if (p.other.rigidBodyObject?.name !== 'vehicle') return
            const store = useStore.getState()
            store.collect(core.id)
            if (!store.muted) playCoin()
            const count = (useStore.getState().progress.collector ?? []).length
            store.toast(translate('collected', store.lang), `${count} / ${COLLECTIBLES.length}`)
          }}
        />
      </RigidBody>
      <group ref={group} position={[0, y, 0]}>
        <mesh castShadow>
          <octahedronGeometry args={[0.42, 0]} />
          <meshStandardMaterial color="#8fb8ff" emissive="#3d7bff" emissiveIntensity={2.2} roughness={0.2} metalness={0.3} toneMapped={false} />
        </mesh>
        <Halo position={[0, 0, 0]} scale={2.4} color="#7fb0ff" dayOpacity={0.45} />
        <mesh scale={1.5}>
          <octahedronGeometry args={[0.42, 0]} />
          <meshBasicMaterial color="#6aa1ff" wireframe transparent opacity={0.35} />
        </mesh>
      </group>
      {/* Zemindeki halka */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, heightAt(core.x, core.z) + 0.05, 0]}>
        <ringGeometry args={[0.55, 0.75, 32]} />
        <meshBasicMaterial color={new THREE.Color('#6aa1ff')} transparent opacity={0.55} />
      </mesh>
    </group>
  )
}

export default function Collectibles() {
  const collected = useStore((s) => s.progress.collector ?? NONE)
  return COLLECTIBLES.map((core) => <Core key={core.id} core={core} collected={collected.includes(core.id)} />)
}
