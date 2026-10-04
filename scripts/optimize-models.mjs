// Kaynak modelleri (models-src/) web için optimize edip public/models/ içine yazar.
// Çalıştırma: npm run models
//
// Her model için: eski SpecGloss malzemeleri MetalRough'a çevrilir, tüm dönüşümler köşelere işlenir,
// model metre ölçeğine getirilir (taban y=0, x/z merkezde), aynı malzemeli parçalar birleştirilir,
// üçgen sayısı azaltılır, dokular WebP'ye çevrilip küçültülür ve geometri Meshopt ile sıkıştırılır.

import fs from 'node:fs'
import path from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import {
  clearNodeTransform,
  dedup,
  flatten,
  getBounds,
  join,
  meshopt,
  metalRough,
  prune,
  simplify,
  textureCompress,
  transformMesh,
  weld,
} from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'

const SRC = 'models-src'
const OUT = 'public/models'

// height: hedef yükseklik (m). simplify: korunacak üçgen oranı. texture: en büyük doku kenarı.
// removeMaterials: atılacak parçalar. alphaMask: yaprak kartları için şeffaflık modu. keepNames: ayrı kalacak parçalar.
const MODELS = {
  car: { file: 'cartoon_car.glb', car: true, simplify: 0.3, error: 0.004, texture: 1024, keepNames: ['front left wheel', 'front right wheel', 'rear wheels'] },
  tree: { file: 'tree.glb', height: 6.5, simplify: 0.18, error: 0.05, texture: 256 },
  maple: { file: 'maple_tree.glb', height: 7.5, simplify: 0.3, error: 0.05, texture: 512, removeMaterials: ['Groundcover_Wood_Mix', 'grass'], alphaMask: ['sugar_maple_leaf'] },
  oak: { file: 'oak_trees.glb', height: 6, simplify: 0.3, error: 0.05, texture: 512 },
  bush: { file: 'stylized_bush.glb', height: 1.1, simplify: 1, texture: 512 },
  rock: { file: 'rock.glb', height: 1.8, simplify: 0.08, error: 0.02, texture: 512 },
  lamp: { file: 'street_lamb.glb', height: 3.4, simplify: 1, texture: 256 },
  fence: { file: 'wooden_fence.glb', height: 1.3, simplify: 1, texture: 512 },
  wall: { file: 'ruined_rock_fence.glb', height: 1.4, simplify: 1, texture: 512 },
  grass: { file: 'grass.glb', height: 0.55, simplify: 0.03, error: 0.15, texture: 256, alphaMask: ['*'] },
  flower: { file: 'white_flower.glb', height: 0.6, simplify: 0.006, error: 0.12, texture: 256, alphaMask: ['*'] },
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
})

async function processModel(key, cfg) {
  const doc = await io.read(path.join(SRC, cfg.file))
  const root = doc.getRoot()
  const credit = root.getAsset().extras ?? {}

  // Animasyon ve deri (skin) kullanılmıyor; statik modellere indir
  root.listAnimations().forEach((a) => a.dispose())
  root.listSkins().forEach((s) => s.dispose())

  await doc.transform(metalRough(), flatten())

  // Kaldırılacak malzemelerin parçalarını sil
  if (cfg.removeMaterials) {
    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        if (cfg.removeMaterials.includes(prim.getMaterial()?.getName())) prim.dispose()
      }
    }
  }

  // Yaprak/çimen kartları: BLEND yerine MASK (sıralama hatası yok, daha hızlı)
  if (cfg.alphaMask) {
    for (const mat of root.listMaterials()) {
      if (cfg.alphaMask.includes('*') || cfg.alphaMask.includes(mat.getName())) {
        mat.setAlphaMode('MASK').setAlphaCutoff(0.45).setDoubleSided(true)
      }
    }
  }

  // Düğüm dönüşümlerini köşelere işle; ayrı tutulacakların dışındaki isimleri sil (birleşebilsinler)
  for (const node of root.listNodes()) {
    if (node.getMesh()) clearNodeTransform(node)
    const keep = cfg.keepNames?.find((n) => node.getName().startsWith(n))
    node.setName(keep ?? '')
    node.getMesh()?.setName(keep ?? '')
  }

  // Ölçek ve konum normalizasyonu
  const scene = root.listScenes()[0]
  const bounds = getBounds(scene)
  let matrix
  if (cfg.car) {
    // Araba: ileri +z → +x, uzunluk 2.6 m, aks ortası x=0, tekerlek merkezi y=0
    const s = 2.6 / (bounds.max[2] - bounds.min[2])
    const wheelY = 2.55
    const wheelMidZ = (3.61 + -2.28) / 2
    // y ekseni etrafında +90°: x' = z, z' = -x
    matrix = [0, 0, -s, 0, 0, s, 0, 0, s, 0, 0, 0, -wheelMidZ * s, -wheelY * s, 0, 1]
    console.log(`  araba ölçeği ${s.toFixed(4)} (tekerlek yarıçapı ≈ ${(1.48 * s).toFixed(3)} m)`)
  } else {
    const h = bounds.max[1] - bounds.min[1]
    const s = cfg.height / h
    const cx = (bounds.min[0] + bounds.max[0]) / 2
    const cz = (bounds.min[2] + bounds.max[2]) / 2
    matrix = [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, -cx * s, -bounds.min[1] * s, -cz * s, 1]
  }
  for (const mesh of root.listMeshes()) transformMesh(mesh, matrix)

  await doc.transform(
    join({ keepNamed: true }),
    weld(),
    ...(cfg.simplify < 1 ? [simplify({ simplifier: MeshoptSimplifier, ratio: cfg.simplify, error: cfg.error ?? 0.002 })] : []),
    dedup(),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [cfg.texture, cfg.texture], quality: 82 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  )

  const out = path.join(OUT, `${key}.glb`)
  await io.write(out, doc)

  let tris = 0
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? 0) / 3
  const size = fs.statSync(out).size
  const b = getBounds(root.listScenes()[0])
  console.log(
    `${key.padEnd(7)} ${(size / 1024).toFixed(0).padStart(6)} KB  ${Math.round(tris).toString().padStart(6)} üçgen  ${root.listMeshes().length} mesh  boyut ${b.max.map((v, i) => (v - b.min[i]).toFixed(2)).join('×')} m`,
  )
  return { key, file: cfg.file, ...credit }
}

fs.mkdirSync(OUT, { recursive: true })
await MeshoptEncoder.ready
await MeshoptSimplifier.ready
const credits = []
for (const [key, cfg] of Object.entries(MODELS)) {
  credits.push(await processModel(key, cfg))
}
// Lisans bilgileri (CC-BY 4.0 atıf zorunluluğu için) sitede gösterilir
fs.writeFileSync('src/game/credits.json', JSON.stringify(credits, null, 2) + '\n')
console.log('\nsrc/game/credits.json yazıldı.')
