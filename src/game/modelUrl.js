// Model adresine içerik özetini ekler (vite.config.js > __MODEL_HASHES__).
// Vercel /models/* dosyalarını uzun süre önbellekte tuttuğu için tüm GLB adresleri buradan geçmeli.
/* global __MODEL_HASHES__ */
const HASHES = typeof __MODEL_HASHES__ === 'undefined' ? {} : __MODEL_HASHES__

export function modelUrl(path) {
  const v = HASHES[path]
  return v ? `${path}?v=${v}` : path
}
