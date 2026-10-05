import { useStore } from '../store.js'

const translateKonami = (lang) => (lang === 'tr' ? 'Hile kodu etkin!' : 'Cheat code activated!')

// Klavye, dokunmatik ve gamepad aynı nesneye yazar; araç her fizik adımında buradan okur.
export const input = {
  keys: { forward: false, backward: false, left: false, right: false, boost: false, brake: false },
  // Dokunmatik joystick: -1..1
  touch: { steer: 0, throttle: 0, active: false, boost: false },
  // keys.up: Boşluk basılı (helikopterde yükselmek için); keys içinde dinamik olarak tutulur
  // Tek seferlik olaylar (araç tüketir)
  events: new Set(),
}

// Aracın canlı durumu: HUD, harita ve ses buradan okur (React render'ı tetiklemez)
export const vehicleState = {
  position: { x: 0, y: 0, z: 0 },
  forward: { x: 1, y: 0, z: 0 },
  throttle: 0,
  boost: false,
  grounded: true,
  slip: 0, // yanal kayma hızı (m/s)
  braking: false,
  handbrake: false,
  recovering: 0, // 0..1 kendini düzeltme ilerlemesi
  cameraYaw: 0,
  rearWheels: [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ],
  rearContact: [true, true],
  heading: 0,
  speed: 0,
  upright: 1, // 1 = dik, -1 = ters
  quaternion: { x: 0, y: 0, z: 0, w: 1 }, // ekranda çizilen yönelim (hayalet kaydı için)
  modelOffsetY: 0, // gövdeye göre model yüksekliği (Vehicle ayarlar)
  altitude: 0, // helikopterde yerden yükseklik (m)
  heliTeleport: null, // helikopterdeyken haritadan ışınlanma hedefi
  teleport: null, // { position, yaw }
}

export function trigger(event) {
  input.events.add(event)
}

const KEYMAP = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'boost',
  ShiftRight: 'boost',
  ControlLeft: 'brake',
  KeyB: 'brake',
}

function isTyping(event) {
  const el = event.target
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

// ↑↑↓↓←→←→BA
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA']
let konamiIndex = 0

export function bindKeyboard() {
  const onDown = (event) => {
    if (isTyping(event)) return
    const store = useStore.getState()
    if (store.view !== '3d') return
    if (!event.repeat) {
      konamiIndex = event.code === KONAMI[konamiIndex] ? konamiIndex + 1 : event.code === KONAMI[0] ? 1 : 0
      if (konamiIndex === KONAMI.length) {
        konamiIndex = 0
        store.activateKonami()
        store.toast('🌈', translateKonami(store.lang))
      }
    }

    if (event.code === 'Escape') {
      store.closeAll()
      return
    }
    // Pencere açıkken araç kontrolü yok; sadece Esc çalışır
    if (store.modal) return
    if (!store.started) return

    const key = KEYMAP[event.code]
    if (key) {
      input.keys[key] = true
      if (event.code.startsWith('Arrow') || event.code === 'ControlLeft') event.preventDefault()
      return
    }
    if (event.repeat) return
    switch (event.code) {
      case 'Space':
        event.preventDefault()
        input.keys.up = true
        if (store.mode === 'car') trigger('jump')
        break
      case 'KeyV':
        store.toggleHeli()
        break
      case 'Enter':
      case 'KeyE':
        store.interact()
        break
      case 'KeyH':
        trigger('honk')
        break
      case 'KeyR':
        trigger('respawn')
        break
      case 'KeyM':
        store.togglePanel('map')
        break
      case 'KeyT':
        event.preventDefault()
        store.openModal({ type: 'whisper' })
        break
      case 'KeyL':
        store.toggleMuted()
        break
      case 'KeyN':
        store.toggleDayNight()
        break
      case 'KeyF':
        store.cycleHeadlights()
        break
      case 'KeyC':
        store.toggleCamera()
        break
      case 'Digit1':
      case 'Digit2':
      case 'Digit3':
      case 'Digit4':
      case 'Digit5':
        trigger('hydro' + event.code.slice(5))
        break
    }
  }
  const onUp = (event) => {
    const key = KEYMAP[event.code]
    if (key) input.keys[key] = false
    if (event.code === 'Space') input.keys.up = false
  }
  const releaseAll = () => {
    for (const k in input.keys) input.keys[k] = false
  }
  window.addEventListener('keydown', onDown)
  window.addEventListener('keyup', onUp)
  window.addEventListener('blur', releaseAll)
  // Pencere açılınca basılı tuşlar takılı kalmasın
  const unsub = useStore.subscribe((s, prev) => {
    if (s.modal && !prev.modal) releaseAll()
  })
  return () => {
    window.removeEventListener('keydown', onDown)
    window.removeEventListener('keyup', onUp)
    window.removeEventListener('blur', releaseAll)
    unsub()
  }
}

// Gamepad: her karede çağrılır
const padPrev = {}
export function pollGamepad() {
  const pads = navigator.getGamepads?.() ?? []
  const pad = [...pads].find(Boolean)
  if (!pad) return null
  const store = useStore.getState()
  const pressed = (i) => pad.buttons[i]?.pressed ?? false
  const edge = (i, fn) => {
    const now = pressed(i)
    if (now && !padPrev[i]) fn()
    padPrev[i] = now
  }
  edge(0, () => (store.modal ? store.closeAll() : store.interact())) // A
  edge(3, () => trigger('jump')) // Y
  edge(10, () => trigger('honk')) // sol çubuk basma
  edge(8, () => trigger('respawn')) // Select
  edge(9, () => store.togglePanel('map')) // Start
  const axis = pad.axes[0] ?? 0
  return {
    steer: Math.abs(axis) > 0.15 ? -axis : 0,
    throttle: (pad.buttons[7]?.value ?? 0) - (pad.buttons[6]?.value ?? 0),
    boost: pressed(1),
    brake: pressed(2),
  }
}

export function teleport(position, yaw) {
  vehicleState.teleport = { position, yaw }
}
