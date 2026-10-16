import { FERRY_SCHEDULE, PIERS, STRAIT } from './layout.js'

// Araba vapuru seferleri. İki vapur (0 ve 1) yarım tur arayla çalışır:
// 0 Avrupa'da beklerken 1 Asya'da bekler; sonra ikisi aynı anda karşıya geçer ve birbirinin yanından
// (z ekseninde ayrı şeritlerden) geçer. Konum yalnızca saate bağlıdır: sahne ve iskele aynı hesabı kullanır.

const { dock, cross } = FERRY_SCHEDULE
export const CYCLE = 2 * (dock + cross)
export const FERRY_LENGTH = 12
export const DECK_HEIGHT = 0.9 // su seviyesinden güverte yüksekliği
export const DOCK_X = { europe: PIERS.europe.to + FERRY_LENGTH / 2 + 0.5, asia: PIERS.asia.to - FERRY_LENGTH / 2 - 0.5 }

const smooth = (t) => t * t * (3 - 2 * t)

// Bir vapurun t anındaki durumu: iskelede (side) ya da yolda (progress, dir)
export function ferryPhase(id, t) {
  const local = (((t + id * (dock + cross)) % CYCLE) + CYCLE) % CYCLE
  if (local < dock) return { side: 'europe', left: dock - local }
  if (local < dock + cross) return { side: null, progress: (local - dock) / cross, dir: 1 }
  if (local < 2 * dock + cross) return { side: 'asia', left: 2 * dock + cross - local }
  return { side: null, progress: (local - 2 * dock - cross) / cross, dir: -1 }
}

// Konum ve yön (vapurlar çift başlıdır: dönmez, ileri-geri gider)
export function ferryPose(id, t, out = {}) {
  const phase = ferryPhase(id, t)
  const lane = id === 0 ? -1 : 1 // geçişte birbirinden ayrılan şeritler
  if (phase.side) {
    out.x = DOCK_X[phase.side]
    out.z = PIERS.z
  } else {
    const k = smooth(phase.progress)
    const [a, b] = phase.dir > 0 ? [DOCK_X.europe, DOCK_X.asia] : [DOCK_X.asia, DOCK_X.europe]
    out.x = a + (b - a) * k
    out.z = PIERS.z + lane * 4.5 * Math.sin(Math.PI * phase.progress)
  }
  out.y = STRAIT.seaLevel
  out.phase = phase
  return out
}

// Bu iskelede şimdi binilebilecek vapur (en az 1,5 sn yanaşık kalacak) ya da sıradakine kalan süre
export function boarding(side, t) {
  let wait = Infinity
  for (const id of [0, 1]) {
    const phase = ferryPhase(id, t)
    if (phase.side === side && phase.left > 1.5) return { ferry: id, wait: 0 }
    // Bu vapurun bu iskeleye bir sonraki yanaşmasına kalan süre
    for (let dt = 0.5; dt <= CYCLE; dt += 0.5) {
      const next = ferryPhase(id, t + dt)
      if (next.side === side) {
        wait = Math.min(wait, dt)
        break
      }
    }
  }
  return { ferry: null, wait: Math.ceil(wait) }
}

// Sahnedeki vapurların canlı konumları (martılar ve taşınan araç izler)
export const ferryLive = [{ x: DOCK_X.europe, y: 0, z: PIERS.z }, { x: DOCK_X.asia, y: 0, z: PIERS.z }]

