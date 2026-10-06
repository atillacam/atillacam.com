// Tüm sesler Web Audio ile anlık üretilir: indirilecek ses dosyası yok.
// Yapı: efekt, müzik ve ortam sesleri ayrı kanallarda toplanır; hepsi kompresörlü ana kanala gider.
let ctx = null
let master = null
let sfx = null
let musicBus = null
let ambBus = null
let reverb = null
let engine = null
let tires = null
let ambience = null
let rotor = null
let noiseBuffer = null
let musicOn = true
let muted = false
let isNight = false
const MASTER = 0.8
const MUSIC = 0.5

function makeNoise(seconds, pink = false) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1
    last = last * 0.97 + w * 0.12
    data[i] = pink ? last * 2.2 : w
  }
  return buffer
}

// Üretilmiş dürtü yanıtıyla yumuşak bir yankı
function makeReverb(seconds = 2.6) {
  const len = ctx.sampleRate * seconds
  const buffer = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3
  }
  const node = ctx.createConvolver()
  node.buffer = buffer
  return node
}

function loop(buffer) {
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.loop = true
  src.start()
  return src
}

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume()
    return
  }
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return
  ctx = new AudioContext()
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -16
  comp.ratio.value = 3
  master = ctx.createGain()
  master.gain.value = muted ? 0 : MASTER
  master.connect(comp).connect(ctx.destination)
  sfx = ctx.createGain()
  sfx.connect(master)
  musicBus = ctx.createGain()
  musicBus.gain.value = 0
  musicBus.connect(master)
  if (musicOn) musicBus.gain.setTargetAtTime(MUSIC, ctx.currentTime + 1, 2)
  ambBus = ctx.createGain()
  ambBus.gain.value = 0.7
  ambBus.connect(master)
  reverb = makeReverb()
  const reverbOut = ctx.createGain()
  reverbOut.gain.value = 0.55
  reverb.connect(reverbOut).connect(master)
  noiseBuffer = makeNoise(2)

  // Motor: detune iki osilatör + alt oktav gövde sesi, alçak geçiren filtre
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 380
  filter.Q.value = 2
  const gain = ctx.createGain()
  gain.gain.value = 0
  const a = ctx.createOscillator()
  const b = ctx.createOscillator()
  const sub = ctx.createOscillator()
  a.type = 'sawtooth'
  b.type = 'square'
  a.frequency.value = 42
  b.frequency.value = 42.7
  sub.frequency.value = 21
  const bGain = ctx.createGain()
  bGain.gain.value = 0.3
  const subGain = ctx.createGain()
  subGain.gain.value = 0.9
  a.connect(filter)
  b.connect(bGain).connect(filter)
  sub.connect(subGain).connect(gain)
  filter.connect(gain).connect(sfx)
  a.start()
  b.start()
  sub.start()
  engine = { a, b, sub, filter, gain, gear: 0, shiftUntil: 0 }

  // Lastik sürtünmesi: bant geçiren gürültü, yanal kaymaya göre açılır
  const tireFilter = ctx.createBiquadFilter()
  tireFilter.type = 'bandpass'
  tireFilter.frequency.value = 1500
  tireFilter.Q.value = 6
  const tireGain = ctx.createGain()
  tireGain.gain.value = 0
  loop(noiseBuffer).connect(tireFilter).connect(tireGain).connect(sfx)
  tires = { filter: tireFilter, gain: tireGain }

  // Ortam: rüzgâr (hıza göre), yağmur hışırtısı, gece cırcır böcekleri
  const windFilter = ctx.createBiquadFilter()
  windFilter.type = 'lowpass'
  windFilter.frequency.value = 400
  const windGain = ctx.createGain()
  windGain.gain.value = 0
  loop(makeNoise(4, true)).connect(windFilter).connect(windGain).connect(ambBus)
  const rainFilter = ctx.createBiquadFilter()
  rainFilter.type = 'highpass'
  rainFilter.frequency.value = 1800
  const rainGain = ctx.createGain()
  rainGain.gain.value = 0
  loop(noiseBuffer).connect(rainFilter).connect(rainGain).connect(ambBus)
  const cricket = ctx.createOscillator()
  cricket.frequency.value = 4400
  const cricketAm = ctx.createGain()
  cricketAm.gain.value = 0.5
  const lfo = ctx.createOscillator()
  lfo.type = 'square'
  lfo.frequency.value = 28
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 0.5
  lfo.connect(lfoGain).connect(cricketAm.gain)
  // Cırcır böcekleri sürekli değil, ritmik gruplar halinde öter
  const pulse = ctx.createOscillator()
  pulse.type = 'square'
  pulse.frequency.value = 1.6
  const pulseGain = ctx.createGain()
  pulseGain.gain.value = 0.5
  const cricketGate = ctx.createGain()
  cricketGate.gain.value = 0.5
  pulse.connect(pulseGain).connect(cricketGate.gain)
  const cricketGain = ctx.createGain()
  cricketGain.gain.value = 0
  cricket.connect(cricketAm).connect(cricketGate).connect(cricketGain).connect(ambBus)
  cricket.start()
  lfo.start()
  pulse.start()
  ambience = { windFilter, windGain, rainGain, cricketGain, wet: 0 }

  // Helikopter rotoru: alçak geçiren gürültü, ~13 Hz'lik "pat-pat" ile genliği dalgalanır + bas gövde sesi
  const rotorFilter = ctx.createBiquadFilter()
  rotorFilter.type = 'lowpass'
  rotorFilter.frequency.value = 260
  const chop = ctx.createGain()
  chop.gain.value = 0.5
  const chopLfo = ctx.createOscillator()
  chopLfo.type = 'sawtooth'
  chopLfo.frequency.value = 13
  const chopDepth = ctx.createGain()
  chopDepth.gain.value = 0.5
  chopLfo.connect(chopDepth).connect(chop.gain)
  const rotorGain = ctx.createGain()
  rotorGain.gain.value = 0
  loop(makeNoise(3, true)).connect(rotorFilter).connect(chop).connect(rotorGain).connect(sfx)
  const thump = ctx.createOscillator()
  thump.frequency.value = 52
  const thumpGain = ctx.createGain()
  thumpGain.gain.value = 0.35
  thump.connect(thumpGain).connect(chop)
  chopLfo.start()
  thump.start()
  rotor = { gain: rotorGain, lfo: chopLfo, filter: rotorFilter }

  setInterval(tick, 250)
}

export function setMuted(value) {
  muted = value
  if (!ctx) return
  master.gain.setTargetAtTime(muted ? 0 : MASTER, ctx.currentTime, 0.05)
}

export function setMusic(on) {
  musicOn = on
  if (!ctx) return
  musicBus.gain.cancelScheduledValues(ctx.currentTime)
  musicBus.gain.setTargetAtTime(on ? MUSIC : 0, ctx.currentTime, on ? 1.5 : 0.3)
}

// speed: m/s, throttle: 0..1, slip: yanal kayma (m/s)
const GEARS = [0, 9, 17, 25, 34]
export function updateEngine(speed, throttle, slip = 0, grounded = true) {
  if (!engine) return
  const t = ctx.currentTime
  const v = Math.min(Math.abs(speed), 40)
  // Basit vites kutusu: her viteste devir yükselir, vites değişiminde kısa bir boşluk olur
  let gear = 0
  while (gear < GEARS.length - 1 && v > GEARS[gear + 1]) gear++
  if (gear !== engine.gear) {
    if (gear > engine.gear && throttle > 0) engine.shiftUntil = t + 0.12
    engine.gear = gear
  }
  const lo = GEARS[gear]
  const hi = GEARS[gear + 1] ?? 44
  const rpm = Math.min((v - lo) / (hi - lo), 1)
  const shifting = t < engine.shiftUntil
  const freq = 40 + rpm * 70 + gear * 9 + throttle * 10 + (grounded ? 0 : throttle * 25)
  engine.a.frequency.setTargetAtTime(freq, t, shifting ? 0.05 : 0.07)
  engine.b.frequency.setTargetAtTime(freq * 1.012, t, 0.07)
  engine.sub.frequency.setTargetAtTime(freq / 2, t, 0.07)
  engine.filter.frequency.setTargetAtTime(260 + freq * 4 + throttle * 300, t, 0.1)
  engine.gain.gain.setTargetAtTime(shifting ? 0.02 : 0.03 + throttle * 0.045, t, 0.06)
  const screech = grounded && v > 4 ? Math.min(Math.max((slip - 3.5) / 6, 0), 1) : 0
  tires.gain.gain.setTargetAtTime(screech * 0.07, t, 0.08)
  tires.filter.frequency.setTargetAtTime(1300 + screech * 600, t, 0.1)
}

// Helikopter rotor sesi: on = helikopter modunda mı, power: 0..1
export function updateHeli(on, power) {
  if (!rotor) return
  const t = ctx.currentTime
  rotor.gain.gain.setTargetAtTime(on ? 0.05 + power * 0.06 : 0, t, on ? 0.4 : 0.25)
  rotor.lfo.frequency.setTargetAtTime(11 + power * 5, t, 0.3)
  rotor.filter.frequency.setTargetAtTime(220 + power * 140, t, 0.3)
}

// night, wet: 0..1, speed: m/s
export function updateAmbience(night, wet, speed) {
  if (!ambience) return
  const t = ctx.currentTime
  const v = Math.min(Math.abs(speed), 40)
  ambience.wet = wet
  isNight = night > 0.5
  ambience.windGain.gain.setTargetAtTime(0.025 + v * 0.0025 + wet * 0.03, t, 0.3)
  ambience.windFilter.frequency.setTargetAtTime(300 + v * 28, t, 0.3)
  ambience.rainGain.gain.setTargetAtTime(wet * 0.07, t, 0.5)
  ambience.cricketGain.gain.setTargetAtTime(Math.max(night - 0.4, 0) * (1 - wet) * 0.012, t, 1)
}

// Gündüz kuş cıvıltısı: kısa, hızlı frekans kaydırmalı ötüşler
function chirp() {
  const t = ctx.currentTime
  const base = 2400 + Math.random() * 1600
  const n = 2 + Math.floor(Math.random() * 4)
  const out = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain()
  if (out.pan) out.pan.value = Math.random() * 1.6 - 0.8
  out.connect(ambBus)
  out.connect(reverb)
  for (let i = 0; i < n; i++) {
    const s = t + i * (0.09 + Math.random() * 0.05)
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.frequency.setValueAtTime(base, s)
    osc.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), s + 0.05)
    g.gain.setValueAtTime(0.0001, s)
    g.gain.exponentialRampToValueAtTime(0.012, s + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.07)
    osc.connect(g).connect(out)
    osc.start(s)
    osc.stop(s + 0.1)
  }
}

// ================= Prosedürel müzik =================
// Gündüz: parlak majör yedili akorlar; gece: daha yavaş, koyu minör akorlar.
const midi = (n) => 440 * 2 ** ((n - 69) / 12)
const DAY = [
  [48, 55, 59, 64, 67], // Cmaj7
  [45, 52, 55, 59, 64], // Am9
  [41, 48, 52, 57, 60], // Fmaj7
  [43, 50, 55, 59, 62], // G6
]
const NIGHT = [
  [45, 52, 55, 60, 64], // Am7
  [41, 48, 53, 57, 64], // Fmaj7
  [38, 45, 50, 53, 57], // Dm9
  [40, 47, 52, 55, 59], // Em7
]
let nextChord = 0
let chordIndex = 0
let nextNote = 0
let currentChord = DAY[0]

function padVoice(freq, start, length, volume, bright) {
  const osc = ctx.createOscillator()
  const osc2 = ctx.createOscillator()
  const filter = ctx.createBiquadFilter()
  const g = ctx.createGain()
  const g2 = ctx.createGain()
  osc.type = 'triangle'
  osc2.type = 'sawtooth'
  osc.frequency.value = freq
  osc2.frequency.value = freq * 1.004
  filter.type = 'lowpass'
  filter.frequency.value = bright
  g2.gain.value = 0.25
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(volume, start + 2.2)
  g.gain.setValueAtTime(volume, start + length - 0.5)
  g.gain.exponentialRampToValueAtTime(0.0001, start + length + 2.5)
  osc.connect(filter)
  osc2.connect(g2).connect(filter)
  filter.connect(g)
  g.connect(musicBus)
  g.connect(reverb)
  osc.start(start)
  osc2.start(start)
  osc.stop(start + length + 2.6)
  osc2.stop(start + length + 2.6)
}

function pluck(freq, start, volume) {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.frequency.value = freq
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(volume, start + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, start + 1.4)
  osc.connect(g)
  g.connect(musicBus)
  g.connect(reverb)
  osc.start(start)
  osc.stop(start + 1.5)
}

// Sesler ses kanalına bağlı olduğu için müzik kapalıyken hiç planlama yapılmaz
function scheduleMusic() {
  const now = ctx.currentTime
  if (nextChord < now) nextChord = now + 0.1
  if (nextChord < now + 0.6) {
    const set = isNight ? NIGHT : DAY
    const length = isNight ? 10 : 8
    currentChord = set[chordIndex % set.length]
    chordIndex++
    const bright = isNight ? 520 : 950
    currentChord.slice(1).forEach((n) => padVoice(midi(n), nextChord, length, 0.028, bright))
    padVoice(midi(currentChord[0] - 12), nextChord, length, 0.05, 300)
    nextNote = Math.max(nextNote, nextChord + 1)
    nextChord += length
  }
  // Seyrek, rastgele arpej notaları
  if (nextNote < now) nextNote = now + 0.05
  while (nextNote < now + 0.6) {
    const step = isNight ? 0.75 : 0.5
    if (Math.random() < (isNight ? 0.28 : 0.38)) {
      const n = currentChord[1 + Math.floor(Math.random() * (currentChord.length - 1))] + 12 * (Math.random() < 0.5 ? 1 : 2)
      pluck(midi(n), nextNote, isNight ? 0.025 : 0.035)
    }
    nextNote += step
  }
}

function tick() {
  if (!ctx || ctx.state !== 'running' || muted || document.hidden) return
  if (musicOn) scheduleMusic()
  if (ambience && !isNight && ambience.wet < 0.3 && Math.random() < 0.1) chirp()
}

function tone({ freq, type = 'sine', duration = 0.2, volume = 0.15, delay = 0, slide = 0, wet = false }) {
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
  osc.connect(gain).connect(sfx)
  if (wet) gain.connect(reverb)
  osc.start(t)
  osc.stop(t + duration + 0.05)
}

function noiseBurst({ duration, volume, type = 'lowpass', freq = 800, endFreq = 0, pink = false }) {
  if (!ctx) return
  const t = ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = pink ? makeNoise(duration + 0.1, true) : noiseBuffer
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.setValueAtTime(freq, t)
  if (endFreq) filter.frequency.exponentialRampToValueAtTime(endFreq, t + duration)
  const g = ctx.createGain()
  g.gain.setValueAtTime(volume, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  src.connect(filter).connect(g).connect(sfx)
  src.start(t)
  src.stop(t + duration + 0.05)
  return g
}

export function playHonk() {
  tone({ freq: 415, type: 'square', duration: 0.32, volume: 0.06 })
  tone({ freq: 523, type: 'square', duration: 0.32, volume: 0.05 })
}

export function playChime() {
  ;[659, 784, 1046].forEach((freq, i) => tone({ freq, type: 'triangle', duration: 0.5, volume: 0.12, delay: i * 0.09, wet: true }))
}

export function playClick() {
  tone({ freq: 880, type: 'triangle', duration: 0.12, volume: 0.08, slide: 1.4 })
}

// Çarpışma: alçak gövde sesi + kısa metal/plastik tıkırtısı
export function playThud(strength = 1) {
  const s = Math.min(strength, 3)
  tone({ freq: 110 + Math.random() * 30, type: 'sine', duration: 0.2, volume: Math.min(0.05 + s * 0.035, 0.2), slide: 0.5 })
  noiseBurst({ duration: 0.08 + s * 0.04, volume: 0.04 + s * 0.04, type: 'bandpass', freq: 600 + Math.random() * 500, endFreq: 250 })
}

export function playSplash() {
  noiseBurst({ duration: 0.6, volume: 0.35, type: 'bandpass', freq: 1200, endFreq: 500 })
}

export function playCoin() {
  tone({ freq: 988, type: 'square', duration: 0.09, volume: 0.05 })
  tone({ freq: 1319, type: 'square', duration: 0.22, volume: 0.05, delay: 0.08, wet: true })
}

export function playCountdown(final = false) {
  tone({ freq: final ? 880 : 440, type: 'triangle', duration: final ? 0.5 : 0.18, volume: 0.12 })
}

export function playCheckpoint() {
  tone({ freq: 660, type: 'triangle', duration: 0.14, volume: 0.1 })
  tone({ freq: 990, type: 'triangle', duration: 0.2, volume: 0.1, delay: 0.1, wet: true })
}

// Patlama: süzgeci kapanan gürültü + düşen bas
export function playBoom() {
  if (!ctx) return
  const g = noiseBurst({ duration: 1.2, volume: 0.55, freq: 1400, endFreq: 120 })
  g?.connect(reverb)
  tone({ freq: 70, type: 'sine', duration: 0.6, volume: 0.25, slide: 0.4 })
}

// Uzak gök gürültüsü: uzun, alçak frekanslı, yavaş açılan gürültü
export function playThunder() {
  if (!ctx) return
  const t = ctx.currentTime
  const g = noiseBurst({ duration: 2.8, volume: 0.0001, freq: 320, pink: true })
  g.gain.cancelScheduledValues(t)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.9, t + 0.1)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8)
  g.connect(reverb)
}

// Heykel yıkılması gibi taş/beton düşüşleri
export function playCrumble() {
  noiseBurst({ duration: 0.9, volume: 0.3, freq: 900, endFreq: 150, pink: true })
  ;[0, 0.12, 0.27, 0.4].forEach((d, i) => tone({ freq: 90 - i * 8, type: 'sine', duration: 0.25, volume: 0.12, delay: d, slide: 0.6 }))
}

// Havai fişek: kısa patlama ve çıtırtı
export function playFirework() {
  if (!ctx) return
  noiseBurst({ duration: 0.5, volume: 0.22, freq: 2200, endFreq: 400 })
  for (let i = 0; i < 6; i++) tone({ freq: 2400 + Math.random() * 1800, type: 'square', duration: 0.03, volume: 0.025, delay: 0.25 + Math.random() * 0.5 })
}

// Vapur düdüğü: iki alçak, hafif akortsuz ton
export function playFerryHorn(volume = 1) {
  if (!ctx) return
  tone({ freq: 138, type: 'sawtooth', duration: 1.6, volume: 0.05 * volume, wet: true })
  tone({ freq: 146, type: 'sawtooth', duration: 1.6, volume: 0.04 * volume, wet: true })
}

// Konami / gizli sürpriz arpeji
export function playSecret() {
  ;[523, 659, 784, 1046, 1319].forEach((freq, i) => tone({ freq, type: 'triangle', duration: 0.4, volume: 0.09, delay: i * 0.07, wet: true }))
}
