import { create } from 'zustand'
import { profile, projects } from './content.js'
import { playChime, playSecret } from './audio.js'
import { AREAS, COLLECTIBLES, GOLF_PAR, HIDDEN_LOGOS } from './game/layout.js'
import { DEFAULT_EQUIPPED, REWARDS, SIMIT, findItem, isFree } from './game/shop.js'

const COLLECTIBLE_COUNT = COLLECTIBLES.length
const AREA_COUNT = AREAS.length

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
  { id: 'statue', title: { tr: 'Devrim!', en: 'Revolution!' }, text: { tr: 'Mühendis heykelini devir.', en: 'Topple the engineer statue.' } },
  { id: 'konami', title: { tr: 'Eski usul', en: 'Old school' }, text: { tr: 'Gizli kodu gir.', en: 'Enter the secret code.' } },
  { id: 'boom', title: { tr: 'Dinamit', en: 'Dynamite' }, text: { tr: 'Bütün TNT kasalarını patlat.', en: 'Blow up every TNT crate.' }, goal: 8 },
  { id: 'rain', title: { tr: 'Yağmurda dans', en: 'Singing in the rain' }, text: { tr: 'Yağmurlu havayı gör.', en: 'Witness the rain.' } },
  { id: 'snow', title: { tr: 'Kardan adam', en: 'Snow day' }, text: { tr: 'Karlı havayı gör.', en: 'Witness the snow.' } },
  { id: 'goal', title: { tr: 'Gol!', en: 'Goal!' }, text: { tr: 'Futbol sahasında bir gol at.', en: 'Score a goal on the football pitch.' } },
  { id: 'hattrick', title: { tr: 'Hat-trick', en: 'Hat-trick' }, text: { tr: 'Toplam 3 gol at.', en: 'Score 3 goals in total.' }, goal: 3 },
  { id: 'drifter', title: { tr: 'Drift ustası', en: 'Drift king' }, text: { tr: 'Tek seferde 3000 drift puanı topla.', en: 'Score 3000 drift points in one combo.' } },
  { id: 'summit', title: { tr: 'Zirve', en: 'Summit' }, text: { tr: 'Gözlem tepesine çık.', en: 'Reach the lookout hill.' } },
  { id: 'garage', title: { tr: 'Garaj', en: 'Garage' }, text: { tr: 'Aracını ya da rengini değiştir.', en: 'Change your car or its colour.' } },
  { id: 'whisper', title: { tr: 'Fısıltı', en: 'Whisperer' }, text: { tr: 'Dünyaya bir fısıltı bırak.', en: 'Leave a whisper in the world.' } },
  { id: 'seasons', title: { tr: 'Dört mevsim', en: 'Four seasons' }, text: { tr: 'Dört mevsimi de gör.', en: 'See all four seasons.' }, goal: 4 },
  { id: 'stuntman', title: { tr: 'Dublör', en: 'Stuntman' }, text: { tr: 'Stunt parkında tek atlayışta 1500 puan topla.', en: 'Score 1500 points in a single stunt-park jump.' } },
  { id: 'ringOfFire', title: { tr: 'Ateş çemberi', en: 'Ring of fire' }, text: { tr: 'Ateş halkasının içinden geç.', en: 'Fly through the ring of fire.' } },
  { id: 'golfer', title: { tr: 'Golfçü', en: 'Golfer' }, text: { tr: 'Mini golfte topu deliğe sok.', en: 'Sink the ball in mini golf.' } },
  { id: 'holeInOne', title: { tr: 'Tek vuruş', en: 'Hole in one' }, text: { tr: 'Mini golfte tek vuruşta deliğe sok.', en: 'Get a hole in one in mini golf.' } },
  { id: 'wrecker', title: { tr: 'Yıkım ekibi', en: 'Wrecking crew' }, text: { tr: '15 bank, çit ya da duvarı parçala.', en: 'Smash 15 benches, fences or walls.' }, goal: 15 },
  { id: 'pilot', title: { tr: 'Pilot', en: 'Pilot' }, text: { tr: 'Helikopterle dünyanın üzerinde uç.', en: 'Fly over the world by helicopter.' } },
  { id: 'logoHunter', title: { tr: 'Logo avcısı', en: 'Logo hunter' }, text: { tr: 'Haritaya saklanmış bütün AÇ logolarını bul. Ödül: altın boya.', en: 'Find every AÇ logo hidden around the map. Reward: gold paint.' }, goal: HIDDEN_LOGOS.length },
  { id: 'cabbie', title: { tr: 'Taksici', en: 'Cabbie' }, text: { tr: 'Tek vardiyada 5 yolcu taşı.', en: 'Deliver 5 passengers in a single shift.' } },
  { id: 'ringMaster', title: { tr: 'Halka ustası', en: 'Ring master' }, text: { tr: 'Helikopter halka parkurunu bitir.', en: 'Finish the helicopter ring course.' } },
  { id: 'sumo', title: { tr: 'Yokozuna', en: 'Yokozuna' }, text: { tr: 'Sumo arenasında üç rakibi de dışarı it.', en: 'Push all three rivals out of the sumo ring.' } },
  { id: 'shopper', title: { tr: 'İlk alışveriş', en: 'First purchase' }, text: { tr: 'Garaj dükkânından bir şey satın al.', en: 'Buy something from the garage shop.' } },
  { id: 'tycoon', title: { tr: 'Patron', en: 'Tycoon' }, text: { tr: 'Toplam ₺10.000 kazan.', en: 'Earn ₺10,000 in total.' }, goal: 10000 },
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

// Ekran kartının adı (yalnızca ilk açılışta, kısa ömürlü bir bağlamla okunur)
function gpuName() {
  try {
    const gl = document.createElement('canvas').getContext('webgl')
    if (!gl) return ''
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const name = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return String(name || '')
  } catch {
    return ''
  }
}

// İlk açılış kalitesi: zayıf cihazda düşük başlar (kullanıcının kendi seçimi her zaman önceliklidir).
// Düşük: dokunmatik cihaz, ≤4 GB bellek, ≤4 çekirdek, eski tümleşik/ mobil ekran kartı ya da yazılımsal çizim.
function detectQuality() {
  if (typeof window === 'undefined') return 'high'
  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  const lowMemory = navigator.deviceMemory && navigator.deviceMemory <= 4
  const fewCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4
  const gpu = gpuName()
  const weakGpu = /SwiftShader|llvmpipe|Basic Render|Intel.*\b(U?HD) Graphics|Mali|Adreno \(TM\) [2-5]\d\d|PowerVR/i.test(gpu)
  return coarse || lowMemory || fewCores || weakGpu ? 'low' : 'high'
}

const saved = { unlocked: {}, progress: {}, times: [], driftBest: 0, stuntBest: 0, golfBest: 0, taxiBest: 0, ringsBest: 0, sumoBest: 0, wallet: 0, owned: [], ...readJSON(STORAGE_KEY, {}) }
const settings = { quality: detectQuality(), muted: false, music: true, fpsCap: 60, carId: 'ae86', carColor: 'white', ...readJSON(SETTINGS_KEY, {}) }
settings.equipped = { ...DEFAULT_EQUIPPED, ...settings.equipped }
let toastId = 0

const idleRace = { active: false, countdown: 0, start: 0, next: 0, finishedAt: 0, lastTime: 0 }
// stage: 'pickup' (yolcuya git) | 'ride' (yolcuyu götür)
const idleTaxi = { active: false, endsAt: 0, fares: 0, earned: 0, stage: 'pickup', pickup: null, dest: null, rideStart: 0, par: 0, last: 0 }
const idleRings = { active: false, start: 0, next: 0 }
// result: 'win' | 'lose' | null (son maçın sonucu, bir süre gösterilir)
const idleSumo = { active: false, countdown: 0, start: 0, out: [], result: null, time: 0 }

export const useStore = create((set, get) => ({
  view: '3d', // '3d' | 'classic'
  lang: detectLanguage(),
  quality: settings.quality, // 'high' | 'low'
  ready: false,
  started: false,
  muted: settings.muted,
  music: settings.music,
  fpsCap: settings.fpsCap, // 30 | 60 | 0 (sınırsız)
  night: false,
  spot: null,
  area: 'home',
  modal: null, // { type, id? }
  panel: null, // 'map' | 'achievements' | 'leaderboard' | null
  unlocked: saved.unlocked,
  progress: saved.progress,
  times: saved.times, // en iyi yarış süreleri (ms)
  driftBest: saved.driftBest ?? 0,
  stuntBest: saved.stuntBest ?? 0,
  stunt: { score: 0, active: false },
  golfBest: saved.golfBest ?? 0, // en az vuruş (0 = henüz yok)
  golf: { strokes: 0 },
  taxiBest: saved.taxiBest ?? 0, // tek vardiyada en yüksek kazanç (₺)
  taxi: idleTaxi,
  ringsBest: saved.ringsBest ?? 0, // en hızlı halka parkuru (ms, 0 = yok)
  rings: idleRings,
  sumoBest: saved.sumoBest ?? 0, // en hızlı sumo zaferi (ms, 0 = yok)
  sumo: idleSumo,
  drift: { combo: 0, active: false },
  soccerSession: 0, // bu ziyaretteki goller
  cinematic: 0, // > performance.now() ise sinematik kamera
  carId: settings.carId,
  carColor: settings.carColor,
  wallet: saved.wallet ?? 0, // ₺ bakiye
  owned: saved.owned ?? [], // satın alınan eşyalar ('kategori:id')
  equipped: settings.equipped, // takılı eşyalar { glow, trail, horn, roof }
  lastEarn: null, // { amount, at }: cüzdan göstergesindeki "+₺" animasyonu
  simitUntil: 0, // > performance.now() ise simit gücü (yarış dışında)
  headlights: 'auto', // 'auto' | 'on' | 'off'
  cameraMode: 'follow', // 'follow' | 'chase'
  rainbow: 0, // > performance.now() ise araba gökkuşağı renginde
  navTarget: null, // GPS hedefi: { id, x, z, radius, label, color }
  pinsDown: 0,
  bowlingReset: 0, // değişince lobutlar yeniden dizilir
  weatherMode: 'auto', // 'auto' | 'clear' | 'rain' | 'snow'
  weather: 'clear', // şu anki hava
  seasonMode: 'auto', // 'auto' | 'spring' | 'summer' | 'autumn' | 'winter'
  season: 'summer', // şu an görünen mevsim
  toasts: [],
  whispers: [], // ziyaretçi fısıltıları { id, name, message, x, z }
  race: idleRace,
  celebrate: 0, // havai fişek başlangıcı (performance.now)

  persist: () => {
    const s = get()
    writeJSON(STORAGE_KEY, { unlocked: s.unlocked, progress: s.progress, times: s.times, driftBest: s.driftBest, stuntBest: s.stuntBest, golfBest: s.golfBest, taxiBest: s.taxiBest, ringsBest: s.ringsBest, sumoBest: s.sumoBest, wallet: s.wallet, owned: s.owned })
    writeJSON(SETTINGS_KEY, { quality: s.quality, muted: s.muted, music: s.music, fpsCap: s.fpsCap, carId: s.carId, carColor: s.carColor, equipped: s.equipped })
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
  setFpsCap: (fpsCap) => {
    set({ fpsCap })
    get().persist()
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
  setMusicOn: (music) => {
    set({ music })
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
    const { spot, modal, openModal, race, mode } = get()
    // Helikopterdeyken park hâlindeki arabanın durduğu noktayla etkileşim olmaz
    if (modal || !spot || mode !== 'car') return
    if (spot.id.startsWith('project:')) openModal({ type: 'project', id: spot.id.slice(8) })
    else if (spot.id.startsWith('social:')) {
      const social = profile.socials.find((s) => `social:${s.id}` === spot.id)
      if (social) window.open(social.url, '_blank', 'noopener,noreferrer')
      get().unlock('social')
    } else if (spot.id === 'bowling') {
      set({ bowlingReset: Date.now() })
    } else if (spot.id === 'lookout') {
      get().startCinematic()
    } else if (spot.id === 'simit') {
      const { lang, race } = get()
      const tr = lang !== 'en'
      if (race.active || race.countdown) get().toast('🥯', tr ? 'Yarışta simit molası yok!' : 'No snack breaks during a race!')
      else if (get().buySimit()) {
        get().toast(tr ? 'Simit aldın 🥯' : 'Simit bought 🥯', tr ? `${SIMIT.seconds} sn simit gücü: daha hızlı!` : `${SIMIT.seconds} s of simit power: faster!`)
        if (!get().muted) playChime()
      } else get().toast('🥯', tr ? `Simit ₺${SIMIT.price}. Önce biraz para kazan (ör. taksi).` : `A simit is ₺${SIMIT.price}. Earn some money first (e.g. taxi).`)
    } else if (spot.id === 'taxi') {
      if (get().taxi.active) get().endTaxi()
      else get().startTaxi()
    } else if (spot.id === 'helipad') {
      get().startRings()
    } else if (spot.id === 'sumo') {
      if (!get().sumo.active) get().startSumo()
    } else if (spot.id === 'race') {
      if (!race.active && !race.countdown) get().requestRace()
    } else openModal({ type: spot.id })
  },

  // area: son girilen bölge (harita, keşif); zone: şu an içinde olunan bölge (oyun göstergeleri)
  zone: null,
  mode: 'car', // 'car' | 'heli' | 'landing'
  enterArea: (id) => {
    set({ area: id, zone: id })
    get().addToSet('explorer', id)
  },

  leaveZone: (id) => set((s) => (s.zone === id ? { zone: null } : {})),

  // ---------- Yarış ----------
  // requestRace: aracı başlangıca ışınlatır (Race bileşeni dinler) ve geri sayımı başlatır
  // Yarış her zaman arabayla: helikopterdeyse araca geçilir
  requestRace: () => {
    if (get().taxi.active) get().endTaxi()
    set({ mode: 'car', race: { ...idleRace, countdown: 3, requested: Date.now() }, rings: idleRings, sumo: idleSumo, navTarget: null })
  },
  setMode: (mode) => set({ mode }),
  // V tuşu / düğme: arabadan helikoptere geç ya da helikopterle in
  toggleHeli: () => {
    const { mode, started, race, sumo, taxi } = get()
    if (!started || race.active || race.countdown || sumo.active) return
    if (mode === 'car') {
      if (taxi.active) get().endTaxi()
      set({ mode: 'heli' })
      get().unlock('pilot')
    } else if (mode === 'heli') set({ mode: 'landing' })
  },
  setCountdown: (countdown) => set((s) => ({ race: { ...s.race, countdown } })),
  beginRace: () => set((s) => ({ race: { ...s.race, countdown: 0, active: true, start: performance.now(), next: 1 } })),
  passCheckpoint: (index) => set((s) => ({ race: { ...s.race, next: index + 1 } })),
  finishRace: () => {
    const { race, times } = get()
    const ms = performance.now() - race.start
    get().earn(REWARDS.raceFinish + (!times.length || ms < times[0].ms ? REWARDS.raceRecord : 0))
    const nextTimes = [...times, { ms, at: Date.now() }].sort((a, b) => a.ms - b.ms).slice(0, 5)
    set({ race: { ...idleRace, lastTime: ms, finishedAt: Date.now() }, times: nextTimes })
    get().unlock('racer')
    if (ms < 40000) get().unlock('speedster')
    get().persist()
    return ms
  },
  cancelRace: () => set({ race: idleRace }),

  // ---------- Futbol ----------
  scoreGoal: () => {
    set((s) => ({ soccerSession: s.soccerSession + 1 }))
    get().earn(REWARDS.goal)
    get().unlock('goal')
    get().addProgress('hattrick', 1)
  },

  // ---------- Drift ----------
  setDrift: (drift) => set({ drift }),
  bankDrift: (points) => {
    const best = Math.max(get().driftBest, Math.round(points))
    get().earn(Math.min(Math.floor(points / 50), 120))
    set({ driftBest: best, drift: { combo: 0, active: false } })
    if (points >= 3000) get().unlock('drifter')
    get().persist()
  },

  // ---------- Stunt parkı ----------
  setStunt: (stunt) => set({ stunt }),
  bankStunt: (points) => {
    get().earn(Math.min(Math.floor(points / 40), 100))
    set((s) => ({ stuntBest: Math.max(s.stuntBest, Math.round(points)), stunt: { score: Math.round(points), active: false } }))
    if (points >= 1500) get().unlock('stuntman')
    get().persist()
  },

  // ---------- Cüzdan ve garaj dükkânı ----------
  earn: (amount) => {
    const value = Math.round(amount)
    if (value <= 0) return
    set((s) => ({ wallet: s.wallet + value, lastEarn: { amount: value, at: performance.now() } }))
    get().addProgress('tycoon', value)
    get().persist()
  },
  buy: (category, id) => {
    const item = findItem(category, id)
    const key = `${category}:${id}`
    const { wallet, owned } = get()
    if (!item || owned.includes(key) || item.price > wallet) return false
    set({ wallet: wallet - item.price, owned: [...owned, key] })
    get().unlock('shopper')
    get().equip(category, id)
    return true
  },
  // Takma / çıkarma (id null = çıkar). Boya için garajdaki renk değişir.
  equip: (category, id) => {
    if (category === 'paint') return get().setCarColor(id)
    const { owned, equipped } = get()
    if (id && !isFree(category, id) && !owned.includes(`${category}:${id}`)) return
    set({ equipped: { ...equipped, [category]: id ?? DEFAULT_EQUIPPED[category] } })
    get().persist()
  },
  buySimit: () => {
    const { wallet } = get()
    if (wallet < SIMIT.price) return false
    set({ wallet: wallet - SIMIT.price, simitUntil: performance.now() + SIMIT.seconds * 1000 })
    get().persist()
    return true
  },

  // ---------- Taksi ----------
  startTaxi: (shift = 120000) => {
    if (get().mode !== 'car') return
    set({ taxi: { ...idleTaxi, active: true, endsAt: performance.now() + shift }, rings: idleRings, sumo: idleSumo })
  },
  setTaxi: (patch) => set((s) => ({ taxi: { ...s.taxi, ...patch } })),
  endTaxi: () => {
    const { taxi } = get()
    if (!taxi.active) return
    set((s) => ({ taxi: { ...idleTaxi, last: taxi.earned }, taxiBest: Math.max(s.taxiBest, taxi.earned), navTarget: null }))
    if (taxi.fares >= 5) get().unlock('cabbie')
    get().persist()
  },

  // ---------- Helikopter halka parkuru ----------
  startRings: () => {
    const { started, race } = get()
    if (!started || race.active || race.countdown) return
    if (get().taxi.active) get().endTaxi()
    set({ mode: 'heli', rings: { active: true, start: performance.now(), next: 0 }, sumo: idleSumo, navTarget: null })
    get().unlock('pilot')
  },
  passRing: (index) => set((s) => ({ rings: { ...s.rings, next: index + 1 } })),
  finishRings: () => {
    const ms = performance.now() - get().rings.start
    const { ringsBest } = get()
    get().earn(REWARDS.ringsFinish + (!ringsBest || ms < ringsBest ? REWARDS.ringsRecord : 0))
    set((s) => ({ rings: idleRings, ringsBest: s.ringsBest ? Math.min(s.ringsBest, ms) : ms }))
    get().unlock('ringMaster')
    get().persist()
    return ms
  },
  cancelRings: () => set({ rings: idleRings }),

  // ---------- Sumo ----------
  startSumo: () => {
    const { started, race, mode } = get()
    if (!started || race.active || race.countdown || mode !== 'car') return
    if (get().taxi.active) get().endTaxi()
    set({ sumo: { ...idleSumo, active: true, countdown: 3 }, rings: idleRings, navTarget: null })
  },
  setSumo: (patch) => set((s) => ({ sumo: { ...s.sumo, ...patch } })),
  endSumo: (win) => {
    const { sumo } = get()
    const time = sumo.start ? performance.now() - sumo.start : 0
    if (win) get().earn(REWARDS.sumoWin + (!get().sumoBest || time < get().sumoBest ? REWARDS.sumoRecord : 0))
    set((s) => ({ sumo: { ...idleSumo, result: win ? 'win' : 'lose', time }, sumoBest: win ? (s.sumoBest ? Math.min(s.sumoBest, time) : time) : s.sumoBest }))
    if (win) get().unlock('sumo')
    get().persist()
  },

  // ---------- Mini golf ----------
  setGolf: (golf) => set({ golf }),
  sinkGolf: (strokes) => {
    get().earn(strokes === 1 ? REWARDS.holeInOne : strokes <= GOLF_PAR ? REWARDS.golfPar : 0)
    set((s) => ({ golfBest: s.golfBest ? Math.min(s.golfBest, strokes) : strokes, golf: { strokes } }))
    get().unlock('golfer')
    if (strokes === 1) get().unlock('holeInOne')
    get().persist()
  },

  // ---------- Garaj, far, kamera ----------
  setCar: (carId) => {
    set({ carId })
    get().unlock('garage')
    get().persist()
  },
  setCarColor: (carColor) => {
    const { owned, unlocked } = get()
    const allowed = isFree('paint', carColor) || owned.includes(`paint:${carColor}`) || (carColor === 'gold' && unlocked.logoHunter)
    if (!allowed) return
    set({ carColor })
    get().unlock('garage')
    get().persist()
  },
  cycleHeadlights: () => set((s) => ({ headlights: s.headlights === 'auto' ? 'on' : s.headlights === 'on' ? 'off' : 'auto' })),
  toggleCamera: () => set((s) => ({ cameraMode: s.cameraMode === 'follow' ? 'chase' : 'follow' })),
  startCinematic: (ms = 9000) => set({ cinematic: performance.now() + ms }),
  setPinsDown: (pinsDown) => set({ pinsDown }),
  setNavTarget: (navTarget) => set({ navTarget }),
  activateKonami: () => {
    set({ rainbow: performance.now() + 30000 })
    if (!get().muted) playSecret()
    get().unlock('konami')
  },
  setWeatherMode: (weatherMode) => set({ weatherMode }),
  setSeasonMode: (seasonMode) => set({ seasonMode }),
  setSeason: (season) => {
    set({ season })
    if (get().started) get().addToSet('seasons', season)
  },
  setWhispers: (rows) =>
    set((s) => {
      // Sunucudan gelen listeye, henüz listede olmayan kendi yerel fısıltılarımızı ekle
      const mine = s.whispers.filter((w) => w.mine && !rows.some((r) => r.message === w.message && r.name === w.name))
      return { whispers: [...mine, ...rows] }
    }),
  addWhisper: (whisper) => {
    set((s) => ({ whispers: [whisper, ...s.whispers] }))
    get().unlock('whisper')
  },
  setWeather: (weather) => {
    set({ weather })
    if (weather === 'rain') get().unlock('rain')
    if (weather === 'snow') get().unlock('snow')
  },

  // ---------- Toplanabilirler ----------
  collect: (id) => {
    if ((get().progress.collector ?? []).includes(id)) return
    get().addToSet('collector', id)
    get().earn(REWARDS.core)
  },
  // Gizli logo: sonuncusu bulununca altın boya açılır ve havai fişek patlar
  findLogo: (id) => {
    const had = !!get().unlocked.logoHunter
    if ((get().progress.logoHunter ?? []).includes(id)) return
    get().addToSet('logoHunter', id)
    get().earn(REWARDS.logo)
    if (!had && get().unlocked.logoHunter) {
      set({ celebrate: performance.now(), carColor: 'gold' })
      get().persist()
    }
  },

  // ---------- Başarımlar ----------
  unlock: (id) => {
    const { unlocked, muted, lang } = get()
    if (unlocked[id]) return
    const achievement = ACHIEVEMENTS.find((a) => a.id === id)
    if (!achievement) return
    const toast = { key: ++toastId, title: achievement.title[lang], text: achievement.text[lang] }
    set((s) => ({ unlocked: { ...s.unlocked, [id]: Date.now() }, toasts: [...s.toasts, toast] }))
    get().earn(REWARDS.achievement)
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
    set((s) => ({ unlocked: {}, progress: {}, times: [], driftBest: 0, stuntBest: 0, golfBest: 0, taxiBest: 0, ringsBest: 0, sumoBest: 0, wallet: 0, owned: [], equipped: DEFAULT_EQUIPPED, carColor: isFree('paint', s.carColor) ? s.carColor : 'white' }))
    get().persist()
  },
}))

export function progressOf(state, achievement) {
  const value = state.progress[achievement.id]
  if (!achievement.goal) return null
  const current = Array.isArray(value) ? value.length : Math.floor(value ?? 0)
  return { current: Math.min(current, achievement.goal), goal: achievement.goal }
}
