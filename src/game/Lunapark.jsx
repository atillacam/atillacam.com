import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { WHEEL } from './layout.js'
import { heightAt } from './terrain.js'
import { vehicleState } from './input.js'
import { world } from './time.js'
import { translate } from '../i18n.js'
import Signboard from './Signboard.jsx'
import { useStore } from '../store.js'
import { cabinAngle, wheelAngle } from './wheel.js'
import StaticMerge from './StaticMerge.jsx'
import Halo from './Halo.jsx'

// Lunapark: Asya Yakası'nın kuzey bloğunda dev dönme dolap. Teker x eksenine dik düzlemde (denizden tam
// görünecek şekilde) sürekli döner; kabinler hep dik asılı kalır. Binince kamera kabine geçer ve bir tam
// tur boyunca Boğaz'ı, köprüyü ve iki yakayı gösterir. Jantlardaki ampuller renk renk yanıp söner.

const HANG = 1.35 // asma noktasından kabin merkezine
const RIM_BULBS = 48
const CABIN_COLORS = ['#ff5d73', '#ffb547', '#4fd99a', '#5bb8ff', '#b28dff', '#ff8a3d']

// Kabin merkezinin dünya konumu
function cabinPosition(i, t, out = new THREE.Vector3()) {
  const a = cabinAngle(i, t)
  const ground = heightAt(WHEEL.x, WHEEL.z)
  return out.set(WHEEL.x, ground + WHEEL.hub + Math.sin(a) * WHEEL.radius - HANG, WHEEL.z + Math.cos(a) * WHEEL.radius)
}

// Ayak: zeminden göbeğe uzanan eğik direk
function Leg({ x, z, hub }) {
  const length = Math.hypot(z, hub)
  const tilt = Math.atan2(-z, hub)
  return (
    <mesh position={[x, hub / 2, z / 2]} rotation={[tilt, 0, 0]} castShadow>
      <cylinderGeometry args={[0.22, 0.32, length, 10]} />
      <meshStandardMaterial color="#e9edf3" roughness={0.4} metalness={0.6} />
    </mesh>
  )
}

function Cabin({ color }) {
  return (
    <group>
      {/* Askı */}
      <mesh position={[0, HANG / 2 + 0.2, 0]}>
        <cylinderGeometry args={[0.05, 0.05, HANG - 0.2, 6]} />
        <meshStandardMaterial color="#c7ccd4" metalness={0.7} roughness={0.35} />
      </mesh>
      {/* Gövde: alt yarısı renkli, üstü camlı, şapkalı çatı */}
      <mesh position={[0, -0.45, 0]} castShadow>
        <boxGeometry args={[2.1, 1, 2.1]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[2.0, 0.75, 2.0]} />
        <meshStandardMaterial color="#cfe8ff" roughness={0.1} metalness={0.2} transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.95, 0]} castShadow>
        <coneGeometry args={[1.55, 0.6, 4]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.2} />
      </mesh>
    </group>
  )
}

export function FerrisWheel() {
  const lang = useStore((s) => s.lang)
  const rotor = useRef()
  const cabins = useRef([])
  const bulbs = useRef()
  const ground = useMemo(() => heightAt(WHEEL.x, WHEEL.z), [])
  const { hub, radius } = WHEEL

  // Ampuller: iki jantta eşit aralıklı
  const bulbList = useMemo(() => {
    const list = []
    for (const x of [-1.2, 1.2]) for (let i = 0; i < RIM_BULBS; i++) list.push({ x, a: (i / RIM_BULBS) * Math.PI * 2, i })
    return list
  }, [])
  useLayoutEffect(() => {
    const mesh = bulbs.current
    const m = new THREE.Matrix4()
    bulbList.forEach((b, i) => {
      mesh.setMatrixAt(i, m.makeTranslation(b.x, Math.sin(b.a) * (radius + 0.05), Math.cos(b.a) * (radius + 0.05)))
      mesh.setColorAt(i, new THREE.Color('#ffffff'))
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [bulbList, radius])

  const spokes = useMemo(() => Array.from({ length: 16 }, (_, i) => (i / 16) * Math.PI * 2), [])
  const color = useMemo(() => new THREE.Color(), [])
  const clock = useRef(0)

  useFrame((_, delta) => {
    const t = performance.now() / 1000
    if (rotor.current) rotor.current.rotation.x = -wheelAngle(t)
    cabins.current.forEach((c, i) => {
      if (c) cabinPosition(i, t, c.position).sub(_origin.set(WHEEL.x, ground, WHEEL.z))
    })
    // Ampullerde akan renkler (gece parlak, gündüz soluk); saniyede ~20 kez güncellenir
    clock.current += Math.max(0, delta)
    if (clock.current < 0.05 || !bulbs.current) return
    clock.current = 0
    const light = 0.4 + world.night * 0.25
    bulbList.forEach((b, i) => {
      bulbs.current.setColorAt(i, color.setHSL((b.i / RIM_BULBS + t * 0.25) % 1, 0.95, light))
    })
    bulbs.current.instanceColor.needsUpdate = true
  })

  return (
    <group position={[WHEEL.x, ground, WHEEL.z]}>
      <RigidBody type="fixed" colliders={false}>
        {/* Biniş platformu ve ayak tabanları */}
        <CuboidCollider args={[3.2, 0.3, 2.8]} position={[0, 0.3, 0]} />
        {[-2.6, 2.6].flatMap((x) => [-8, 8].map((z) => <CylinderCollider key={x + ',' + z} args={[1.2, 0.5]} position={[x, 1.2, z * 0.93]} />))}
      </RigidBody>
      <StaticMerge>
        <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[6.4, 0.6, 5.6]} />
          <meshStandardMaterial color="#c9ced6" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.62, 0]} receiveShadow>
          <boxGeometry args={[6, 0.04, 5.2]} />
          <meshStandardMaterial color="#c8302c" roughness={0.9} />
        </mesh>
        {[-2.6, 2.6].flatMap((x) => [-8, 8].map((z) => <Leg key={x + ',' + z} x={x} z={z} hub={hub} />))}
        {/* Aks */}
        <mesh position={[0, hub, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.35, 0.35, 6, 14]} />
          <meshStandardMaterial color="#8d939c" metalness={0.7} roughness={0.35} />
        </mesh>
      </StaticMerge>

      {/* Dönen kısım: iki jant, teller, göbek, ampuller */}
      <group ref={rotor} position={[0, hub, 0]}>
        {[-1.2, 1.2].map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
            <torusGeometry args={[radius, 0.16, 8, 72]} />
            <meshStandardMaterial color="#f2f4f8" roughness={0.35} metalness={0.6} />
          </mesh>
        ))}
        {[-1.2, 1.2].flatMap((x) =>
          spokes.map((a) => (
            <mesh key={x + ':' + a} position={[x, (Math.sin(a) * radius) / 2, (Math.cos(a) * radius) / 2]} rotation={[-a, 0, 0]}>
              <boxGeometry args={[0.07, 0.07, radius]} />
              <meshStandardMaterial color="#dfe3ea" roughness={0.4} metalness={0.6} />
            </mesh>
          )),
        )}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[1.1, 1.1, 2.8, 20]} />
          <meshStandardMaterial color="#ff6fae" roughness={0.4} metalness={0.3} />
        </mesh>
        <instancedMesh ref={bulbs} args={[undefined, undefined, bulbList.length]}>
          <sphereGeometry args={[0.24, 8, 6]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
        {/* Gece jant boyunca ışık haleleri */}
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2
          return <Halo key={i} position={[-1.3, Math.sin(a) * radius, Math.cos(a) * radius]} scale={4.5} color={i % 2 ? '#ff8fc4' : '#8fd8ff'} />
        })}
      </group>
      <Halo position={[1.8, hub, 0]} scale={6} color="#ff8fc4" dayOpacity={0} />

      {/* Kabinler (teker dönerken dik kalır) */}
      {Array.from({ length: WHEEL.cabins }, (_, i) => (
        <group
          key={i}
          ref={(el) => {
            cabins.current[i] = el
          }}
        >
          <Cabin color={CABIN_COLORS[i % CABIN_COLORS.length]} />
        </group>
      ))}

      {/* Bilet gişesi */}
      <group position={[-6.5, 0, 6.5]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[1, 1.3, 1]} position={[0, 1.3, 0]} />
        </RigidBody>
        <StaticMerge>
          <mesh position={[0, 1.2, 0]} castShadow>
            <boxGeometry args={[2, 2.4, 2]} />
            <meshStandardMaterial color="#fff4e6" roughness={0.7} />
          </mesh>
          <mesh position={[0, 2.65, 0]} castShadow>
            <coneGeometry args={[1.7, 1, 4]} />
            <meshStandardMaterial color="#ff6fae" roughness={0.6} />
          </mesh>
        </StaticMerge>
      </group>
      <Signboard position={[-4.8, 0, 0]} rotation={-Math.PI / 2} title={translate('spotWheel', lang).toLocaleUpperCase()} subtitle={translate('signWheel', lang)} accent="#ff6fae" postHeight={1.6} />
    </group>
  )
}

const _origin = new THREE.Vector3()
const _cam = new THREE.Vector3()
const _look = new THREE.Vector3()

// Biniş: kamera seçilen kabine geçer; tur bitince araca dönülür
export function WheelRide() {
  const camera = useThree((s) => s.camera)
  const blend = useRef(0)
  useFrame((_, delta) => {
    const store = useStore.getState()
    const ride = store.wheelRide
    if (store.mode !== 'wheel' || !ride) {
      blend.current = 0
      return
    }
    const t = performance.now() / 1000
    const progress = (t - ride.start) / WHEEL.ride
    if (progress >= 1) {
      store.endWheel(true)
      return
    }
    // Kabinin içinden, denize (batıya) bakarak; bakış yavaşça kuzeyden güneye süzülür
    cabinPosition(ride.cabin, t, _cam)
    // Batı camının hemen önünde, oturan birinin göz hizasında
    _cam.x -= 0.95
    _cam.y += 0.45
    const yaw = Math.PI + Math.sin(progress * Math.PI * 2) * 0.85
    const pitch = -0.04 - Math.sin(progress * Math.PI) * 0.16
    _look.set(_cam.x + Math.cos(yaw) * 10, _cam.y + pitch * 10, _cam.z - Math.sin(yaw) * 10)
    blend.current = Math.min(1, blend.current + Math.max(0, delta) * 1.5)
    camera.position.lerp(_cam, blend.current < 1 ? 1 - Math.exp(-6 * Math.max(0, delta)) : 1)
    camera.lookAt(_look)
    vehicleState.cameraYaw = Math.atan2(_look.x - camera.position.x, _look.z - camera.position.z)
  })
  return null
}
