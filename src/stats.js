// GitHub'dan derleme sırasında çekilen gerçek veriler (scripts/github-stats.mjs → src/data/github.json)
import github from './data/github.json'
import { profile } from './content.js'

const RTF = {}
// "dün", "3 gün önce", "2 ay önce" gibi göreli zaman (ziyaret anına göre)
export function relativeTime(iso, lang) {
  if (!iso) return ''
  const rtf = (RTF[lang] ??= new Intl.RelativeTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-GB', { numeric: 'auto' }))
  const diff = (new Date(iso).getTime() - Date.now()) / 1000
  const abs = Math.abs(diff)
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day')
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), 'month')
  return rtf.format(Math.round(diff / (86400 * 365)), 'year')
}

// Hero'daki öne çıkan rakamlar: GitHub verisi varsa gerçek değerler, yoksa içerikteki metin
export function highlights(lang) {
  const t = github.totals
  if (!t) return profile.highlights.map((h) => ({ value: h.value, label: h.label[lang] ?? h.label.tr }))
  const tr = lang === 'tr'
  return [
    { value: String(t.projects), label: tr ? 'Açık kaynak proje' : 'Open-source projects' },
    { value: String(t.stars), label: tr ? 'GitHub yıldızı' : 'GitHub stars' },
    { value: relativeTime(t.lastPush, lang), label: tr ? 'Son GitHub güncellemesi' : 'Last GitHub update', small: true },
  ]
}

// Bir proje bağlantısından (github.com/kullanıcı/depo) depo verisini bul
export function repoFor(link) {
  const m = /github\.com\/[^/]+\/([^/?#]+)/.exec(link ?? '')
  return m ? (github.repos[m[1]] ?? null) : null
}

export const GITHUB_FETCHED_AT = github.fetchedAt
