import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { world } from './time.js'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { Billboard, Text } from '@react-three/drei'
import { AREAS, SPOTS } from './layout.js'
import { fontBold } from './fonts.js'
import { useStore } from '../store.js'
import { useT } from '../i18n.js'
import { playClick } from '../audio.js'
import { vehicleState } from './input.js'

const isVehicle = (payload) => payload.other.rigidBodyObject?.name === 'vehicle'

// Portal tabanı: yumuşak dolgu + parlak kenar halkası (zeminle derinlik kavgası yapmaz)
const baseVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const baseFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float r = distance(vUv, vec2(0.5)) * 2.0;
    float rim = smoothstep(0.80, 0.90, r) * (1.0 - smoothstep(0.93, 1.0, r));
    float fill = (1.0 - smoothstep(0.0, 0.9, r)) * 0.22;
    float pulse = smoothstep(0.0, 0.08, abs(fract(r * 1.4 - uTime * 0.45) - 0.5) * -1.0 + 0.08) * (1.0 - r) * 0.35;
    float a = (rim + fill + pulse) * uIntensity;
    gl_FragColor = vec4(uColor * (0.9 + rim * 0.8), clamp(a, 0.0, 1.0));
  }
`
// Işık sütunu: yukarı doğru solar, içinde yükselen bantlar akar
const beamVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const beamFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float fade = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 2.2);
    float bands = 0.55 + 0.45 * smoothstep(0.6, 1.0, sin((vUv.y * 9.0 - uTime * 1.6) * 3.14159));
    float a = fade * bands * 0.24 * uIntensity;
    gl_FragColor = vec4(uColor, a);
  }
`

function Spot({ spot }) {
  const { t, L } = useT()
  const ring = useRef()
  const label = useRef()
  const active = useStore((s) => s.spot?.id === spot.id)
  const uniforms = useMemo(
    () => ({ uColor: { value: new THREE.Color(spot.color) }, uIntensity: { value: 0.8 }, uTime: { value: 0 } }),
    [spot.color],
  )

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    uniforms.uTime.value = t
    // Etkin portal daha parlak; gece biraz daha belirgin
    const targetIntensity = (active ? 1.7 : 0.85) * (1 + world.night * 0.15)
    uniforms.uIntensity.value += (targetIntensity - uniforms.uIntensity.value) * Math.min(delta * 6, 1)
    if (ring.current) {
      const target = active ? 1.15 : 1 + Math.sin(t * 2.5) * 0.04
      ring.current.scale.setScalar(ring.current.scale.x + (target - ring.current.scale.x) * Math.min(delta * 10, 1))
    }
    if (label.current) {
      label.current.position.y = 2.9 + Math.sin(t * 2 + spot.position[0]) * 0.12
      // Uzaktaki etiketler küçülüp kaybolur: ekran kalabalıklaşmaz
      const d = Math.hypot(vehicleState.position.x - spot.position[0], vehicleState.position.z - spot.position[2])
      const target = active ? 1.1 : 1 - Math.min(Math.max((d - 22) / 14, 0), 1)
      const k = label.current.scale.x + (target - label.current.scale.x) * Math.min(delta * 6, 1)
      label.current.scale.setScalar(k)
      label.current.visible = k > 0.02
    }
  })

  return (
    <group position={spot.position}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          sensor
          args={[1.9, 1, 1.9]}
          position={[0, 1, 0]}
          onIntersectionEnter={(p) => {
            if (!isVehicle(p)) return
            useStore.getState().setSpot(spot)
            if (!useStore.getState().muted) playClick()
          }}
          onIntersectionExit={(p) => isVehicle(p) && useStore.getState().clearSpot(spot.id)}
        />
      </RigidBody>
      <group ref={ring}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]} renderOrder={3}>
          <circleGeometry args={[2.05, 64]} />
          <shaderMaterial
            uniforms={uniforms}
            vertexShader={baseVertex}
            fragmentShader={baseFragment}
            transparent
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-8}
            polygonOffsetUnits={-8}
          />
        </mesh>
      </group>
      <mesh position={[0, 1.25, 0]} renderOrder={4}>
        <cylinderGeometry args={[1.85, 1.85, 2.5, 48, 1, true]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={beamVertex}
          fragmentShader={beamFragment}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <Billboard ref={label} position={[0, 2.9, 0]}>
        <Text font={fontBold} fontSize={0.42} color="#121726" outlineWidth={0.045} outlineColor="#ffffff" anchorY="bottom" maxWidth={6} textAlign="center">
          {spot.rawLabel ? L(spot.label) : t(spot.label)}
        </Text>
        <Text font={fontBold} fontSize={0.26} color="#3a4157" outlineWidth={0.035} outlineColor="#ffffff" anchorY="top" position={[0, -0.06, 0]}>
          {active ? t('pressEnter') : t(spot.action)}
        </Text>
      </Billboard>
    </group>
  )
}

function Area({ area }) {
  return (
    <RigidBody type="fixed" colliders={false} position={area.center}>
      <CylinderCollider
        sensor
        args={[4, area.radius]}
        onIntersectionEnter={(p) => isVehicle(p) && useStore.getState().enterArea(area.id)}
      />
    </RigidBody>
  )
}

export default function Spots() {
  return (
    <>
      {SPOTS.map((spot) => (
        <Spot key={spot.id} spot={spot} />
      ))}
      {AREAS.map((area) => (
        <Area key={area.id} area={area} />
      ))}
    </>
  )
}
