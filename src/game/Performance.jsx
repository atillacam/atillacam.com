import { useEffect, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { useStore } from '../store.js'
import { translate } from '../i18n.js'

// Kare hızı sınırı: Canvas "never" modunda çalışır, kareleri yalnızca burada istenen hızda çizeriz.
// ("demand" yetmez: fizik motoru hareketli her cisim için her karede invalidate() çağırır.)
// 120–240 Hz ekranlarda sahneyi gereksiz yere 2–4 kat çizip cihazı ısıtmayı önler.
// Pencere açıkken (oyun duraklatılmış) 24 FPS yeterli; sekme gizliyken rAF zaten durur.
export function FrameDriver() {
  const advance = useThree((s) => s.advance)
  const cap = useStore((s) => s.fpsCap)
  const paused = useStore((s) => !!s.modal)
  useEffect(() => {
    const target = paused ? 24 : cap
    const interval = target > 0 ? 1000 / target : 0
    let last = performance.now()
    let id = 0
    const loop = (now) => {
      id = requestAnimationFrame(loop)
      if (interval) {
        const elapsed = now - last
        // 1 ms tolerans: ekran tazelemesi tam katı olmadığında kare kaçırmamak için
        if (elapsed < interval - 1) return
        // Fazlayı taşı ki ortalama hız hedefte kalsın (144 Hz'de 60 FPS gibi)
        last = now - (elapsed % interval)
      }
      // "never" modunda r3f zamanı saniye cinsinden bekler (delta = timestamp - elapsedTime)
      advance(now / 1000)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [cap, paused, advance])
  return null
}

// Otomatik kalite: kare hızı hedefin altına düşünce çözünürlüğü kademeli düşür,
// en düşükte hâlâ yetişemiyorsa "Performans" kalitesine geç (oturum başına bir kez).
export function AutoQuality({ min, max }) {
  const setDpr = useThree((s) => s.setDpr)
  const cap = useStore((s) => s.fpsCap)
  const [factor, setFactor] = useState(1)
  const fellBack = useRef(false)
  const target = cap > 0 ? cap : 60

  useEffect(() => {
    const native = Math.min(window.devicePixelRatio || 1, max)
    setDpr(Math.max(min, Math.round((min + (native - min) * factor) * 20) / 20))
  }, [factor, min, max, setDpr])

  return (
    <PerformanceMonitor
      // Sınır kullanıcının seçtiği hıza göre: ekran tazeleme hızına göre değil
      bounds={() => [target * 0.8, target * 0.95]}
      factor={1}
      step={0.2}
      flipflops={4}
      onChange={({ factor: f }) => setFactor(f)}
      onFallback={() => {
        if (fellBack.current) return
        fellBack.current = true
        const store = useStore.getState()
        if (store.quality !== 'high') return
        store.setQuality('low')
        store.toast('⚡', translate('autoLowQuality', store.lang))
      }}
    />
  )
}
