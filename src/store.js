import { create } from 'zustand'
import { profile, projects } from './content.js'
import { playChime } from './audio.js'

const COLLECTIBLE_COUNT = 10
const AREA_COUNT = 7

export const ACHIEVEMENTS = [
  { id: 'start', title: { tr: 'Yola çıktın', en: 'Hit the road' }, text: { tr: 'Başlangıç noktasından uzaklaş.', en: 'Leave the starting area.' } },
  { id: 'explorer', title: { tr: 'Kâşif', en: 'Explorer' }, text: { tr: 'Bütün bölgeleri ziyaret et.', en: 'Visit every area.' }, goal: AREA_COUNT },
  { id: 'curious', title: { tr: 'Meraklı', en: 'Curious mind' }, text: { tr: 'Bütün projeleri incele.', en: 'Check out every project.' }, goal: projects.length },
  { id: 'hello', title: { tr: 'Merhaba de', en: 'Say hello' }, text: { tr: 'İletişim bilgilerini aç.', en: 'Open the contact details.' } },
  { id: 'social', title: { tr: 'Bağlantı kur', en: 'Connected' }, text: { tr: 'Bir sosyal medya profilimi ziyaret et.', en: 'Visit one of my social profiles.' } },
  { id: 'collector', title: { tr: 'Koleksiyoncu', en: 'Collector' }, text: { tr: 'Bütün veri çekirdeklerini topla.', en: 'Collect every data core.' }, goal: COLLECTIBLE_COUNT },
  { id: 'racer', title: { tr: 'Yarışçı', en: 'Racer' }, text: { tr: 'Bir yarışı bitir.', en: 'Finish a race.' } },
  { id: 'speedster', title: { tr: 'Işık hızı', en: 'Speed demon' }, text: { tr: 'Yarışı 40 saniyenin altında bitir.', en: 'Finish a race in under 40 seconds.' } },
  { id: 'letters', title: { tr: 'İsmimi dağıttın', en: 'Name wrecker' }, text: { tr: 'Ortadaki harfleri devir.', en: 'Knock over the letters.' } },
  { id: 'strike', title: { tr: 'Strike!', en: 'Strike!' }, text: { tr: 'Bütün lobutları devir.', en: 'Knock down every pin.' } },
  { id: 'sky', title: { tr: 'Bulutlara dokun', en: 'Touch the sky' }, text: { tr: 'Yerden 5 metre yükseğe çık.', en: 'Get 5 metres off the ground.' } },
  { id: 'swim', title: { tr: 'Yüzme bilmiyor', en: 'Not a boat' }, text: { tr: 'Göle dal.', en: 'Drive into the lake.' } },
  { id: 'night', title: { tr: 'Gece kuşu', en: 'Night owl' }, text: { tr: 'Geceyi gör.', en: 'Witness the night.' } },
  { id: 'turtle', title: { tr: 'Kaplumbağa', en: 'Turtle' }, text: { tr: 'Arabayı ters çevir.', en: 'Flip the car upside down.' } },
  { id: 'honk', title: { tr: 'Korna ustası', en: 'Honk master' }, text: { tr: '10 kez korna çal.', en: 'Honk 10 times.' }, goal: 10 },
  { id: 'road', title: { tr: 'Uzun yol', en: 'Road trip' }, text: { tr: '2 km yol yap.', en: 'Drive 2 km.' }, goal: 2000 },
]

const STORAGE_KEY = 'atillacam-progress-v2'
const SETTINGS_KEY = 'atillacam-settings-v1'

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return { ...fallback, ...JSON.parse(raw) }
  } catch {
    // depolama kapalı olabilir; ilerleme sadece bu oturumda tutulur
  }
  return fallback
}
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // yok say
  }
}

function detectLanguage() {
  try {
    const saved = localStorage.getItem('portfolio-lang')
    if (saved === 'tr' || saved === 'en') return saved
  } catch {
    // yok say
  }
  const fromUrl = new URLSearchParams(typeof location !== 'undefined' ? location.search : '').get('lang')
  if (fromUrl === 'tr' || fromUrl === 'en') return fromUrl
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'tr'
  return nav.toLowerCase().startsWith('tr') ? 'tr' : 'en'
}

function detectQuality() {
  if (typeof window === 'undefined') return 'high'
  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  const lowMemory = navigator.deviceMemory && navigator.deviceMemory <= 4
  return coarse || lowMemory ? 'low' : 'high'
}

const saved = readJSON(STORAGE_KEY, { unlocked: {}, progress: {}, times: [] })
const settings = readJSON(SETTINGS_KEY, { quality: detectQuality(), muted: false })
let toastId = 0

const idleRace = { active: false, countdown: 0, start: 0, next: 0, finishedAt: 0, lastTime: 0 }

export const useStore = create((set, get) => ({
  view: '3d', // '3d' | 'classic'
  lang: detectLanguage(),
  quality: settings.quality, // 'high' | 'low'
  ready: false,
  started: false,
  muted: settings.muted,
  night: false,
  spot: null,
  area: 'home',
  modal: null, // { type, id? }
  panel: null, // 'map' | 'achievements' | 'leaderboard' | null
  unlocked: saved.unlocked,
  progress: saved.progress,
  times: saved.times, // en iyi yarış süreleri (ms)
  toasts: [],
  race: idleRace,

  persist: () => {
    const s = get()
    writeJSON(STORAGE_KEY, { unlocked: s.unlocked, progress: s.progress, times: s.times })
    writeJSON(SETTINGS_KEY, { quality: s.quality, muted: s.muted })
  },

  setView: (view) => set({ view, modal: null, panel: null }),
  setLang: (lang) => {
    set({ lang })
    try {
      localStorage.setItem('portfolio-lang', lang)
    } catch {
      // yok say
    }
    document.documentElement.lang = lang
  },
  setQuality: (quality) => {
    set({ quality })
    get().persist()
  },
  loadProgress: 0,
  setLoadProgress: (loadProgress) => set({ loadProgress }),
  setReady: () => set({ ready: true }),
  start: () => set({ started: true }),
  setNight: (night) => set({ night }),
  // Gün/gece düğmesi: DayNight bileşeni hedef saate yumuşakça geçer
  timeRequest: null,
  toggleDayNight: () => set((s) => ({ timeRequest: { target: s.night ? 0.36 : 0.86, id: Date.now() } })),
  toggleMuted: () => {
    set((s) => ({ muted: !s.muted }))
    get().persist()
  },
  setSpot: (spot) => set({ spot }),
  clearSpot: (id) => set((s) => (s.spot?.id === id ? { spot: null } : {})),
  togglePanel: (panel) => set((s) => ({ panel: s.panel === panel ? null : panel })),
  closeAll: () => set({ modal: null, panel: null }),

  openModal: (modal) => {
    set({ modal, panel: null })
    if (modal.type === 'project') get().addToSet('curious', modal.id)
    if (modal.type === 'contact') get().unlock('hello')
  },

  interact: () => {
    const { spot, modal, openModal, race } = get()
    if (modal || !spot) return
    if (spot.id.startsWith('project:')) openModal({ type: 'project', id: spot.id.slice(8) })
    else if (spot.id.startsWith('social:')) {
      const social = profile.socials.find((s) => `social:${s.id}` === spot.id)
      if (social) window.open(social.url, '_blank', 'noopener,noreferrer')
      get().unlock('social')
    } else if (spot.id === 'race') {
      if (!race.active && !race.countdown) get().requestRace()
    } else openModal({ type: spot.id })
  },

  enterArea: (id) => {
    set({ area: id })
    get().addToSet('explorer', id)
  },

  // ---------- Yarış ----------
  // requestRace: aracı başlangıca ışınlatır (Race bileşeni dinler) ve geri sayımı başlatır
  requestRace: () => set({ race: { ...idleRace, countdown: 3, requested: Date.now() } }),
  setCountdown: (countdown) => set((s) => ({ race: { ...s.race, countdown } })),
  beginRace: () => set((s) => ({ race: { ...s.race, countdown: 0, active: true, start: performance.now(), next: 1 } })),
  passCheckpoint: (index) => set((s) => ({ race: { ...s.race, next: index + 1 } })),
  finishRace: () => {
    const { race, times } = get()
    const ms = performance.now() - race.start
    const nextTimes = [...times, { ms, at: Date.now() }].sort((a, b) => a.ms - b.ms).slice(0, 5)
    set({ race: { ...idleRace, lastTime: ms, finishedAt: Date.now() }, times: nextTimes })
    get().unlock('racer')
    if (ms < 40000) get().unlock('speedster')
    get().persist()
    return ms
  },
  cancelRace: () => set({ race: idleRace }),

  // ---------- Toplanabilirler ----------
  collect: (id) => get().addToSet('collector', id),

  // ---------- Başarımlar ----------
  unlock: (id) => {
    const { unlocked, muted, lang } = get()
    if (unlocked[id]) return
    const achievement = ACHIEVEMENTS.find((a) => a.id === id)
    if (!achievement) return
    const toast = { key: ++toastId, title: achievement.title[lang], text: achievement.text[lang] }
    set((s) => ({ unlocked: { ...s.unlocked, [id]: Date.now() }, toasts: [...s.toasts, toast] }))
    get().persist()
    if (!muted) playChime()
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.key !== toast.key) })), 4200)
  },

  toast: (title, text) => {
    const toast = { key: ++toastId, title, text, info: true }
    set((s) => ({ toasts: [...s.toasts, toast] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.key !== toast.key) })), 3000)
  },

  // Sayısal ilerleme (korna, mesafe)
  addProgress: (id, amount) => {
    const achievement = ACHIEVEMENTS.find((a) => a.id === id)
    const value = Math.min((get().progress[id] ?? 0) + amount, achievement.goal)
    set((s) => ({ progress: { ...s.progress, [id]: value } }))
    if (value >= achievement.goal) get().unlock(id)
    else get().persist()
  },

  // Küme tabanlı ilerleme (ziyaret edilen bölgeler, açılan projeler, toplananlar)
  addToSet: (id, item) => {
    const list = Array.isArray(get().progress[id]) ? get().progress[id] : []
    if (list.includes(item)) return
    const next = [...list, item]
    set((s) => ({ progress: { ...s.progress, [id]: next } }))
    const achievement = ACHIEVEMENTS.find((a) => a.id === id)
    if (achievement && next.length >= achievement.goal) get().unlock(id)
    else get().persist()
  },

  resetProgress: () => {
    set({ unlocked: {}, progress: {}, times: [] })
    get().persist()
  },
}))

export function progressOf(state, achievement) {
  const value = state.progress[achievement.id]
  if (!achievement.goal) return null
  const current = Array.isArray(value) ? value.length : Math.floor(value ?? 0)
  return { current: Math.min(current, achievement.goal), goal: achievement.goal }
}
