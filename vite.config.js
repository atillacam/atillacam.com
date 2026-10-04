import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Three.js'in TTFLoader'ı opentype.js'i CDN'den çeker; yerel paketi kullan ki site dış servise bağımlı olmasın
      { find: 'https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/+esm', replacement: 'opentype.js/dist/opentype.module.js' },
    ],
  },
  build: {
    // 3D paketi (Three.js + gömülü Rapier WASM) doğal olarak büyük; ilk ekran ondan bağımsız yüklenir.
    chunkSizeWarningLimit: 4000,
  },
})
