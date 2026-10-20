import { Children } from 'react'
import { Text as DreiText } from '@react-three/drei'

// 3D yazı: drei Text'in yazı tipinde olmayan karakterleri ayıklayan sürümü.
// troika, fontta bulunmayan bir karakter (emoji, ●, Yunan harfi...) görünce yedek fontu jsdelivr CDN'inden
// indirmeye çalışır; CSP bunu engellediğinde yazının tamamı hiç çizilmez. Ziyaretçi metinleri (fısıltılar,
// sıralama adları) her karakteri içerebileceği için ayıklama burada, tek noktada yapılır.
// Karakter listesi derlemede alt kümelenmiş Nunito dosyalarından okunur (vite.config.js > __FONT_GLYPHS__).
/* global __FONT_GLYPHS__ */
const GLYPHS = typeof __FONT_GLYPHS__ === 'undefined' ? null : new Set(__FONT_GLYPHS__)

function glyphSafe(text) {
  if (!GLYPHS) return text
  let out = ''
  for (const ch of String(text)) if (GLYPHS.has(ch) || /\s/.test(ch)) out += ch
  return out.replace(/ {2,}/g, ' ')
}

export function Text({ children, ...props }) {
  const safe = Children.map(children, (child) =>
    typeof child === 'string' || typeof child === 'number' ? glyphSafe(child) : child,
  )
  return <DreiText {...props}>{safe}</DreiText>
}
