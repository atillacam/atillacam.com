import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody, useRapier } from '@react-three/rapier'
import { RoundedBox, Text } from '@react-three/drei'
import * as THREE from 'three'
import { career, labExperiments, profile } from '../content.js'
import { AREAS, COLORS } from './layout.js'
import { heightAt } from './terrain.js'
import { fontBlack, fontBold, fontRegular } from './fonts.js'
import { vehicleState } from './input.js'
import { useStore } from '../store.js'
import { useT } from '../i18n.js'
import { playCrumble } from '../audio.js'

const area = (id) => AREAS.find((a) => a.id === id)

// ================= Laboratuvar =================
function NoiseSphere() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          uniform float uTime;
          varying float vN;
          varying vec3 vNormal;
          // Basit 3D gürültü (sinüs tabanlı, ucuz)
          float n3(vec3 p) {
            return sin(p.x * 1.7 + uTime) * sin(p.y * 1.9 - uTime * 0.8) * sin(p.z * 1.5 + uTime * 1.2);
          }
          void main() {
            float n = n3(position * 2.2) * 0.5 + n3(position * 4.5 + 3.0) * 0.25;
            vN = n;
            vNormal = normalMatrix * normal;
            vec3 p = position + normal * n * 0.35;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vN;
          varying vec3 vNormal;
          void main() {
            vec3 a = vec3(0.18, 0.77, 0.71);
            vec3 b = vec3(0.61, 0.48, 1.0);
            vec3 col = mix(a, b, vN * 0.9 + 0.5);
            float rim = pow(1.0 - abs(normalize(vNormal).z), 2.0);
            gl_FragColor = vec4(col + rim * 0.5, 1.0);
            #include <colorspace_fragment>
          }
        `,
      }),
    [],
  )
  useFrame((_, d) => (material.uniforms.uTime.value += d))
  return (
    <mesh material={material}>
      <icosahedronGeometry args={[0.9, 48]} />
    </mesh>
  )
}

function Attractor() {
  const COUNT = 3000
  const data = useMemo(() => {
    const pos = new Float32Array(COUNT * 3)
    let x = 0.1
    let y = 0
    let z = 0
    for (let i = 0; i < COUNT; i++) {
      // Lorenz denklemleri: σ=10, ρ=28, β=8/3
      for (let k = 0; k < 4; k++) {
        const dt = 0.006
        const dx = 10 * (y - x)
        const dy = x * (28 - z) - y
        const dz = x * y - (8 / 3) * z
        x += dx * dt
        y += dy * dt
        z += dz * dt
      }
      pos.set([x * 0.035, (z - 25) * 0.035, y * 0.035], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [])
  const ref = useRef()
  useFrame((state) => {
    if (!ref.current) return
    ref.current.rotation.y = state.clock.elapsedTime * 0.3
    // Çizginin "çizilme" animasyonu
    data.setDrawRange(0, Math.floor(((state.clock.elapsedTime * 400) % (COUNT * 1.3)) + 200))
  })
  return (
    <points ref={ref} geometry={data}>
      <pointsMaterial size={0.03} color="#ffb547" sizeAttenuation transparent opacity={0.9} />
    </points>
  )
}

function FractalCube() {
  // 2. seviye Menger süngeri: 20 × 20 = 400 küçük küp, tek InstancedMesh
  const cubes = useMemo(() => {
    const list = []
    const keep = (x, y, z) => [x, y, z].filter((v) => v === 1).length < 2
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++)
        for (let c = 0; c < 3; c++) {
          if (!keep(a, b, c)) continue
          for (let d = 0; d < 3; d++)
            for (let e = 0; e < 3; e++)
              for (let f = 0; f < 3; f++) {
                if (!keep(d, e, f)) continue
                list.push([(a - 1) / 3 + (d - 1) / 9, (b - 1) / 3 + (e - 1) / 9, (c - 1) / 3 + (f - 1) / 9])
              }
        }
    return list
  }, [])
  const mesh = useRef()
  const group = useRef()
  useFrame((state) => {
    const im = mesh.current
    if (im && !im.userData.ready) {
      const m = new THREE.Matrix4()
      cubes.forEach((p, i) => {
        m.makeTranslation(p[0] * 1.6, p[1] * 1.6, p[2] * 1.6)
        im.setMatrixAt(i, m)
      })
      im.instanceMatrix.needsUpdate = true
      im.userData.ready = true
    }
    if (group.current) {
      group.current.rotation.x = state.clock.elapsedTime * 0.25
      group.current.rotation.y = state.clock.elapsedTime * 0.35
    }
  })
  return (
    <group ref={group}>
      <instancedMesh ref={mesh} args={[undefined, undefined, cubes.length]} castShadow>
        <boxGeometry args={[1.6 / 9, 1.6 / 9, 1.6 / 9]} />
        <meshStandardMaterial color="#9b7bff" metalness={0.4} roughness={0.35} />
      </instancedMesh>
    </group>
  )
}

function SpeedBars() {
  const BARS = 16
  const refs = useRef([])
  useFrame((state) => {
    const speed = Math.abs(vehicleState.speed)
    const t = state.clock.elapsedTime
    refs.current.forEach((m, i) => {
      if (!m) return
      const wave = Math.sin(t * 6 + i * 0.7) * 0.5 + 0.5
      const h = 0.15 + (speed / 25) * 1.6 * (0.4 + wave * 0.6) + wave * 0.15
      m.scale.y += (h - m.scale.y) * 0.2
      m.position.y = m.scale.y / 2
      m.material.emissiveIntensity = 0.4 + (speed / 25) * 2
    })
  })
  return (
    <group position={[-((BARS - 1) * 0.14) / 2, -0.9, 0]}>
      {Array.from({ length: BARS }, (_, i) => (
        <mesh key={i} ref={(el) => (refs.current[i] = el)} position={[i * 0.14, 0.1, 0]}>
          <boxGeometry args={[0.1, 1, 0.1]} />
          <meshStandardMaterial color="#3d7bff" emissive="#3d7bff" emissiveIntensity={0.5} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

const EXPERIMENTS = { shader: NoiseSphere, attractor: Attractor, fractal: FractalCube, speed: SpeedBars }

function Pedestal({ experiment, position }) {
  const { L } = useT()
  const Demo = EXPERIMENTS[experiment.id]
  const holder = useRef()
  useFrame((state) => {
    if (holder.current) holder.current.position.y = 2.6 + Math.sin(state.clock.elapsedTime * 1.4 + position[0]) * 0.1
  })
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.6, 1.1]} position={[0, 0.6, 0]} />
      </RigidBody>
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1, 1.15, 1.2, 32]} />
        <meshStandardMaterial color="#141a26" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.22, 0]}>
        <torusGeometry args={[1.0, 0.035, 8, 48]} />
        <meshStandardMaterial color="#2ec4b6" emissive="#2ec4b6" emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      <group ref={holder} position={[0, 2.6, 0]}>
        <Demo />
      </group>
      <Text font={fontBold} fontSize={0.3} color="#e6fffb" position={[0, 0.7, 1.17]} anchorX="center" anchorY="middle" maxWidth={2}>
        {L(experiment.title)}
      </Text>
    </group>
  )
}

function Lab() {
  const { t } = useT()
  const a = area('lab')
  const [cx, , cz] = a.center
  const y = heightAt(cx, cz)
  const spots = [
    [cx - 7.5, cz - 4],
    [cx - 2.5, cz - 8],
    [cx + 2.5, cz - 8],
    [cx + 7.5, cz - 4],
  ]
  return (
    <group>
      {/* Hologram kubbe */}
      <mesh position={[cx, y, cz - 4]}>
        <sphereGeometry args={[13, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#2ec4b6" wireframe transparent opacity={0.07} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, y + 0.04, cz - 4]}>
        <ringGeometry args={[12.6, 13, 96]} />
        <meshStandardMaterial color="#2ec4b6" emissive="#2ec4b6" emissiveIntensity={1.2} toneMapped={false} polygonOffset polygonOffsetFactor={-3} />
      </mesh>
      {labExperiments.map((e, i) => (
        <Pedestal key={e.id} experiment={e} position={[spots[i][0], y, spots[i][1]]} />
      ))}
      <Text font={fontBlack} fontSize={1.5} color="#e6fffb" outlineWidth={0.05} outlineColor="#0f6e66" position={[cx, y + 6.5, cz - 13]} anchorX="center">
        {t('areaLab').toLocaleUpperCase()}
      </Text>
    </group>
  )
}

// ================= Kariyer Yolu =================
function Milestone({ item, index, x, z, side }) {
  const { L } = useT()
  const y = heightAt(x, z)
  const color = [COLORS.amber, COLORS.teal, COLORS.blue, COLORS.coral, COLORS.violet][index % 5]
  // Yolun kenarında, yola dönük pano
  return (
    <group position={[x, y, z + side * 6]} rotation={[0, side > 0 ? Math.PI : 0, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.6, 1.7, 0.2]} position={[0, 2.6, 0]} />
      </RigidBody>
      <RoundedBox args={[5.2, 3.4, 0.3]} radius={0.12} smoothness={3} position={[0, 2.6, 0]} castShadow>
        <meshStandardMaterial color={COLORS.ink} roughness={0.5} />
      </RoundedBox>
      <mesh position={[0, 4.24, 0.16]}>
        <planeGeometry args={[4.9, 0.1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} toneMapped={false} />
      </mesh>
      <group position={[-2.3, 3.95, 0.17]}>
        <Text font={fontBlack} fontSize={0.85} color={color} anchorX="left" anchorY="top">
          {item.year}
        </Text>
        <Text font={fontBlack} fontSize={0.36} color={COLORS.cream} anchorX="left" anchorY="top" position={[0, -1.0, 0]} maxWidth={4.6}>
          {L(item.title)}
        </Text>
        <Text font={fontRegular} fontSize={0.24} lineHeight={1.35} color="#c3c9da" anchorX="left" anchorY="top" position={[0, -1.6, 0]} maxWidth={4.6}>
          {L(item.text)}
        </Text>
      </group>
      {[-2.2, 2.2].map((px) => (
        <mesh key={px} position={[px, 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.1, 1, 8]} />
          <meshStandardMaterial color="#2a2f3a" />
        </mesh>
      ))}
    </group>
  )
}

function Career() {
  const { t } = useT()
  const a = area('career')
  const [cx, , cz] = a.center
  const start = cx + 13
  const step = 7
  return (
    <group>
      {/* Zaman çizelgesi: yol boyunca parlayan çizgi ve yıl işaretleri */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx - 1.5, heightAt(cx, cz) + 0.05, cz]}>
        <planeGeometry args={[34, 0.18]} />
        <meshStandardMaterial color={COLORS.amber} emissive={COLORS.amber} emissiveIntensity={1.2} toneMapped={false} polygonOffset polygonOffsetFactor={-4} />
      </mesh>
      {career.map((item, i) => {
        const x = start - i * step
        return (
          <group key={i}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, heightAt(x, cz) + 0.06, cz]}>
              <circleGeometry args={[0.45, 24]} />
              <meshStandardMaterial color={COLORS.cream} emissive={COLORS.amber} emissiveIntensity={0.6} polygonOffset polygonOffsetFactor={-5} />
            </mesh>
            <Milestone item={item} index={i} x={x} z={cz} side={i % 2 ? 1 : -1} />
          </group>
        )
      })}
      <Text font={fontBlack} fontSize={1.4} color={COLORS.cream} outlineWidth={0.05} outlineColor="#7a5418" position={[start + 6, heightAt(start + 6, cz) + 4.5, cz - 9]} rotation={[0, Math.PI / 2, 0]} anchorX="center">
        {t('areaCareer').toLocaleUpperCase()}
      </Text>
    </group>
  )
}

// ================= Mühendis Heykeli (yıkılabilir) =================
function StatuePart({ position, size, color, mass = 0.6, children, onRef }) {
  return (
    <RigidBody ref={onRef} type="fixed" colliders={false} position={position} friction={0.8} linearDamping={0.05}>
      <CuboidCollider args={size.map((s) => s / 2)} mass={mass} />
      <RoundedBox args={size} radius={0.06} smoothness={2} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.25} />
      </RoundedBox>
      {children}
    </RigidBody>
  )
}

function Statue() {
  const { t } = useT()
  const x = -16
  const z = -16
  const y = heightAt(x, z)
  const { rapier } = useRapier()
  const parts = useRef([])
  const head = useRef()
  const fallen = useRef(false)
  const awake = useRef(false)
  const part = (i) => (el) => {
    parts.current[i] = el
    if (i === 5) head.current = el
  }
  // Araba heykele değince bütün parçalar fizik nesnesine döner ve devrilebilir
  const wake = (p) => {
    if (awake.current || p.other.rigidBodyObject?.name !== 'vehicle') return
    awake.current = true
    if (!useStore.getState().muted) playCrumble()
    const v = p.other.rigidBody?.linvel() ?? { x: 0, y: 0, z: 0 }
    // Tip değişiminden hemen sonra kütle henüz hesaplanmadığı için itmeyi doğrudan hız olarak veriyoruz;
    // yukarıdaki parçalar daha çok savrulur, böylece heykel devrilerek dağılır
    const speed = Math.max(Math.hypot(v.x, v.z), 6)
    const dx = v.x / (Math.hypot(v.x, v.z) || 1)
    const dz = v.z / (Math.hypot(v.x, v.z) || 1)
    parts.current.forEach((rb) => {
      if (!rb) return
      rb.setBodyType(rapier.RigidBodyType.Dynamic, true)
      const h = rb.translation().y - base
      const k = speed * (0.2 + h * 0.08)
      rb.setLinvel({ x: dx * k + (Math.random() - 0.5), y: 1 + h * 0.4, z: dz * k + (Math.random() - 0.5) }, true)
      rb.setAngvel({ x: dz * 2.5, y: (Math.random() - 0.5) * 2, z: -dx * 2.5 }, true)
    })
  }
  const base = y + 0.4
  useFrame(() => {
    if (fallen.current || !head.current) return
    const p = head.current.translation()
    if (p.y < base + 2.6) {
      fallen.current = true
      useStore.getState().unlock('statue')
    }
  })
  const stone = '#c9c4b8'
  return (
    <group>
      {/* Kaide */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.5, 0.2, 1.5]} position={[x, y + 0.2, z]} />
        <CylinderCollider sensor args={[2.5, 4.2]} position={[x, y + 2.5, z]} onIntersectionEnter={wake} />
      </RigidBody>
      <RoundedBox args={[3, 0.4, 3]} radius={0.08} position={[x, y + 0.2, z]} castShadow receiveShadow>
        <meshStandardMaterial color="#8f8a80" roughness={0.9} />
      </RoundedBox>
      <Text font={fontBold} fontSize={0.16} color="#2a2620" position={[x, y + 0.2, z + 1.51]} anchorX="center" anchorY="middle">
        {`${t('statue')} · ${profile.name}`}
      </Text>
      {/* Bacaklar, gövde (kasa), kollar, kafa (monitör) — hepsi ayrı fizik parçası */}
      <StatuePart onRef={part(0)} position={[x - 0.35, base + 0.6, z]} size={[0.45, 1.2, 0.5]} color={stone} />
      <StatuePart onRef={part(1)} position={[x + 0.35, base + 0.6, z]} size={[0.45, 1.2, 0.5]} color={stone} />
      <StatuePart onRef={part(2)} position={[x, base + 1.85, z]} size={[1.4, 1.3, 0.8]} color={stone} mass={0.9}>
        <mesh position={[0, 0.25, 0.41]}>
          <planeGeometry args={[0.9, 0.18]} />
          <meshStandardMaterial color="#3d7bff" emissive="#3d7bff" emissiveIntensity={1.2} toneMapped={false} />
        </mesh>
      </StatuePart>
      <StatuePart onRef={part(3)} position={[x - 0.95, base + 1.9, z]} size={[0.4, 1.1, 0.4]} color={stone} mass={0.3} />
      <StatuePart onRef={part(4)} position={[x + 0.95, base + 1.9, z]} size={[0.4, 1.1, 0.4]} color={stone} mass={0.3} />
      <StatuePart onRef={part(5)} position={[x, base + 3.05, z]} size={[1.1, 0.8, 0.5]} color="#2a2f3a" mass={0.4}>
        <mesh position={[0, 0, 0.26]}>
          <planeGeometry args={[0.9, 0.6]} />
          <meshStandardMaterial color="#0f1a2e" emissive="#2ec4b6" emissiveIntensity={0.5} />
        </mesh>
        <Text font={fontBlack} fontSize={0.26} color="#5ee0d4" position={[0, 0, 0.27]} anchorX="center" anchorY="middle">
          {'</>'}
        </Text>
      </StatuePart>
    </group>
  )
}

export default function Showcase() {
  return (
    <>
      <Lab />
      <Career />
      <Statue />
    </>
  )
}
