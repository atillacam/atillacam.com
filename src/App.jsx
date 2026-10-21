import { Component, lazy, Suspense, useEffect, useMemo } from 'react'
import { useStore } from './store.js'
import ClassicSite from './ui/ClassicSite.jsx'
import { loadGame, OverlaySlot } from './ui/lazyParts.js'

// 3D kısım ayrı bir pakette: klasik görünüm Three.js'i hiç indirmez
const Game = lazy(loadGame)

// Ucuz özellik kontrolü: gerçek bir bağlam açmak telefonda yüzlerce ms sürer. Bağlam yine de açılamazsa
// (kara listedeki sürücü vb.) 3D tarafı hata verir ve GameBoundary klasik görünüme düşer.
function supportsWebGL() {
  return typeof window !== 'undefined' && !!(window.WebGL2RenderingContext || window.WebGLRenderingContext)
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
    document.title = lang === 'tr' ? 'Atilla Çam | Bilgisayar Mühendisi · Yazılım Geliştirici' : 'Atilla Çam | Computer Engineer · Software Developer'
  }, [lang])

  useEffect(() => {
    // WebGL yoksa 3D açılamaz (açılış görünümü store.js'de: adres, tercih ve cihaza göre)
    if (!webgl) setView('classic')
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
      <OverlaySlot />
    </>
  )
}
