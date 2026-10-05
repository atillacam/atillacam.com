import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody, useRapier } from '@react-three/rapier'
import * as THREE from 'three'
import { AREAS } from './layout.js'
import { heightAt } from './terrain.js'
import { vehicleState } from './input.js'
import { useStore } from '../store.js'
import { playCrumble, playThud } from '../audio.js'

// Kırılabilir dünya: banklar, çitler ve tuğla duvarlar araba çarpana kadar sabit durur,
// çarpınca parçalara ayrılır; bir süre sonra (araba uzaktayken) eski hâline döner.
const RESPAWN_MS = 20000
const MIN_SPEED = 3.5 // m/s: hafif sürtünme parçalamaz

const WOOD = '#9a6a43'
const WOOD_DARK = '#6e4a2f'
const METAL = '#2a2e38'

// Parça listeleri: [boyut, yerel konum, renk, kütle]
function benchParts() {
  return [
    [[1.8, 0.08, 0.5], [0, 0.48, 0], WOOD, 0.25],
    [[1.8, 0.4, 0.07], [0, 0.78, -0.24], WOOD, 0.2],
    [[0.08, 0.48, 0.48], [-0.8, 0.24, 0], METAL, 0.2],
    [[0.08, 0.48, 0.48], [0.8, 0.24, 0], METAL, 0.2],
  ]
}

function fenceParts() {
  const list = [
    [[0.12, 1.1, 0.12], [-1.2, 0.55, 0], WOOD_DARK, 0.15],
    [[0.12, 1.1, 0.12], [1.2, 0.55, 0], WOOD_DARK, 0.15],
    [[2.4, 0.1, 0.06], [0, 0.85, 0], WOOD, 0.1],
    [[2.4, 0.1, 0.06], [0, 0.4, 0], WOOD, 0.1],
  ]
  // Dikey çıtalar
  for (let i = 0; i < 5; i++) list.push([[0.12, 0.95, 0.04], [-0.8 + i * 0.4, 0.5, 0.05], '#efe6d6', 0.05])
  return list
}

function wallParts() {
  const list = []
  const L = 0.9
  const H = 0.45
  const colors = ['#b5523b', '#a84a35', '#c25e44']
  for (let row = 0; row < 4; row++) {
    const shift = row % 2 ? L / 2 : 0
    const count = row % 2 ? 5 : 6
    for (let c = 0; c < count; c++) {
      const z = -2.25 + L / 2 + shift + c * L
      list.push([[0.45, H - 0.02, L - 0.03], [0, H / 2 + row * H, z], colors[(row + c) % 3], 0.15])
    }
  }
  return list
}

const area = (id) => AREAS.find((a) => a.id === id)

// Dünya yerleşimi: banklar yol kenarlarında, çitler golf yolunda, duvarlar stunt parkında ve arazi parkurunda
function placements() {
  const list = []
  // Banklar: lambaların karşısında, yolun öbür kenarında, yola dönük
  const benches = [
    [-4.4, -10, Math.PI / 2],
    [-4.4, -16, Math.PI / 2],
    [12, 4.4, Math.PI],
    [18, 4.4, Math.PI],
    [-12, -4.4, 0],
    [-18, -4.4, 0],
    [-4.4, 14, Math.PI / 2],
    [-4.4, 19, Math.PI / 2],
  ]
  // Bankın arkalığı yerel -z'de: yerel +z yola baksın diye dönüş açısı verilir
  for (const [x, z, rot] of benches) list.push({ kind: 'bench', x, z, rot, parts: benchParts() })
  // Golf yolunun iki yanında çit sıraları
  const d = new THREE.Vector2(1, 1).normalize()
  const n = new THREE.Vector2(-1, 1).normalize()
  for (const side of [-1, 1]) {
    for (const t of [15, 22, 29]) {
      const x = d.x * t + n.x * side * 3.4
      const z = d.y * t + n.y * side * 3.4
      list.push({ kind: 'fence', x, z, rot: -Math.PI / 4, parts: fenceParts() })
    }
  }
  // Tuğla duvarlar
  const stunt = area('stunt')
  list.push({ kind: 'wall', x: stunt.center[0] - 12, z: stunt.center[2] + 11, rot: 0, parts: wallParts() })
  const offroad = area('offroad')
  list.push({ kind: 'wall', x: offroad.center[0] - 13, z: offroad.center[2] - 3, rot: Math.PI / 6, parts: wallParts() })
  return list
}

function Breakable({ kind, x, z, rot, parts }) {
  const { rapier } = useRapier()
  const bodies = useRef([])
  const y = heightAt(x, z)
  const state = useRef({ broken: false, at: 0, settling: false })
  // Parçaların başlangıç dünya dönüşümleri (geri kurmak için)
  const homes = useMemo(() => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0))
    return parts.map(([, p]) => {
      const v = new THREE.Vector3(p[0], p[1], p[2]).applyQuaternion(q)
      return { pos: { x: x + v.x, y: y + v.y, z: z + v.z }, rot: { x: q.x, y: q.y, z: q.z, w: q.w } }
    })
  }, [parts, rot, x, y, z])

  const shatter = (other) => {
    const s = state.current
    if (s.broken || other.rigidBodyObject?.name !== 'vehicle') return
    // Çarpışma olayı fizik adımından sonra gelir; arabanın hızı çarpmayla zaten sönmüştür.
    // Fizik araçtan önce çalıştığı için vehicleState hâlâ bir önceki karenin (çarpma öncesi) hızını tutar.
    const speed = vehicleState.speed
    if (Math.abs(speed) < MIN_SPEED) return
    const v = { x: Math.cos(vehicleState.heading) * speed, z: -Math.sin(vehicleState.heading) * speed }
    s.broken = true
    s.at = performance.now()
    bodies.current.forEach((rb, i) => {
      if (!rb) return
      rb.setBodyType(rapier.RigidBodyType.Dynamic, true)
      // Arabanın hızının bir kısmını parçalara aktar; yukarıdakiler daha çok savrulur
      const h = homes[i].pos.y - y
      const k = 0.45 + h * 0.15
      rb.setLinvel({ x: v.x * k + (Math.random() - 0.5) * 1.5, y: 1.2 + h + Math.random(), z: v.z * k + (Math.random() - 0.5) * 1.5 }, true)
      rb.setAngvel({ x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 6, z: (Math.random() - 0.5) * 6 }, true)
    })
    const store = useStore.getState()
    store.addProgress('wrecker', 1)
    if (!store.muted) {
      if (kind === 'wall') playCrumble()
      else playThud(2)
    }
  }

  useFrame(() => {
    const s = state.current
    // Geri kurmanın ikinci karesi: parçalar yerinde, artık sabitlenebilir
    if (s.settling) {
      s.settling = false
      bodies.current.forEach((rb) => rb?.setBodyType(rapier.RigidBodyType.Fixed, true))
      return
    }
    if (!s.broken || performance.now() - s.at < RESPAWN_MS) return
    // Araba yakındayken geri kurma (parçalar arabanın içine doğmasın)
    if (Math.hypot(vehicleState.position.x - x, vehicleState.position.z - z) < 10) return
    // Sabit gövdelerin görüntüsü fizikten senkronlanmaz: önce bir kare kinematik yap ki
    // ekrandaki parçalar da yerine otursun, sonraki karede sabitle
    bodies.current.forEach((rb, i) => {
      if (!rb) return
      rb.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true)
      rb.setTranslation(homes[i].pos, true)
      rb.setRotation(homes[i].rot, true)
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true)
    })
    s.broken = false
    s.settling = true
  })

  return parts.map(([size, , color, mass], i) => (
    <RigidBody
      key={i}
      ref={(el) => (bodies.current[i] = el)}
      type="fixed"
      colliders={false}
      position={[homes[i].pos.x, homes[i].pos.y, homes[i].pos.z]}
      rotation={[0, rot, 0]}
      friction={0.7}
      linearDamping={0.2}
      angularDamping={0.3}
      onCollisionEnter={(p) => shatter(p.other)}
    >
      <CuboidCollider args={size.map((v) => v / 2)} mass={mass} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.8} metalness={color === METAL ? 0.5 : 0} />
      </mesh>
    </RigidBody>
  ))
}

export default function Breakables() {
  const list = useMemo(() => placements(), [])
  return list.map((b, i) => <Breakable key={i} {...b} />)
}
