// Kenney Car Kit (CC0) araçlarını tek dosyada birleştirir: public/models/cars.glb
// Her araç sahnede kendi adındaki düğümün altında (body + wheel-front-left ... düğümleri).
// Ortak renk paleti dokusu ve malzeme bir kez saklanır; geometri meshopt ile sıkıştırılır.
// Kullanım: node scripts/import-cars.mjs  (kaynak: models-src/cars/kenney_car-kit/Models/GLB format)
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, mergeDocuments, meshopt, prune, unpartition, weld } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'

const SRC = 'models-src/cars/kenney_car-kit/Models/GLB format/'
const OUT = 'public/models/cars.glb'
// Trafikte ve garajda kullanılanlar
const CARS = ['sedan', 'taxi', 'van', 'suv', 'delivery', 'police', 'ambulance', 'truck', 'hatchback-sports', 'sedan-sports', 'race', 'race-future', 'suv-luxury']

await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })

const target = await io.read(SRC + CARS[0] + '.glb')
const root = target.getRoot()
const main = root.listScenes()[0]
// İlk aracın kökleri kendi düğümüne
const wrap = (scene, name) => {
  const holder = target.createNode(name)
  for (const child of scene.listChildren()) {
    scene.removeChild(child)
    holder.addChild(child)
  }
  main.addChild(holder)
}
main.setName('cars')
wrap(main, CARS[0])
for (const name of CARS.slice(1)) {
  const source = await io.read(SRC + name + '.glb')
  const map = mergeDocuments(target, source)
  const scene = map.get(source.getRoot().listScenes()[0])
  wrap(scene, name)
  scene.dispose()
}
await target.transform(unpartition(), weld(), dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
await io.write(OUT, target)
const { statSync } = await import('node:fs')
console.log(OUT, Math.round(statSync(OUT).size / 1024) + ' KB', root.listTextures().length + ' doku', root.listMaterials().length + ' malzeme')
