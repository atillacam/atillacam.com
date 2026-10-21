import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import react from '@vitejs/plugin-react'
import opentype from 'opentype.js'
import { defineConfig } from 'vite'

// public/models altındaki her GLB için içerik özeti: model değişince adresi (?v=) de değişir,
// böylece uzun süreli önbellek ziyaretçiye eski modeli vermez (src/game/modelUrl.js).
function modelHashes(dir = 'public/models') {
  const hashes = {}
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const path = join(d, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.name.endsWith('.glb')) {
        const url = '/' + relative('public', path).split(sep).join('/')
        hashes[url] = createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 10)
      }
    }
  }
  walk(dir)
  return hashes
}

// 3D yazı tiplerinin (alt kümelenmiş Nunito) üçünde de bulunan karakterler: src/game/Text.jsx bunların
// dışındakileri ayıklar ki troika yedek font için dış CDN'e gitmesin.
function fontGlyphs(files = ['Nunito-Black', 'Nunito-ExtraBold', 'Nunito-SemiBold']) {
  const sets = files.map((name) => {
    const data = readFileSync(`src/assets/fonts/${name}.ttf`)
    const glyphs = opentype.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)).glyphs
    const chars = new Set()
    for (let i = 0; i < glyphs.length; i++) for (const u of glyphs.get(i).unicodes) chars.add(String.fromCodePoint(u))
    return chars
  })
  return [...sets[0]].filter((ch) => sets.every((s) => s.has(ch))).join('')
}

// `font.ttf?typeface` içe aktarımı: TTF'yi derlemede Three.js typeface JSON'una çevirir (TTFLoader'ın dönüşümüyle aynı).
// Tarayıcı opentype.js'i (165 KB) indirmez; yalnızca büyük harfler ve rakamlar alınır (3D isim harfleri).
const TYPEFACE_CHARS = 'ABCÇDEFGĞHIİJKLMNOÖPQRSŞTUÜVWXYZ0123456789'
function typefaceFonts() {
  const SUFFIX = '?typeface'
  return {
    name: 'ttf-typeface',
    enforce: 'pre', // Vite'ın varlık (asset) eklentisi .ttf'yi adres olarak almadan önce
    load(id) {
      if (!id.endsWith(SUFFIX)) return null
      const data = readFileSync(id.slice(0, -SUFFIX.length))
      const font = opentype.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
      const scale = 100000 / ((font.unitsPerEm || 2048) * 72)
      const r = Math.round
      const glyphs = {}
      for (const ch of TYPEFACE_CHARS) {
        const glyph = font.charToGlyph(ch)
        if (!glyph.unicodes.length) continue
        let o = ''
        for (const c of glyph.path.commands) {
          o += (c.type === 'C' ? 'b' : c.type.toLowerCase()) + ' '
          if (c.x !== undefined) o += r(c.x * scale) + ' ' + r(c.y * scale) + ' '
          if (c.x1 !== undefined) o += r(c.x1 * scale) + ' ' + r(c.y1 * scale) + ' '
          if (c.x2 !== undefined) o += r(c.x2 * scale) + ' ' + r(c.y2 * scale) + ' '
        }
        glyphs[ch] = { ha: r(glyph.advanceWidth * scale), x_min: r(glyph.xMin * scale), x_max: r(glyph.xMax * scale), o }
      }
      const json = {
        glyphs,
        familyName: font.getEnglishName('fullName'),
        ascender: r(font.ascender * scale),
        descender: r(font.descender * scale),
        underlinePosition: font.tables.post.underlinePosition,
        underlineThickness: font.tables.post.underlineThickness,
        boundingBox: { xMin: font.tables.head.xMin, xMax: font.tables.head.xMax, yMin: font.tables.head.yMin, yMax: font.tables.head.yMax },
        resolution: 1000,
      }
      return `export default ${JSON.stringify(json)}`
    },
  }
}

// Sayfa yazı tipleri CSS çözümlenene kadar keşfedilmez; derlenmiş WOFF2 dosyaları HTML'de önceden istenir
// (yazılar geç belirmez ve yazı tipi değişince sayfa kaymaz).
function preloadFonts() {
  return {
    name: 'preload-fonts',
    apply: 'build',
    transformIndexHtml(html, { bundle }) {
      if (!bundle) return html
      return Object.keys(bundle)
        .filter((file) => file.endsWith('.woff2'))
        .map((file) => ({ tag: 'link', attrs: { rel: 'preload', href: `/${file}`, as: 'font', type: 'font/woff2', crossorigin: '' }, injectTo: 'head' }))
    },
  }
}

// `vite preview` canlı sitedeki güvenlik başlıklarıyla (vercel.json) çalışsın ki CSP yerelde de denenebilsin.
// HSTS ve https yükseltmesi localhost'u bozacağı için dışarıda bırakılır.
function previewHeaders() {
  const { headers } = JSON.parse(readFileSync('vercel.json', 'utf8'))
  const all = headers.find((h) => h.source === '/(.*)').headers
  return Object.fromEntries(
    all
      .filter((h) => h.key !== 'Strict-Transport-Security')
      .map((h) => [h.key, h.value.replace('; upgrade-insecure-requests', '')]),
  )
}

// rapier3d-compat fizik motorunu (1,5 MB WASM) base64 metin olarak JS'e gömer: paket ~2 MB büyür, metin her
// açılışta çözülür. Üretim derlemesinde gömülü metin yerine pakette zaten bulunan .wasm dosyası ayrı varlık olarak
// yayınlanır; tarayıcı onu indirirken derler (instantiateStreaming) ve uzun süre önbellekte tutar.
function rapierWasmAsset() {
  const INLINE = /[A-Za-z_$][\w$]*\.toByteArray\("[A-Za-z0-9+/=]{1000,}"\)\.buffer/
  return {
    name: 'rapier-wasm-asset',
    apply: 'build',
    transform(code, id) {
      if (!/@dimforge[\\/]rapier3d-compat[\\/]rapier\.mjs$/.test(id)) return null
      if (!INLINE.test(code)) this.error('rapier3d-compat: gömülü WASM bulunamadı (paket sürümü değişmiş olabilir)')
      const wasm = join(id, '..', 'rapier_wasm3d_bg.wasm').split(sep).join('/')
      return {
        code: `import __rapierWasmUrl from ${JSON.stringify(wasm + '?url')};\n` + code.replace(INLINE, '{module_or_path:__rapierWasmUrl}'),
        map: null,
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), rapierWasmAsset(), typefaceFonts(), preloadFonts()],
  define: {
    __MODEL_HASHES__: JSON.stringify(modelHashes()),
    __FONT_GLYPHS__: JSON.stringify(fontGlyphs()),
  },
  preview: {
    headers: previewHeaders(),
  },
  build: {
    // 3D paketi (Three.js + drei) doğal olarak büyük; ilk ekran ondan bağımsız yüklenir.
    chunkSizeWarningLimit: 2000,
  },
})
