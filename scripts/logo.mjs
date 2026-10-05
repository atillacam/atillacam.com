// AÇ monogramı: yazı tipine bağlı olmayan, elle çizilmiş vektör logo.
// GLYPH, src/ui/Icons.jsx içindeki <Logo /> bileşeni tarafından da içe aktarılır: tek kaynak burası.
// viewBox 0 0 64 64; glif güvenli alanın içinde kalır (maskable ikonlar için).

// A: sivri tepeli geometrik harf + yatay çizgi; Ç: sağa açık yay + kuyruk (çengel)
export const GLYPH = {
  a: 'M11 45 L21 18 L31 45',
  bar: 'M16.4 34.2 H25.6',
  c: 'M53.6 23.9 A10.6 10.6 0 1 0 53.6 39.1',
  cedilla: 'M46.2 42.2 V45.2 Q49.2 45.4 48.3 47.9 Q47.5 49.9 44.8 49.5',
}

export function logoSvg({ size = 64, radius = 16, bleed = false } = {}) {
  const r = bleed ? 0 : radius
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a86ff"/><stop offset="0.55" stop-color="#5b6cff"/><stop offset="1" stop-color="#8a5cff"/></linearGradient>
    <linearGradient id="hi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
    <linearGradient id="ink" gradientUnits="userSpaceOnUse" x1="0" y1="16" x2="0" y2="52"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e3e9ff"/></linearGradient>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.4" stdDeviation="1.2" flood-color="#1b1460" flood-opacity="0.45"/></filter>
  </defs>
  <rect width="64" height="64" rx="${r}" fill="url(#bg)"/>
  <rect width="64" height="64" rx="${r}" fill="url(#hi)"/>
  <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="${Math.max(r - 0.75, 0)}" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="1.5"/>
  <g fill="none" stroke="url(#ink)" stroke-linecap="round" stroke-linejoin="round" filter="url(#sh)">
    <path d="${GLYPH.a}" stroke-width="6"/>
    <path d="${GLYPH.bar}" stroke-width="4.2"/>
    <path d="${GLYPH.c}" stroke-width="6"/>
    <path d="${GLYPH.cedilla}" stroke-width="2.8"/>
  </g>
</svg>`
}
