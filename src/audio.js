// Tüm sesler Web Audio ile anlık üretilir: indirilecek ses dosyası yok.
let ctx = null
let master = null
let engine = null

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume()
    return
  }
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return
  ctx = new AudioContext()
  master = ctx.createGain()
  master.gain.value = 0.8
  master.connect(ctx.destination)

  // Motor: iki hafif detune osilatör + alçak geçiren filtre
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 380
  const gain = ctx.createGain()
  gain.gain.value = 0
  const a = ctx.createOscillator()
  const b = ctx.createOscillator()
  a.type = 'sawtooth'
  b.type = 'square'
  a.frequency.value = 42
  b.frequency.value = 42.7
  const bGain = ctx.createGain()
  bGain.gain.value = 0.35
  a.connect(filter)
  b.connect(bGain).connect(filter)
  filter.connect(gain).connect(master)
  a.start()
  b.start()
  engine = { a, b, filter, gain }
}

export function setMuted(muted) {
  if (!ctx) return
  master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.05)
}

// speed: m/s, throttle: 0..1
export function updateEngine(speed, throttle) {
  if (!engine) return
  const t = ctx.currentTime
  const freq = 38 + Math.min(Math.abs(speed), 30) * 4.2 + throttle * 14
  engine.a.frequency.setTargetAtTime(freq, t, 0.08)
  engine.b.frequency.setTargetAtTime(freq * 1.012, t, 0.08)
  engine.filter.frequency.setTargetAtTime(300 + freq * 4, t, 0.1)
  engine.gain.gain.setTargetAtTime(0.035 + throttle * 0.045, t, 0.12)
}

function tone({ freq, type = 'sine', duration = 0.2, volume = 0.15, delay = 0, slide = 0 }) {
  if (!ctx) return
  const t = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slide) osc.frequency.exponentialRampToValueAtTime(freq * slide, t + duration)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(gain).connect(master)
  osc.start(t)
  osc.stop(t + duration + 0.05)
}

export function playHonk() {
  tone({ freq: 415, type: 'square', duration: 0.32, volume: 0.06 })
  tone({ freq: 523, type: 'square', duration: 0.32, volume: 0.05 })
}

export function playChime() {
  ;[659, 784, 1046].forEach((freq, i) => tone({ freq, type: 'triangle', duration: 0.5, volume: 0.12, delay: i * 0.09 }))
}

export function playClick() {
  tone({ freq: 880, type: 'triangle', duration: 0.12, volume: 0.08, slide: 1.4 })
}

export function playThud(strength = 1) {
  tone({ freq: 120, type: 'sine', duration: 0.18, volume: Math.min(0.05 + strength * 0.03, 0.2), slide: 0.5 })
}

export function playSplash() {
  if (!ctx) return
  // Beyaz gürültüden kısa bir su sıçraması
  const t = ctx.currentTime
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 900
  const gain = ctx.createGain()
  gain.gain.value = 0.35
  src.connect(filter).connect(gain).connect(master)
  src.start(t)
}

export function playCoin() {
  tone({ freq: 988, type: 'square', duration: 0.09, volume: 0.05 })
  tone({ freq: 1319, type: 'square', duration: 0.22, volume: 0.05, delay: 0.08 })
}

export function playCountdown(final = false) {
  tone({ freq: final ? 880 : 440, type: 'triangle', duration: final ? 0.5 : 0.18, volume: 0.12 })
}

export function playCheckpoint() {
  tone({ freq: 660, type: 'triangle', duration: 0.14, volume: 0.1 })
  tone({ freq: 990, type: 'triangle', duration: 0.2, volume: 0.1, delay: 0.1 })
}
