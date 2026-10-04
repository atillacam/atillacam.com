import { AREAS, PATHS, RING_RADIUS, RING_WIDTH } from './layout.js'

// Yol ağı: düz yollar + çevre yolu halkası. GPS rotası bu graf üzerinde en kısa yolu bulur.
// Grafı bir kez kurup bellekte tutuyoruz.

const RING_NODES = 64
let graph = null

function key(x, z) {
  return `${Math.round(x * 10)}:${Math.round(z * 10)}`
}

function buildGraph() {
  const nodes = []
  const index = new Map()
  const edges = []
  const add = (x, z) => {
    const k = key(x, z)
    if (index.has(k)) return index.get(k)
    const id = nodes.length
    nodes.push({ x, z })
    index.set(k, id)
    edges.push([])
    return id
  }
  const link = (a, b) => {
    const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z)
    edges[a].push([b, d])
    edges[b].push([a, d])
  }

  // Çevre yolu: halka üzerinde eşit aralıklı düğümler
  const ring = []
  for (let i = 0; i < RING_NODES; i++) {
    const a = (i / RING_NODES) * Math.PI * 2
    ring.push(add(Math.cos(a) * RING_RADIUS, Math.sin(a) * RING_RADIUS))
  }
  ring.forEach((id, i) => link(id, ring[(i + 1) % RING_NODES]))

  // Düz yollar: uzun yolları ara düğümlere bölüp uç noktaları birbirine bağla
  const pathNodes = []
  for (const p of PATHS) {
    const len = Math.hypot(p.to[0] - p.from[0], p.to[1] - p.from[1])
    const steps = Math.max(1, Math.ceil(len / 12))
    let prev = add(p.from[0], p.from[1])
    pathNodes.push(prev)
    for (let s = 1; s <= steps; s++) {
      const t = s / steps
      const id = add(p.from[0] + (p.to[0] - p.from[0]) * t, p.from[1] + (p.to[1] - p.from[1]) * t)
      link(prev, id)
      pathNodes.push(id)
      prev = id
    }
  }
  // Halkaya değen yol uçlarını en yakın halka düğümüne bağla
  const nearest = (x, z, pool) => {
    let best = -1
    let bestD = Infinity
    for (const id of pool) {
      const d = Math.hypot(nodes[id].x - x, nodes[id].z - z)
      if (d < bestD) {
        bestD = d
        best = id
      }
    }
    return [best, bestD]
  }
  for (const id of pathNodes) {
    const n = nodes[id]
    const r = Math.hypot(n.x, n.z)
    if (Math.abs(r - RING_RADIUS) <= RING_WIDTH / 2 + 4) {
      const [ringId] = nearest(n.x, n.z, ring)
      if (ringId !== id) link(id, ringId)
    }
  }
  // Birbirine çok yakın ama ayrı yolların uçlarını birleştir (meydan bağlantıları)
  for (let i = 0; i < pathNodes.length; i++) {
    for (let j = i + 1; j < pathNodes.length; j++) {
      const a = nodes[pathNodes[i]]
      const b = nodes[pathNodes[j]]
      if (pathNodes[i] !== pathNodes[j] && Math.hypot(a.x - b.x, a.z - b.z) < 12) link(pathNodes[i], pathNodes[j])
    }
  }
  // Bölge merkezleri: en yakın yol düğümüne bağlanır
  const all = nodes.map((_, i) => i)
  for (const area of AREAS) {
    const id = add(area.center[0], area.center[2])
    const [near] = nearest(area.center[0], area.center[2], all.filter((n) => n !== id))
    link(id, near)
    // Meydanlar çevre yola da bağlanır (aradaki çimenden geçilebilir)
    const [ringId, ringD] = nearest(area.center[0], area.center[2], ring)
    if (ringD < area.radius + 20) link(id, ringId)
  }
  return { nodes, edges, nearest: (x, z) => nearest(x, z, nodes.map((_, i) => i)) }
}

// Dijkstra (düğüm sayısı küçük; basit dizi kuyruğu yeterli)
export function findRoute(fromX, fromZ, toX, toZ) {
  if (!graph) graph = buildGraph()
  const { nodes, edges } = graph
  const [start] = graph.nearest(fromX, fromZ)
  const [goal] = graph.nearest(toX, toZ)
  const dist = new Float64Array(nodes.length).fill(Infinity)
  const prev = new Int32Array(nodes.length).fill(-1)
  const done = new Uint8Array(nodes.length)
  dist[start] = 0
  for (let iter = 0; iter < nodes.length; iter++) {
    let u = -1
    let best = Infinity
    for (let i = 0; i < nodes.length; i++) {
      if (!done[i] && dist[i] < best) {
        best = dist[i]
        u = i
      }
    }
    if (u === -1 || u === goal) break
    done[u] = 1
    for (const [v, w] of edges[u]) {
      if (dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w
        prev[v] = u
      }
    }
  }
  const points = [{ x: toX, z: toZ }]
  for (let u = goal; u !== -1; u = prev[u]) points.push(nodes[u])
  points.push({ x: fromX, z: fromZ })
  points.reverse()
  // Çok kısa ardışık parçaları ayıkla
  const clean = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const p = clean[clean.length - 1]
    if (Math.hypot(points[i].x - p.x, points[i].z - p.z) > 1.5) clean.push(points[i])
  }
  return clean
}

export function routeLength(points) {
  let d = 0
  for (let i = 1; i < points.length; i++) d += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z)
  return d
}
