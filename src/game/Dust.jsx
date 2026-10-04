import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { vehicleState } from './input.js'
import { world } from './time.js'

// Arka tekerleklerden kalkan toz: sabit boyutlu bir parçacık havuzu, GPU'da yumuşak daireler
const COUNT = 140

export default function Dust() {
  const points = useRef()
  const state = useMemo(
    () => ({
      positions: new Float32Array(COUNT * 3).fill(-999),
      velocities: new Float32Array(COUNT * 3),
      ages: new Float32Array(COUNT).fill(1),
      lifetimes: new Float32Array(COUNT).fill(1),
      cursor: 0,
      accumulator: 0,
    }),
    [],
  )
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(state.positions, 3))
    g.setAttribute('aAge', new THREE.BufferAttribute(state.ages, 1))
    return g
  }, [state])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uColor: { value: new THREE.Color('#d9c7a0') }, uScale: { value: 1 } },
        vertexShader: /* glsl */ `
          attribute float aAge;
          varying float vAge;
          uniform float uScale;
          void main() {
            vAge = aAge;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            // Dünya biriminde boyut: 0.3 m'den 1.1 m'ye büyür, uzaklıkla küçülür
            gl_PointSize = (0.3 + aAge * 0.8) * uScale / -mv.z;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          varying float vAge;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.05, d) * (1.0 - vAge) * (1.0 - vAge) * 0.28;
            if (a < 0.01) discard;
            gl_FragColor = vec4(uColor, a);
          }
        `,
      }),
    [],
  )

  const _back = useMemo(() => new THREE.Vector3(), [])
  const _side = useMemo(() => new THREE.Vector3(), [])

  useFrame((frame, delta) => {
    const dt = Math.min(delta, 0.05)
    const s = state
    const speed = Math.abs(vehicleState.speed)
    // Projeksiyon ölçeği: piksel/metre (1 m uzaklıkta)
    material.uniforms.uScale.value = (frame.size.height * frame.viewport.dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(frame.camera.fov) / 2))
    material.uniforms.uColor.value.set(world.night > 0.5 ? '#4a5068' : '#cdbf9c')

    // Yeni parçacıklar
    // Hafif toz: sadece hızlıyken ya da kayarken
    const intensity = Math.max(speed - 6, 0) / 14 + Math.max(vehicleState.slip - 1.2, 0) * 0.4
    const rate = vehicleState.grounded ? Math.min(intensity, 1.2) * (vehicleState.boost ? 34 : 22) : 0
    s.accumulator += rate * dt
    const f = vehicleState.forward
    _back.set(-f.x, 0, -f.z).normalize()
    _side.set(-_back.z, 0, _back.x)
    while (s.accumulator >= 1) {
      s.accumulator -= 1
      const i = s.cursor
      s.cursor = (s.cursor + 1) % COUNT
      const side = Math.random() < 0.5 ? -0.6 : 0.6
      s.positions[i * 3] = vehicleState.position.x + _back.x * 0.75 + _side.x * side
      s.positions[i * 3 + 1] = vehicleState.position.y - 0.5
      s.positions[i * 3 + 2] = vehicleState.position.z + _back.z * 0.75 + _side.z * side
      s.velocities[i * 3] = _back.x * 1.2 + (Math.random() - 0.5) * 1.2
      s.velocities[i * 3 + 1] = 0.3 + Math.random() * 0.5
      s.velocities[i * 3 + 2] = _back.z * 1.2 + (Math.random() - 0.5) * 1.2
      s.ages[i] = 0
      s.lifetimes[i] = 0.7 + Math.random() * 0.6
    }

    // Güncelle
    for (let i = 0; i < COUNT; i++) {
      if (s.ages[i] >= 1) continue
      s.ages[i] = Math.min(s.ages[i] + dt / s.lifetimes[i], 1)
      s.positions[i * 3] += s.velocities[i * 3] * dt
      s.positions[i * 3 + 1] += s.velocities[i * 3 + 1] * dt
      s.positions[i * 3 + 2] += s.velocities[i * 3 + 2] * dt
      s.velocities[i * 3 + 1] *= 0.96
    }
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.aAge.needsUpdate = true
  })

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />
}
