import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { world } from './time.js'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { Billboard, Text } from '@react-three/drei'
import { AREAS, SPOTS } from './layout.js'
import { fontBlack, fontBold } from './fonts.js'
import { useStore } from '../store.js'
import { useT } from '../i18n.js'
import { playClick } from '../audio.js'
import { vehicleState } from './input.js'
import { heightAt } from './terrain.js'

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

// Bilgi baloncuğu: yuvarlak köşeli koyu kart + alttan portalı gösteren uç (x-y düzleminde, merkez kartın ortası)
function bubbleShape(w, h, r) {
  const s = new THREE.Shape()
  const x0 = -w / 2
  const y0 = -h / 2
  s.moveTo(x0 + r, y0)
  s.lineTo(-0.18, y0)
  s.lineTo(0, y0 - 0.22)
  s.lineTo(0.18, y0)
  s.lineTo(-x0 - r, y0)
  s.absarc(-x0 - r, y0 + r, r, -Math.PI / 2, 0)
  s.lineTo(-x0, -y0 - r)
  s.absarc(-x0 - r, -y0 - r, r, 0, Math.PI / 2)
  s.lineTo(x0 + r, -y0)
  s.absarc(x0 + r, -y0 - r, r, Math.PI / 2, Math.PI)
  s.lineTo(x0, y0 + r)
  s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5)
  return s
}
const PANEL = new THREE.MeshBasicMaterial({ color: '#121829', transparent: true, opacity: 0.92, depthWrite: false, toneMapped: false })
const KEY_W = 1.05
const PANEL_KEY = new THREE.MeshBasicMaterial({ color: '#2a3350', toneMapped: false })

function Spot({ spot }) {
  const { t, L } = useT()
  const ring = useRef()
  const label = useRef()
  const active = useStore((s) => s.spot?.id === spot.id)
  const title = spot.rawLabel ? L(spot.label) : t(spot.label)
  const action = t(spot.action)
  // Kart genişliği yazıdan tahmin edilir; sağda ENTER tuşu için yer ayrılır
  const card = useMemo(() => {
    const w = Math.max(title.length * 0.36 * 0.6, action.length * 0.22 * 0.55) + 0.75 + KEY_W
    const h = 1.02
    return { w, h, geometry: new THREE.ShapeGeometry(bubbleShape(w, h, 0.2), 6) }
  }, [title, action])
  const accent = useMemo(() => new THREE.MeshBasicMaterial({ color: spot.color, toneMapped: false }), [spot.color])
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
    <group position={[spot.position[0], spot.position[1] || heightAt(spot.position[0], spot.position[2]), spot.position[2]]}>
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
        <mesh geometry={card.geometry} material={PANEL} renderOrder={5} />
        {/* Sol kenarda renkli şerit */}
        <mesh position={[-card.w / 2 + 0.16, 0, 0.005]} material={accent} renderOrder={6}>
          <planeGeometry args={[0.07, card.h - 0.34]} />
        </mesh>
        <Text font={fontBlack} fontSize={0.36} color="#ffffff" anchorX="left" anchorY="bottom" position={[-card.w / 2 + 0.36, 0.0, 0.01]} renderOrder={7}>
          {title}
        </Text>
        <Text font={fontBold} fontSize={0.22} color="#b9c3dc" anchorX="left" anchorY="top" position={[-card.w / 2 + 0.36, -0.05, 0.01]} renderOrder={7}>
          {action}
        </Text>
        {/* ENTER tuşu: portalın içindeyken renklenir */}
        <mesh position={[card.w / 2 - KEY_W / 2 - 0.12, 0, 0.005]} material={active ? accent : PANEL_KEY} renderOrder={6}>
          <planeGeometry args={[KEY_W - 0.1, 0.42]} />
        </mesh>
        <Text font={fontBlack} fontSize={0.19} color={active ? '#121829' : '#b9c3dc'} anchorX="center" anchorY="middle" position={[card.w / 2 - KEY_W / 2 - 0.12, 0, 0.012]} renderOrder={8} letterSpacing={0.06}>
          ENTER
        </Text>
      </Billboard>
    </group>
  )
}

function Area({ area }) {
  return (
    <RigidBody type="fixed" colliders={false} position={[area.center[0], heightAt(area.center[0], area.center[2]), area.center[2]]}>
      <CylinderCollider
        sensor
        args={[4, area.radius]}
        onIntersectionEnter={(p) => isVehicle(p) && useStore.getState().enterArea(area.id)}
        onIntersectionExit={(p) => isVehicle(p) && useStore.getState().leaveZone(area.id)}
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
