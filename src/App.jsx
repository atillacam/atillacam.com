import { Component, lazy, Suspense, useEffect, useMemo } from 'react'
import { useStore } from './store.js'
import Overlay from './ui/Overlay.jsx'
import ClassicSite from './ui/ClassicSite.jsx'

// 3D kısım ayrı bir pakette: klasik görünüm Three.js'i hiç indirmez
const Game = lazy(() => import('./game/Game.jsx'))

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

// 3D tarafında beklenmedik bir hata olursa klasik görünüme düş
class GameBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error) {
    console.error(error)
    useStore.getState().setView('classic')
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export default function App() {
  const webgl = useMemo(() => supportsWebGL(), [])
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const lang = useStore((s) => s.lang)

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = lang === 'tr' ? 'Atilla Çam | Yazılım Geliştirici' : 'Atilla Çam | Software Developer'
  }, [lang])

  useEffect(() => {
    const wantsClassic = new URLSearchParams(window.location.search).has('klasik')
    if (!webgl || wantsClassic) setView('classic')
  }, [webgl, setView])

  if (view === 'classic') return <ClassicSite webgl={webgl} />

  return (
    <>
      <div className="stage">
        <GameBoundary>
          <Suspense fallback={null}>
            <Game />
          </Suspense>
        </GameBoundary>
      </div>
      <Overlay />
    </>
  )
}
