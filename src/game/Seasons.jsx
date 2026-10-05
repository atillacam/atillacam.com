import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { SEASONS, seasonWeights, world } from './time.js'
import { useStore } from '../store.js'
import { translate } from '../i18n.js'

// Mevsim döngüsü: otomatik modda her oyun gününde bir sonraki mevsime geçilir (~7 dk).
// Menüden seçilen mevsime en kısa yoldan yumuşakça geçilir. Ağırlıklar ve kar örtüsü
// world.uniforms üzerinden bitki örtüsü, çimen, arazi ve su shader'larına gider.
const ICONS = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' }

export default function Seasons() {
  const last = useRef(null)
  const counted = useRef(false)

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const store = useStore.getState()
    const mode = store.seasonMode

    if (mode === 'auto') {
      if (store.started) world.season = (world.season + dt * world.speed) % 4
    } else {
      // Hedef mevsimin ortasına, dairesel en kısa yönden yaklaş
      const target = SEASONS.indexOf(mode)
      let diff = target - world.season
      diff = ((((diff + 2) % 4) + 4) % 4) - 2
      world.season = (world.season + diff * (1 - Math.exp(-1.5 * dt)) + 4) % 4
      if (Math.abs(diff) < 0.002) world.season = target
    }

    const w = seasonWeights(world.season, world.uniforms.uSeason.value)

    // Kar örtüsü: kışın kendiliğinden oluşur, kar yağarken birikir, sıcak mevsimde hızla erir
    const snowing = world.snowy > 0.5 ? 1 : 0
    const goal = Math.max(w.w * 0.85, snowing * (w.w + w.z * 0.6 + w.x * 0.4))
    const rate = goal > world.snowCover ? 0.08 : 0.05 + (w.y + w.x) * 0.25
    world.snowCover += (goal - world.snowCover) * (1 - Math.exp(-rate * dt * 4))
    world.uniforms.uSnow.value = world.snowCover

    // Görünen mevsim değişince arayüze bildir
    const name = SEASONS[[w.x, w.y, w.z, w.w].indexOf(Math.max(w.x, w.y, w.z, w.w))]
    if (name !== last.current) {
      const first = last.current === null
      last.current = name
      store.setSeason(name)
      if (!first && store.started) store.toast(ICONS[name], translate('season_' + name, store.lang))
    }
    // Açılıştaki mevsim de "Dört mevsim" başarımına sayılsın (oyun başladığı anda)
    if (store.started && !counted.current) {
      counted.current = true
      store.addToSet('seasons', name)
    }
  })
  return null
}
