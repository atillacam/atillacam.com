import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { heightAt } from './terrain.js'
import { fontBlack, fontRegular } from './fonts.js'
import { vehicleState } from './input.js'
import { useStore } from '../store.js'
import { ONLINE, fetchWhispers } from '../online.js'

// Ziyaretçi fısıltıları: bırakıldıkları yerde süzülen küçük fenerler.
// Araba yaklaşınca en yakın fısıltının mesajı üstünde belirir.
const MAX = 80
const SHOW_DISTANCE = 7
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

export default function Whispers() {
  const whispers = useStore((s) => s.whispers)
  const mesh = useRef()
  const label = useRef()
  const [near, setNear] = useState(null)
  const nearId = useRef(null)

  // İlk yükleme + çevrimiçiyse iki dakikada bir yenile
  useEffect(() => {
    let alive = true
    const load = () => fetchWhispers().then((rows) => alive && useStore.getState().setWhispers(rows))
    load()
    const id = ONLINE ? setInterval(load, 120000) : 0
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const items = useMemo(
    () =>
      whispers.slice(0, MAX).map((w, i) => ({
        ...w,
        y: heightAt(w.x, w.z) + 1.3,
        phase: i * 1.7,
      })),
    [whispers],
  )

  const geometry = useMemo(() => new THREE.OctahedronGeometry(0.22, 0), [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffd38a', emissive: '#ffb547', emissiveIntensity: 1.6, toneMapped: false, roughness: 0.4 }), [])

  useFrame((state) => {
    const im = mesh.current
    if (!im) return
    const t = state.clock.elapsedTime
    const car = vehicleState.position
    let best = null
    let bestD = SHOW_DISTANCE
    items.forEach((w, i) => {
      const d = Math.hypot(w.x - car.x, w.z - car.z)
      if (d < bestD) {
        bestD = d
        best = w
      }
      const scale = best === w ? 1.35 : 1
      _p.set(w.x, w.y + Math.sin(t * 1.6 + w.phase) * 0.15, w.z)
      _q.setFromAxisAngle(_up, t * 0.8 + w.phase)
      _s.setScalar(scale)
      _m.compose(_p, _q, _s)
      im.setMatrixAt(i, _m)
    })
    im.count = items.length
    im.instanceMatrix.needsUpdate = true
    const id = best?.id ?? null
    if (id !== nearId.current) {
      nearId.current = id
      setNear(best)
    }
    if (label.current && best) label.current.position.y = best.y + 1.1 + Math.sin(t * 1.6 + best.phase) * 0.15
  })

  return (
    <>
      <instancedMesh ref={mesh} args={[geometry, material, MAX]} frustumCulled={false} />
      {near && (
        <Billboard ref={label} position={[near.x, near.y + 1.1, near.z]}>
          <Text font={fontRegular} fontSize={0.32} maxWidth={4.2} lineHeight={1.25} textAlign="center" color="#fff7e6" outlineWidth={0.03} outlineColor="#2a1c08" anchorX="center" anchorY="bottom">
            {near.message}
          </Text>
          <Text font={fontBlack} fontSize={0.24} color="#ffb547" outlineWidth={0.025} outlineColor="#2a1c08" anchorX="center" anchorY="top" position={[0, -0.08, 0]}>
            {`— ${near.name}`}
          </Text>
        </Billboard>
      )}
    </>
  )
}
