import { createElement, useEffect, useState } from 'react'

// 3D görünümün parçaları ayrı paketlerde: klasik görünüm (telefonlar dahil) onları hiç indirmez.
// 3D ile açılışta main.jsx ikisini de hemen ister; arayüz gelene kadar index.html'deki statik açılış ekranı görünür.
export const loadGame = () => import('../game/Game.jsx')

let Overlay = null
export const loadOverlay = () => import('./Overlay.jsx').then((m) => (Overlay = m.default))

// 3D arayüzü; henüz yüklenmediyse (klasikten 3D'ye geçiş) yükler ve gelince çizer
export function OverlaySlot() {
  const [component, setComponent] = useState(() => Overlay)
  useEffect(() => {
    if (!component) loadOverlay().then((C) => setComponent(() => C))
  }, [component])
  return component ? createElement(component) : null
}
