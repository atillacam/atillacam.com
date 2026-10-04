// Çevrimiçi özellikler: ziyaretçi fısıltıları ve dünya yarış sıralaması.
// Supabase REST API'si doğrudan fetch ile kullanılır (ek paket yok). Ortam değişkenleri
// tanımlı değilse her şey yalnızca bu tarayıcıda (localStorage) çalışır.
const API_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const ONLINE = Boolean(API_URL && KEY)

export const LIMITS = { name: 24, message: 140, minRaceMs: 15000, maxRaceMs: 600000 }
const LOCAL_WHISPERS = 'atillacam-whispers-v1'
const NAME_KEY = 'atillacam-name-v1'
const COOLDOWN_KEY = 'atillacam-whisper-at'
const SUBMITTED_KEY = 'atillacam-submitted-best'
export const WHISPER_COOLDOWN = 60000

function headers(extra = {}) {
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...extra }
}

async function request(path, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(`${API_URL}/rest/v1/${path}`, { ...options, headers: headers(options.headers), signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.status === 204 || res.status === 201 ? null : await res.json()
  } finally {
    clearTimeout(timer)
  }
}

function readLocal(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key))
    return v ?? fallback
  } catch {
    return fallback
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Gizli sekme vb.: sessizce yok say
  }
}

// Kontrol karakterlerini ve fazla boşlukları temizle
export function clean(text, max) {
  return String(text ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export function savedName() {
  return readLocal(NAME_KEY, '')
}

export function rememberName(name) {
  writeLocal(NAME_KEY, name)
}

// ---------- Fısıltılar ----------
export async function fetchWhispers() {
  const local = readLocal(LOCAL_WHISPERS, [])
  if (!ONLINE) return local
  try {
    const rows = await request('whispers?select=id,name,message,x,z,created_at&order=created_at.desc&limit=80')
    return rows
  } catch {
    return local
  }
}

export function whisperCooldown() {
  return Math.max(0, readLocal(COOLDOWN_KEY, 0) + WHISPER_COOLDOWN - Date.now())
}

export async function postWhisper({ name, message, x, z }) {
  const row = {
    name: clean(name, LIMITS.name),
    message: clean(message, LIMITS.message),
    x: Math.round(x * 10) / 10,
    z: Math.round(z * 10) / 10,
  }
  if (!row.name || !row.message) throw new Error('empty')
  if (whisperCooldown() > 0) throw new Error('cooldown')
  if (ONLINE) await request('whispers', { method: 'POST', body: JSON.stringify(row), headers: { Prefer: 'return=minimal' } })
  writeLocal(COOLDOWN_KEY, Date.now())
  rememberName(row.name)
  const local = { ...row, id: `local-${Date.now()}`, created_at: new Date().toISOString(), mine: true }
  // Çevrimdışıyken de bu tarayıcıda görünsün
  writeLocal(LOCAL_WHISPERS, [local, ...readLocal(LOCAL_WHISPERS, [])].slice(0, 30))
  return local
}

// ---------- Dünya sıralaması ----------
export async function fetchScores() {
  if (!ONLINE) return null
  return request('race_scores?select=id,name,time_ms,car,created_at&order=time_ms.asc&limit=10')
}

export function submittedBest() {
  return readLocal(SUBMITTED_KEY, 0)
}

export async function submitScore({ name, ms, car }) {
  const row = { name: clean(name, LIMITS.name), time_ms: Math.round(ms), car: clean(car, 16) }
  if (!ONLINE || !row.name) throw new Error('offline')
  if (row.time_ms < LIMITS.minRaceMs || row.time_ms > LIMITS.maxRaceMs) throw new Error('range')
  await request('race_scores', { method: 'POST', body: JSON.stringify(row), headers: { Prefer: 'return=minimal' } })
  writeLocal(SUBMITTED_KEY, row.time_ms)
  rememberName(row.name)
}
