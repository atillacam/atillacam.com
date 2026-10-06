// Paylaşım görseli, uygulama ikonları ve favicon üretir. Çalıştırma: node scripts/brand-assets.mjs
import fs from 'node:fs'
import sharp from 'sharp'
import { GLYPH, GLYPH_SHIFT_Y, C_STROKE, LOGO_COLORS, logoSvg } from './logo.mjs'

// Favicon ve uygulama ikonları: AÇ logosu (scripts/logo.mjs)
fs.writeFileSync('public/favicon.svg', logoSvg({ size: 64 }) + '\n')
fs.writeFileSync('public/logo.svg', logoSvg({ size: 512 }) + '\n')
// iOS köşeleri kendisi yuvarlar: tam dolu kare
await sharp(Buffer.from(logoSvg({ size: 180, bleed: true }))).png().toFile('public/apple-touch-icon.png')
await sharp(Buffer.from(logoSvg({ size: 192 }))).png().toFile('public/icon-192.png')

// Arama motorları için favicon seti: Google 48 pikselin katlarını ve kökteki /favicon.ico'yu tercih eder
const png = (size) => sharp(Buffer.from(logoSvg({ size }))).png().toBuffer()
await sharp(await png(48)).toFile('public/favicon-48.png')
await sharp(await png(96)).toFile('public/favicon-96.png')
// ICO: içinde PNG gömülü çok boyutlu dosya (16, 32, 48)
const icoSizes = [16, 32, 48]
const images = await Promise.all(icoSizes.map(png))
const header = Buffer.alloc(6 + 16 * images.length)
header.writeUInt16LE(0, 0) // ayrılmış
header.writeUInt16LE(1, 2) // tür: ikon
header.writeUInt16LE(images.length, 4)
let offset = header.length
images.forEach((img, i) => {
  const e = 6 + i * 16
  header.writeUInt8(icoSizes[i], e) // genişlik
  header.writeUInt8(icoSizes[i], e + 1) // yükseklik
  header.writeUInt8(0, e + 2) // palet yok
  header.writeUInt8(0, e + 3)
  header.writeUInt16LE(1, e + 4) // renk düzlemi
  header.writeUInt16LE(32, e + 6) // bit derinliği
  header.writeUInt32LE(img.length, e + 8)
  header.writeUInt32LE(offset, e + 12)
  offset += img.length
})
fs.writeFileSync('public/favicon.ico', Buffer.concat([header, ...images]))
// Maskable: Android şekli kendisi kırpar; glif güvenli alanın içinde
await sharp(Buffer.from(logoSvg({ size: 512, bleed: true }))).png().toFile('public/icon-512.png')
const logoData = 'data:image/svg+xml;base64,' + Buffer.from(logoSvg({ size: 112 })).toString('base64')

// Paylaşım görseli (1200×630): solda kimlik, sağda logonun büyük ve soluk silueti
const { from, to } = LOGO_COLORS
const font = 'Segoe UI, Arial, sans-serif'
const og = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="a" cx="0.85" cy="0" r="0.9"><stop offset="0" stop-color="#3d7bff" stop-opacity="0.42"/><stop offset="1" stop-color="#0a0e1a" stop-opacity="0"/></radialGradient>
    <radialGradient id="b" cx="0" cy="1" r="0.8"><stop offset="0" stop-color="#8a5cff" stop-opacity="0.28"/><stop offset="1" stop-color="#0a0e1a" stop-opacity="0"/></radialGradient>
    <linearGradient id="ink" gradientUnits="userSpaceOnUse" x1="8" y1="14" x2="56" y2="52"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>
    <linearGradient id="text" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c9d6ff"/></linearGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#ffffff" stroke-opacity="0.04" stroke-width="1"/></pattern>
  </defs>
  <rect width="1200" height="630" fill="#0a0e1a"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect width="1200" height="630" fill="url(#a)"/>
  <rect width="1200" height="630" fill="url(#b)"/>
  <!-- Logonun büyük silueti -->
  <g transform="translate(700 60) scale(8)" opacity="0.13">
    <g transform="translate(0 ${GLYPH_SHIFT_Y})">
      <path fill="url(#ink)" fill-rule="evenodd" d="${GLYPH.a}"/>
      <path fill="none" stroke="url(#ink)" stroke-width="${C_STROKE}" d="${GLYPH.c}"/>
      <path fill="url(#ink)" d="${GLYPH.cedilla}"/>
    </g>
  </g>
  <image x="90" y="84" width="112" height="112" href="${logoData}"/>
  <text x="90" y="318" font-family="${font}" font-weight="900" font-size="100" fill="url(#text)" letter-spacing="-3">Atilla Çam</text>
  <text x="94" y="380" font-family="${font}" font-weight="700" font-size="34" fill="#7aa8ff">Bilgisayar Mühendisi · Yazılım Geliştirici</text>
  <text x="94" y="434" font-family="${font}" font-weight="600" font-size="26" fill="#a2aac0">Yapay zekâ · Backend · Etkileşimli 3D web — İstanbul</text>
  <rect x="90" y="500" width="296" height="54" rx="27" fill="#4fd99a" fill-opacity="0.08" stroke="#4fd99a" stroke-opacity="0.45"/>
  <circle cx="120" cy="527" r="7" fill="#4fd99a"/>
  <text x="139" y="536" font-family="${font}" font-weight="700" font-size="24" fill="#4fd99a">İş tekliflerine açık</text>
  <text x="1110" y="536" text-anchor="end" font-family="${font}" font-weight="800" font-size="30" fill="#f2f4fa">atillacam.com</text>
</svg>`
await sharp(Buffer.from(og)).png().toFile('public/og-image.png')

fs.writeFileSync(
  'public/site.webmanifest',
  JSON.stringify(
    {
      name: 'Atilla Çam — 3D Portfolio',
      short_name: 'Atilla Çam',
      start_url: '/',
      display: 'fullscreen',
      orientation: 'any',
      background_color: '#0a0e1a',
      theme_color: '#0a0e1a',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    },
    null,
    2,
  ) + '\n',
)
fs.writeFileSync('public/robots.txt', 'User-agent: *\nAllow: /\n\nSitemap: https://www.atillacam.com/sitemap.xml\n')
fs.writeFileSync(
  'public/sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.atillacam.com/</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>
  <url><loc>https://www.atillacam.com/klasik</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
</urlset>
`,
)
console.log('Marka dosyaları üretildi.')
