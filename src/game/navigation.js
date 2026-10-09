import { WORLD } from './layout.js'

// GPS rotasının canlı durumu (React render'ı tetiklemez; HUD ve harita rAF ile okur)
export const routeState = {
  points: [], // [{ x, z }]
  length: 0, // metre
  version: 0, // rota değişince artar
  next: null, // aracın ilerisindeki hedef nokta (yön oku için)
}

// Keşif sisi: dünya dikdörtgeni ızgara hücrelerine bölünür; gezilen hücreler açılır ve tarayıcıda saklanır.
// Hücre boyu eski kare dünyayla aynı (280 / 36 m): eski kayıt yeni ızgaranın sol kısmına birebir taşınır.
const SIZE = (WORLD.maxZ - WORLD.minZ) / 36
export const FOG = { cols: Math.ceil((WORLD.maxX - WORLD.minX) / SIZE), rows: 36, size: SIZE }
const STORAGE_KEY = 'atillacam-explored-v2'
const OLD_KEY = 'atillacam-explored-v1'

const decode = (raw) => Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))

function load() {
  const grid = new Uint8Array(FOG.cols * FOG.rows)
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const bytes = decode(raw)
      if (bytes.length === grid.length) return bytes
    }
    // Eski kare ızgara (36×36): aynı başlangıç ve hücre boyu
    const old = localStorage.getItem(OLD_KEY)
    if (old) {
      const bytes = decode(old)
      if (bytes.length === 36 * 36) for (let j = 0; j < 36; j++) for (let i = 0; i < 36; i++) grid[j * FOG.cols + i] = bytes[j * 36 + i]
    }
  } catch {
    // yok say
  }
  return grid
}

export const explored = { grid: load(), count: 0, version: 0 }
explored.count = explored.grid.reduce((a, b) => a + b, 0)

let saveTimer = null
function save() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, btoa(String.fromCharCode(...explored.grid)))
    } catch {
      // yok say
    }
  }, 1500)
}

// Aracın çevresindeki hücreleri açar (görüş yarıçapı ~ 2 hücre)
export function revealAround(x, z, radius = 22) {
  const { cols, rows, size } = FOG
  let changed = false
  const cx = Math.floor((x - WORLD.minX) / size)
  const cz = Math.floor((z - WORLD.minZ) / size)
  const r = Math.ceil(radius / size)
  for (let i = cx - r; i <= cx + r; i++) {
    for (let j = cz - r; j <= cz + r; j++) {
      if (i < 0 || j < 0 || i >= cols || j >= rows) continue
      const wx = WORLD.minX + (i + 0.5) * size
      const wz = WORLD.minZ + (j + 0.5) * size
      if (Math.hypot(wx - x, wz - z) > radius) continue
      const k = j * cols + i
      if (!explored.grid[k]) {
        explored.grid[k] = 1
        explored.count++
        changed = true
      }
    }
  }
  if (changed) {
    explored.version++
    save()
  }
}

export function resetExplored() {
  explored.grid.fill(0)
  explored.count = 0
  explored.version++
  save()
}
