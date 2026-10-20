import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import react from '@vitejs/plugin-react'
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __MODEL_HASHES__: JSON.stringify(modelHashes()),
  },
  resolve: {
    alias: [
      // Three.js'in TTFLoader'ı opentype.js'i CDN'den çeker; yerel paketi kullan ki site dış servise bağımlı olmasın
      { find: 'https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/+esm', replacement: 'opentype.js/dist/opentype.module.js' },
    ],
  },
  preview: {
    headers: previewHeaders(),
  },
  build: {
    // 3D paketi (Three.js + gömülü Rapier WASM) doğal olarak büyük; ilk ekran ondan bağımsız yüklenir.
    chunkSizeWarningLimit: 4000,
  },
})
