// Premium (gerçekçi) araçları web'e uygun hâle getirir: public/models/premium/<id>.glb
// - İç mekân ve alt takım gibi görünmeyen parçalar atılır
// - Saydam (x-ray) boya opak yapılır; boya malzemesi "premium_paint" adını alır (garajda boyanabilir)
// - Araç +z'ye bakacak şekilde döndürülür, uzunluğu oyuna uygun ölçeklenir, tabanı y = 0'a oturur
// - Tekerlek malzemeleri üçgen konumuna göre dört tekerleğe bölünür (wheel-front-left ...; x > 0 sol)
// - Üçgen sayısı hedefe sadeleştirilir, dokular 1024 px webp, geometri meshopt ile sıkıştırılır
// Kullanım: node scripts/import-premium.mjs
import fs from 'node:fs'
import { NodeIO, getBounds } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { clearNodeTransform, dedup, flatten, join, meshopt, prune, simplify, textureCompress, transformMesh, weld } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'

const SRC = 'models-src/premium/'
const OUT = 'public/models/premium/'
const MODELS = [
  {
    id: 'sls',
    file: '2010_mercedes_sls_amg/scene.gltf',
    forward: 1, // ön +z
    length: 3.4,
    tris: 42000,
    drop: /^(INT_|DAMAGE_GLASS|Mechanics)/,
    wheels: /^(Rim|Tyre|Brake_Disk)/,
    paint: /^Carpaint/,
  },
  {
    id: 'amg-one',
    file: 'transparency_mercedes_amg_one/scene.gltf',
    forward: 0, // otomatik (farların tarafı)
    length: 3.4,
    tris: 80000,
    drop: /(interior|stitches|speakers|belt|underbody|trim001)/,
    wheels: /(tire|rim|hubdecal)/,
    paint: /amgprojone_paint$/,
    opaque: /(amgprojone_paint|amgprojone_carbon)$/,
    headlight: /headlight/,
    error: 0.008,
    hideInside: /(plastic|carbon|grey)$/, // opak gövdenin içinde kalan motor ve şasi parçaları
  },
]

await MeshoptEncoder.ready
await MeshoptSimplifier.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
fs.mkdirSync(OUT, { recursive: true })

const countTris = (root) => root.listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, p) => b + (p.getIndices()?.getCount() ?? 0) / 3, 0), 0)

for (const cfg of MODELS) {
  const doc = await io.read(SRC + cfg.file)
  const root = doc.getRoot()
  await doc.transform(flatten())
  for (const node of root.listNodes()) if (node.getMesh()) clearNodeTransform(node)

  // Görünmeyen parçaları at
  for (const mesh of root.listMeshes())
    for (const prim of mesh.listPrimitives()) if (cfg.drop.test(prim.getMaterial()?.getName() ?? '')) prim.dispose()

  // Boya: opak, dokusuz (renk garajdan), parlak metalik
  for (const mat of root.listMaterials()) {
    const name = mat.getName()
    if (cfg.opaque?.test(name)) {
      mat.setAlphaMode('OPAQUE')
      const c = mat.getBaseColorFactor()
      mat.setBaseColorFactor([c[0], c[1], c[2], 1])
    }
    if (cfg.paint.test(name)) {
      mat.setName('premium_paint').setBaseColorTexture(null).setBaseColorFactor([1, 1, 1, 1]).setAlphaMode('OPAQUE').setMetallicFactor(0.55).setRoughnessFactor(0.28)
    }
  }

  // Yön: farların ortalaması z < 0 ise 180° çevir
  let forward = cfg.forward
  if (!forward) {
    let sum = 0
    let n = 0
    for (const mesh of root.listMeshes())
      for (const prim of mesh.listPrimitives()) {
        if (!cfg.headlight.test(prim.getMaterial()?.getName() ?? '')) continue
        const pos = prim.getAttribute('POSITION')
        for (let i = 0; i < pos.getCount(); i += 7) {
          sum += pos.getElement(i, [0, 0, 0])[2]
          n++
        }
      }
    forward = sum / Math.max(n, 1) >= 0 ? 1 : -1
  }

  // Ölçek ve konum: uzunluk hedefe, merkez x-z'de 0, taban y = 0
  const b = getBounds(root.listScenes()[0])
  const s = cfg.length / (b.max[2] - b.min[2])
  const cx = (b.min[0] + b.max[0]) / 2
  const cz = (b.min[2] + b.max[2]) / 2
  const f = forward
  // x' = f*s*(x - cx), z' = f*s*(z - cz), y' = s*(y - ymin)
  const matrix = [f * s, 0, 0, 0, 0, s, 0, 0, 0, 0, f * s, 0, -f * s * cx, -s * b.min[1], -f * s * cz, 1]
  for (const mesh of root.listMeshes()) transformMesh(mesh, matrix)

  // Opak gövdenin içinde kalan (hiç görünmeyecek) parçalar: kutusu iç bölgede kalan ilkel geometriler atılır
  if (cfg.hideInside) {
    const L = cfg.length / 2
    const sb = getBounds(root.listScenes()[0])
    const hx = (sb.max[0] - sb.min[0]) / 2
    const top = sb.max[1]
    for (const mesh of root.listMeshes())
      for (const prim of mesh.listPrimitives()) {
        if (!cfg.hideInside.test(prim.getMaterial()?.getName() ?? '')) continue
        // Üçgen düzeyinde: ağırlık merkezi iç bölgede kalan üçgenler atılır
        const pos = prim.getAttribute('POSITION')
        const idx = prim.getIndices()
        const keep = []
        const v = [0, 0, 0]
        for (let t = 0; t < idx.getCount(); t += 3) {
          let x = 0
          let y = 0
          let z = 0
          for (let k = 0; k < 3; k++) {
            pos.getElement(idx.getScalar(t + k), v)
            x += v[0] / 3
            y += v[1] / 3
            z += v[2] / 3
          }
          const inside = Math.abs(x) < hx * 0.8 && Math.abs(z) < L * 0.85 && y > 0.14 && y < top * 0.78
          if (!inside) keep.push(idx.getScalar(t), idx.getScalar(t + 1), idx.getScalar(t + 2))
        }
        if (keep.length === 0) prim.dispose()
        else prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(keep)))
      }
  }

  // Tekerlekleri dörde böl: her çeyrek kendi düğümü ve kendi köşe kopyasıyla
  const scene = root.listScenes()[0]
  const quad = {}
  const quadNode = (key) => {
    if (!quad[key]) {
      const mesh = doc.createMesh(key)
      const node = doc.createNode(key).setMesh(mesh)
      scene.addChild(node)
      quad[key] = mesh
    }
    return quad[key]
  }
  for (const mesh of root.listMeshes()) {
    if (Object.values(quad).includes(mesh)) continue
    for (const prim of mesh.listPrimitives()) {
      if (!cfg.wheels.test(prim.getMaterial()?.getName() ?? '')) continue
      const pos = prim.getAttribute('POSITION')
      const idx = prim.getIndices()
      const groups = {}
      const a = [0, 0, 0]
      for (let t = 0; t < idx.getCount(); t += 3) {
        let x = 0
        let z = 0
        for (let k = 0; k < 3; k++) {
          pos.getElement(idx.getScalar(t + k), a)
          x += a[0]
          z += a[2]
        }
        const key = `wheel-${z > 0 ? 'front' : 'back'}-${x > 0 ? 'left' : 'right'}`
        ;(groups[key] ??= []).push(idx.getScalar(t), idx.getScalar(t + 1), idx.getScalar(t + 2))
      }
      for (const [key, list] of Object.entries(groups)) {
        // Yalnızca kullanılan köşeler kopyalanır
        const used = [...new Set(list)]
        const remap = new Map(used.map((v, i) => [v, i]))
        const part = doc.createPrimitive().setMaterial(prim.getMaterial())
        for (const semantic of prim.listSemantics()) {
          const src = prim.getAttribute(semantic)
          const size = src.getElementSize()
          const arr = new Float32Array(used.length * size)
          const el = new Array(size)
          used.forEach((v, i) => arr.set(src.getElement(v, el), i * size))
          part.setAttribute(semantic, doc.createAccessor().setType(src.getType()).setArray(arr))
        }
        part.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(list.map((v) => remap.get(v)))))
        quadNode(key).addPrimitive(part)
      }
      prim.dispose()
    }
  }

  // Gövde parçaları tek "body" altında; aracın kök düğümü id
  const holder = doc.createNode(cfg.id)
  for (const node of [...scene.listChildren()]) {
    if (!node.getMesh() || node.getMesh().listPrimitives().length === 0) continue
    if (!node.getName().startsWith('wheel-')) node.setName('')
    scene.removeChild(node)
    holder.addChild(node)
  }
  for (const node of [...scene.listChildren()]) scene.removeChild(node)
  scene.addChild(holder)
  scene.setName('premium')

  const before = countTris(root)
  await doc.transform(
    join({ keepNamed: true }),
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, cfg.tris / before), error: cfg.error ?? 0.004 }),
    dedup(),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 80 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  )
  const out = OUT + cfg.id + '.glb'
  await io.write(out, doc)
  console.log(cfg.id, 'yön', forward, 'ölçek', s.toFixed(3), 'üçgen', Math.round(before), '→', Math.round(countTris(root)), 'malzeme', root.listMaterials().length, 'doku', root.listTextures().length, Math.round(fs.statSync(out).size / 1024) + ' KB')
}
