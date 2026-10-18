// Garaj verileri (araçlar, boyalar). Three.js içermez: arayüz ve giriş ekranı 3D motoru yüklemeden kullanır.

// Garajdaki araçlar. Yeni bir GLB araç eklemek için:
// 1) models-src/ içine koy, scripts/optimize-models.mjs'e `car: true` ayarıyla ekle (tekerlek adları keepNames'te)
// 2) Buraya { id, name, url } satırı ekle. Fizik ölçüleri (aks ve iz genişliği) tüm araçlarda ortaktır.
// spec: power (motor gücü çarpanı), top / boost (azami hız, m/s), steer (en büyük direksiyon açısı)
// rating: garajda gösterilen değerler (1-5): güç, hız, yol tutuş
export const CARS = [
  {
    id: 'ae86',
    name: { tr: 'Klasik Hatchback', en: 'Classic Hatchback' },
    url: '/models/car.glb',
    spec: { power: 1, top: 17, boost: 25, steer: 0.5 },
    rating: { power: 3, speed: 3, grip: 5 },
  },
  {
    id: 'racer',
    name: { tr: 'Spor Coupé', en: 'Sports Coupé' },
    procedural: true,
    spec: { power: 1.3, top: 21, boost: 29, steer: 0.42 },
    rating: { power: 5, speed: 5, grip: 3 },
  },
  // Kenney Car Kit (CC0) modelleri; price: garajda satın alma (₺), yoksa ücretsiz
  {
    id: 'hatch-sport',
    kenney: 'hatchback-sports',
    name: { tr: 'Sportif Hatchback', en: 'Hot Hatch' },
    spec: { power: 1.1, top: 18.5, boost: 26.5, steer: 0.52 },
    rating: { power: 3, speed: 4, grip: 5 },
  },
  {
    id: 'sedan-sport',
    kenney: 'sedan-sports',
    name: { tr: 'Spor Sedan', en: 'Sports Sedan' },
    price: 600,
    spec: { power: 1.18, top: 19.5, boost: 27.5, steer: 0.46 },
    rating: { power: 4, speed: 4, grip: 4 },
  },
  {
    id: 'suv-lux',
    kenney: 'suv-luxury',
    name: { tr: 'Lüks SUV', en: 'Luxury SUV' },
    price: 900,
    spec: { power: 1.2, top: 17.5, boost: 25, steer: 0.44 },
    rating: { power: 4, speed: 3, grip: 4 },
  },
  {
    id: 'pickup',
    kenney: 'truck',
    name: { tr: 'Pikap', en: 'Pickup' },
    price: 900,
    spec: { power: 1.35, top: 16, boost: 23, steer: 0.42 },
    rating: { power: 5, speed: 2, grip: 3 },
  },
  {
    id: 'police',
    kenney: 'police',
    name: { tr: 'Polis Aracı', en: 'Police Cruiser' },
    price: 1500,
    spec: { power: 1.25, top: 20.5, boost: 28.5, steer: 0.47 },
    rating: { power: 4, speed: 5, grip: 4 },
  },
  {
    id: 'race',
    kenney: 'race',
    name: { tr: 'Yarış Arabası', en: 'Race Car' },
    price: 3000,
    spec: { power: 1.4, top: 22.5, boost: 31, steer: 0.45 },
    rating: { power: 5, speed: 5, grip: 5 },
  },
  {
    id: 'race-future',
    kenney: 'race-future',
    name: { tr: 'Geleceğin Yarışçısı', en: 'Future Racer' },
    price: 5000,
    spec: { power: 1.5, top: 24, boost: 33, steer: 0.43 },
    rating: { power: 5, speed: 5, grip: 4 },
  },
]
export const carSpec = (id) => (CARS.find((c) => c.id === id) ?? CARS[0]).spec

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
