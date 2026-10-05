// AÇ logosu ("Monolit"): koyu rozet üzerinde keskin, dolu, degrade harfler.
// Yazı tipine bağlı değildir; tüm şekiller vektör yol olarak çizilir.
// GLYPH ve renkler src/ui/Icons.jsx içindeki <Logo /> bileşeni tarafından da içe aktarılır: tek kaynak burası.
// viewBox 0 0 64 64; glif güvenli alanın içinde kalır (maskable ikonlar için).

export const LOGO_COLORS = {
  from: '#4a86ff', // harf degradesi başlangıcı (marka mavisi)
  to: '#8a5cff', // harf degradesi sonu (marka moru)
  bgTop: '#16203a',
  bgBottom: '#0b1020',
}

export const GLYPH = {
  // A: dolu gövde, iç boşluk evenodd ile oyulur; düz ayaklar
  a: 'M7 46 L17.1 17.5 H22.9 L33 46 H27.1 L25.1 40 H14.9 L12.9 46 Z M16.5 35 H23.5 L20 24.6 Z',
  // Ç: sağa açık kalın yay (düz uçlu)
  c: 'M54.1 24.6 A10.2 10.2 0 1 0 54.1 38.4',
  // Çengel: geometrik, yayın alt ucuna bağlı
  cedilla: 'M43.1 43.4 H46.7 V46.2 H49.1 L46.1 51.2 H42.5 L44.9 47.8 H43.1 Z',
}
export const C_STROKE = 5.6
// Çengel aşağı sarktığı için glif optik olarak ortalanır
export const GLYPH_SHIFT_Y = -1.5

export function logoSvg({ size = 64, radius = 14, bleed = false } = {}) {
  const r = bleed ? 0 : radius
  const { from, to, bgTop, bgBottom } = LOGO_COLORS
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="ink" gradientUnits="userSpaceOnUse" x1="8" y1="14" x2="56" y2="52"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bgTop}"/><stop offset="1" stop-color="${bgBottom}"/></linearGradient>
  </defs>
  <rect width="64" height="64" rx="${r}" fill="url(#bg)"/>
  ${bleed ? '' : `<rect x="0.75" y="0.75" width="62.5" height="62.5" rx="${r - 0.75}" fill="none" stroke="url(#ink)" stroke-opacity="0.55" stroke-width="1.5"/>`}
  <g transform="translate(0 ${GLYPH_SHIFT_Y})">
    <path fill="url(#ink)" fill-rule="evenodd" d="${GLYPH.a}"/>
    <path fill="none" stroke="url(#ink)" stroke-width="${C_STROKE}" d="${GLYPH.c}"/>
    <path fill="url(#ink)" d="${GLYPH.cedilla}"/>
  </g>
</svg>`
}
