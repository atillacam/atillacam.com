import { PAINTS } from './cars.js'

// Garaj dükkânı: oyunlarda kazanılan ₺ ile yalnızca görünüm satın alınır.
// Performans satılmaz: yarış ve dünya sıralaması herkes için adil kalır.
// Her kategoride en fazla bir eşya takılı olur (boya garajdaki renk seçimidir).

export const SHOP_CATEGORIES = [
  { id: 'paint', name: { tr: 'Boya', en: 'Paint' } },
  { id: 'glow', name: { tr: 'Neon taban', en: 'Underglow' } },
  { id: 'trail', name: { tr: 'İz efekti', en: 'Trail' } },
  { id: 'horn', name: { tr: 'Korna', en: 'Horn' } },
  { id: 'roof', name: { tr: 'Tavan', en: 'Roof' } },
]

export const SHOP_ITEMS = {
  // Satılık boyalar önce (fiyata göre), ücretsizler sonra
  paint: PAINTS.filter((p) => !p.secret)
    .map((p) => ({ id: p.id, name: p.name, price: p.price ?? 0, color: p.hex, finish: p.finish }))
    .sort((a, b) => (b.price > 0) - (a.price > 0) || a.price - b.price),
  glow: [
    { id: 'glow-blue', name: { tr: 'Buz mavisi', en: 'Ice blue' }, price: 800, color: '#3d9bff' },
    { id: 'glow-pink', name: { tr: 'Neon pembe', en: 'Neon pink' }, price: 800, color: '#ff3fa4' },
    { id: 'glow-green', name: { tr: 'Zehir yeşili', en: 'Toxic green' }, price: 800, color: '#2fe08a' },
    { id: 'glow-rainbow', name: { tr: 'Gökkuşağı', en: 'Rainbow' }, price: 2000, color: 'rainbow' },
  ],
  trail: [
    { id: 'trail-smoke', name: { tr: 'Duman', en: 'Smoke' }, price: 900, color: '#b9bec8' },
    { id: 'trail-sparks', name: { tr: 'Kıvılcım', en: 'Sparks' }, price: 1200, color: '#ffb547' },
    { id: 'trail-rainbow', name: { tr: 'Gökkuşağı', en: 'Rainbow' }, price: 1800, color: 'rainbow' },
  ],
  horn: [
    { id: 'horn-classic', name: { tr: 'Klasik', en: 'Classic' }, price: 0 },
    { id: 'horn-dolmus', name: { tr: 'Dolmuş', en: 'Minibus' }, price: 300 },
    { id: 'horn-ferry', name: { tr: 'Vapur düdüğü', en: 'Ferry horn' }, price: 500 },
    { id: 'horn-melody', name: { tr: 'Melodi', en: 'Melody' }, price: 1200 },
  ],
  roof: [
    { id: 'roof-taxi', name: { tr: 'Taksi lambası', en: 'Taxi light' }, price: 600, color: '#f2c230' },
    { id: 'roof-surf', name: { tr: 'Sörf tahtası', en: 'Surfboard' }, price: 900, color: '#2ec4b6' },
    { id: 'roof-police', name: { tr: 'Çakar lamba', en: 'Light bar' }, price: 1500, color: '#e84a5f' },
  ],
}

// Takılı eşyaların varsayılanı (boya ayrı: carColor)
export const DEFAULT_EQUIPPED = { glow: null, trail: null, horn: 'horn-classic', roof: null }

export const findItem = (category, id) => SHOP_ITEMS[category]?.find((i) => i.id === id) ?? null
export const isFree = (category, id) => (findItem(category, id)?.price ?? 0) === 0

// Oyunlardan kazanılan ödüller (₺)
export const REWARDS = {
  achievement: 25,
  core: 20,
  logo: 50,
  goal: 30,
  raceFinish: 80,
  raceRecord: 60,
  ringsFinish: 120,
  ringsRecord: 80,
  sumoWin: 150,
  sumoRecord: 100,
  golfPar: 60,
  holeInOne: 150,
}

export const SIMIT = { price: 15, seconds: 15, power: 1.2 }

export function formatMoney(amount, lang) {
  return '₺' + Math.round(amount).toLocaleString(lang === 'en' ? 'en-GB' : 'tr-TR')
}
