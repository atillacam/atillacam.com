import { WHEEL } from './layout.js'

// Dönme dolabın saati: sahne ve biniş aynı hesabı kullanır (ferry.js gibi yalnızca zamana bağlı)
const OMEGA = (Math.PI * 2) / WHEEL.ride // rad/sn

// Tekerin t anındaki dönüş açısı
export const wheelAngle = (t) => t * OMEGA
// i. kabinin teker düzlemindeki açısı: -π/2 en alt
export const cabinAngle = (i, t) => (i / WHEEL.cabins) * Math.PI * 2 + wheelAngle(t)

// Şu an en altta (binişe hazır) olan kabin
export function bottomCabin(t) {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < WHEEL.cabins; i++) {
    const a = cabinAngle(i, t) + Math.PI / 2
    const d = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)))
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}
