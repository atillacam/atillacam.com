// Paylaşım görseli, uygulama ikonları ve favicon üretir. Çalıştırma: node scripts/brand-assets.mjs
import fs from 'node:fs'
import sharp from 'sharp'
import { logoSvg } from './logo.mjs'

// Favicon ve uygulama ikonları: elle çizilmiş AÇ monogramı (scripts/logo.mjs)
fs.writeFileSync('public/favicon.svg', logoSvg({ size: 64, radius: 16 }) + '\n')
fs.writeFileSync('public/logo.svg', logoSvg({ size: 512, radius: 16 }) + '\n')
// iOS köşeleri kendisi yuvarlar: tam dolu kare
await sharp(Buffer.from(logoSvg({ size: 180, bleed: true }))).png().toFile('public/apple-touch-icon.png')
await sharp(Buffer.from(logoSvg({ size: 192, radius: 14 }))).png().toFile('public/icon-192.png')
// Maskable: Android şekli kendisi kırpar; glif güvenli alanın içinde
await sharp(Buffer.from(logoSvg({ size: 512, bleed: true }))).png().toFile('public/icon-512.png')
const logoData = 'data:image/svg+xml;base64,' + Buffer.from(logoSvg({ size: 96, radius: 16 })).toString('base64')

const og = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="a" cx="0.85" cy="0" r="0.9"><stop offset="0" stop-color="#3d7bff" stop-opacity="0.45"/><stop offset="1" stop-color="#0a0e1a" stop-opacity="0"/></radialGradient>
    <radialGradient id="b" cx="0" cy="1" r="0.8"><stop offset="0" stop-color="#8a5cff" stop-opacity="0.3"/><stop offset="1" stop-color="#0a0e1a" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#0a0e1a"/>
  <rect width="1200" height="630" fill="url(#a)"/>
  <rect width="1200" height="630" fill="url(#b)"/>
  <image x="90" y="90" width="96" height="96" href="${logoData}"/>
  <text x="90" y="330" font-family="Segoe UI, Arial, sans-serif" font-weight="900" font-size="104" fill="#ffffff" letter-spacing="-3">Atilla Çam</text>
  <text x="94" y="392" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="36" fill="#6aa1ff">Computer Engineer · Bilgisayar Mühendisi</text>
  <text x="94" y="450" font-family="Segoe UI, Arial, sans-serif" font-weight="600" font-size="28" fill="#a2aac0">AI · Backend · Interactive 3D Web — İstanbul</text>
  <rect x="90" y="510" width="270" height="52" rx="26" fill="none" stroke="#4fd99a" stroke-opacity="0.5"/>
  <circle cx="118" cy="536" r="7" fill="#4fd99a"/>
  <text x="136" y="545" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="24" fill="#4fd99a">Open to work</text>
  <text x="1110" y="545" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="30" fill="#f2f4fa">atillacam.com</text>
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
fs.writeFileSync('public/robots.txt', 'User-agent: *\nAllow: /\n\nSitemap: https://atillacam.com/sitemap.xml\n')
fs.writeFileSync(
  'public/sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://atillacam.com/</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>
  <url><loc>https://atillacam.com/?klasik</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
</urlset>
`,
)
console.log('Marka dosyaları üretildi.')
