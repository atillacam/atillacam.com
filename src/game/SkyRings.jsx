import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { HELIPAD, LAKE, SKY_RINGS } from './layout.js'
import { heightAt } from './terrain.js'
import { vehicleState } from './input.js'
import { useStore } from '../store.js'
import { translate } from '../i18n.js'
import { playCheckpoint, playChime } from '../audio.js'
import { formatTime } from '../format.js'
import { fontBlack } from './fonts.js'

// Helikopter halka parkuru: pistten kalk, havadaki halkalardan sırayla geç, piste dön.
// Yalnızca sıradaki halka parlak; bir sonraki soluk görünür, ötekiler gizlidir.
const RADIUS = 5
const THICKNESS = 2.5 // halka düzleminden bu kadar uzaklıkta geçiş sayılır

const COURSE = (() => {
  const centers = SKY_RINGS.map(([x, h, z]) => {
    // Gölün üstünde yükseklik su yüzeyinden ölçülür
    const inLake = Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.radius + 2
    return new THREE.Vector3(x, Math.max(heightAt(x, z), inLake ? LAKE.waterLevel : -Infinity) + h, z)
  })
  const start = new THREE.Vector3(HELIPAD.x, heightAt(HELIPAD.x, HELIPAD.z) + 8, HELIPAD.z)
  return centers.map((c, i) => {
    // Halka, gelişten çıkışa doğru olan yöne bakar
    const prev = i === 0 ? start : centers[i - 1]
    const next = centers[i + 1] ?? c.clone().add(c.clone().sub(prev))
    const normal = next.clone().sub(prev).normalize()
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
    return { center: c, normal, quaternion }
  })
})()

const _d = new THREE.Vector3()
const _x = new THREE.Vector3()
const _y = new THREE.Vector3()
const _z = new THREE.Vector3()
const _basis = new THREE.Matrix4()

// Yatay, düz ok: takip kamerası yukarıdan baktığı için yönü kolay okunur (ucu +z)
function arrowShape() {
  const s = new THREE.Shape()
  s.moveTo(0, 1.1)
  s.lineTo(0.85, 0)
  s.lineTo(0.32, 0)
  s.lineTo(0.32, -0.9)
  s.lineTo(-0.32, -0.9)
  s.lineTo(-0.32, 0)
  s.lineTo(-0.85, 0)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: false })
  g.translate(0, 0, -0.08)
  g.rotateX(Math.PI / 2)
  return g
}

function Helipad() {
  const y = heightAt(HELIPAD.x, HELIPAD.z)
  return (
    <group position={[HELIPAD.x, y, HELIPAD.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} receiveShadow>
        <circleGeometry args={[3.6, 48]} />
        <meshStandardMaterial color="#3a3f4b" roughness={0.9} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[3.1, 3.35, 48]} />
        <meshBasicMaterial color="#f2c230" polygonOffset polygonOffsetFactor={-3} />
      </mesh>
      <Text font={fontBlack} fontSize={3} color="#ffffff" rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} anchorX="center" anchorY="middle">
        H
      </Text>
    </group>
  )
}

export default function SkyRings() {
  const rings = useRef([])
  const line = useRef()
  const arrow = useRef()
  const arrowGeometry = useMemo(() => arrowShape(), [])
  const materials = useMemo(
    () => COURSE.map(() => new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffb547', emissiveIntensity: 1.2, transparent: true, toneMapped: false })),
    [],
  )
  const lineGeometry = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), [])

  useFrame((state) => {
    const store = useStore.getState()
    const course = store.rings
    const t = state.clock.elapsedTime

    if (course.active && store.mode !== 'heli') {
      // İnişe geçildi: parkur yarıda kaldı
      store.cancelRings()
      store.toast(translate('ringsCancelled', store.lang), translate('ringsHint', store.lang))
    }
    const active = store.rings.active
    const next = store.rings.next

    COURSE.forEach((ring, i) => {
      const mesh = rings.current[i]
      if (!mesh) return
      const isNext = active && i === next
      const isAfter = active && i === next + 1
      mesh.visible = isNext || isAfter
      if (!mesh.visible) return
      const m = materials[i]
      m.color.set(isNext ? '#ffd27a' : '#9fc4ff')
      m.emissive.set(isNext ? '#ffb547' : '#3d7bff')
      m.opacity = isNext ? 1 : 0.4
      m.emissiveIntensity = isNext ? 1.1 + Math.sin(t * 6) * 0.4 : 0.5
      mesh.scale.setScalar(isNext ? 1 + Math.sin(t * 3) * 0.03 : 1)
    })

    const l = line.current
    if (l) l.visible = active
    if (arrow.current) arrow.current.visible = active
    if (!active) return

    // Sıradaki halkaya kılavuz çizgisi
    const p = vehicleState.position
    const ring = COURSE[next]
    const pos = lineGeometry.attributes.position
    pos.setXYZ(0, p.x, p.y + 0.6, p.z)
    pos.setXYZ(1, ring.center.x, ring.center.y, ring.center.z)
    pos.needsUpdate = true
    lineGeometry.computeBoundingSphere()
    // Helikopterin üstünde sıradaki halkayı gösteren ok
    const a = arrow.current
    if (a) {
      a.position.set(p.x, p.y + 4.6, p.z)
      // Ucu halkaya, düz yüzü kameraya: hangi açıdan bakılırsa bakılsın ok şekli okunur
      _z.subVectors(ring.center, a.position).normalize()
      _y.subVectors(state.camera.position, a.position)
      _y.addScaledVector(_z, -_y.dot(_z))
      if (_y.lengthSq() < 1e-4) _y.set(0, 1, 0)
      _y.normalize()
      _x.crossVectors(_y, _z)
      a.quaternion.setFromRotationMatrix(_basis.makeBasis(_x, _y, _z))
    }

    // Geçiş: halka düzlemine yakın ve halkanın içinden
    _d.set(p.x - ring.center.x, p.y - ring.center.y, p.z - ring.center.z)
    const along = _d.dot(ring.normal)
    const radial = _d.addScaledVector(ring.normal, -along).length()
    if (Math.abs(along) > THICKNESS || radial > RADIUS * 1.05) return

    if (next === COURSE.length - 1) {
      const best = store.ringsBest
      const ms = store.finishRings()
      const record = !best || ms < best
      store.toast(translate(record ? 'ringsRecord' : 'ringsFinished', store.lang), formatTime(ms))
      if (!store.muted) playChime()
    } else {
      store.passRing(next)
      if (!store.muted) playCheckpoint()
    }
  })

  return (
    <>
      <Helipad />
      {COURSE.map((ring, i) => (
        <mesh
          key={i}
          ref={(el) => {
            rings.current[i] = el
          }}
          position={ring.center}
          quaternion={ring.quaternion}
          material={materials[i]}
          visible={false}
        >
          <torusGeometry args={[RADIUS, 0.32, 10, 48]} />
        </mesh>
      ))}
      <mesh ref={arrow} geometry={arrowGeometry} scale={1.2} visible={false}>
        <meshStandardMaterial color="#ffd27a" emissive="#ffb547" emissiveIntensity={0.9} toneMapped={false} />
      </mesh>
      <line ref={line} geometry={lineGeometry} visible={false} frustumCulled={false}>
        <lineBasicMaterial color="#ffd27a" transparent opacity={0.55} depthWrite={false} toneMapped={false} />
      </line>
    </>
  )
}
