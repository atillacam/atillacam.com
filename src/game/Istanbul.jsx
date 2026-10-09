import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { ISTANBUL, LAKE } from './layout.js'
import { heightAt } from './terrain.js'
import { vehicleState } from './input.js'
import { world } from './time.js'
import { useStore } from '../store.js'
import { playFerryHorn } from '../audio.js'
import { fontBlack } from './fonts.js'
import StaticMerge from './StaticMerge.jsx'

// İstanbul dokunuşları: Galata Kulesi, gölde Kız Kulesi ve etrafında dönen vapur, meydanda simitçi.
// Hepsi basit, az poligonlu parçalardan kurulur; gece pencereler yanar.

const STONE = '#dccaa6'
const STONE_DARK = '#bea983'
const LEAD = '#5b6878'

// Gece yanan pencere malzemesi (bütün İstanbul parçaları paylaşır)
function useWindowMaterial() {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2d3340', emissive: '#ffc970', emissiveIntensity: 0, roughness: 0.6 }), [])
  useFrame(() => {
    material.emissiveIntensity = world.night * 1.6
  })
  return material
}

function Galata({ windows }) {
  const { x, z } = ISTANBUL.galata
  const y = useMemo(() => {
    // Taban, eğimli zeminde boşluk kalmasın diye en alçak noktaya oturur
    let min = Infinity
    for (let a = 0; a < 8; a++) min = Math.min(min, heightAt(x + Math.cos(a) * 2.8, z + Math.sin(a) * 2.8))
    return min
  }, [x, z])
  const BODY = 11
  const slots = useMemo(() => {
    const list = []
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + (row % 2 ? Math.PI / 6 : 0)
        list.push({ a, h: 3 + row * 3 })
      }
    }
    return list
  }, [])
  return (
    <StaticMerge position={[x, y, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[8, 2.75]} position={[0, 8, 0]} />
      </RigidBody>
      {/* Gövde */}
      <mesh position={[0, BODY / 2 - 0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.55, 2.75, BODY + 1, 14]} />
        <meshStandardMaterial color={STONE} roughness={0.9} />
      </mesh>
      {/* Kapı */}
      <mesh position={[0, 1.1, 2.62]} material={windows}>
        <boxGeometry args={[1.1, 2.2, 0.3]} />
      </mesh>
      {/* Gövde pencereleri */}
      {slots.map((s, i) => (
        <mesh key={i} position={[Math.sin(s.a) * 2.6, s.h, Math.cos(s.a) * 2.6]} rotation={[0, s.a, 0]} material={windows}>
          <boxGeometry args={[0.38, 0.9, 0.2]} />
        </mesh>
      ))}
      {/* Korniş ve seyir galerisi */}
      <mesh position={[0, BODY, 0]} castShadow>
        <cylinderGeometry args={[2.95, 2.75, 0.4, 14]} />
        <meshStandardMaterial color={STONE_DARK} roughness={0.85} />
      </mesh>
      <mesh position={[0, BODY + 1.05, 0]} material={windows}>
        <cylinderGeometry args={[2.35, 2.35, 1.7, 14]} />
      </mesh>
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.sin(a) * 2.45, BODY + 1.05, Math.cos(a) * 2.45]} rotation={[0, a, 0]} castShadow>
            <boxGeometry args={[0.32, 1.7, 0.3]} />
            <meshStandardMaterial color={STONE} roughness={0.9} />
          </mesh>
        )
      })}
      <mesh position={[0, BODY + 2.05, 0]} castShadow>
        <cylinderGeometry args={[2.75, 2.6, 0.3, 14]} />
        <meshStandardMaterial color={STONE_DARK} roughness={0.85} />
      </mesh>
      {/* Külah ve alem */}
      <mesh position={[0, BODY + 2.2 + 2.6, 0]} castShadow>
        <coneGeometry args={[2.7, 5.2, 14]} />
        <meshStandardMaterial color={LEAD} roughness={0.55} metalness={0.25} />
      </mesh>
      <mesh position={[0, BODY + 7.75, 0]}>
        <sphereGeometry args={[0.16, 12, 8]} />
        <meshStandardMaterial color="#e2b546" metalness={0.8} roughness={0.3} />
      </mesh>
    </StaticMerge>
  )
}

// Türk bayrağı: kırmızı zemin, ay için üst üste iki daire, yıldız için beşgen
export function Flag({ position }) {
  const flag = useRef()
  useFrame((state) => {
    if (flag.current) flag.current.rotation.y = Math.sin(state.clock.elapsedTime * 2.1) * 0.12
  })
  return (
    <group position={position} userData={{ noMerge: true }}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 1.6, 6]} />
        <meshStandardMaterial color="#d9d9d9" metalness={0.6} roughness={0.4} />
      </mesh>
      <group ref={flag} position={[0, 1.05, 0]}>
        <group position={[0.42, 0, 0]}>
          <mesh>
            <planeGeometry args={[0.84, 0.56]} />
            <meshStandardMaterial color="#e30a17" side={THREE.DoubleSide} roughness={0.8} />
          </mesh>
          {[1, -1].map((side) => (
            <group key={side} position={[0, 0, side * 0.004]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
              <mesh position={[-0.12 * side, 0, 0]}>
                <circleGeometry args={[0.14, 24]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              <mesh position={[-0.085 * side, 0, 0.002]}>
                <circleGeometry args={[0.112, 24]} />
                <meshBasicMaterial color="#e30a17" />
              </mesh>
              <mesh position={[0.06 * side, 0, 0.002]} rotation={[0, 0, Math.PI / 2]}>
                <circleGeometry args={[0.055, 5]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
  )
}

function MaidenTower({ windows }) {
  const { x, z } = ISTANBUL.maiden
  const bottom = heightAt(x, z) - 0.3
  const top = LAKE.waterLevel + 0.45
  const rock = top - bottom
  return (
    <StaticMerge position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[(rock + 3.6) / 2, 2.6]} position={[0, bottom + (rock + 3.6) / 2, 0]} />
      </RigidBody>
      {/* Kayalık ada */}
      <mesh position={[0, bottom + rock / 2, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[2.3, 2.9, rock, 9]} />
        <meshStandardMaterial color="#8d8a83" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, top + 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[2.15, 2.3, 0.12, 18]} />
        <meshStandardMaterial color="#cfc8b8" roughness={0.9} />
      </mesh>
      {/* Alçak ek bina */}
      <mesh position={[0.5, top + 0.65, 0.2]} castShadow receiveShadow>
        <boxGeometry args={[2.6, 1.2, 1.9]} />
        <meshStandardMaterial color="#f1ece1" roughness={0.85} />
      </mesh>
      <mesh position={[0.5, top + 1.3, 0.2]} castShadow>
        <boxGeometry args={[2.75, 0.12, 2.05]} />
        <meshStandardMaterial color="#c9c2b3" roughness={0.85} />
      </mesh>
      {[-0.5, 0.3, 1.1].map((wx) => (
        <mesh key={wx} position={[wx, top + 0.75, 1.17]} material={windows}>
          <boxGeometry args={[0.28, 0.5, 0.06]} />
        </mesh>
      ))}
      {/* Kule: sekizgen gövde, külah ve fener */}
      <mesh position={[-0.75, top + 1.75, -0.2]} castShadow>
        <cylinderGeometry args={[0.72, 0.78, 3.5, 8]} />
        <meshStandardMaterial color="#f4efe4" roughness={0.85} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 8
        return (
          <mesh key={i} position={[-0.75 + Math.sin(a) * 0.74, top + 2.7, -0.2 + Math.cos(a) * 0.74]} rotation={[0, a, 0]} material={windows}>
            <boxGeometry args={[0.22, 0.5, 0.06]} />
          </mesh>
        )
      })}
      <mesh position={[-0.75, top + 3.65, -0.2]} castShadow>
        <cylinderGeometry args={[0.9, 0.9, 0.18, 8]} />
        <meshStandardMaterial color="#d8d1c2" roughness={0.85} />
      </mesh>
      <mesh position={[-0.75, top + 4.35, -0.2]} castShadow>
        <coneGeometry args={[0.8, 1.3, 8]} />
        <meshStandardMaterial color={LEAD} roughness={0.55} metalness={0.25} />
      </mesh>
      <Flag position={[1.5, top + 1.35, 0.9]} />
    </StaticMerge>
  )
}

// Şehir hatları vapuru: koyu tekne, beyaz kamara, sarı-siyah baca
function hullShape(length, width) {
  const s = new THREE.Shape()
  const h = length / 2
  const w = width / 2
  s.moveTo(-h, -w * 0.8)
  s.lineTo(h - 0.9, -w)
  s.quadraticCurveTo(h, -w * 0.6, h + 0.15, 0)
  s.quadraticCurveTo(h, w * 0.6, h - 0.9, w)
  s.lineTo(-h, w * 0.8)
  s.quadraticCurveTo(-h - 0.25, 0, -h, -w * 0.8)
  return s
}

// Göl turu: Kız Kulesi'nin çevresinde daire
const LAKE_ROUTE = {
  speed: 0.11,
  start: 0.6,
  at: (a) => ({ x: LAKE.x + Math.cos(a) * ISTANBUL.ferryRadius, z: LAKE.z + Math.sin(a) * ISTANBUL.ferryRadius, dx: -Math.sin(a), dz: Math.cos(a) }),
}

// route: { speed (rad/sn), start, at(açı) → { x, z, dx, dz } (konum ve gidiş yönü) }, scale: boyut, level: su seviyesi
export function Ferry({ windows, route = LAKE_ROUTE, scale = 1, level = LAKE.waterLevel }) {
  const body = useRef()
  const model = useRef()
  const state = useRef({ angle: route.start, hornAt: 0, nearAt: 0 })
  const geometries = useMemo(() => {
    const extrude = (shape, depth) => {
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
      // Şekil x-y düzleminde: yatay düzleme (x-z) çevir, tabanı y=0'a koy
      g.rotateX(-Math.PI / 2)
      return g
    }
    return { hull: extrude(hullShape(4.6, 1.6), 0.6), band: extrude(hullShape(4.5, 1.56), 0.28) }
  }, [])
  const _q = useMemo(() => new THREE.Quaternion(), [])
  const _up = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  useFrame((frame, delta) => {
    const s = state.current
    const dt = Math.min(delta, 0.05)
    s.angle += dt * route.speed
    const { x, z, dx, dz } = route.at(s.angle)
    const t = frame.clock.elapsedTime
    const y = level - 0.28 * scale + Math.sin(t * 1.3) * 0.04
    // Gidiş yönünde ilerler (+x burnu): yaw = atan2(-dz, dx)
    const yaw = Math.atan2(-dz, dx)
    _q.setFromAxisAngle(_up, yaw)
    body.current?.setNextKinematicTranslation({ x, y, z })
    body.current?.setNextKinematicRotation(_q)
    if (model.current) model.current.rotation.x = Math.sin(t * 0.9) * 0.025

    // Düdük: ara sıra (oyuncu yakınsa) ve araç burnuna yaklaşınca
    const { muted, started } = useStore.getState()
    if (muted || !started) return
    const p = vehicleState.position
    const d = Math.hypot(p.x - x, p.z - z)
    const now = performance.now()
    if (d < 7 * scale && now - s.nearAt > 9000) {
      s.nearAt = now
      s.hornAt = now
      playFerryHorn(1)
    } else if (d < 45 * scale && now - s.hornAt > 42000) {
      s.hornAt = now
      playFerryHorn(Math.max(0.25, 1 - d / (45 * scale)))
    }
  })

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[route.at(route.start).x, level, route.at(route.start).z]}>
      <CuboidCollider args={[2.35 * scale, 1.1 * scale, 0.82 * scale]} position={[0, -0.1 * scale, 0]} />
      <group ref={model} scale={scale}>
        <StaticMerge>
        <mesh geometry={geometries.hull} position={[0, -0.45, 0]} castShadow>
          <meshStandardMaterial color="#1f2a3a" roughness={0.7} />
        </mesh>
        <mesh geometry={geometries.band} position={[0, 0.15, 0]} castShadow>
          <meshStandardMaterial color="#f3f1ea" roughness={0.75} />
        </mesh>
        {/* Kamara, pencere şeridi, üst güverte */}
        <mesh position={[-0.2, 0.83, 0]} castShadow>
          <boxGeometry args={[2.9, 0.8, 1.22]} />
          <meshStandardMaterial color="#f7f5ef" roughness={0.75} />
        </mesh>
        <mesh position={[-0.2, 0.9, 0]} material={windows}>
          <boxGeometry args={[2.92, 0.24, 1.24]} />
        </mesh>
        <mesh position={[0.25, 1.43, 0]} castShadow>
          <boxGeometry args={[1.4, 0.4, 1.0]} />
          <meshStandardMaterial color="#f7f5ef" roughness={0.75} />
        </mesh>
        <mesh position={[0.25, 1.48, 0]} material={windows}>
          <boxGeometry args={[1.42, 0.14, 1.02]} />
        </mesh>
        {/* Baca */}
        <mesh position={[-0.55, 1.75, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.22, 0.75, 14]} />
          <meshStandardMaterial color="#f2c230" roughness={0.6} />
        </mesh>
        <mesh position={[-0.55, 2.17, 0]}>
          <cylinderGeometry args={[0.205, 0.205, 0.12, 14]} />
          <meshStandardMaterial color="#16181d" roughness={0.6} />
        </mesh>
        </StaticMerge>
      </group>
    </RigidBody>
  )
}

// Simitçi tezgâhı: kırmızı çerçeveli camlı kasa, içinde simitler, üstünde tente.
// Hafif dinamik cisim: araçla itilebilir, sert çarpınca devrilir.
function SimitCart() {
  const { x, z, rot } = ISTANBUL.simit
  const y = heightAt(x, z)
  const simits = useMemo(() => {
    const list = []
    for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) list.push([-0.45 + i * 0.3, 1.2 + row * 0.11, -0.12 + row * 0.2])
    return list
  }, [])
  return (
    <RigidBody colliders={false} position={[x, y, z]} rotation={[0, rot, 0]} linearDamping={0.6} angularDamping={0.8}>
      <CuboidCollider args={[0.8, 0.85, 0.48]} position={[0, 0.85, 0]} mass={60} />
      <StaticMerge>
      {/* Kasa ve tekerlekler */}
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.55, 0.85]} />
        <meshStandardMaterial color="#c8302c" roughness={0.6} />
      </mesh>
      {[-0.55, 0.55].map((wx) => (
        <mesh key={wx} position={[wx, 0.3, 0.46]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.08, 16]} />
          <meshStandardMaterial color="#2a2c31" roughness={0.8} />
        </mesh>
      ))}
      {[-0.65, 0.65].map((lx) => (
        <mesh key={lx} position={[lx, 0.22, -0.35]} castShadow>
          <boxGeometry args={[0.07, 0.44, 0.07]} />
          <meshStandardMaterial color="#2a2c31" roughness={0.8} />
        </mesh>
      ))}
      {/* Camlı vitrin ve simitler */}
      <mesh position={[0, 1.27, 0]}>
        <boxGeometry args={[1.4, 0.55, 0.78]} />
        <meshStandardMaterial color="#cfe8ff" transparent opacity={0.22} roughness={0.1} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.56, 0]} castShadow>
        <boxGeometry args={[1.46, 0.06, 0.84]} />
        <meshStandardMaterial color="#c8302c" roughness={0.6} />
      </mesh>
      {simits.map((p, i) => (
        <mesh key={i} position={p} rotation={[-Math.PI / 2 + 0.25, 0, 0]}>
          <torusGeometry args={[0.11, 0.045, 8, 18]} />
          <meshStandardMaterial color={i % 3 ? '#b8662a' : '#a95a22'} roughness={0.85} />
        </mesh>
      ))}
      <Text font={fontBlack} fontSize={0.2} color="#ffffff" position={[0, 0.74, 0.43]} anchorX="center" anchorY="middle">
        SİMİT
      </Text>
      {/* Tente */}
      <mesh position={[0, 1.95, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.8, 6]} />
        <meshStandardMaterial color="#d9d9d9" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 2.45, 0]} castShadow>
        <coneGeometry args={[1.05, 0.4, 8, 1, true]} />
        <meshStandardMaterial color="#f4efe4" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 2.26, 0]}>
        <cylinderGeometry args={[1.06, 1.06, 0.06, 8, 1, true]} />
        <meshStandardMaterial color="#c8302c" roughness={0.7} side={THREE.DoubleSide} />
      </mesh>
      </StaticMerge>
    </RigidBody>
  )
}

export default function Istanbul() {
  const windows = useWindowMaterial()
  return (
    <>
      <Galata windows={windows} />
      <MaidenTower windows={windows} />
      <Ferry windows={windows} />
      <SimitCart />
    </>
  )
}
