import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { world } from './time.js'
import { useStore } from '../store.js'
import { playThunder } from '../audio.js'

// Hava durumu: otomatik döngüde çoğunlukla açık, ara sıra yağmur (şimşekli) ya da kar.
// Parçacıklar kameranın etrafındaki bir kutuda döner; uzaklaştıkça yeniden sarılır.
const BOX = { x: 70, y: 34, z: 70 }
const RAIN_COUNT = 3200
const SNOW_COUNT = 2600

// Parçacık başlangıç konumları için tekrarlanabilir rastgelelik
function seeded(seed) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

function pickWeather() {
  const r = Math.random()
  return r < 0.58 ? 'clear' : r < 0.84 ? 'rain' : 'snow'
}

function Rain() {
  const lines = useRef()
  const data = useMemo(() => {
    const rand = seeded(3)
    const pos = new Float32Array(RAIN_COUNT * 6)
    for (let i = 0; i < RAIN_COUNT; i++) {
      const x = (rand() - 0.5) * BOX.x
      const y = rand() * BOX.y
      const z = (rand() - 0.5) * BOX.z
      pos.set([x, y, z, x + 0.05, y - 0.7, z + 0.03], i * 6)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [])
  useFrame(({ camera }, delta) => {
    const l = lines.current
    if (!l) return
    l.visible = world.wet > 0.02
    if (!l.visible) return
    l.material.opacity = world.wet * 0.55
    const pos = data.attributes.position.array
    const fall = Math.min(delta, 0.05) * 30
    for (let i = 0; i < RAIN_COUNT; i++) {
      const o = i * 6
      pos[o + 1] -= fall
      pos[o + 4] -= fall
      if (pos[o + 4] < -4) {
        pos[o + 1] += BOX.y
        pos[o + 4] += BOX.y
      }
    }
    data.attributes.position.needsUpdate = true
    // Kutu kameranın altında kalsın, böylece her yerde yağar
    l.position.set(camera.position.x, camera.position.y - BOX.y * 0.75, camera.position.z)
  })
  return (
    <lineSegments ref={lines} geometry={data} frustumCulled={false}>
      <lineBasicMaterial color="#b9cbe6" transparent opacity={0} depthWrite={false} />
    </lineSegments>
  )
}

function Snow() {
  const points = useRef()
  const data = useMemo(() => {
    const pos = new Float32Array(SNOW_COUNT * 3)
    const phase = new Float32Array(SNOW_COUNT)
    const rand = seeded(5)
    for (let i = 0; i < SNOW_COUNT; i++) {
      pos.set([(rand() - 0.5) * BOX.x, rand() * BOX.y, (rand() - 0.5) * BOX.z], i * 3)
      phase[i] = rand() * 100
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return { g, phase }
  }, [])
  useFrame(({ camera, clock }, delta) => {
    const p = points.current
    if (!p) return
    p.visible = world.snowy > 0.02
    if (!p.visible) return
    p.material.opacity = world.snowy * 0.9
    const pos = data.g.attributes.position.array
    const dt = Math.min(delta, 0.05)
    const t = clock.elapsedTime
    for (let i = 0; i < SNOW_COUNT; i++) {
      const o = i * 3
      pos[o + 1] -= dt * 1.6
      pos[o] += Math.sin(t * 0.8 + data.phase[i]) * dt * 0.6
      if (pos[o + 1] < -2) pos[o + 1] += BOX.y
    }
    data.g.attributes.position.needsUpdate = true
    p.position.set(camera.position.x, camera.position.y - BOX.y * 0.75, camera.position.z)
  })
  return (
    <points ref={points} geometry={data.g} frustumCulled={false}>
      <pointsMaterial color="#ffffff" size={0.16} transparent opacity={0} depthWrite={false} sizeAttenuation />
    </points>
  )
}

export default function Weather() {
  const state = useRef({ auto: 'clear', next: 120, thunder: 10 })
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const s = state.current
    const store = useStore.getState()
    if (!store.started) return

    // Otomatik modda belirli aralıklarla hava değişir
    s.next -= dt
    if (s.next <= 0) {
      s.auto = pickWeather()
      s.next = s.auto === 'clear' ? 150 + Math.random() * 120 : 70 + Math.random() * 60
    }
    const current = store.weatherMode === 'auto' ? s.auto : store.weatherMode
    if (current !== store.weather) store.setWeather(current)

    // Yumuşak geçiş
    const ease = 1 - Math.exp(-0.6 * dt)
    world.wet += ((current === 'rain' ? 1 : 0) - world.wet) * ease
    world.snowy += ((current === 'snow' ? 1 : 0) - world.snowy) * ease

    // Şimşek: yağmurda rastgele aralıklarla
    world.flash = Math.max(world.flash - dt * 3.5, 0)
    if (world.wet > 0.6) {
      s.thunder -= dt
      if (s.thunder <= 0) {
        world.flash = 1
        s.thunder = 8 + Math.random() * 14
        if (!store.muted) setTimeout(() => playThunder(), 300 + Math.random() * 900)
      }
    }
  })
  return (
    <>
      <Rain />
      <Snow />
    </>
  )
}
