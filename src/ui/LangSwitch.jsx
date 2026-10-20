import { useStore } from '../store.js'

// TR / EN düğmeleri (hem 3D arayüzde hem klasik görünümde)
export function LangSwitch() {
  const lang = useStore((s) => s.lang)
  const setLang = useStore((s) => s.setLang)
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      {['tr', 'en'].map((l) => (
        <button key={l} className={lang === l ? 'active' : ''} onClick={() => setLang(l)} aria-pressed={lang === l}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
