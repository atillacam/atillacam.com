import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BallCollider, CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { AREAS, GOLF_PAR } from './layout.js'
import { heightAt } from './terrain.js'
import { fontBlack } from './fonts.js'
import { useStore } from '../store.js'
import { translate, useT } from '../i18n.js'
import { playChime, playClick } from '../audio.js'

// Mini golf: arabayla dev topu itip deliğe sok. Arabanın topa her dokunuşu bir vuruş.
// Kursun ortasında dönen kanatlı bir yel değirmeni, deliğin önünde tamponlar var.
const G = AREAS.find((a) => a.id === 'golf')
const [CX, , CZ] = G.center
const Y = heightAt(CX, CZ)
const BALL_R = 0.7
// Tee kuzeybatıda (yolun girdiği taraf), delik güneydoğuda
const DIR = new THREE.Vector3(1, 0, 1).normalize()
const SIDE = new THREE.Vector3(-1, 0, 1).normalize()
const local = (d, s, y = 0) => [CX + DIR.x * d + SIDE.x * s, Y + y, CZ + DIR.z * d + SIDE.z * s]
const TEE = local(-6.5, 0, BALL_R + 0.1)
const HOLE = local(6.8, 0)
const YAW = Math.atan2(-DIR.z, DIR.x) // yerel +x = tee → delik yönü

function feltTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#3f9a4a'
  ctx.fillRect(0, 0, size, size)
  // Biçilmiş çim halkaları
  for (let i = 0; i < 8; i++) {
    ctx.strokeStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
    ctx.lineWidth = size / 16
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, (i + 0.5) * (size / 16), 0, Math.PI * 2)
    ctx.stroke()
  }
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1)
  }
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// Gamzeli golf topu: küçük çukurlar için köşeleri hafifçe içeri it
function golfBallGeometry() {
  const g = new THREE.IcosahedronGeometry(BALL_R, 4)
  const pos = g.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const n = Math.sin(v.x * 24) * Math.sin(v.y * 24) * Math.sin(v.z * 24)
    v.multiplyScalar(1 - Math.max(n, 0) * 0.02)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

// Tüm modülün paylaştığı tur durumu
const round = { strokes: 0, sunkAt: 0, lastHit: 0 }

function Ball() {
  const body = useRef()
  const geometry = useMemo(() => golfBallGeometry(), [])
  const outside = useRef(0)

  // Geliştirme sırasında konsoldan test edebilmek için
  useEffect(() => {
    if (import.meta.env.DEV) window.__portfolio = Object.assign(window.__portfolio ?? {}, { golfBall: body.current })
  }, [])

  const reset = () => {
    const b = body.current
    if (!b) return
    b.setTranslation({ x: TEE[0], y: TEE[1], z: TEE[2] }, true)
    b.setLinvel({ x: 0, y: 0, z: 0 }, true)
    b.setAngvel({ x: 0, y: 0, z: 0 }, true)
  }

  useFrame((_, delta) => {
    const b = body.current
    if (!b) return
    // Delikten sonra kısa bir bekleme, ardından topu tee'ye geri koy
    if (round.sunkAt && performance.now() - round.sunkAt > 1600) {
      round.sunkAt = 0
      round.strokes = 0
      useStore.getState().setGolf({ strokes: 0 })
      reset()
      return
    }
    // Kurstan uzaklaşan top birkaç saniye sonra tee'ye döner (vuruş sayısı korunur)
    const t = b.translation()
    const far = Math.hypot(t.x - CX, t.z - CZ) > G.radius + 3 || t.y < Y - 3
    outside.current = far ? outside.current + delta : 0
    if (outside.current > 2.5) {
      outside.current = 0
      reset()
    }
  })

  return (
    <RigidBody
      ref={body}
      name="golfball"
      colliders={false}
      position={TEE}
      restitution={0.35}
      friction={0.6}
      linearDamping={0.85}
      angularDamping={0.6}
      ccd
      onCollisionEnter={(p) => {
        if (p.other.rigidBodyObject?.name !== 'vehicle' || round.sunkAt) return
        const now = performance.now()
        if (now - round.lastHit < 500) return
        round.lastHit = now
        round.strokes += 1
        const store = useStore.getState()
        store.setGolf({ strokes: round.strokes })
        if (!store.muted) playClick()
      }}
    >
      <BallCollider args={[BALL_R]} mass={0.3} />
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial color="#fbfbf7" roughness={0.35} />
      </mesh>
    </RigidBody>
  )
}

function Hole() {
  const flag = useRef()
  useFrame((state) => {
    // Bayrak rüzgârda dalgalanır
    if (flag.current) flag.current.rotation.y = Math.sin(state.clock.elapsedTime * 2.4) * 0.25
  })
  return (
    <group position={HOLE}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider
          sensor
          args={[0.4, 0.75]}
          position={[0, 0.4, 0]}
          onIntersectionEnter={(p) => {
            if (p.other.rigidBodyObject?.name !== 'golfball' || round.sunkAt) return
            round.sunkAt = performance.now()
            const strokes = Math.max(round.strokes, 1)
            const store = useStore.getState()
            store.sinkGolf(strokes)
            const diff = strokes - GOLF_PAR
            const label = strokes === 1 ? translate('golfHoleInOne', store.lang) : diff < 0 ? translate('golfUnderPar', store.lang) : diff === 0 ? translate('golfPar', store.lang) : translate('golfOverPar', store.lang)
            store.toast('⛳', `${label} · ${strokes} ${translate('golfStrokes', store.lang)}`)
            if (!store.muted) playChime()
            // Topu deliğin dibine "düşür"
            p.other.rigidBody?.setLinvel({ x: 0, y: -2, z: 0 }, true)
          }}
        />
      </RigidBody>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <circleGeometry args={[1.05, 40]} />
        <meshStandardMaterial color="#0e1210" roughness={1} polygonOffset polygonOffsetFactor={-4} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.055, 0]}>
        <ringGeometry args={[1.05, 1.2, 40]} />
        <meshStandardMaterial color="#f6f3ec" roughness={0.6} polygonOffset polygonOffsetFactor={-4} />
      </mesh>
      <mesh position={[0, 1.8, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 3.6, 8]} />
        <meshStandardMaterial color="#f6f3ec" roughness={0.4} />
      </mesh>
      <group ref={flag} position={[0, 3.3, 0]}>
        <mesh position={[0.6, 0, 0]} castShadow>
          <boxGeometry args={[1.2, 0.7, 0.03]} />
          <meshStandardMaterial color="#ff5d5d" roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}

// Yel değirmeni: kanatlar tünelin önünde döner; top ve araba alttan geçmek için zamanlamayı tutturmalı
function Windmill() {
  const blades = useRef()
  const hub = useMemo(() => local(0.6, 0, 3.3), [])
  const axis = useMemo(() => new THREE.Vector3(DIR.x, 0, DIR.z), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const base = useMemo(() => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), YAW), [])
  const spin = useMemo(() => new THREE.Quaternion(), [])
  useFrame((state) => {
    const b = blades.current
    if (!b) return
    spin.setFromAxisAngle(axis, state.clock.elapsedTime * 0.9)
    q.copy(spin).multiply(base)
    b.setNextKinematicRotation(q)
  })
  const tower = local(1.4, 0)
  return (
    <group>
      {/* Gövde: iki yan ayak + çatı, aradan 2.8 m genişliğinde tünel */}
      <RigidBody type="fixed" colliders={false} position={tower} rotation={[0, YAW, 0]}>
        {[-1, 1].map((s) => (
          <CuboidCollider key={s} args={[0.7, 1.2, 0.35]} position={[0, 1.2, s * 1.75]} />
        ))}
        <CuboidCollider args={[0.7, 0.9, 2.1]} position={[0, 3.3, 0]} />
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0, 1.2, s * 1.75]} castShadow receiveShadow>
            <boxGeometry args={[1.4, 2.4, 0.7]} />
            <meshStandardMaterial color="#f2e6cf" roughness={0.8} />
          </mesh>
        ))}
        <mesh position={[0, 3.3, 0]} castShadow>
          <boxGeometry args={[1.4, 1.8, 4.2]} />
          <meshStandardMaterial color="#f2e6cf" roughness={0.8} />
        </mesh>
        <mesh position={[0, 4.75, 0]} rotation={[0, 0, 0]} castShadow>
          <coneGeometry args={[2.3, 1.4, 4, 1]} />
          <meshStandardMaterial color="#c8553d" roughness={0.7} />
        </mesh>
      </RigidBody>
      {/* Dönen kanatlar (kinematik): çapraz iki çubuk */}
      <RigidBody ref={blades} type="kinematicPosition" colliders={false} position={hub} rotation={[0, YAW, 0]}>
        <CuboidCollider args={[0.08, 2.9, 0.22]} />
        <CuboidCollider args={[0.08, 0.22, 2.9]} />
        <mesh castShadow>
          <boxGeometry args={[0.12, 5.8, 0.5]} />
          <meshStandardMaterial color="#8a5a3b" roughness={0.8} />
        </mesh>
        <mesh castShadow>
          <boxGeometry args={[0.12, 0.5, 5.8]} />
          <meshStandardMaterial color="#8a5a3b" roughness={0.8} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.32, 0.32, 0.3, 16]} />
          <meshStandardMaterial color="#2a2e38" roughness={0.5} />
        </mesh>
      </RigidBody>
    </group>
  )
}

// Deliğin önündeki yuvarlak tamponlar
const BUMPERS = [
  [4.2, -2.2],
  [4.6, 2.4],
  [8.6, -1.4],
]

function Course() {
  const { t } = useT()
  const texture = useMemo(() => feltTexture(), [])
  // Kenar bordürü: girişte (kuzeybatı, yolun geldiği taraf) arabanın girebileceği bir boşluk bırak
  const curbs = useMemo(() => {
    const list = []
    const n = 28
    const gap = Math.atan2(-DIR.z, -DIR.x) // tee arkası
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const d = Math.abs(Math.atan2(Math.sin(a - gap), Math.cos(a - gap)))
      if (d < 0.3) continue
      list.push({ x: CX + Math.cos(a) * (G.radius - 0.3), z: CZ + Math.sin(a) * (G.radius - 0.3), rot: -a })
    }
    return list
  }, [])
  const segment = ((Math.PI * 2 * (G.radius - 0.3)) / 28) * 1.02
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CX, Y + 0.03, CZ]} receiveShadow>
        <circleGeometry args={[G.radius - 0.4, 72]} />
        <meshStandardMaterial map={texture} roughness={0.95} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      {/* Tee alanı */}
      <mesh rotation={[-Math.PI / 2, 0, -YAW]} position={[TEE[0], Y + 0.045, TEE[2]]}>
        <planeGeometry args={[2.6, 2.6]} />
        <meshStandardMaterial color="#2f7a3a" roughness={0.9} polygonOffset polygonOffsetFactor={-3} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        {curbs.map((c, i) => (
          <CuboidCollider key={i} args={[0.18, 0.22, segment / 2]} position={[c.x, Y + 0.22, c.z]} rotation={[0, c.rot, 0]} />
        ))}
        {BUMPERS.map(([d, s], i) => {
          const [x, , z] = local(d, s)
          return <CylinderCollider key={i} args={[0.45, 0.5]} position={[x, Y + 0.45, z]} restitution={1.1} />
        })}
      </RigidBody>
      {curbs.map((c, i) => (
        <mesh key={i} position={[c.x, Y + 0.22, c.z]} rotation={[0, c.rot, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.36, 0.44, segment]} />
          <meshStandardMaterial color={i % 2 ? '#f6f3ec' : '#2ec4b6'} roughness={0.6} />
        </mesh>
      ))}
      {BUMPERS.map(([d, s], i) => {
        const [x, , z] = local(d, s)
        return (
          <mesh key={i} position={[x, Y + 0.45, z]} castShadow>
            <cylinderGeometry args={[0.5, 0.55, 0.9, 20]} />
            <meshStandardMaterial color="#ffb547" roughness={0.4} emissive="#ff8a1f" emissiveIntensity={0.25} />
          </mesh>
        )
      })}
      <Text font={fontBlack} fontSize={1.3} color="#ffffff" fillOpacity={0.85} rotation={[-Math.PI / 2, 0, 0]} position={local(-2, 6.5, 0.06)} anchorX="center" anchorY="middle">
        {`${t('areaGolf').toLocaleUpperCase()} · PAR ${GOLF_PAR}`}
      </Text>
    </group>
  )
}

export default function MiniGolf() {
  return (
    <group>
      <Course />
      <Windmill />
      <Hole />
      <Ball />
    </group>
  )
}
