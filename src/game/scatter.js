import { useMemo } from 'react'
import * as THREE from 'three'
import { AREAS, CLEARINGS, LAKE, LAMPS, PATHS, RING_RADIUS, RING_WIDTH, SPOTS, WORLD_HALF } from './layout.js'
import { heightAt } from './terrain.js'

// Bitki örtüsü, çit, duvar ve lamba yerleşimleri (bileşen değil, saf veri)

export const MODEL_URLS = {
  tree: '/models/tree.glb',
  maple: '/models/maple.glb',
  oak: '/models/oak.glb',
  bush: '/models/bush.glb',
  rock: '/models/rock.glb',
  grass: '/models/grass.glb',
  flower: '/models/flower.glb',
  fence: '/models/fence.glb',
  wall: '/models/wall.glb',
  lamp: '/models/lamp.glb',
}

function seeded(seed) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function distanceToSegment(px, pz, [ax, az], [bx, bz]) {
  const dx = bx - ax
  const dz = bz - az
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)))
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz))
}

function isFree(x, z, margin) {
  if (Math.abs(x) > WORLD_HALF - 2 || Math.abs(z) > WORLD_HALF - 2) return false
  if (CLEARINGS.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + margin)) return false
  if (PATHS.some((p) => distanceToSegment(x, z, p.from, p.to) < 4 + margin)) return false
  if (Math.abs(Math.hypot(x, z) - RING_RADIUS) < RING_WIDTH / 2 + 2.5 + margin) return false
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.radius + 2.5 + margin) return false
  if (SPOTS.some((s) => Math.hypot(x - s.position[0], z - s.position[2]) < 4 + margin)) return false
  if (LAMPS.some(([lx, , lz]) => Math.hypot(x - lx, z - lz) < 2 + margin)) return false
  return true
}

// Lambalar en yakın yola dönük durur; başlığın altındaki ampul konumu da buradan gelir
export function lampPlacements() {
  return LAMPS.map(([x, , z]) => {
    let best = null
    let bestD = Infinity
    for (const p of PATHS) {
      const [ax, az] = p.from
      const [bx, bz] = p.to
      const dx = bx - ax
      const dz = bz - az
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
      const px = ax + t * dx
      const pz = az + t * dz
      const d = Math.hypot(x - px, z - pz)
      if (d < bestD) {
        bestD = d
        best = [px, pz]
      }
    }
    const r = Math.hypot(x, z)
    if (Math.abs(r - RING_RADIUS) < bestD) best = [(x / r) * RING_RADIUS, (z / r) * RING_RADIUS]
    const rot = Math.atan2(best[0] - x, best[1] - z)
    const y = heightAt(x, z)
    const bulb = new THREE.Vector3(x + Math.sin(rot) * 0.15, y + 3.12, z + Math.cos(rot) * 0.15)
    return { x, z, y, rot, scale: 1, bulb }
  })
}

// Tüm yerleşimler tek seferde, tekrarlanabilir şekilde hesaplanır
export function useScatter(density = 1) {
  return useMemo(() => {
    const rand = seeded(11)
    const place = (count, margin, minGap, list, extra = () => ({})) => {
      let guard = 0
      const out = []
      while (out.length < count && guard++ < count * 60) {
        const x = (rand() * 2 - 1) * (WORLD_HALF - 3)
        const z = (rand() * 2 - 1) * (WORLD_HALF - 3)
        if (!isFree(x, z, margin)) continue
        if ([...list, ...out].some((t) => Math.hypot(t.x - x, t.z - z) < minGap)) continue
        out.push({ x, z, y: heightAt(x, z), rot: rand() * Math.PI * 2, scale: 0.8 + rand() * 0.45, ...extra(x, z) })
      }
      return out
    }
    const trees = place(Math.round(185 * density), 1.5, 5.5, [], () => ({ kind: ['tree', 'maple', 'oak'][Math.floor(rand() * 3)] }))
    const rocks = place(Math.round(55 * density), 0.5, 3, trees, () => ({ scale: 0.5 + rand() * 1.1 }))
    const bushes = place(Math.round(110 * density), 0, 2.2, [...trees, ...rocks])

    // Bölge kenarlarında ve göl kıyısında çimen öbekleri ve çiçekler
    const decor = []
    const ringAround = (cx, cz, radius, count, kind, jitter = 2) => {
      for (let i = 0; i < count; i++) {
        const a = rand() * Math.PI * 2
        const r = radius + (rand() - 0.5) * jitter * 2
        const x = cx + Math.cos(a) * r
        const z = cz + Math.sin(a) * r
        if (!isFree(x, z, -2.5) && kind !== 'flower') continue
        if (PATHS.some((p) => distanceToSegment(x, z, p.from, p.to) < 3.6)) continue
        if (Math.abs(Math.hypot(x, z) - RING_RADIUS) < RING_WIDTH / 2 + 1.5) continue
        if (SPOTS.some((s) => Math.hypot(x - s.position[0], z - s.position[2]) < 2.6)) continue
        decor.push({ kind, x, z, y: heightAt(x, z), rot: rand() * Math.PI * 2, scale: 0.7 + rand() * 0.6 })
      }
    }
    for (const a of AREAS) {
      if (a.id === 'race') continue
      ringAround(a.center[0], a.center[2], a.radius + (a.id === 'lake' ? 2.5 : 1), Math.round(12 * density), 'grass')
      ringAround(a.center[0], a.center[2], a.radius + (a.id === 'lake' ? 3.5 : 0.5), Math.round(22 * density), 'flower', 1.4)
    }

    // Oyun alanının etrafında ahşap çit (yolların girdiği yerlerde boşluk)
    const fences = []
    const pg = AREAS.find((a) => a.id === 'playground')
    const fr = pg.radius + 1.2
    const fenceCount = Math.floor((Math.PI * 2 * fr) / 2.6)
    for (let i = 0; i < fenceCount; i++) {
      const a = (i / fenceCount) * Math.PI * 2
      const gap = Math.abs(Math.sin(a) + 1) < 0.08 || Math.abs(Math.sin(a) - 1) < 0.08
      if (gap) continue
      fences.push({ x: pg.center[0] + Math.cos(a) * fr, z: pg.center[2] + Math.sin(a) * fr, rot: -a, y: 0 })
    }

    // Tepelerin eteğinde doğal taş duvarlar
    const walls = []
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2 + rand() * 0.08
      // Dış bölgelere giden yolların geçtiği çaprazlarda boşluk bırak
      const diag = Math.abs(((a - Math.PI / 4) % (Math.PI / 2) + Math.PI / 2) % (Math.PI / 2) - Math.PI / 4)
      if (Math.PI / 4 - diag < 0.14) continue
      const r = RING_RADIUS + RING_WIDTH / 2 + 4.5 + rand() * 1.5
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      walls.push({ x, z, y: heightAt(x, z) - 0.15, rot: -a + Math.PI / 2, scale: 0.9 + rand() * 0.4 })
    }

    const lamps = lampPlacements()

    return { trees, rocks, bushes, decor, fences, walls, lamps }
  }, [density])
}

