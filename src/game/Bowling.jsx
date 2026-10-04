import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BallCollider, CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { AREAS } from './layout.js'
import { heightAt } from './terrain.js'
import { fontBlack } from './fonts.js'
import { useStore } from '../store.js'
import { translate, useT } from '../i18n.js'
import { playChime, playThud } from '../audio.js'

// Bowling salonu: araç doğudan (−x) gelir, pist +x yönünde uzanır
const A = AREAS.find((a) => a.id === 'bowling')
const LANE = { start: A.center[0] - 14, end: A.center[0] + 16, width: 5.2 }
const PIN_X = LANE.end - 4.2
const PIN_SPACING = 1.05

function laneTexture() {
  const W = 256
  const H = 1024
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  // Akçaağaç tahtalar
  const boards = 12
  for (let i = 0; i < boards; i++) {
    const v = 190 + ((i * 37) % 30)
    ctx.fillStyle = `rgb(${v}, ${v - 40}, ${v - 95})`
    ctx.fillRect((i * W) / boards, 0, W / boards, H)
    ctx.fillStyle = 'rgba(80,45,20,0.25)'
    ctx.fillRect((i * W) / boards, 0, 1, H)
  }
  // Nişan okları ve noktalar
  ctx.fillStyle = 'rgba(40,20,10,0.75)'
  for (let i = 2; i < boards - 1; i += 2) {
    const x = (i * W) / boards + W / boards / 2
    const y = H * 0.62 - Math.abs(i - boards / 2) * 18
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - 7, y + 26)
    ctx.lineTo(x + 7, y + 26)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x, H * 0.86, 4, 0, Math.PI * 2)
    ctx.fill()
  }
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function pinLayout() {
  const list = []
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i <= row; i++) list.push([PIN_X + row * PIN_SPACING * 0.87, (i - row / 2) * PIN_SPACING])
  }
  return list
}

function Pin({ index, base, y, register }) {
  const body = useRef()
  useEffect(() => {
    register(index, body)
  }, [index, register])
  return (
    <RigidBody ref={body} colliders={false} position={[base[0], y + 0.78, base[1] + A.center[2]]} friction={0.35} restitution={0.25} linearDamping={0.1} angularDamping={0.15}>
      <CylinderCollider args={[0.75, 0.24]} mass={0.18} />
      <mesh castShadow>
        <cylinderGeometry args={[0.15, 0.25, 1.15, 16]} />
        <meshStandardMaterial color="#f7f5f0" roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.165, 0.17, 0.09, 16]} />
        <meshStandardMaterial color="#d8322f" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.17, 0.165, 0.05, 16]} />
        <meshStandardMaterial color="#d8322f" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.66, 0]} castShadow>
        <sphereGeometry args={[0.17, 16, 12]} />
        <meshStandardMaterial color="#f7f5f0" roughness={0.25} />
      </mesh>
    </RigidBody>
  )
}

const _up = new THREE.Vector3()
const _q = new THREE.Quaternion()

export default function Bowling() {
  const { t } = useT()
  const y = heightAt(A.center[0], A.center[2])
  const z0 = A.center[2]
  const pins = useMemo(() => pinLayout(), [])
  const texture = useMemo(() => laneTexture(), [])
  const bodies = useRef([])
  const ball = useRef()
  const game = useRef({ counting: 0, settled: 0, lastDown: 0, reported: false })
  const resetId = useStore((s) => s.bowlingReset)
  const register = useMemo(() => (i, ref) => (bodies.current[i] = ref), [])
  const ballHome = useMemo(() => [LANE.start + 4, y + 1.1, z0], [y, z0])

  const reset = () => {
    pins.forEach((p, i) => {
      const b = bodies.current[i]?.current
      if (!b) return
      b.setTranslation({ x: p[0], y: y + 0.78, z: p[1] + z0 }, true)
      b.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
      b.setLinvel({ x: 0, y: 0, z: 0 }, true)
      b.setAngvel({ x: 0, y: 0, z: 0 }, true)
    })
    const bb = ball.current
    if (bb) {
      bb.setTranslation({ x: ballHome[0], y: ballHome[1], z: ballHome[2] }, true)
      bb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      bb.setAngvel({ x: 0, y: 0, z: 0 }, true)
    }
    game.current = { counting: 0, settled: 0, lastDown: 0, reported: false }
    useStore.getState().setPinsDown(0)
  }

  // "Lobutları diz" portalı
  const resetRef = useRef(reset)
  useEffect(() => {
    resetRef.current = reset
  })
  useEffect(() => {
    if (resetId) resetRef.current()
  }, [resetId])

  // Devrilen lobutları say; hareket durunca sonucu bildir, birkaç saniye sonra yeniden diz
  useFrame((_, delta) => {
    const g = game.current
    let down = 0
    let moving = false
    bodies.current.forEach((ref) => {
      const b = ref?.current
      if (!b) return
      const r = b.rotation()
      _up.set(0, 1, 0).applyQuaternion(_q.set(r.x, r.y, r.z, r.w))
      const tr = b.translation()
      if (_up.y < 0.75 || tr.y < y - 1 || tr.x > LANE.end + 1) down++
      const v = b.linvel()
      if (v.x * v.x + v.y * v.y + v.z * v.z > 0.05) moving = true
    })
    const store = useStore.getState()
    if (down !== g.lastDown) {
      g.lastDown = down
      store.setPinsDown(down)
      if (down > 0 && !g.counting) g.counting = 0.001
      if (down > 0 && !store.muted) playThud(0.6)
    }
    if (g.counting) {
      g.counting += delta
      g.settled = moving ? 0 : g.settled + delta
      if (!g.reported && (g.settled > 1.2 || g.counting > 7)) {
        g.reported = true
        if (down === pins.length) {
          store.unlock('strike')
          store.toast(translate('strike', store.lang), `${down} / ${pins.length}`)
          if (!store.muted) playChime()
        } else {
          store.toast(translate('pins', store.lang), `${down} / ${pins.length}`)
        }
      }
      if (g.reported && g.counting > 9) reset()
    }
  })

  const railZ = LANE.width / 2 + 1.0
  const length = LANE.end - LANE.start
  const mid = (LANE.start + LANE.end) / 2

  return (
    <group>
      {/* Pist ve oluklar */}
      <mesh rotation={[-Math.PI / 2, 0, -Math.PI / 2]} position={[mid, y + 0.035, z0]} receiveShadow>
        <planeGeometry args={[LANE.width, length]} />
        <meshStandardMaterial map={texture} roughness={0.25} metalness={0.05} polygonOffset polygonOffsetFactor={-3} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} rotation={[-Math.PI / 2, 0, 0]} position={[mid, y + 0.03, z0 + s * (LANE.width / 2 + 0.45)]} receiveShadow>
          <planeGeometry args={[length, 0.9]} />
          <meshStandardMaterial color="#2a2d35" roughness={0.6} polygonOffset polygonOffsetFactor={-3} />
        </mesh>
      ))}
      {/* Korkuluklar ve arka duvar (top ve lobutlar dışarı kaçmaz) */}
      <RigidBody type="fixed" colliders={false}>
        {[-1, 1].map((s) => (
          <CuboidCollider key={s} args={[length / 2, 0.45, 0.15]} position={[mid, y + 0.45, z0 + s * railZ]} />
        ))}
        <CuboidCollider args={[0.3, 1.5, railZ]} position={[LANE.end + 0.6, y + 1.5, z0]} />
      </RigidBody>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[mid, y + 0.45, z0 + s * railZ]} castShadow>
          <boxGeometry args={[length, 0.9, 0.3]} />
          <meshStandardMaterial color="#1c1f27" roughness={0.4} metalness={0.3} />
        </mesh>
      ))}
      <mesh position={[LANE.end + 0.6, y + 1.5, z0]} castShadow>
        <boxGeometry args={[0.6, 3, railZ * 2 + 0.3]} />
        <meshStandardMaterial color="#14161c" roughness={0.6} />
      </mesh>
      {/* Neon çerçeve ve tabela */}
      {[-1, 1].map((s) => (
        <mesh key={`p${s}`} position={[PIN_X - 2, y + 2.4, z0 + s * (railZ + 0.4)]} castShadow>
          <boxGeometry args={[0.3, 4.8, 0.3]} />
          <meshStandardMaterial color="#1c1f27" />
        </mesh>
      ))}
      <mesh position={[PIN_X - 2, y + 4.9, z0]}>
        <boxGeometry args={[0.4, 0.5, railZ * 2 + 1.1]} />
        <meshStandardMaterial color="#1c1f27" />
      </mesh>
      <mesh position={[PIN_X - 2.22, y + 4.9, z0]}>
        <boxGeometry args={[0.04, 0.12, railZ * 2 + 0.6]} />
        <meshStandardMaterial color="#ff8a3d" emissive="#ff8a3d" emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      <Text font={fontBlack} fontSize={1.1} color="#ffe2c8" outlineWidth={0.05} outlineColor="#ff5d1f" position={[PIN_X - 2.25, y + 5.9, z0]} rotation={[0, -Math.PI / 2, 0]} anchorX="center">
        {t('areaBowling').toLocaleUpperCase()}
      </Text>
      {pins.map((p, i) => (
        <Pin key={i} index={i} base={p} y={y} register={register} />
      ))}
      {/* İtilebilir bowling topu */}
      <RigidBody ref={ball} colliders={false} position={ballHome} restitution={0.2} friction={0.5} linearDamping={0.08} angularDamping={0.1} ccd>
        <BallCollider args={[0.75]} mass={1.6} />
        <mesh castShadow>
          <sphereGeometry args={[0.75, 32, 24]} />
          <meshPhysicalMaterial color="#3d2bd8" roughness={0.15} metalness={0.2} clearcoat={1} clearcoatRoughness={0.1} />
        </mesh>
        {[
          [0.5, 0.5, 0.2],
          [0.6, 0.38, -0.1],
          [0.42, 0.58, -0.15],
        ].map(([px, py, pz], i) => (
          <mesh key={i} position={[px, py, pz]}>
            <sphereGeometry args={[0.07, 10, 8]} />
            <meshStandardMaterial color="#0c0c12" />
          </mesh>
        ))}
      </RigidBody>
    </group>
  )
}
