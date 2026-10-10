import { AREAS, LAKE, PATHS, RING_RADIUS, RING_WIDTH, ROUNDABOUTS, STRAIT, WORLD } from './layout.js'

// Arazi yüksekliği tek bir fonksiyondan gelir: görsel mesh, fizik çarpışması ve
// ağaç/lamba yerleşimi aynı değeri kullanır, böylece hiçbir şey havada kalmaz.

// Tekrarlanabilir 2D değer gürültüsü
function hash(x, y) {
  let h = x * 374761393 + y * 668265263
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}
function smooth(t) {
  return t * t * (3 - 2 * t)
}
function valueNoise(x, y) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = smooth(x - xi)
  const yf = smooth(y - yi)
  const a = hash(xi, yi)
  const b = hash(xi + 1, yi)
  const c = hash(xi, yi + 1)
  const d = hash(xi + 1, yi + 1)
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf
}
export function fbm(x, y, octaves = 4) {
  let value = 0
  let amp = 0.5
  let freq = 1
  for (let i = 0; i < octaves; i++) {
    value += amp * valueNoise(x * freq, y * freq)
    freq *= 2.03
    amp *= 0.5
  }
  return value
}

export function smoothstep(edge0, edge1, x) {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1)
  return t * t * (3 - 2 * t)
}

function distanceToSegment(px, pz, [ax, az], [bx, bz]) {
  const dx = bx - ax
  const dz = bz - az
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)))
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz))
}

// 0 = tamamen düz olmalı (yol, bölge), 1 = serbest arazi
export function flatMask(x, z) {
  let d = Infinity
  for (const a of AREAS) {
    // Göl, arazi parkuru ve gözlem tepesi kendi şekillerine sahip
    if (a.id === 'lake' || a.pad === 'dirt' || a.pad === 'hill') continue
    d = Math.min(d, Math.hypot(x - a.center[0], z - a.center[2]) - a.radius - 2)
  }
  // Köprü yolu da düzleştirir: rampaların altı düz kara olur; deniz tabanı sonradan uygulandığından etkilenmez
  for (const p of PATHS) d = Math.min(d, distanceToSegment(x, z, p.from, p.to) - 5)
  // Göbek kavşaklar düz
  for (const r of Object.values(ROUNDABOUTS)) d = Math.min(d, Math.hypot(x - r.x, z - r.z) - r.lane - 3.5)
  const r = Math.hypot(x, z)
  d = Math.min(d, Math.abs(r - RING_RADIUS) - RING_WIDTH / 2 - 2.5)
  return smoothstep(0, 9, d)
}

const OFFROAD = AREAS.find((a) => a.id === 'offroad')
const LOOKOUT = AREAS.find((a) => a.id === 'lookout')

export function heightAt(x, z) {
  const r = Math.hypot(x, z)
  const mask = flatMask(x, z)

  // Hafif tümsekler (yollar ve meydanlarda sıfır)
  let h = (fbm(x * 0.045 + 10, z * 0.045 - 4, 3) - 0.45) * 2.2 * mask

  // Çevre yolun ötesinde yuvarlak tepeler; yollar bu tepeleri yararak geçer
  const band = smoothstep(RING_RADIUS + RING_WIDTH / 2 + 3, 84, r)
  // Asya Yakası şehri: tepeler alçak (yokuşlar sürülebilir kalsın)
  const city = smoothstep(STRAIT.beachEast + 2, STRAIT.beachEast + 12, x) * (1 - smoothstep(WORLD.maxX - 18, WORLD.maxX - 8, x))
  h += band * (2.5 + fbm(x * 0.035, z * 0.035, 4) * 7) * mask * (1 - 0.8 * city)

  // Dünyanın kenarında yüksek dağlar (görünmez duvarların arkası): sınıra 18 m kala yükselmeye başlar
  const edge = Math.min(x - WORLD.minX, WORLD.maxX - x, z - WORLD.minZ, WORLD.maxZ - z)
  h += smoothstep(18, -10, edge) * (10 + fbm(x * 0.02, z * 0.02, 3) * 16)

  // Arazi parkuru: tekerlek zıplatan dalgalı zemin
  const od = Math.hypot(x - OFFROAD.center[0], z - OFFROAD.center[2])
  const rough = 1 - smoothstep(OFFROAD.radius - 4, OFFROAD.radius + 4, od)
  h += rough * (Math.sin(x * 0.55) * Math.cos(z * 0.5) * 0.7 + (fbm(x * 0.2, z * 0.2, 2) - 0.5) * 1.6)

  // Gözlem tepesi: düz zirveli yumuşak tepe
  const ld2 = Math.hypot(x - LOOKOUT.center[0], z - LOOKOUT.center[2])
  h += 11 * (1 - smoothstep(5, 30, ld2))

  // Göl çanağı
  const ld = Math.hypot(x - LAKE.x, z - LAKE.z)
  const bowl = 1 - smoothstep(LAKE.radius * 0.35, LAKE.radius + 3, ld)
  h -= bowl * 3.2

  // Boğaz: kıyıya yaklaştıkça tepeler düzleşir (kumsal), sonra deniz tabanına iner
  const coast = smoothstep(STRAIT.beachWest - 16, STRAIT.beachWest + 2, x) * (1 - smoothstep(STRAIT.beachEast - 2, STRAIT.beachEast + 14, x))
  h *= 1 - coast
  const sea = seaMask(x)
  if (sea > 0) h = h * (1 - sea) + STRAIT.depth * sea

  return h
}

// 0 = kara, 1 = Boğaz'ın derin kısmı (kumsallar arası yumuşak geçiş)
export function seaMask(x) {
  return smoothstep(STRAIT.beachWest, STRAIT.west, x) * (1 - smoothstep(STRAIT.east, STRAIT.beachEast, x))
}

// Zemin rengi için: 0 = kum/kıyı, 1 = çimen
export function shoreFactor(x, z) {
  const ld = Math.hypot(x - LAKE.x, z - LAKE.z)
  const lake = smoothstep(LAKE.radius - 1, LAKE.radius + 3.5, ld)
  // Boğaz kıyıları kumsal
  const strait = 1 - smoothstep(STRAIT.beachWest - 8, STRAIT.beachWest + 2, x) * (1 - smoothstep(STRAIT.beachEast - 2, STRAIT.beachEast + 8, x))
  return Math.min(lake, strait)
}
