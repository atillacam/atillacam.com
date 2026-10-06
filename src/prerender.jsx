// Derleme sırasında klasik görünümü sunucu tarafında HTML'e çevirir (scripts/prerender.mjs kullanır).
// Böylece /klasik sayfası arama motorlarına JavaScript beklemeden tam içerikle gelir.
import { renderToString } from 'react-dom/server'
import ClassicSite from './ui/ClassicSite.jsx'
import { useStore } from './store.js'

export function render(lang = 'tr') {
  useStore.setState({ lang, view: 'classic' })
  // webgl: sunucuda bilinmez; 3D düğmeleri tarayıcıda uygulama yüklenince gelir
  return renderToString(<ClassicSite webgl={false} />)
}
