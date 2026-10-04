import { useStore } from '../store.js'

// Klavye, dokunmatik ve gamepad aynı nesneye yazar; araç her fizik adımında buradan okur.
export const input = {
  keys: { forward: false, backward: false, left: false, right: false, boost: false, brake: false },
  // Dokunmatik joystick: -1..1
  touch: { steer: 0, throttle: 0, active: false, boost: false },
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
  rearWheels: [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ],
  rearContact: [true, true],
  heading: 0,
  speed: 0,
  upright: 1, // 1 = dik, -1 = ters
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

export function bindKeyboard() {
  const onDown = (event) => {
    if (isTyping(event)) return
    const store = useStore.getState()
    if (store.view !== '3d') return

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
        trigger('jump')
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
      case 'KeyL':
        store.toggleMuted()
        break
      case 'KeyN':
        store.toggleDayNight()
        break
    }
  }
  const onUp = (event) => {
    const key = KEYMAP[event.code]
    if (key) input.keys[key] = false
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
