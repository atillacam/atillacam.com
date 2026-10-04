import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { RoundedBox, Text } from '@react-three/drei'
import * as THREE from 'three'
import { AREAS, COLORS } from './layout.js'
import { fontBlack } from './fonts.js'
import { useT } from '../i18n.js'
import Explosives from './Explosives.jsx'

const _up = new THREE.Vector3()
const _q = new THREE.Quaternion()

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
      {/* Bowling kendi salonuna taşındı; burada patlayan TNT kasaları var */}
      <Explosives origin={[cx + 8, cz]} />
      {/* Rampa güneye doğru yükselir; kuzeyden gelince zıplatır */}
      <Ramp position={[cx - 8, 0, cz]} rotation={Math.PI} />
      <Crates position={[cx - 8, 0, cz + 12]} />
      <Text font={fontBlack} fontSize={1.6} color={COLORS.cream} rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.07, cz - 8]} outlineWidth={0.06} outlineColor={COLORS.coral}>
        {t('areaPlayground').toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : 'en-US')}
      </Text>
    </group>
  )
}
