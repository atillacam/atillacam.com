import * as THREE from 'three'
import { toFloatAttributes } from './geometry.js'

// Kenney Car Kit (CC0) araçları: hepsi tek dosyada (scripts/import-cars.mjs), tek doku ve tek malzeme.
// Modeller +z'ye bakar; oyunda ileri +x. Dönüştürülmüş hâlde: tekerlek merkezleri y = 0'da,
// her tekerlek kendi merkezine taşınmış (dönebilir), yerleri wheelPos'ta (oyundaki sıra: ön sol, ön sağ, arka sol, arka sağ).
export const KENNEY_URL = '/models/cars.glb'

const TO_GAME = new THREE.Matrix4().makeRotationY(Math.PI / 2)
const WHEEL_KEYS = { 'wheel-front-left': 0, 'wheel-front-right': 1, 'wheel-back-left': 2, 'wheel-back-right': 3 }
const cache = new WeakMap()

// Bir aracın geometrileri (sahne başına bir kez hesaplanır)
function parts(scene, id) {
  let byScene = cache.get(scene)
  if (!byScene) cache.set(scene, (byScene = new Map()))
  if (byScene.has(id)) return byScene.get(id)
  // Araçlar sahnenin doğrudan alt düğümleri (getObjectByName sahnenin kendisini de bulabilir)
  const holder = scene.children.find((c) => c.name === id)
  if (!holder) throw new Error('cars.glb: ' + id + ' yok')
  holder.updateMatrixWorld(true)
  const toLocal = new THREE.Matrix4().copy(holder.matrixWorld).invert()
  const body = []
  const wheels = []
  let material = null
  holder.traverse((o) => {
    if (!o.isMesh) return
    // Yalnızca bu aracın parçaları (iç içe başka araç düğümü olsa bile)
    for (let p = o.parent; p && p !== holder; p = p.parent) if (scene.children.includes(p)) return
    material = o.material
    // Sıkıştırılmış (tamsayı) öznitelikler önce float olur; yoksa dönüşümde değerler kırpılıp model bozulur
    const geometry = toFloatAttributes(o.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld)).applyMatrix4(TO_GAME)
    // GLTFLoader aynı adlı düğümlere sonek ekler (wheel-front-left_3): sonek atılır; gerekirse üst düğüme bakılır
    const base = (n) => (n ?? '').replace(/_\d+$/, '')
    const slot = WHEEL_KEYS[base(o.name)] ?? WHEEL_KEYS[base(o.parent?.name)]
    if (slot === undefined) body.push(geometry)
    else {
      geometry.computeBoundingBox()
      const center = geometry.boundingBox.getCenter(new THREE.Vector3())
      geometry.translate(-center.x, -center.y, -center.z)
      wheels[slot] = { geometry, center, radius: (geometry.boundingBox.max.y - geometry.boundingBox.min.y) / 2 }
    }
  })
  // Tekerlek merkezleri y = 0 olacak şekilde gövdeyi indir
  const wheelY = wheels.reduce((a, w) => a + w.center.y, 0) / wheels.length
  for (const g of body) g.translate(0, -wheelY, 0)
  const box = new THREE.Box3()
  for (const g of body) {
    g.computeBoundingBox()
    box.union(g.boundingBox)
  }
  const result = {
    material,
    body,
    box,
    radius: wheels[0].radius,
    wheels: wheels.map((w) => ({ geometry: w.geometry, position: new THREE.Vector3(w.center.x, 0, w.center.z) })),
  }
  byScene.set(id, result)
  return result
}

const mesh = (geometry, material) => {
  const m = new THREE.Mesh(geometry, material)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

// Oyuncu aracı: Vehicle'ın beklediği biçim (gövde grubu, adlandırılmış tekerlekler, görsel tekerlek yerleri)
export function playerCar(scene, id) {
  const p = parts(scene, id)
  const body = new THREE.Group()
  for (const g of p.body) body.add(mesh(g, p.material))
  const names = ['front left wheel', 'front right wheel', 'rear left wheel', 'rear right wheel']
  const wheels = {}
  p.wheels.forEach((w, i) => (wheels[names[i]] = mesh(w.geometry, p.material)))
  return { body, wheels, wheelPos: p.wheels.map((w) => w.position), glass: [], paint: [], factoryPaint: true }
}

// NPC aracı: tekerlekler zemine oturur (alt kenar y = 0); farlar ve stop lambaları gece yanar
export function npcCar(scene, id, lights) {
  const p = parts(scene, id)
  const group = new THREE.Group()
  const lift = p.radius
  for (const g of p.body) {
    const m = mesh(g, p.material)
    m.position.y = lift
    group.add(m)
  }
  const spinners = p.wheels.map((w) => {
    const m = mesh(w.geometry, p.material)
    m.position.set(w.position.x, lift, w.position.z)
    group.add(m)
    return m
  })
  // Farlar (ön) ve stop lambaları (arka): modelin ön ve arka yüzüne ince ışıklı paneller
  const lampGeo = new THREE.BoxGeometry(0.04, 0.1, 0.22)
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(lampGeo, lights.head)
    head.position.set(p.box.max.x + 0.01, lift + 0.18, side * Math.min(0.42, p.box.max.z * 0.6))
    const tail = new THREE.Mesh(lampGeo, lights.tail)
    tail.position.set(p.box.min.x - 0.01, lift + 0.22, side * Math.min(0.42, p.box.max.z * 0.6))
    group.add(head, tail)
  }
  group.userData.spinners = spinners
  group.userData.radius = p.radius
  return group
}
