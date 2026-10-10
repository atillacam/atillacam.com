import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { BRIDGE, STRAIT, WORLD } from './layout.js'
import { heightAt } from './terrain.js'
import { world } from './time.js'
import { fontBlack, fontBold } from './fonts.js'
import { Ferry } from './Istanbul.jsx'
import StaticMerge from './StaticMerge.jsx'
import AsiaShore from './AsiaShore.jsx'
import { BridgeTraffic } from './Traffic.jsx'
import Halo from './Halo.jsx'

// Boğaz: Avrupa ile Asya yakası arasında deniz, üzerinde asma köprü, altından geçen vapur,
// karşı kıyıda deniz feneri. Köprü kuleleri ve kabloları gece renk değiştiren LED'lerle aydınlanır.

const Z = BRIDGE.z
const HALF = BRIDGE.width / 2
const DECK = BRIDGE.deckY
const THICK = 0.7
const LEG_Z = HALF + 1.4 // kule ayakları tabliyenin dışında
const RAMP_W = { from: BRIDGE.startX, to: BRIDGE.deckStart }
const RAMP_E = { from: BRIDGE.deckEnd, to: BRIDGE.endX }
const RAMP_LEN = Math.hypot(RAMP_W.to - RAMP_W.from, DECK)
const RAMP_ANGLE = Math.atan2(DECK, RAMP_W.to - RAMP_W.from)

// ---------- Deniz ----------
const seaVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const seaFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform vec3 uSunDir;
  uniform float uNight;
  uniform vec2 uShore; // batı ve doğu su çizgisi (x)
  varying vec3 vWorld;

  vec3 waveNormal(vec2 p, float t) {
    vec2 dirs[4];
    dirs[0] = vec2(0.2, 0.98);
    dirs[1] = vec2(-0.6, 0.8);
    dirs[2] = vec2(0.7, -0.7);
    dirs[3] = vec2(-0.95, -0.3);
    float dx = 0.0;
    float dz = 0.0;
    for (int i = 0; i < 4; i++) {
      float f = 0.45 + float(i) * 0.5;
      float ph = dot(dirs[i], p) * f + t * (1.1 + float(i) * 0.3);
      float c = cos(ph) * (0.08 / (1.0 + float(i))) * f;
      dx += dirs[i].x * c;
      dz += dirs[i].y * c;
    }
    return normalize(vec3(-dx, 1.0, -dz));
  }

  void main() {
    // Kıyıya uzaklık: kıyıda sığ ve köpüklü, ortada derin
    float shore = min(vWorld.x - uShore.x, uShore.y - vWorld.x);
    vec3 n = waveNormal(vWorld.xz, uTime);
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fresnel = pow(clamp(1.0 - dot(n, viewDir), 0.0, 1.0), 3.0);
    vec3 water = mix(uShallow, uDeep, smoothstep(0.0, 22.0, shore));
    vec3 col = mix(water, uSky, clamp(fresnel * 0.85 + 0.1, 0.0, 1.0));
    vec3 r = reflect(-viewDir, n);
    float glint = pow(max(dot(r, normalize(uSunDir)), 0.0), 180.0) * (1.0 - uNight);
    col += vec3(1.0, 0.92, 0.75) * glint * 2.4;
    // Kıyıya vuran köpük şeridi
    float foam = 1.0 - smoothstep(0.0, 2.2, shore + sin(vWorld.z * 0.35 + uTime * 1.6) * 0.6);
    col = mix(col, vec3(0.93, 0.96, 0.98), foam * 0.65);
    col *= mix(1.0, 0.3, uNight);
    gl_FragColor = vec4(col, 0.93);
    #include <colorspace_fragment>
  }
`

// Su çizgisi: deniz seviyesinin araziyi kestiği x (köprü ekseninde ölçülür)
function shoreLine(from, to) {
  for (let x = from; from < to ? x < to : x > to; x += from < to ? 0.25 : -0.25) if (heightAt(x, Z) < STRAIT.seaLevel) return x
  return from
}

function Sea() {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color('#0f3f63') },
      uShallow: { value: new THREE.Color('#3f9bbd') },
      uSky: { value: new THREE.Color('#9fd3ec') },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uNight: { value: 0 },
      uShore: { value: new THREE.Vector2(shoreLine(STRAIT.beachWest - 10, STRAIT.centerX), shoreLine(STRAIT.beachEast + 10, STRAIT.centerX)) },
    }),
    [],
  )
  useFrame((_, delta) => {
    uniforms.uTime.value += Math.min(delta, 0.1)
    uniforms.uNight.value = world.night
    uniforms.uSky.value.copy(world.skyHorizon)
    uniforms.uSunDir.value.copy(world.sunDir)
  })
  const x0 = STRAIT.beachWest - 6
  const x1 = STRAIT.beachEast + 6
  const depth = WORLD.maxZ - WORLD.minZ + 60
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, STRAIT.seaLevel, 0]} renderOrder={1}>
      <planeGeometry args={[x1 - x0, depth]} />
      <shaderMaterial transparent depthWrite={false} uniforms={uniforms} vertexShader={seaVertex} fragmentShader={seaFragment} />
    </mesh>
  )
}

// ---------- Köprü ----------
// Ana kablo yüksekliği: kuleler arasında parabol, yan açıklıklarda kule tepesinden tabliyeye iner
const [T1, T2] = BRIDGE.towers
const MID = (T1 + T2) / 2
const SAG = DECK + 2.6
function cableY(x) {
  if (x <= T1) return THREE.MathUtils.lerp(DECK + 0.8, BRIDGE.towerTop, (x - BRIDGE.deckStart) / (T1 - BRIDGE.deckStart)) - Math.sin(((x - BRIDGE.deckStart) / (T1 - BRIDGE.deckStart)) * Math.PI) * 1.2
  if (x >= T2) return THREE.MathUtils.lerp(BRIDGE.towerTop, DECK + 0.8, (x - T2) / (BRIDGE.deckEnd - T2)) - Math.sin(((x - T2) / (BRIDGE.deckEnd - T2)) * Math.PI) * 1.2
  const u = (x - MID) / (T2 - MID)
  return SAG + (BRIDGE.towerTop - SAG) * u * u
}

// LED malzemesi: gündüz açık gri çelik; gece yavaşça renk değiştiren ışık (kablolar ve askılar)
function useLedMaterial() {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d7dbe2', roughness: 0.35, metalness: 0.6, emissive: '#000000' }), [])
  useFrame((state) => {
    const n = world.night
    if (n < 0.02) {
      material.emissiveIntensity = 0
      return
    }
    material.emissive.setHSL((state.clock.elapsedTime * 0.05) % 1, 0.85, 0.5)
    material.emissiveIntensity = n * 1.6
  })
  return material
}

function Cables({ led }) {
  const geometry = useMemo(() => {
    const parts = []
    for (const side of [-1, 1]) {
      const points = []
      for (let x = BRIDGE.deckStart; x <= BRIDGE.deckEnd + 0.01; x += 1) points.push(new THREE.Vector3(x, cableY(x), Z + side * LEG_Z))
      parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), points.length * 2, 0.26, 8, false))
    }
    return parts
  }, [])
  // Askı halatları: 3 m arayla, kablodan tabliyeye
  const hangers = useRef()
  const spots = useMemo(() => {
    const list = []
    for (let x = BRIDGE.deckStart + 3; x < BRIDGE.deckEnd - 1; x += 3) {
      if (Math.abs(x - T1) < 1.5 || Math.abs(x - T2) < 1.5) continue
      for (const side of [-1, 1]) list.push({ x, z: Z + side * LEG_Z, top: cableY(x) })
    }
    return list
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    spots.forEach((h, i) => {
      const length = Math.max(0.1, h.top - DECK)
      m.makeScale(1, length, 1).setPosition(h.x, DECK + length / 2, h.z)
      hangers.current.setMatrixAt(i, m)
    })
    hangers.current.instanceMatrix.needsUpdate = true
    hangers.current.computeBoundingSphere()
  }, [spots])
  return (
    <>
      {geometry.map((g, i) => (
        <mesh key={i} geometry={g} material={led} castShadow />
      ))}
      <instancedMesh ref={hangers} args={[undefined, led, spots.length]} castShadow>
        <boxGeometry args={[0.07, 1, 0.07]} />
      </instancedMesh>
    </>
  )
}

function Tower({ x, led }) {
  const base = STRAIT.depth - 0.5
  const height = BRIDGE.towerTop + 1 - base
  return (
    <group position={[x, 0, Z]}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, base + height / 2, side * LEG_Z]} castShadow receiveShadow>
          <boxGeometry args={[1.5, height, 1.5]} />
          <meshStandardMaterial color="#e3e6eb" roughness={0.6} />
        </mesh>
      ))}
      {/* Kirişler: tabliye altı, orta, tepe */}
      {[DECK - 1.6, (DECK + BRIDGE.towerTop) / 2, BRIDGE.towerTop + 0.2].map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow>
          <boxGeometry args={[1.3, 1.1, LEG_Z * 2]} />
          <meshStandardMaterial color="#e3e6eb" roughness={0.6} />
        </mesh>
      ))}
      {/* Kule tepesinde kabloyu taşıyan eyer (LED ile aynı malzeme) */}
      {[-1, 1].map((side) => (
        <mesh key={`s${side}`} position={[0, BRIDGE.towerTop + 1.1, side * LEG_Z]} material={led}>
          <boxGeometry args={[1.8, 0.5, 1.8]} />
        </mesh>
      ))}
      {/* Kule ışığı (uçak uyarı lambası) */}
      <Halo position={[0, BRIDGE.towerTop + 1.8, 0]} scale={2.4} color="#ff4d4d" dayOpacity={0.25} />
    </group>
  )
}

// Tabliye kesiti (yol, kenar kirişleri, bariyerler) bir parça boyunca
function DeckSection({ length }) {
  return (
    <>
      <mesh position={[0, -THICK / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, THICK, BRIDGE.width]} />
        <meshStandardMaterial color="#3a3e47" roughness={0.9} />
      </mesh>
      {/* Kenar kirişleri */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, -THICK - 0.25, side * (HALF - 0.3)]} castShadow>
          <boxGeometry args={[length, 0.5, 0.6]} />
          <meshStandardMaterial color="#c9ced6" roughness={0.6} />
        </mesh>
      ))}
      {/* Şerit çizgisi */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[length - 1, 0.14]} />
        <meshStandardMaterial color="#f2c230" roughness={0.8} />
      </mesh>
      {/* Bariyer: alçak beton + üst korkuluk */}
      {[-1, 1].map((side) => (
        <group key={`b${side}`}>
          <mesh position={[0, 0.3, side * (HALF - 0.12)]} castShadow>
            <boxGeometry args={[length, 0.6, 0.24]} />
            <meshStandardMaterial color="#d5d9e0" roughness={0.8} />
          </mesh>
          <mesh position={[0, 1.0, side * (HALF - 0.12)]}>
            <boxGeometry args={[length, 0.08, 0.08]} />
            <meshStandardMaterial color="#8d96a5" roughness={0.4} metalness={0.6} />
          </mesh>
        </group>
      ))}
    </>
  )
}

// Rampa: başlangıç (x0, 0) → bitiş (x1, DECK) ya da tersi; eğik parça
function rampTransform(from, to, up) {
  const cx = (from + to) / 2
  const angle = up ? RAMP_ANGLE : -RAMP_ANGLE
  return { position: [cx, DECK / 2, Z], rotation: [0, 0, angle] }
}

// Deck lambaları: iki yanda 12 m arayla
function DeckLamps() {
  const bulbs = useRef()
  const lamps = useMemo(() => {
    const list = []
    for (let x = BRIDGE.deckStart + 6; x < BRIDGE.deckEnd - 3; x += 12) for (const side of [-1, 1]) list.push([x, DECK + 3.1, Z + side * (HALF - 0.2)])
    return list
  }, [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff1d0', emissive: '#ffcf86', emissiveIntensity: 0 }), [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    lamps.forEach((p, i) => bulbs.current.setMatrixAt(i, m.makeTranslation(p[0], p[1], p[2])))
    bulbs.current.instanceMatrix.needsUpdate = true
    bulbs.current.computeBoundingSphere()
  }, [lamps])
  useFrame(() => {
    material.emissiveIntensity = 0.1 + world.night * 5
  })
  return (
    <>
      <StaticMerge>
        {lamps.map((p, i) => (
          <mesh key={i} position={[p[0], DECK + 1.55, p[2]]}>
            <cylinderGeometry args={[0.05, 0.07, 3.1, 6]} />
            <meshStandardMaterial color="#8d96a5" roughness={0.4} metalness={0.6} />
          </mesh>
        ))}
      </StaticMerge>
      <instancedMesh ref={bulbs} args={[undefined, material, lamps.length]}>
        <sphereGeometry args={[0.16, 10, 8]} />
      </instancedMesh>
      {lamps
        .filter((_, i) => i % 3 === 0)
        .map((p, i) => (
          <Halo key={i} position={p} scale={2.2} />
        ))}
    </>
  )
}

function Bridge() {
  const led = useLedMaterial()
  const deckLength = BRIDGE.deckEnd - BRIDGE.deckStart
  const deckX = (BRIDGE.deckStart + BRIDGE.deckEnd) / 2
  const west = rampTransform(RAMP_W.from, RAMP_W.to, true)
  const east = rampTransform(RAMP_E.from, RAMP_E.to, false)
  // Rampa çarpışması: üst yüzey yol çizgisinden geçsin diye kutu kalınlığının yarısı kadar normal yönünde aşağı
  const rampBody = (t, up) => {
    const a = up ? RAMP_ANGLE : -RAMP_ANGLE
    return [t.position[0] + Math.sin(a) * THICK * 0.5, t.position[1] - Math.cos(a) * THICK * 0.5, Z]
  }
  return (
    <group>
      <RigidBody type="fixed" colliders={false} friction={1}>
        {/* Tabliye ve rampalar */}
        <CuboidCollider args={[deckLength / 2, THICK / 2, HALF]} position={[deckX, DECK - THICK / 2, Z]} />
        <CuboidCollider args={[RAMP_LEN / 2, THICK / 2, HALF]} position={rampBody(west, true)} rotation={west.rotation} />
        <CuboidCollider args={[RAMP_LEN / 2, THICK / 2, HALF]} position={rampBody(east, false)} rotation={east.rotation} />
        {/* Bariyerler: araç köprüden düşmesin */}
        {[-1, 1].map((side) => (
          <group key={side}>
            <CuboidCollider args={[deckLength / 2, 0.7, 0.15]} position={[deckX, DECK + 0.7, Z + side * (HALF - 0.12)]} />
            <CuboidCollider args={[RAMP_LEN / 2, 0.7, 0.15]} position={[west.position[0], west.position[1] + 0.7, Z + side * (HALF - 0.12)]} rotation={west.rotation} />
            <CuboidCollider args={[RAMP_LEN / 2, 0.7, 0.15]} position={[east.position[0], east.position[1] + 0.7, Z + side * (HALF - 0.12)]} rotation={east.rotation} />
          </group>
        ))}
        {/* Kule ayakları */}
        {BRIDGE.towers.map((x) => [-1, 1].map((side) => <CuboidCollider key={`${x}${side}`} args={[0.75, 22, 0.75]} position={[x, 14, Z + side * LEG_Z]} />))}
      </RigidBody>

      <StaticMerge>
        <group position={[deckX, DECK, Z]}>
          <DeckSection length={deckLength} />
        </group>
        <group position={west.position} rotation={west.rotation}>
          <DeckSection length={RAMP_LEN} />
        </group>
        <group position={east.position} rotation={east.rotation}>
          <DeckSection length={RAMP_LEN} />
        </group>
        {/* Rampa ayakları (betondan) */}
        {[10, 20, 30].flatMap((d) => [RAMP_W.from + d, RAMP_E.to - d]).map((x) => {
          const top = (x < BRIDGE.deckStart ? (x - RAMP_W.from) : (RAMP_E.to - x)) * (DECK / (RAMP_W.to - RAMP_W.from)) - THICK
          const ground = Math.min(heightAt(x, Z), STRAIT.seaLevel)
          const h = top - ground
          return h > 0.5 ? (
            <mesh key={x} position={[x, ground + h / 2, Z]} castShadow>
              <boxGeometry args={[1.1, h, BRIDGE.width - 2]} />
              <meshStandardMaterial color="#c9ced6" roughness={0.8} />
            </mesh>
          ) : null
        })}
        {BRIDGE.towers.map((x) => (
          <Tower key={x} x={x} led={led} />
        ))}
      </StaticMerge>
      <Cables led={led} />
      <DeckLamps />
    </group>
  )
}

// ---------- Asya Yakası: deniz feneri ve tabela ----------
function Lighthouse() {
  const x = STRAIT.beachEast - 4
  const z = -26
  const y = heightAt(x, z)
  const beam = useRef()
  const lamp = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: '#ffd27a', emissiveIntensity: 0.4, toneMapped: false }), [])
  useFrame((state) => {
    lamp.emissiveIntensity = 0.4 + world.night * 3
    if (beam.current) {
      beam.current.rotation.y = state.clock.elapsedTime * 0.9
      beam.current.visible = world.night > 0.2
    }
  })
  return (
    <group position={[x, y, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[5.5, 1.6]} position={[0, 5.5, 0]} />
      </RigidBody>
      <StaticMerge>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[0, 1.1 + i * 2.1, 0]} castShadow>
            <cylinderGeometry args={[1.25 - i * 0.12, 1.37 - i * 0.12, 2.1, 18]} />
            <meshStandardMaterial color={i % 2 ? '#d8322f' : '#f4f1ea'} roughness={0.7} />
          </mesh>
        ))}
        <mesh position={[0, 10.75, 0]} castShadow>
          <cylinderGeometry args={[1.25, 1.1, 0.3, 18]} />
          <meshStandardMaterial color="#2a2c31" roughness={0.6} />
        </mesh>
        <mesh position={[0, 12.5, 0]} castShadow>
          <coneGeometry args={[0.95, 1.2, 18]} />
          <meshStandardMaterial color="#d8322f" roughness={0.6} />
        </mesh>
      </StaticMerge>
      <mesh position={[0, 11.4, 0]} material={lamp}>
        <cylinderGeometry args={[0.75, 0.75, 1.1, 16]} />
      </mesh>
      <Halo position={[0, 11.4, 0]} scale={4} color="#ffe2a0" dayOpacity={0.1} />
      {/* Dönen ışık huzmesi (gece) */}
      <group ref={beam} position={[0, 11.4, 0]}>
        <mesh position={[9, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[1.6, 18, 16, 1, true]} />
          <meshBasicMaterial color="#fff2c6" transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}

function WelcomeSign() {
  const x = BRIDGE.endX + 2
  const z = Z - HALF - 3
  const y = heightAt(x, z)
  return (
    <group position={[x, y, z]} rotation={[0, -Math.PI / 2, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.15, 1.6, 2.2]} position={[0, 1.6, 0]} />
      </RigidBody>
      <StaticMerge>
        {[-1.9, 1.9].map((zz) => (
          <mesh key={zz} position={[0, 1.2, zz]} castShadow>
            <cylinderGeometry args={[0.08, 0.08, 2.4, 8]} />
            <meshStandardMaterial color="#8d96a5" metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
        <mesh position={[0, 2.4, 0]} castShadow>
          <boxGeometry args={[0.16, 1.5, 4.4]} />
          <meshStandardMaterial color="#1f5f8f" roughness={0.6} />
        </mesh>
      </StaticMerge>
      {[1, -1].map((side) => (
        <group key={side} position={[side * 0.09, 2.4, 0]} rotation={[0, side > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
          <Text font={fontBlack} fontSize={0.48} color="#ffffff" position={[0, 0.25, 0]} anchorX="center" anchorY="middle">
            ASYA · ASIA
          </Text>
          <Text font={fontBold} fontSize={0.24} color="#bfe0ff" position={[0, -0.3, 0]} anchorX="center" anchorY="middle">
            Hoş geldiniz · Welcome
          </Text>
        </group>
      ))}
    </group>
  )
}

// Boğaz vapurları. Rotalar kesişmez: iki vapur kanal boyunca aynı uzun elipste yarım tur arayla
// (köprünün altından geçer), biri güneyde karşıdan karşıya geçer.
const ellipse = (cx, cz, rx, rz, speed, start) => ({
  speed,
  start,
  at: (a) => ({ x: cx + Math.cos(a) * rx, z: cz + Math.sin(a) * rz, dx: -Math.sin(a) * rx, dz: Math.cos(a) * rz }),
})
const FERRY_ROUTES = [
  { route: ellipse(STRAIT.centerX, 16, 9, 96, 0.065, 0), scale: 2.2 },
  { route: ellipse(STRAIT.centerX, 16, 9, 96, 0.065, Math.PI), scale: 2.2 },
  { route: ellipse(STRAIT.centerX, -104, 28, 5, 0.09, 1), scale: 1.7 },
]

function useFerryWindows() {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2d3340', emissive: '#ffc970', emissiveIntensity: 0, roughness: 0.6 }), [])
  useFrame(() => {
    material.emissiveIntensity = world.night * 1.6
  })
  return material
}

export default function Bosphorus() {
  const windows = useFerryWindows()
  return (
    <>
      <Sea />
      <Bridge />
      {FERRY_ROUTES.map((f, i) => (
        <Ferry key={i} windows={windows} route={f.route} scale={f.scale} level={STRAIT.seaLevel} />
      ))}
      <BridgeTraffic />
      <AsiaShore />
      <Lighthouse />
      <WelcomeSign />
    </>
  )
}
