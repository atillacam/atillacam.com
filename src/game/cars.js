import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

// Garajdaki araçlar. Yeni bir GLB araç eklemek için:
// 1) models-src/ içine koy, scripts/optimize-models.mjs'e `car: true` ayarıyla ekle (tekerlek adları keepNames'te)
// 2) Buraya { id, name, url } satırı ekle. Fizik ölçüleri (aks ve iz genişliği) tüm araçlarda ortaktır.
export const CARS = [
  { id: 'ae86', name: { tr: 'Klasik Hatchback', en: 'Classic Hatchback' }, url: '/models/car.glb' },
  { id: 'racer', name: { tr: 'Spor Coupé', en: 'Sports Coupé' }, procedural: true },
]

// finish: yüzey (metal | chrome | matte; yoksa modelin kendi değeri)
// price: garaj dükkânındaki fiyat (yoksa ücretsiz); secret: yalnızca ödülle açılır
export const PAINTS = [
  { id: 'white', hex: '#f2f2f0', name: { tr: 'Beyaz', en: 'White' } },
  { id: 'red', hex: '#d8322f', name: { tr: 'Kırmızı', en: 'Red' } },
  { id: 'blue', hex: '#2f6fe0', name: { tr: 'Mavi', en: 'Blue' } },
  { id: 'yellow', hex: '#f2b632', name: { tr: 'Sarı', en: 'Yellow' } },
  { id: 'green', hex: '#2fae8a', name: { tr: 'Yeşil', en: 'Green' } },
  { id: 'black', hex: '#24262c', name: { tr: 'Siyah', en: 'Black' } },
  { id: 'neon-pink', hex: '#ff3fa4', price: 400, name: { tr: 'Neon pembe', en: 'Neon pink' } },
  { id: 'lime', hex: '#9be22d', price: 400, name: { tr: 'Limon yeşili', en: 'Lime' } },
  { id: 'matte-black', hex: '#1c1d21', price: 600, finish: 'matte', name: { tr: 'Mat siyah', en: 'Matte black' } },
  { id: 'ocean', hex: '#1d5fd1', price: 800, finish: 'metal', name: { tr: 'Metalik okyanus', en: 'Metallic ocean' } },
  { id: 'violet', hex: '#7a4dff', price: 800, finish: 'metal', name: { tr: 'Metalik mor', en: 'Metallic violet' } },
  { id: 'chrome', hex: '#e9edf2', price: 2500, finish: 'chrome', name: { tr: 'Krom', en: 'Chrome' } },
  // Gizli: bütün AÇ logoları bulununca açılır
  { id: 'gold', hex: '#d6a53a', secret: true, finish: 'metal', name: { tr: 'Altın', en: 'Gold' } },
]

// Yüzey değerleri (metalness, roughness)
export const FINISHES = { metal: [0.65, 0.28], chrome: [1, 0.08], matte: [0, 0.9] }

export const paintHex = (id) => PAINTS.find((p) => p.id === id)?.hex ?? PAINTS[0].hex

// Ortak tekerlek ölçüleri (Vehicle.jsx ile aynı)
const WHEEL_X = 0.615
const TRACK = 0.59
const RADIUS = 0.31

function wheel(radius, width) {
  const group = new THREE.Group()
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 28), new THREE.MeshStandardMaterial({ color: '#1d1f24', roughness: 0.85 }))
  tire.rotation.x = Math.PI / 2
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width + 0.02, 10), new THREE.MeshStandardMaterial({ color: '#c9ccd2', metalness: 0.85, roughness: 0.25 }))
  rim.rotation.x = Math.PI / 2
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.18, radius * 0.18, width + 0.04, 8), new THREE.MeshStandardMaterial({ color: '#2a2d33', metalness: 0.6, roughness: 0.4 }))
  hub.rotation.x = Math.PI / 2
  group.add(tire, rim, hub)
  group.traverse((o) => o.isMesh && (o.castShadow = true))
  return group
}

// Koddan üretilen alçak spor araç. Model koordinatı: ileri +x, tekerlek merkezi y=0.
export function buildRacer() {
  const body = new THREE.Group()
  const paint = new THREE.MeshPhysicalMaterial({ color: '#d8322f', roughness: 0.32, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.15 })
  const dark = new THREE.MeshStandardMaterial({ color: '#16181d', roughness: 0.6 })
  const glassDark = new THREE.MeshPhysicalMaterial({ color: '#141821', roughness: 0.05, metalness: 0.2, clearcoat: 1 })
  const glass = new THREE.MeshStandardMaterial({ color: '#fff7dc', emissive: new THREE.Color('#fff2c6'), emissiveIntensity: 0 })
  glass.name = 'headlight_glass'
  const add = (geometry, material, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geometry, material)
    m.position.set(x, y, z)
    m.rotation.set(rx, ry, rz)
    m.castShadow = true
    m.receiveShadow = true
    body.add(m)
    return m
  }
  // Gövde: alçak, geniş; çamurluk kabarıklıkları tekerlekleri sarar
  add(new RoundedBoxGeometry(2.62, 0.38, 1.18, 4, 0.14), paint, 0.05, 0.2, 0)
  add(new RoundedBoxGeometry(0.78, 0.3, 1.34, 3, 0.12), paint, WHEEL_X, 0.24, 0)
  add(new RoundedBoxGeometry(0.78, 0.3, 1.34, 3, 0.12), paint, -WHEEL_X, 0.24, 0)
  // Kabin ve camlar
  add(new RoundedBoxGeometry(1.15, 0.34, 0.98, 4, 0.14), paint, -0.18, 0.52, 0)
  add(new THREE.BoxGeometry(0.03, 0.27, 0.86), glassDark, 0.39, 0.52, 0, 0, 0, -0.62)
  add(new THREE.BoxGeometry(0.03, 0.24, 0.84), glassDark, -0.74, 0.52, 0, 0, 0, 0.6)
  add(new THREE.BoxGeometry(0.82, 0.22, 0.02), glassDark, -0.16, 0.54, 0.5)
  add(new THREE.BoxGeometry(0.82, 0.22, 0.02), glassDark, -0.16, 0.54, -0.5)
  // Ön ızgara, tampon, farlar, stop
  add(new THREE.BoxGeometry(0.05, 0.12, 0.7), dark, 1.36, 0.12, 0)
  add(new THREE.BoxGeometry(2.7, 0.08, 1.2), dark, 0.05, 0.02, 0)
  for (const z of [-0.4, 0.4]) {
    add(new THREE.BoxGeometry(0.06, 0.08, 0.26), glass, 1.35, 0.26, z)
    add(new THREE.BoxGeometry(0.04, 0.07, 0.3), new THREE.MeshStandardMaterial({ color: '#ff2b2b', emissive: '#ff2020', emissiveIntensity: 1.2, toneMapped: false }), -1.27, 0.27, z)
  }
  // Arka kanat
  add(new THREE.BoxGeometry(0.26, 0.04, 1.2), paint, -1.18, 0.66, 0)
  for (const z of [-0.45, 0.45]) add(new THREE.BoxGeometry(0.05, 0.22, 0.05), dark, -1.16, 0.52, z)

  const makeWheel = () => wheel(RADIUS, 0.26)
  const fl = makeWheel()
  const fr = makeWheel()
  const rear = new THREE.Group()
  const rl = makeWheel()
  const rr = makeWheel()
  rl.position.z = -TRACK
  rr.position.z = TRACK
  rear.add(rl, rr)
  return { body, wheels: { 'front left wheel': fl, 'front right wheel': fr, 'rear wheels': rear }, glass: [glass], paint: [paint] }
}
