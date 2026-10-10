import { useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { TTFLoader } from 'three/examples/jsm/loaders/TTFLoader.js'
import { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { profile } from '../content.js'
import { COLORS } from './layout.js'
import { fontBlack, fontRegular } from './fonts.js'
import { sanitizeNormals } from './geometry.js'
import { useStore } from '../store.js'
import { useT } from '../i18n.js'

const SIZE = 2.2
const DEPTH = 0.7
const GAP = 0.25
const PALETTE = [COLORS.blue, COLORS.cream, COLORS.amber, COLORS.teal, COLORS.coral, COLORS.violet]
const _up = new THREE.Vector3()
const _q = new THREE.Quaternion()

// İsmin harfleri: her biri ayrı fizik nesnesi, araçla devrilebilir
export default function Letters({ position = [0, 0, -9] }) {
  const json = useLoader(TTFLoader, fontBlack)
  const { L, lang } = useT()
  const bodies = useRef([])

  const letters = useMemo(() => {
    const font = new Font(json)
    const chars = [...profile.worldName.toLocaleUpperCase('tr-TR')]
    const items = []
    let cursor = 0
    chars.forEach((char) => {
      if (char === ' ') {
        cursor += SIZE * 0.5
        return
      }
      const geometry = new TextGeometry(char, {
        font,
        size: SIZE,
        depth: DEPTH,
        curveSegments: 5,
        bevelEnabled: true,
        bevelThickness: 0.06,
        bevelSize: 0.05,
        bevelSegments: 2,
      })
      sanitizeNormals(geometry)
      geometry.computeBoundingBox()
      const box = geometry.boundingBox
      const size = new THREE.Vector3()
      box.getSize(size)
      // Geometriyi merkezle; fizik gövdesi kutunun ortasında olsun
      geometry.translate(-(box.min.x + size.x / 2), -(box.min.y + size.y / 2), -(box.min.z + size.z / 2))
      items.push({ char, geometry, size, x: cursor + size.x / 2 })
      cursor += size.x + GAP
    })
    const offset = (cursor - GAP) / 2
    return items.map((l, i) => ({ ...l, x: l.x - offset, color: PALETTE[i % PALETTE.length] }))
  }, [json])

  // Hepsi devrildi mi?
  const timer = useRef(0)
  useFrame((_, delta) => {
    timer.current += delta
    if (timer.current < 0.5) return
    timer.current = 0
    const store = useStore.getState()
    if (store.unlocked.letters || !store.started) return
    const fallen = bodies.current.filter((b) => {
      if (!b) return false
      const r = b.rotation()
      _up.set(0, 1, 0).applyQuaternion(_q.set(r.x, r.y, r.z, r.w))
      return _up.y < 0.5
    }).length
    if (fallen >= Math.ceil(letters.length * 0.6)) store.unlock('letters')
  })

  return (
    <group position={position}>
      {letters.map((l, i) => (
        <RigidBody
          key={i}
          ref={(el) => {
            bodies.current[i] = el
          }}
          colliders={false}
          position={[l.x, l.size.y / 2 + 0.02, 0]}
          friction={0.8}
          restitution={0.05}
          linearDamping={0.2}
          angularDamping={0.4}
        >
          <CuboidCollider args={[l.size.x / 2, l.size.y / 2, l.size.z / 2]} mass={l.size.x * l.size.y * 0.6} />
          <mesh geometry={l.geometry} castShadow receiveShadow>
            <meshStandardMaterial color={l.color} roughness={0.35} metalness={0.05} />
          </mesh>
        </RigidBody>
      ))}
      {/* Unvan zemine yazılı */}
      <Text
        font={fontRegular}
        fontSize={0.9}
        color={COLORS.ink}
        fillOpacity={0.85}
        anchorX="center"
        anchorY="middle"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.07, 2.4]}
        letterSpacing={0.08}
      >
        {L(profile.title).toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : 'en-US')}
      </Text>
    </group>
  )
}
