import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ConvexHullCollider, CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { AREAS, COLORS } from './layout.js'
import { heightAt } from './terrain.js'
import { fontBlack } from './fonts.js'
import { vehicleState } from './input.js'
import { useStore } from '../store.js'
import { translate, useT } from '../i18n.js'
import { playCheckpoint, playChime, playClick } from '../audio.js'

// Stunt parkı: rampalar, hızlandırıcı şerit, ateş ve neon halkaları.
// Havada kalma süresi, yükseklik, takla ve halka bonusu puana dönüşür; ters inişte puan yok.
const A = AREAS.find((a) => a.id === 'stunt')
const [CX, , CZ] = A.center
const Y = heightAt(CX, CZ)
const isVehicle = (p) => p.other.rigidBodyObject?.name === 'vehicle'

// Bu atlayış sırasında kazanılan halka bonusları (Scorer okur)
const jump = { hoopBonus: 0, hoops: [] }

// Üçgen prizma rampa: yerel +x yönünde yükselir
function Ramp({ x, z, rot = 0, length, height, width = 4.4, color = '#e9e4d8', stripe = COLORS.coral }) {
  const { geometry, points } = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-length / 2, 0)
    shape.lineTo(length / 2, 0)
    shape.lineTo(length / 2, height)
    shape.closePath()
    const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false })
    g.translate(0, 0, -width / 2)
    g.computeVertexNormals()
    const points = new Float32Array([
      -length / 2, 0, -width / 2, length / 2, 0, -width / 2, length / 2, height, -width / 2,
      -length / 2, 0, width / 2, length / 2, 0, width / 2, length / 2, height, width / 2,
    ])
    return { geometry: g, points }
  }, [length, height, width])
  const angle = Math.atan2(height, length)
  const slope = Math.hypot(length, height)
  return (
    <group position={[CX + x, Y, CZ + z]} rotation={[0, rot, 0]}>
      <RigidBody type="fixed" colliders={false} friction={1}>
        <ConvexHullCollider args={[points]} />
      </RigidBody>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>
      {/* Rampa yüzeyindeki ok şeritleri */}
      {[-1.3, 1.3].map((pz) => (
        <mesh key={pz} position={[0, height / 2 + 0.02, pz]} rotation={[-Math.PI / 2, 0, angle]}>
          <planeGeometry args={[slope * 0.92, 0.32]} />
          <meshStandardMaterial color={stripe} roughness={0.6} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      ))}
    </group>
  )
}

// Hızlandırıcı şerit: üstünden geçen arabayı şerit yönünde ileri fırlatır
function Booster({ x, z, rot = 0 }) {
  const material = useRef()
  const last = useRef(0)
  const dir = useMemo(() => new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot)), [rot])
  useFrame((state) => {
    if (material.current) material.current.emissiveIntensity = 0.6 + Math.sin(state.clock.elapsedTime * 10) * 0.4
  })
  return (
    <group position={[CX + x, Y, CZ + z]} rotation={[0, rot, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          sensor
          args={[2, 1, 2]}
          position={[0, 1, 0]}
          onIntersectionEnter={(p) => {
            if (!isVehicle(p) || performance.now() - last.current < 800) return
            last.current = performance.now()
            const rb = p.other.rigidBody
            const v = rb.linvel()
            const along = v.x * dir.x + v.z * dir.z
            // Yalnızca şerit yönünde ilerleyen arabayı hızlandır (ters geçişte fırlatma)
            if (along < 2) return
            // Şerit yönündeki hızı en az 18 m/s.ye tamamla (iniş rampasına denk gelen uçuş)
            const add = Math.max(18 - along, 4)
            rb.setLinvel({ x: v.x + dir.x * add, y: v.y, z: v.z + dir.z * add }, true)
            if (!useStore.getState().muted) playClick()
          }}
        />
      </RigidBody>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <planeGeometry args={[4, 4]} />
        <meshStandardMaterial ref={material} color="#ffb547" emissive="#ff8a1f" emissiveIntensity={0.6} roughness={0.5} polygonOffset polygonOffsetFactor={-3} />
      </mesh>
      {[-1, 0, 1].map((i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, -Math.PI / 2]} position={[i * 1.1, 0.06, 0]}>
          <circleGeometry args={[0.55, 3]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

// Halka: içinden geçen arabaya bonus; ateş halkası alevlerle çevrili
function Hoop({ id, x, y, z, rot = 0, radius = 2.6, fire = false, bonus = 600 }) {
  const ring = useRef()
  const flames = useRef()
  const COUNT = 70
  const flameData = useMemo(() => Array.from({ length: COUNT }, (_, i) => ({ a: (i / COUNT) * Math.PI * 2, phase: (i * 0.618) % 1 })), [])
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3))
    return g
  }, [])
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    if (ring.current) ring.current.emissiveIntensity = fire ? 1.6 + Math.sin(t * 13) * 0.4 : 1.2 + Math.sin(t * 3) * 0.3
    if (!fire || !flames.current) return
    const pos = geometry.attributes.position
    flameData.forEach((f, i) => {
      f.phase = (f.phase + delta * 1.6) % 1
      const r = radius + Math.sin(f.a * 7 + t * 5) * 0.08
      // Alevler halka çevresinden yukarı doğru süzülür
      pos.setXYZ(i, 0, Math.sin(f.a) * r + f.phase * 0.9, Math.cos(f.a) * r)
    })
    pos.needsUpdate = true
  })
  return (
    <group position={[CX + x, Y + y, CZ + z]} rotation={[0, rot, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider
          sensor
          args={[0.4, radius - 0.3]}
          rotation={[0, 0, Math.PI / 2]}
          onIntersectionEnter={(p) => {
            if (!isVehicle(p) || jump.hoops.includes(id)) return
            jump.hoops.push(id)
            jump.hoopBonus += bonus
            const store = useStore.getState()
            store.toast(fire ? '🔥' : '💫', translate(fire ? 'stuntFireHoop' : 'stuntHoop', store.lang))
            if (fire) store.unlock('ringOfFire')
            if (!store.muted) playCheckpoint()
          }}
        />
      </RigidBody>
      <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
        <torusGeometry args={[radius, 0.2, 14, 64]} />
        <meshStandardMaterial ref={ring} color={fire ? '#ff7a1f' : '#7ad7ff'} emissive={fire ? '#ff4a0a' : '#2f9bff'} emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
      {/* Halkayı taşıyan direkler */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, -y / 2 - 0.1, s * (radius + 0.35)]} castShadow>
          <cylinderGeometry args={[0.12, 0.14, y + radius * 0.4, 10]} />
          <meshStandardMaterial color="#2a2e38" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      {fire && (
        <points ref={flames} geometry={geometry} frustumCulled={false}>
          <pointsMaterial color="#ffae3a" size={0.55} sizeAttenuation transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </points>
      )}
    </group>
  )
}

const _q = new THREE.Quaternion()
const _up = new THREE.Vector3()
const _prevUp = new THREE.Vector3(0, 1, 0)

// Puanlama: park içinde havaya kalkınca ölçmeye başlar, inişte puanı kasaya yazar
function StuntScorer() {
  const s = useRef({ air: 0, peak: 0, turn: 0, flying: false, sent: 0, ground: 0 })
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const st = s.current
    const store = useStore.getState()
    const p = vehicleState.position
    const inside = Math.hypot(p.x - CX, p.z - CZ) < A.radius + 10
    const height = p.y - heightAt(p.x, p.z)
    const q = vehicleState.quaternion
    _q.set(q.x, q.y, q.z, q.w)
    _up.set(0, 1, 0).applyQuaternion(_q)

    const airborne = !vehicleState.grounded && height > 0.9
    if (airborne && (inside || st.flying)) {
      if (!st.flying) {
        st.flying = true
        st.air = 0
        st.peak = 0
        st.turn = 0
        jump.hoopBonus = 0
        jump.hoops = []
        _prevUp.copy(_up)
      }
      st.air += dt
      st.peak = Math.max(st.peak, height)
      // Toplam dönüş açısı (takla / fıçı dönüşü)
      st.turn += _prevUp.angleTo(_up)
      _prevUp.copy(_up)
      st.ground = 0
    } else if (st.flying) {
      // Kısa sekmeler inişi bozmasın: 0.15 sn yerde kalınca iniş sayılır
      st.ground += dt
      if (st.ground > 0.15) {
        st.flying = false
        const flips = Math.floor(st.turn / (Math.PI * 2 * 0.8))
        const upright = vehicleState.upright > 0.6
        if (st.air > 0.45) {
          if (upright) {
            const points = Math.round(st.air * 220 + st.peak * 60 + flips * 800 + jump.hoopBonus)
            store.bankStunt(points, flips)
            store.toast(translate('stuntLabel', store.lang), `${points}${flips ? ` · ${flips}× ${translate('stuntFlip', store.lang)}` : ''}`)
            if (!store.muted) playChime()
          } else {
            store.setStunt({ score: 0, active: false })
            store.toast('💥', translate('stuntCrash', store.lang))
          }
        } else store.setStunt({ score: 0, active: false })
      }
    }

    // HUD'u saniyede ~10 kez güncelle
    st.sent += dt
    if (st.sent > 0.1) {
      st.sent = 0
      if (st.flying) {
        const flips = Math.floor(st.turn / (Math.PI * 2 * 0.8))
        store.setStunt({ score: Math.round(st.air * 220 + st.peak * 60 + flips * 800 + jump.hoopBonus), active: true })
      }
    }
  })
  return null
}

function ParkFloor() {
  const { t } = useT()
  return (
    <group position={[CX, Y, CZ]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <circleGeometry args={[A.radius - 0.5, 72]} />
        <meshStandardMaterial color="#363b46" roughness={0.88} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[A.radius - 1.1, A.radius - 0.5, 96]} />
        <meshStandardMaterial color={A.color} roughness={0.8} polygonOffset polygonOffsetFactor={-3} />
      </mesh>
      {/* Koşu yolu şeritleri */}
      {[-1, 1].map((s) => (
        <mesh key={s} rotation={[-Math.PI / 2, 0, 0]} position={[-14, 0.045, s * 2.6]}>
          <planeGeometry args={[9, 0.22]} />
          <meshStandardMaterial color="#f2efe6" roughness={0.8} polygonOffset polygonOffsetFactor={-3} />
        </mesh>
      ))}
      <Text font={fontBlack} fontSize={2.2} color="#ffffff" fillOpacity={0.9} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 14]} anchorX="center" anchorY="middle">
        {t('areaStunt').toLocaleUpperCase()}
      </Text>
    </group>
  )
}

export default function Stunt() {
  return (
    <group>
      <ParkFloor />
      {/* Ana hat: hızlandırıcı → mega rampa → ateş halkası → iniş rampası (batıdan doğuya) */}
      <Booster x={-15} z={0} />
      <Ramp x={-6} z={0} length={10} height={3.2} />
      <Hoop id="fire" x={3} y={4.6} z={0} fire bonus={800} />
      <Ramp x={15.5} z={0} rot={Math.PI} length={9} height={2.4} stripe="#ffb547" />
      {/* Kuzey hattı: küçük rampa ve neon halka */}
      <Ramp x={-4} z={-11} length={4} height={1.0} stripe="#7ad7ff" />
      <Ramp x={6} z={-11} length={6} height={1.8} stripe="#7ad7ff" />
      <Hoop id="neon" x={12.5} y={3.2} z={-11} radius={2.2} bonus={400} />
      {/* Güney hattı: dönüş yönünde geniş atlama */}
      <Ramp x={2} z={11} rot={Math.PI} length={5} height={1.4} width={6} stripe="#9b7bff" />
      <StuntScorer />
    </group>
  )
}
