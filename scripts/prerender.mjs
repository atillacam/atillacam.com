// Klasik görünümü hazır HTML olarak dist/klasik/index.html'e yazar.
// Sıra: `vite build` → `vite build --ssr src/prerender.jsx` → bu betik.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const SITE = 'https://www.atillacam.com'
const SSR_DIR = '.ssr-build'

// Modüller yüklenirken tarayıcı nesnelerine dokunanlar için en küçük yedekler
// Dil kaydı önceden 'tr': React'in sunucu çıktısı mağazanın ilk durumunu kullanır (Node'un navigator.language'ı en-US)
const memory = new Map([['portfolio-lang', 'tr']])
globalThis.window ??= globalThis
globalThis.localStorage ??= {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
}
globalThis.location ??= { search: '', pathname: '/klasik' }

const { render } = await import(pathToFileURL(path.resolve(SSR_DIR, 'prerender.js')).href)
const body = render('tr')

let page = fs.readFileSync('dist/index.html', 'utf8')
const rootRe = /<div id="root">[\s\S]*?<\/main>\s*<\/div>/
if (!rootRe.test(page)) throw new Error('dist/index.html içinde #root bulunamadı')
page = page.replace(rootRe, () => `<div id="root">${body}</div>`)
// Bu sayfanın kendi asıl adresi
page = page.replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${SITE}/klasik" />`)
page = page.replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${SITE}/klasik" />`)
// JavaScript kapalıysa kaydırma animasyonu içeriği gizlemesin
page = page.replace('</head>', '  <noscript><style>.reveal{opacity:1!important;transform:none!important}</style></noscript>\n  </head>')

fs.mkdirSync('dist/klasik', { recursive: true })
fs.writeFileSync('dist/klasik/index.html', page)
// Vercel cleanUrls: klasik.html doğrudan /klasik adresinden sunulur (eğik çizgisiz)
fs.writeFileSync('dist/klasik.html', page)
fs.rmSync(SSR_DIR, { recursive: true, force: true })
console.log(`Klasik görünüm hazır HTML olarak yazıldı: dist/klasik/index.html (${(body.length / 1024).toFixed(1)} KB içerik)`)
