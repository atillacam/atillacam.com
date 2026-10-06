import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Ziyaretçi analitiği ve gerçek kullanıcı hız ölçümü (Vercel Web Analytics + Speed Insights).
// Çerez kullanmaz, kişisel veri toplamaz; betikler sitenin kendi alan adından yüklenir.
// Yalnızca canlı sitede çalışır (yerel geliştirme ve önizleme adresleri sayılmaz).
if (import.meta.env.PROD && /(^|\.)atillacam\.com$/.test(window.location.hostname)) {
  window.va = window.va || ((...args) => (window.vaq = window.vaq || []).push(args))
  window.si = window.si || ((...args) => (window.siq = window.siq || []).push(args))
  for (const src of ['/_vercel/insights/script.js', '/_vercel/speed-insights/script.js']) {
    const script = document.createElement('script')
    script.defer = true
    script.src = src
    document.head.appendChild(script)
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
