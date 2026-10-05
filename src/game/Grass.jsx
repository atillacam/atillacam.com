import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { AREAS, LAKE, PATHS, RING_RADIUS, RING_WIDTH, SPOTS } from './layout.js'
import { heightAt } from './terrain.js'
import { world } from './time.js'
import { vehicleState } from './input.js'

// Binlerce çimen yaprağı: tek geometri, GPU'da rüzgâr ve araba itmesi.
// Dünya ızgara parçalarına bölünür; kamera görmeyen parçalar çizilmez.

const CHUNK = 30
const RADIUS = 72
const OUTER_RADIUS = 118

function bladeGeometry() {
  // 5 köşeli sivri yaprak (3 üçgen)
  const w = 0.05
  const positions = new Float32Array([-w, 0, 0, w, 0, 0, -w * 0.7, 0.45, 0, w * 0.7, 0.45, 0, 0, 1, 0])
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  g.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4])
  g.computeVertexNormals()
  return g
}

function distanceToSegment(px, pz, [ax, az], [bx, bz]) {
  const dx = bx - ax
  const dz = bz - az
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)))
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz))
}

function allowed(x, z) {
  if (PATHS.some((p) => distanceToSegment(x, z, p.from, p.to) < 3.2)) return false
  if (Math.hypot(x, z) < 6.5) return false
  if (Math.abs(Math.hypot(x, z) - RING_RADIUS) < RING_WIDTH / 2 + 0.9) return false
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.radius + 1.5) return false
  // Bölge meydanları ve etkileşim halkaları temiz kalsın
  if (AREAS.some((a) => a.id !== 'lake' && a.id !== 'race' && a.pad !== 'hill' && Math.hypot(x - a.center[0], z - a.center[2]) < a.radius - 0.5)) return false
  if (SPOTS.some((s) => Math.hypot(x - s.position[0], z - s.position[2]) < 2.4)) return false
  return true
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uCar;
  varying float vHeight;
  varying float vShade;
  varying float vPatch;
  #include <fog_pars_vertex>
  void main() {
    vec3 p = position;
    vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
    vec3 root = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float h = p.y;
    // Rüzgâr: iki dalga üst üste
    float wind = sin(uTime * 1.7 + root.x * 0.25 + root.z * 0.18) * 0.18 + sin(uTime * 3.1 + root.x * 0.9) * 0.05;
    world.x += wind * h * h;
    world.z += wind * 0.5 * h * h;
    // Araba yakınındaki yapraklar dışa doğru yatar
    vec2 away = root.xz - uCar.xz;
    float d = length(away);
    float push = (1.0 - smoothstep(0.6, 2.2, d)) * step(abs(root.y - uCar.y), 2.5);
    world.xz += normalize(away + 0.0001) * push * h * 0.55;
    world.y -= push * h * 0.35;
    vHeight = h;
    vShade = fract(sin(dot(root.xz, vec2(12.9898, 78.233))) * 43758.5453);
    vPatch = 0.5 + 0.5 * sin(root.x * 0.11 + sin(root.z * 0.07) * 2.0) * cos(root.z * 0.09 - root.x * 0.03);
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uTip;
  uniform vec3 uLight;
  varying float vHeight;
  varying float vShade;
  varying float vPatch;
  #include <fog_pars_fragment>
  void main() {
    vec3 col = mix(uBase, uTip, vHeight) * (0.88 + vShade * 0.24);
    // Geniş ölçekli ton lekeleri: çimen tek düze halı gibi durmaz
    col *= mix(vec3(0.92, 0.95, 0.85), vec3(1.06, 1.02, 0.92), vPatch);
    col *= uLight;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const DAY_LIGHT = new THREE.Color('#ffffff')
const NIGHT_LIGHT = new THREE.Color('#6a7cb0')
// Mevsim renkleri: [dip, uç] — ilkbahar, yaz, sonbahar, kış
const SEASON_COLORS = [
  ['#2f5c27', '#9fcb5c'],
  ['#2f5627', '#87a957'],
  ['#4b4a22', '#bf9c45'],
  ['#3e4a3e', '#b9c4b6'],
].map(([b, t]) => [new THREE.Color(b), new THREE.Color(t)])
const SNOW = new THREE.Color('#eef3f8')
const _base = new THREE.Color()
const _tip = new THREE.Color()

function GrassChunk({ blades, geometry, material }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const mesh = ref.current
    blades.forEach((b, i) => {
      _q.setFromAxisAngle(_up, b.rot)
      _p.set(b.x, b.y, b.z)
      _s.set(b.w, b.h, b.w)
      _m.compose(_p, _q, _s)
      mesh.setMatrixAt(i, _m)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [blades])
  return <instancedMesh ref={ref} args={[geometry, material, blades.length]} frustumCulled />
}

export default function Grass({ count = 60000 }) {
  const geometry = useMemo(() => bladeGeometry(), [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        side: THREE.DoubleSide,
        fog: true,
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          {
            uTime: { value: 0 },
            uCar: { value: new THREE.Vector3() },
            uBase: { value: new THREE.Color('#2f5627') },
            uTip: { value: new THREE.Color('#87a957') },
            uLight: { value: new THREE.Color('#ffffff') },
          },
        ]),
      }),
    [],
  )

  const chunks = useMemo(() => {
    let s = 3
    const rand = () => {
      s = (s * 16807) % 2147483647
      return (s - 1) / 2147483646
    }
    const map = new Map()
    let placed = 0
    let guard = 0
    while (placed < count && guard++ < count * 3) {
      const a = rand() * Math.PI * 2
      // Çimenin çoğu iç bölgede, kalanı tepelere ve dış bölgelere yayılır
      const r = rand() < 0.65 ? Math.sqrt(rand()) * RADIUS : Math.sqrt(RADIUS * RADIUS + rand() * (OUTER_RADIUS * OUTER_RADIUS - RADIUS * RADIUS))
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (!allowed(x, z)) continue
      const key = `${Math.floor(x / CHUNK)}:${Math.floor(z / CHUNK)}`
      if (!map.has(key)) map.set(key, [])
      map.get(key).push({ x, z, y: heightAt(x, z) - 0.02, rot: rand() * Math.PI, w: 0.8 + rand() * 0.6, h: 0.16 + rand() * 0.26 })
      placed++
    }
    return [...map.values()]
  }, [count])

  useFrame((_, delta) => {
    const u = material.uniforms
    u.uTime.value += Math.min(delta, 0.1)
    u.uCar.value.set(vehicleState.position.x, vehicleState.position.y - 0.6, vehicleState.position.z)
    u.uLight.value.copy(DAY_LIGHT).lerp(NIGHT_LIGHT, world.night)
    const w = world.uniforms.uSeason.value
    const weights = [w.x, w.y, w.z, w.w]
    _base.setRGB(0, 0, 0)
    _tip.setRGB(0, 0, 0)
    SEASON_COLORS.forEach(([b, t], i) => {
      _base.r += b.r * weights[i]
      _base.g += b.g * weights[i]
      _base.b += b.b * weights[i]
      _tip.r += t.r * weights[i]
      _tip.g += t.g * weights[i]
      _tip.b += t.b * weights[i]
    })
    const snow = world.snowCover
    u.uBase.value.copy(_base).lerp(SNOW, snow * 0.55)
    u.uTip.value.copy(_tip).lerp(SNOW, snow * 0.9)
  })

  return chunks.map((blades, i) => <GrassChunk key={i} blades={blades} geometry={geometry} material={material} />)
}
