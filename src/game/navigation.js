import { WORLD_HALF } from './layout.js'

// GPS rotasının canlı durumu (React render'ı tetiklemez; HUD ve harita rAF ile okur)
export const routeState = {
  points: [], // [{ x, z }]
  length: 0, // metre
  version: 0, // rota değişince artar
  next: null, // aracın ilerisindeki hedef nokta (yön oku için)
}

// Keşif sisi: dünya ızgara hücrelerine bölünür; gezilen hücreler açılır ve tarayıcıda saklanır
export const FOG = { cells: 36, size: (WORLD_HALF * 2) / 36 }
const STORAGE_KEY = 'atillacam-explored-v1'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
      if (bytes.length === FOG.cells * FOG.cells) return bytes
    }
  } catch {
    // yok say
  }
  return new Uint8Array(FOG.cells * FOG.cells)
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
  const { cells, size } = FOG
  let changed = false
  const cx = Math.floor((x + WORLD_HALF) / size)
  const cz = Math.floor((z + WORLD_HALF) / size)
  const r = Math.ceil(radius / size)
  for (let i = cx - r; i <= cx + r; i++) {
    for (let j = cz - r; j <= cz + r; j++) {
      if (i < 0 || j < 0 || i >= cells || j >= cells) continue
      const wx = -WORLD_HALF + (i + 0.5) * size
      const wz = -WORLD_HALF + (j + 0.5) * size
      if (Math.hypot(wx - x, wz - z) > radius) continue
      const k = j * cells + i
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
