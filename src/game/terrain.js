import { AREAS, LAKE, PATHS, RING_RADIUS, RING_WIDTH } from './layout.js'

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
    if (a.id === 'lake') continue
    d = Math.min(d, Math.hypot(x - a.center[0], z - a.center[2]) - a.radius - 2)
  }
  for (const p of PATHS) d = Math.min(d, distanceToSegment(x, z, p.from, p.to) - 5)
  const r = Math.hypot(x, z)
  d = Math.min(d, Math.abs(r - RING_RADIUS) - RING_WIDTH / 2 - 2.5)
  return smoothstep(0, 9, d)
}

export function heightAt(x, z) {
  const r = Math.hypot(x, z)
  const mask = flatMask(x, z)

  // İç bölgede hafif tümsekler
  let h = (fbm(x * 0.045 + 10, z * 0.045 - 4, 3) - 0.45) * 2.2 * mask

  // Dış çeper: dünyayı çevreleyen tepeler
  const rim = smoothstep(RING_RADIUS + RING_WIDTH / 2 + 3, 92, r)
  h += rim * (5 + fbm(x * 0.03, z * 0.03, 4) * 12)

  // Göl çanağı
  const ld = Math.hypot(x - LAKE.x, z - LAKE.z)
  const bowl = 1 - smoothstep(LAKE.radius * 0.35, LAKE.radius + 3, ld)
  h -= bowl * 3.2

  return h
}

// Zemin rengi için: 0 = kum/kıyı, 1 = çimen
export function shoreFactor(x, z) {
  const ld = Math.hypot(x - LAKE.x, z - LAKE.z)
  return smoothstep(LAKE.radius - 1, LAKE.radius + 3.5, ld)
}
