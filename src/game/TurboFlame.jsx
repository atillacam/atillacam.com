import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { vehicleState } from './input.js'
import { findItem } from './shop.js'
import { useStore } from '../store.js'

// Turbo alevi: egzozdan arkaya doğru, iki katmanlı (dış turuncu, iç mavi-beyaz) titreyen koni.
// Araç gövdesinin içine (RigidBody altına) yerleştirilir; yerel -x araç arkasıdır.

const flameVertex = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    // Uca doğru dalgalanma
    float tip = uv.y; // koni ucunda uv.y = 1
    p.x += sin(uTime * 38.0 + p.y * 9.0) * 0.025 * tip;
    p.z += cos(uTime * 31.0 + p.y * 7.0) * 0.025 * tip;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`
const flameFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    // uv.y: 0 = egzoz ağzı (geniş taban), 1 = uç
    float mouth = clamp(1.0 - vUv.y, 0.0, 1.0);
    float a = pow(mouth, 1.6) * uStrength;
    gl_FragColor = vec4(uColor * (1.0 + mouth), a);
  }
`

function useFlameMaterial(color) {
  return useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uStrength: { value: 0 } },
        vertexShader: flameVertex,
        fragmentShader: flameFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [color],
  )
}

// Koni: geniş taban egzoz ağzında (orijin), uç aracın arkasına (-x) bakar
function coneGeometry(radius, length) {
  const g = new THREE.ConeGeometry(radius, length, 16, 4, true)
  g.rotateX(Math.PI) // uç aşağı
  g.translate(0, -length / 2, 0) // taban y=0, uç y=-length
  g.rotateZ(-Math.PI / 2) // -y → -x
  return g
}

export default function TurboFlame({ position }) {
  const outer = useFlameMaterial('#ff6a1f')
  const inner = useFlameMaterial('#8fd0ff')
  const outerGeo = useMemo(() => coneGeometry(0.11, 0.85), [])
  const innerGeo = useMemo(() => coneGeometry(0.06, 0.5), [])
  const group = useRef()
  const light = useRef()
  const strength = useRef(0)

  useFrame((state, delta) => {
    const on = vehicleState.boost && vehicleState.throttle > 0.2
    strength.current += ((on ? 1 : 0) - strength.current) * Math.min(delta * (on ? 14 : 8), 1)
    const s = strength.current
    const t = state.clock.elapsedTime
    const flicker = 0.85 + Math.sin(t * 47) * 0.08 + Math.sin(t * 23.3) * 0.07
    outer.uniforms.uTime.value = inner.uniforms.uTime.value = t
    // Garaj dükkânından seçilen alev rengi
    const item = findItem('flame', useStore.getState().equipped.flame) ?? findItem('flame', 'flame-classic')
    if (item.color === 'rainbow') outer.uniforms.uColor.value.setHSL((t * 0.6) % 1, 1, 0.55)
    else outer.uniforms.uColor.value.set(item.color)
    inner.uniforms.uColor.value.set(item.inner)
    if (light.current) light.current.color.copy(outer.uniforms.uColor.value)
    outer.uniforms.uStrength.value = s * 0.9
    inner.uniforms.uStrength.value = s
    if (group.current) {
      group.current.visible = s > 0.02
      group.current.scale.set(0.4 + s * flicker * 0.9, 1, 1)
    }
    if (light.current) light.current.intensity = s * flicker * 6
  })

  return (
    <group position={position}>
      <group ref={group} visible={false}>
        <mesh geometry={outerGeo} material={outer} renderOrder={5} />
        <mesh geometry={innerGeo} material={inner} renderOrder={6} />
      </group>
      <pointLight ref={light} position={[-0.5, 0.05, 0]} color="#ff7a2e" distance={6} decay={2} intensity={0} />
    </group>
  )
}
