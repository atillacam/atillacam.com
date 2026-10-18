import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store.js'
import { vehicleState } from './input.js'
import { TOUR_DWELL, TOUR_FLY, TOUR_STOPS } from './tour.js'

// Rehberli tur kamerası: tur sırasında araç park hâlinde, kamera duraklar arasında uçar
const _from = new THREE.Vector3()
const _fromLook = new THREE.Vector3()
const _pos = new THREE.Vector3()
const _look = new THREE.Vector3()
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

export default function Tour() {
  const camera = useThree((s) => s.camera)
  const state = useRef({ step: -1, look: new THREE.Vector3() })
  useFrame(() => {
    const store = useStore.getState()
    const tour = store.tour
    const s = state.current
    if (store.mode !== 'tour' || !tour) {
      s.step = -1
      return
    }
    // Yeni durak: uçuşun başlangıcı kameranın şu anki konumu ve bakışı
    if (s.step !== tour.step) {
      s.step = tour.step
      _from.copy(camera.position)
      camera.getWorldDirection(_fromLook).multiplyScalar(20).add(camera.position)
      if (s.look.lengthSq() > 0) _fromLook.copy(s.look)
      s.from = _from.clone()
      s.fromLook = _fromLook.clone()
    }
    const now = performance.now() / 1000
    const elapsed = now - tour.at
    const stop = TOUR_STOPS[tour.step]
    const k = ease(Math.min(elapsed / TOUR_FLY, 1))
    // Durakta yavaş süzülme: kamera hedefin çevresinde hafifçe kayar
    const drift = Math.max(0, elapsed - TOUR_FLY) * 0.12
    _a.set(...stop.pos)
    _b.set(...stop.look)
    _a.x += Math.sin(drift) * 2.5
    _a.z += (Math.cos(drift) - 1) * 2.5
    _pos.copy(s.from).lerp(_a, k)
    _look.copy(s.fromLook).lerp(_b, k)
    // Uçuş ortasında biraz yükselir (yayvan kavis)
    _pos.y += Math.sin(k * Math.PI) * 8
    camera.position.copy(_pos)
    camera.lookAt(_look)
    s.look.copy(_look)
    vehicleState.cameraYaw = Math.atan2(_look.x - _pos.x, _look.z - _pos.z)
    // Son durak hariç kendiliğinden ilerle
    if (elapsed > TOUR_FLY + TOUR_DWELL && tour.step < TOUR_STOPS.length - 1) store.tourStep(tour.step + 1)
  })
  return null
}
