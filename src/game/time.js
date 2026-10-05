import * as THREE from 'three'

// Gün-gece döngüsünün canlı durumu. Her kare güncellenir; React render'ı tetiklemez.
// time: 0 = gece yarısı, 0.25 = gün doğumu, 0.5 = öğle, 0.75 = gün batımı
export const world = {
  time: 0.33,
  target: null, // butonla geçişte hedef saat
  speed: 1 / 420, // tam gün ≈ 7 dakika
  night: 0, // 0 gündüz … 1 gece
  wet: 0, // yağmur yoğunluğu 0..1
  snowy: 0, // kar yoğunluğu 0..1
  flash: 0, // şimşek parlaması 0..1
  sunDir: new THREE.Vector3(0, 1, 0),
  skyTop: new THREE.Color(),
  skyHorizon: new THREE.Color(),
  // Mevsim: 0 ilkbahar, 1 yaz, 2 sonbahar, 3 kış (ondalıklı değer = iki mevsim arası geçiş)
  season: seasonFromDate(new Date()),
  snowCover: 0, // zemindeki kar örtüsü 0..1
  // Ortak shader değerleri: rüzgâr saati, aracın konumu (görüş hattı şeffaflığı için),
  // mevsim ağırlıkları (x ilkbahar, y yaz, z sonbahar, w kış) ve kar örtüsü
  uniforms: {
    uTime: { value: 0 },
    uCar: { value: new THREE.Vector3() },
    uSeason: { value: new THREE.Vector4(0, 1, 0, 0) },
    uSnow: { value: 0 },
    uCloud: { value: 0 }, // bulut gölgesi gücü 0..1
  },
}

export const SEASONS = ['spring', 'summer', 'autumn', 'winter']

// Gerçek takvimden başlangıç mevsimi (kuzey yarımküre): Mart–Mayıs ilkbahar, Haziran–Ağustos yaz …
export function seasonFromDate(date) {
  return Math.floor(((date.getMonth() + 10) % 12) / 3)
}

// Mevsim değerinden dört ağırlık: komşu iki mevsim arasında yumuşak geçiş, toplam her zaman 1
export function seasonWeights(season, out) {
  const w = [0, 0, 0, 0]
  const base = Math.floor(season) % 4
  const k = season - Math.floor(season)
  // Mevsimin büyük kısmı sabit kalır, sondaki %25'lik dilimde bir sonrakine geçer
  const t = THREE.MathUtils.smoothstep(k, 0.75, 1)
  w[base] = 1 - t
  w[(base + 1) % 4] += t
  return out.set(w[0], w[1], w[2], w[3])
}

// Gökyüzü renk anahtarları (zaman → zenit, ufuk)
const KEYS = [
  { t: 0.0, top: '#060a1c', horizon: '#141c3a' },
  { t: 0.21, top: '#0b1430', horizon: '#2a2d55' },
  { t: 0.26, top: '#3c5a96', horizon: '#f2a37a' },
  { t: 0.32, top: '#5b9be0', horizon: '#ffd9a8' },
  { t: 0.42, top: '#3f8be0', horizon: '#bfe2f4' },
  { t: 0.58, top: '#3f8be0', horizon: '#bfe2f4' },
  { t: 0.68, top: '#5a86d4', horizon: '#ffcf9a' },
  { t: 0.745, top: '#40477f', horizon: '#ff8a5c' },
  { t: 0.8, top: '#121a3a', horizon: '#3a2c55' },
  { t: 1.0, top: '#060a1c', horizon: '#141c3a' },
].map((k) => ({ t: k.t, top: new THREE.Color(k.top), horizon: new THREE.Color(k.horizon) }))

export function skyColors(t, top, horizon) {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i]
    const b = KEYS[i + 1]
    if (t >= a.t && t <= b.t) {
      const k = (t - a.t) / (b.t - a.t)
      top.copy(a.top).lerp(b.top, k)
      horizon.copy(a.horizon).lerp(b.horizon, k)
      return
    }
  }
}

// Güneşin yüksekliği: -1 (gece yarısı) … 1 (öğle)
export function sunElevation(t) {
  return Math.sin((t - 0.25) * Math.PI * 2)
}
