import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { buildRacer } from './cars.js'
import { vehicleState } from './input.js'
import { useStore } from '../store.js'
import { translate } from '../i18n.js'

// Hayalet araba: yarışta en iyi turun kaydı yarı saydam bir kopya olarak seninle birlikte yarışır.
// Her 50 ms'de konum + yönelim kaydedilir; rekor kırılınca kayıt bu tarayıcıda saklanır.
const KEY = 'atillacam-ghost-v1'
const STEP = 50 // ms
const STRIDE = 8 // t, x, y, z, qx, qy, qz, qw

function loadGhost() {
  try {
    const g = JSON.parse(localStorage.getItem(KEY))
    if (g && Array.isArray(g.s) && g.s.length >= STRIDE * 2 && g.ms > 0) return g
  } catch {
    // bozuk ya da erişilemeyen kayıt: hayaletsiz devam
  }
  return null
}

function saveGhost(ghost) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ghost))
  } catch {
    // Gizli sekme vb.: yalnızca bu oturumda kalır
  }
}

const _a = new THREE.Quaternion()
const _b = new THREE.Quaternion()

export default function Ghost() {
  const group = useRef()
  const body = useMemo(() => {
    const { body } = buildRacer()
    const material = new THREE.MeshStandardMaterial({ color: '#8fd8ff', emissive: '#3aa8ff', emissiveIntensity: 0.7, transparent: true, opacity: 0.38, depthWrite: false })
    body.traverse((o) => {
      if (!o.isMesh) return
      o.material = material
      o.castShadow = false
      o.receiveShadow = false
    })
    return body
  }, [])
  const rec = useRef({ active: false, samples: [], next: 0, ghost: loadGhost(), cursor: 0 })

  useFrame(() => {
    const g = group.current
    if (!g) return
    const store = useStore.getState()
    const { race } = store
    const r = rec.current

    if (!race.active) {
      if (r.active) {
        r.active = false
        // Yarış az önce bittiyse (iptal değil) ve rekorsa kaydı sakla
        const finished = race.finishedAt && Date.now() - race.finishedAt < 3000
        if (finished && r.samples.length >= STRIDE * 2 && (!r.ghost || race.lastTime < r.ghost.ms)) {
          r.ghost = { ms: Math.round(race.lastTime), s: r.samples }
          saveGhost(r.ghost)
          store.toast('👻', translate('ghostSaved', store.lang))
        }
      }
      g.visible = false
      return
    }

    const t = performance.now() - race.start
    if (!r.active) {
      r.active = true
      r.samples = []
      r.next = 0
      r.cursor = 0
      if (r.ghost) store.toast('👻', translate('ghostRace', store.lang))
    }

    // Kayıt
    if (t >= r.next) {
      r.next = t + STEP
      const p = vehicleState.position
      const q = vehicleState.quaternion
      const round = (v) => Math.round(v * 1000) / 1000
      r.samples.push(Math.round(t), round(p.x), round(p.y), round(p.z), round(q.x), round(q.y), round(q.z), round(q.w))
    }

    // Oynatma: kayıttaki iki örnek arasında yumuşak geçiş
    const s = r.ghost?.s
    if (!s) {
      g.visible = false
      return
    }
    const count = s.length / STRIDE
    while (r.cursor < count - 2 && s[(r.cursor + 1) * STRIDE] <= t) r.cursor++
    const i = r.cursor * STRIDE
    const j = Math.min(r.cursor + 1, count - 1) * STRIDE
    if (t > s[(count - 1) * STRIDE] + 400) {
      // Hayalet bitişi geçti: kısa süre sonra kaybolur
      g.visible = false
      return
    }
    const span = Math.max(s[j] - s[i], 1)
    const k = THREE.MathUtils.clamp((t - s[i]) / span, 0, 1)
    g.position.set(s[i + 1] + (s[j + 1] - s[i + 1]) * k, s[i + 2] + (s[j + 2] - s[i + 2]) * k, s[i + 3] + (s[j + 3] - s[i + 3]) * k)
    _a.set(s[i + 4], s[i + 5], s[i + 6], s[i + 7])
    _b.set(s[j + 4], s[j + 5], s[j + 6], s[j + 7])
    g.quaternion.slerpQuaternions(_a.normalize(), _b.normalize(), k)
    g.visible = true
  })

  return (
    <group ref={group} visible={false}>
      <group position={[0, vehicleState.modelOffsetY, 0]}>
        <primitive object={body} />
      </group>
    </group>
  )
}
