// Garaj verileri (araçlar, boyalar). Three.js içermez: arayüz ve giriş ekranı 3D motoru yüklemeden kullanır.

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
