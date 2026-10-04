import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { vehicleState } from './input.js'

// Drift ya da sert frende arka tekerleklerin bıraktığı izler.
// Sabit boyutlu bir halka tampon: en eski iz yerine yenisi yazılır, izler zamanla solar.
const COUNT = 700
const LIFETIME = 8
const WIDTH = 0.17

export default function Skids() {
  const mesh = useRef()
  const state = useMemo(
    () => ({ cursor: 0, last: [null, null], time: 0 }),
    [],
  )
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1)
    g.rotateX(-Math.PI / 2)
    const birth = new Float32Array(COUNT).fill(-1000)
    g.setAttribute('aBirth', new THREE.InstancedBufferAttribute(birth, 1))
    return g
  }, [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          attribute float aBirth;
          uniform float uTime;
          varying float vAlpha;
          void main() {
            vAlpha = clamp(1.0 - (uTime - aBirth) / ${LIFETIME.toFixed(1)}, 0.0, 1.0);
            gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vAlpha;
          void main() {
            if (vAlpha <= 0.0) discard;
            gl_FragColor = vec4(0.08, 0.08, 0.09, vAlpha * vAlpha * 0.38);
          }
        `,
      }),
    [],
  )

  const _m = useMemo(() => new THREE.Matrix4(), [])
  const _q = useMemo(() => new THREE.Quaternion(), [])
  const _p = useMemo(() => new THREE.Vector3(), [])
  const _s = useMemo(() => new THREE.Vector3(), [])
  const _up = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  useFrame((_, delta) => {
    const s = state
    s.time += Math.min(delta, 0.1)
    material.uniforms.uTime.value = s.time
    const im = mesh.current
    if (!im) return
    const speed = Math.abs(vehicleState.speed)
    const sliding = vehicleState.slip > 1.5 || (vehicleState.braking && speed > 6)
    let dirty = false

    for (let w = 0; w < 2; w++) {
      const p = vehicleState.rearWheels[w]
      const marking = sliding && vehicleState.rearContact[w] && speed > 3
      if (!marking) {
        s.last[w] = null
        continue
      }
      const prev = s.last[w]
      if (!prev) {
        s.last[w] = { x: p.x, y: p.y, z: p.z }
        continue
      }
      const dx = p.x - prev.x
      const dz = p.z - prev.z
      const len = Math.hypot(dx, dz)
      if (len < 0.25) continue
      if (len > 3) {
        // ışınlanma ya da sıçrama: izi kopar
        s.last[w] = { x: p.x, y: p.y, z: p.z }
        continue
      }
      const i = s.cursor
      s.cursor = (s.cursor + 1) % COUNT
      _p.set((p.x + prev.x) / 2, (p.y + prev.y) / 2 + 0.03, (p.z + prev.z) / 2)
      _q.setFromAxisAngle(_up, Math.atan2(dx, dz))
      _s.set(WIDTH, 1, len + 0.04)
      _m.compose(_p, _q, _s)
      im.setMatrixAt(i, _m)
      geometry.attributes.aBirth.setX(i, s.time)
      s.last[w] = { x: p.x, y: p.y, z: p.z }
      dirty = true
    }
    if (dirty) {
      im.instanceMatrix.needsUpdate = true
      geometry.attributes.aBirth.needsUpdate = true
    }
  })

  return <instancedMesh ref={mesh} args={[geometry, material, COUNT]} frustumCulled={false} renderOrder={1} />
}
