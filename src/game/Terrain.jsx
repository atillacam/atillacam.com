import { useMemo } from 'react'
import { CuboidCollider, RigidBody, TrimeshCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { AREAS, COLORS, PATHS, RING_RADIUS, RING_WIDTH, WORLD } from './layout.js'
import { fbm, heightAt, shoreFactor } from './terrain.js'
import Water from './Water.jsx'
import { createTerrainMaterial } from './terrainMaterial.js'

// Ana karo (merkezde, 1,5 m aralık) ve doğu karosu (Boğaz + Asya Yakası). Aralıklar aynı olduğundan
// karoların ortak kenarındaki köşeler aynı noktalara düşer; aynı yükseklik fonksiyonu dikiş bırakmaz.
const SIZE = 330
const SEGMENTS = 220
const EAST_WIDTH = 171 // x: 165 → 336 (doğu sınırı + kenar dağları)
const EAST_SEGMENTS = 114

function buildTerrain(width = SIZE, depth = SIZE, segX = SEGMENTS, segZ = SEGMENTS, offsetX = 0) {
  const geometry = new THREE.PlaneGeometry(width, depth, segX, segZ)
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(offsetX, 0, 0)
  const pos = geometry.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const grassA = new THREE.Color('#4c7a3c')
  const grassB = new THREE.Color('#6b9447')
  const hill = new THREE.Color('#556f3e')
  const rockC = new THREE.Color('#8d8a7c')
  const sand = new THREE.Color('#d6c48e')
  const dirt = new THREE.Color('#8a6a48')
  const offroad = AREAS.find((a) => a.id === 'offroad')
  const tmp = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const h = heightAt(x, z)
    pos.setY(i, h)
    const n = fbm(x * 0.08, z * 0.08, 3)
    tmp.copy(grassA).lerp(grassB, n)
    if (h > 3) tmp.lerp(hill, Math.min((h - 3) / 6, 1))
    if (h > 9) tmp.lerp(rockC, Math.min((h - 9) / 6, 0.7))
    tmp.lerp(sand, 1 - shoreFactor(x, z))
    // Arazi parkuru: toprak zemin, kenarlara doğru çimene karışır
    const od = Math.hypot(x - offroad.center[0], z - offroad.center[2])
    tmp.lerp(dirt, Math.max(0, Math.min(1, (offroad.radius + 2 - od) / 6)) * (0.75 + n * 0.25))
    colors.set([tmp.r, tmp.g, tmp.b], i * 3)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

function buildRing() {
  // Asfalt halka + iki kenarda kırmızı-beyaz bordür (köşe renkleriyle)
  const group = []
  const asphalt = new THREE.RingGeometry(RING_RADIUS - RING_WIDTH / 2, RING_RADIUS + RING_WIDTH / 2, 160, 1)
  asphalt.rotateX(-Math.PI / 2)
  group.push({ geometry: asphalt, color: COLORS.ring, y: 0.03 })

  const curb = (inner, outer) => {
    const segments = 220
    const g = new THREE.RingGeometry(inner, outer, segments, 1)
    g.rotateX(-Math.PI / 2)
    const colors = new Float32Array(g.attributes.position.count * 3)
    const red = new THREE.Color('#d9463b')
    const white = new THREE.Color('#f4f1ea')
    for (let i = 0; i < g.attributes.position.count; i++) {
      const x = g.attributes.position.getX(i)
      const z = g.attributes.position.getZ(i)
      const a = Math.atan2(z, x)
      const c = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 110) % 2 ? red : white
      colors.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }
  group.push({ geometry: curb(RING_RADIUS - RING_WIDTH / 2 - 0.6, RING_RADIUS - RING_WIDTH / 2), vertexColors: true, y: 0.04 })
  group.push({ geometry: curb(RING_RADIUS + RING_WIDTH / 2, RING_RADIUS + RING_WIDTH / 2 + 0.6), vertexColors: true, y: 0.04 })
  return group
}

function buildDashes() {
  const count = 70
  const g = new THREE.PlaneGeometry(0.25, 2.2)
  g.rotateX(-Math.PI / 2)
  const mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: '#f2efe6', roughness: 0.8 }), count)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a)
    m.compose(new THREE.Vector3(Math.cos(a) * RING_RADIUS, 0.05, Math.sin(a) * RING_RADIUS), q, new THREE.Vector3(1, 1, 1))
    mesh.setMatrixAt(i, m)
  }
  mesh.receiveShadow = true
  return mesh
}

// Kod içinde üretilen taş döşeme dokusu (dış dosya yok). Her karo hafif farklı tonda.
let pavingCanvas = null
function pavingTexture(repeatX, repeatY) {
  if (!pavingCanvas) {
    const size = 512
    const tiles = 4
    pavingCanvas = document.createElement('canvas')
    pavingCanvas.width = pavingCanvas.height = size
    const ctx = pavingCanvas.getContext('2d')
    ctx.fillStyle = '#8f8572'
    ctx.fillRect(0, 0, size, size)
    let seed = 5
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    const step = size / tiles
    for (let y = 0; y < tiles; y++) {
      // Her satır yarım karo kaydırılır (tuğla düzeni)
      const offset = y % 2 ? step / 2 : 0
      for (let x = -1; x < tiles; x++) {
        const v = 196 + rand() * 26
        ctx.fillStyle = `rgb(${v}, ${v - 6}, ${v - 20})`
        const px = x * step + offset + 3
        ctx.beginPath()
        ctx.roundRect(px, y * step + 3, step - 6, step - 6, 10)
        ctx.fill()
      }
    }
    // İnce yüzey dokusu
    for (let i = 0; i < 2200; i++) {
      ctx.fillStyle = `rgba(0,0,0,${rand() * 0.05})`
      ctx.fillRect(rand() * size, rand() * size, 2, 2)
    }
  }
  const texture = new THREE.CanvasTexture(pavingCanvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeatX, repeatY)
  texture.anisotropy = 8
  return texture
}

// Taş kaplama meydanı olan bölgeler: yollar bunların içine çizilmez (iki farklı döşeme üst üste binmesin)
const PLAZAS = AREAS.filter((a) => a.id !== 'lake' && a.id !== 'race' && (!a.pad || a.pad === 'alley'))

// Yol ucunu, içinde kaldığı meydanın kenarına taşı. Yol ağı (GPS, düz zemin) değişmez; yalnızca çizim kırpılır.
function trimToPlazas(from, to) {
  const clip = (p, q) => {
    for (const a of PLAZAS) {
      const cx = a.center[0]
      const cz = a.center[2]
      const R = a.radius - 0.4
      if (Math.hypot(p[0] - cx, p[1] - cz) >= R) continue
      // p'den q'ya giderken çemberden çıkış noktası: |p + t(q-p) - c| = R
      const dx = q[0] - p[0]
      const dz = q[1] - p[1]
      const fx = p[0] - cx
      const fz = p[1] - cz
      const A = dx * dx + dz * dz
      const B = 2 * (fx * dx + fz * dz)
      const C = fx * fx + fz * fz - R * R
      const t = (-B + Math.sqrt(Math.max(B * B - 4 * A * C, 0))) / (2 * A)
      return [p[0] + dx * Math.min(t, 1), p[1] + dz * Math.min(t, 1)]
    }
    return p
  }
  const a = clip(from, to)
  const b = clip(to, a)
  return [a, b]
}

// Araziyi izleyen yol şeridi: tepelerden geçen yollar zemine yapışır
function roadGeometry(p, width, lift) {
  const segments = Math.max(2, Math.ceil(p.length / 1.5))
  const g = new THREE.PlaneGeometry(width, p.length, 2, segments)
  g.rotateX(-Math.PI / 2)
  g.rotateY(p.angle)
  g.translate(p.center[0], 0, p.center[1])
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)) + lift)
  g.computeVertexNormals()
  return g
}

export default function Terrain() {
  const terrain = useMemo(() => buildTerrain(), [])
  const eastTerrain = useMemo(() => buildTerrain(EAST_WIDTH, SIZE, EAST_SEGMENTS, SEGMENTS, SIZE / 2 + EAST_WIDTH / 2), [])
  const terrainMaterial = useMemo(() => createTerrainMaterial(), [])
  const ring = useMemo(() => buildRing(), [])
  const dashes = useMemo(() => buildDashes(), [])
  // Döşeme dokuları bir kez üretilir
  const textures = useMemo(
    () => ({
      plaza: Object.fromEntries(AREAS.map((a) => [a.id, pavingTexture(((a.radius - 0.5) * 2) / 3.2, ((a.radius - 0.5) * 2) / 3.2)])),
      paths: PATHS.map((p) => {
        const [from, to] = trimToPlazas(p.from, p.to)
        return pavingTexture(5 / 2.5, Math.max(Math.hypot(to[0] - from[0], to[1] - from[1]), 0.5) / 2.5)
      }),
    }),
    [],
  )

  // Fizik: aynı geometriden üçgen ağı (yalnızca duvarların içi yeterli ama hepsi ucuz)
  const collider = useMemo(() => {
    const vertices = terrain.attributes.position.array.slice()
    const indices = terrain.index.array.slice()
    return { vertices, indices }
  }, [terrain])
  const eastCollider = useMemo(() => ({ vertices: eastTerrain.attributes.position.array.slice(), indices: eastTerrain.index.array.slice() }), [eastTerrain])

  const paths = useMemo(
    () =>
      PATHS.map((path) => {
        const [from, to] = trimToPlazas(path.from, path.to)
        const dx = to[0] - from[0]
        const dz = to[1] - from[1]
        const p = { length: Math.hypot(dx, dz), angle: Math.atan2(dx, dz), center: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2] }
        return { ...p, road: roadGeometry(p, 5, 0.04), edge: roadGeometry(p, 5.6, 0.03) }
      }),
    [],
  )

  return (
    <>
      <RigidBody type="fixed" colliders={false} friction={1}>
        <TrimeshCollider args={[collider.vertices, collider.indices]} />
        <TrimeshCollider args={[eastCollider.vertices, eastCollider.indices]} />
        {/* Görünmez sınır duvarları (dünya dikdörtgeni) */}
        <CuboidCollider args={[(WORLD.maxX - WORLD.minX) / 2, 12, 0.5]} position={[(WORLD.maxX + WORLD.minX) / 2, 10, WORLD.minZ]} />
        <CuboidCollider args={[(WORLD.maxX - WORLD.minX) / 2, 12, 0.5]} position={[(WORLD.maxX + WORLD.minX) / 2, 10, WORLD.maxZ]} />
        <CuboidCollider args={[0.5, 12, (WORLD.maxZ - WORLD.minZ) / 2]} position={[WORLD.minX, 10, 0]} />
        <CuboidCollider args={[0.5, 12, (WORLD.maxZ - WORLD.minZ) / 2]} position={[WORLD.maxX, 10, 0]} />
      </RigidBody>

      <mesh geometry={terrain} material={terrainMaterial} receiveShadow />
      <mesh geometry={eastTerrain} material={terrainMaterial} receiveShadow />

      {/* Bölge zeminleri */}
      {AREAS.filter((a) => a.id !== 'lake' && a.id !== 'race' && (!a.pad || a.pad === 'alley')).map((a) => (
        <group key={a.id} position={[a.center[0], 0, a.center[2]]}>
          {/* Taş kaplama meydan + bölge renginde ince kenar */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.016, 0]} receiveShadow>
            <circleGeometry args={[a.radius - 0.5, 96]} />
            <meshStandardMaterial map={textures.plaza[a.id]} color="#e8e0cc" roughness={0.92} polygonOffset polygonOffsetFactor={-1} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.017, 0]} receiveShadow>
            <ringGeometry args={[a.radius - 0.5, a.radius, 96]} />
            <meshStandardMaterial color={a.color} roughness={0.8} polygonOffset polygonOffsetFactor={-1.2} />
          </mesh>
        </group>
      ))}

      {/* Yollar */}
      {paths.map((p, i) =>
        PATHS[i].bridge ? null : (
        <group key={i}>
          <mesh geometry={p.road} receiveShadow>
            <meshStandardMaterial map={textures.paths[i]} color="#e2d6b8" roughness={0.95} polygonOffset polygonOffsetFactor={-2} />
          </mesh>
          <mesh geometry={p.edge} receiveShadow>
            <meshStandardMaterial color={COLORS.pathEdge} roughness={1} polygonOffset polygonOffsetFactor={-1.5} />
          </mesh>
        </group>
        ),
      )}

      {/* Çevre yarış yolu */}
      {ring.map((r, i) => (
        <mesh key={i} geometry={r.geometry} position={[0, r.y, 0]} receiveShadow>
          <meshStandardMaterial color={r.color ?? '#ffffff'} vertexColors={!!r.vertexColors} roughness={0.92} polygonOffset polygonOffsetFactor={-3} />
        </mesh>
      ))}
      <primitive object={dashes} />

      <Water />
    </>
  )
}
