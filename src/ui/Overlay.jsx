import { useEffect, useRef, useState } from 'react'
import { profile } from '../content.js'
import { ACHIEVEMENTS, progressOf, useStore } from '../store.js'
import { AREAS, COLLECTIBLES, RACE, WORLD_HALF } from '../game/layout.js'
import { input, teleport, trigger, vehicleState } from '../game/input.js'
import { initAudio } from '../audio.js'
import { useT } from '../i18n.js'
import { formatTime } from '../format.js'
import { Icon } from './Icons.jsx'
import {
  AboutContent,
  ContactContent,
  ControlsContent,
  CreditsContent,
  LeaderboardContent,
  ProjectContent,
  SkillsContent,
  SocialLinks,
} from './Sections.jsx'

const NONE = []
const isTouchDevice = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

export default function Overlay() {
  const started = useStore((s) => s.started)
  return (
    <>
      {!started && <Intro />}
      {started && <Hud />}
      {started && <Prompt />}
      {started && <RaceHud />}
      {started && <AreaTitle />}
      {started && !isTouchDevice() && <MiniMap />}
      {started && isTouchDevice() && <TouchControls />}
      <MapPanel />
      <AchievementsPanel />
      <LeaderboardPanel />
      <MenuPanel />
      <Modal />
      <Toasts />
    </>
  )
}

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

function Intro() {
  const { t, L } = useT()
  const ready = useStore((s) => s.ready)
  const progress = useStore((s) => s.loadProgress)
  const start = useStore((s) => s.start)
  const setView = useStore((s) => s.setView)
  const button = useRef()

  useEffect(() => {
    if (ready) button.current?.focus()
  }, [ready])

  const begin = () => {
    initAudio()
    start()
  }
  const shown = ready ? 100 : Math.min(Math.round(progress), 99)

  return (
    <div className="intro">
      <div className="intro-top">
        <LangSwitch />
      </div>
      <div className="intro-card">
        <div className="monogram" aria-hidden="true">
          AÇ
        </div>
        <p className="eyebrow">{L(profile.title)}</p>
        <h1>{profile.name}</h1>
        <p className="lead">{L(profile.tagline)}</p>
        {profile.available && <p className="badge">{t('openToWork')}</p>}
        <div className="progress" aria-hidden={ready}>
          <div className="progress-bar" style={{ transform: `scaleX(${shown / 100})` }} />
        </div>
        <button ref={button} className="button primary big" onClick={begin} disabled={!ready}>
          {ready ? t('start') : `${t('loading')} · ${shown}%`}
        </button>
        <button className="link" onClick={() => setView('classic')}>
          {t('classicLink')}
        </button>
        <p className="hint">{isTouchDevice() ? t('hintTouch') : t('hintKeys')}</p>
      </div>
    </div>
  )
}

function Hud() {
  const { t } = useT()
  const muted = useStore((s) => s.muted)
  const night = useStore((s) => s.night)
  const toggleMuted = useStore((s) => s.toggleMuted)
  const toggleDayNight = useStore((s) => s.toggleDayNight)
  const togglePanel = useStore((s) => s.togglePanel)
  const panel = useStore((s) => s.panel)
  const unlockedCount = useStore((s) => Object.keys(s.unlocked).length)
  const cores = useStore((s) => (s.progress.collector ?? NONE).length)
  const { L } = useT()

  return (
    <>
      <header className="hud-brand">
        <span className="monogram small" aria-hidden="true">
          AÇ
        </span>
        <span>
          <strong>{profile.name}</strong>
          <small>{L(profile.title)}</small>
        </span>
      </header>
      <nav className="hud-actions" aria-label={t('menu')}>
        <button onClick={() => togglePanel('map')} title={`${t('map')} (M)`} aria-pressed={panel === 'map'}>
          <Icon name="map" />
          <span className="label">{t('map')}</span>
        </button>
        <button onClick={() => togglePanel('achievements')} title={t('achievements')} aria-pressed={panel === 'achievements'}>
          <Icon name="trophy" />
          <span>
            {unlockedCount}/{ACHIEVEMENTS.length}
          </span>
        </button>
        <button onClick={toggleDayNight} title={`${t('timeOfDay')} (N)`}>
          <Icon name={night ? 'sun' : 'moon'} />
          <span className="label">{night ? t('day') : t('night')}</span>
        </button>
        <button onClick={toggleMuted} title={`${t('sound')} (L)`} aria-pressed={!muted}>
          <Icon name={muted ? 'mute' : 'volume'} />
        </button>
        <button onClick={() => togglePanel('menu')} title={t('menu')} aria-pressed={panel === 'menu'}>
          <Icon name="menu" />
        </button>
      </nav>
      <div className="hud-bottom-left">
        <div className="core-counter" title={t('collected')}>
          <Icon name="cube" size={18} />
          {cores}/{COLLECTIBLES.length}
        </div>
        <SocialLinks compact />
      </div>
    </>
  )
}

function Prompt() {
  const { t, L } = useT()
  const spot = useStore((s) => s.spot)
  const modal = useStore((s) => s.modal)
  const interact = useStore((s) => s.interact)
  if (!spot || modal) return null
  return (
    <button className="prompt" onClick={interact}>
      <kbd>Enter</kbd>
      <span className="prompt-text">
        <strong>{t(spot.action)}</strong>
        <small>{spot.rawLabel ? L(spot.label) : t(spot.label)}</small>
      </span>
    </button>
  )
}

function RaceHud() {
  const { t } = useT()
  const race = useStore((s) => s.race)
  const timer = useRef()
  useEffect(() => {
    if (!race.active) return
    let frame
    const loop = () => {
      if (timer.current) timer.current.textContent = formatTime(performance.now() - race.start)
      frame = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(frame)
  }, [race.active, race.start])

  if (race.countdown) {
    return (
      <div className="countdown" key={race.countdown}>
        {race.countdown}
      </div>
    )
  }
  if (!race.active) return null
  const passed = Math.min(race.next - 1, RACE.checkpoints - 1)
  return (
    <div className="race-hud">
      <span className="race-time" ref={timer}>
        0:00.00
      </span>
      <span className="race-progress">
        <Icon name="flag" size={16} /> {passed}/{RACE.checkpoints - 1}
      </span>
      <button className="link" onClick={() => useStore.getState().cancelRace()}>
        {t('close')}
      </button>
    </div>
  )
}

// Bölgeye girerken beliren başlık kartı (her bölge değişiminde yeniden doğar)
function AreaTitle() {
  const area = useStore((s) => s.area)
  return <AreaTitleCard key={area} id={area} />
}

function AreaTitleCard({ id }) {
  const { t } = useT()
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 2800)
    return () => clearTimeout(timer)
  }, [])
  const def = AREAS.find((a) => a.id === id)
  if (!visible || !def) return null
  return (
    <div className="area-title" style={{ '--area': def.color }}>
      <span className="area-line" />
      <strong>{t(def.label)}</strong>
      <span>{t('sub_' + def.id)}</span>
    </div>
  )
}

// Köşede sürekli görünen mini harita; tıklayınca büyük harita açılır
function MiniMap() {
  const { t } = useT()
  const togglePanel = useStore((s) => s.togglePanel)
  const collected = useStore((s) => s.progress.collector ?? NONE)
  const car = useRef()
  useEffect(() => {
    let frame
    const loop = () => {
      const { x, z } = vehicleState.position
      const deg = (-vehicleState.heading * 180) / Math.PI
      car.current?.setAttribute('transform', `translate(${x} ${z}) rotate(${deg})`)
      frame = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(frame)
  }, [])
  const s = WORLD_HALF
  return (
    <button className="minimap" onClick={() => togglePanel('map')} aria-label={t('openMap')} title={`${t('openMap')} (M)`}>
      <svg viewBox={`${-s} ${-s} ${s * 2} ${s * 2}`}>
        <circle cx="0" cy="0" r={s} className="mm-ground" />
        <circle cx="0" cy="0" r="66" className="mm-ring" />
        <path d="M0 0 V-30 M0 0 H28 M0 0 H-28 M0 0 V66 M-8 8 L-22 22" className="mm-path" />
        {AREAS.map((a) => (
          <circle key={a.id} cx={a.center[0]} cy={a.center[2]} r={Math.max(a.radius * 0.75, 6)} fill={a.color} opacity="0.75" />
        ))}
        {COLLECTIBLES.filter((c) => !collected.includes(c.id)).map((c) => (
          <circle key={c.id} cx={c.x} cy={c.z} r="2.4" className="mm-core" />
        ))}
        <g ref={car}>
          <path d="M7 0 L-5 -5 L-2.5 0 L-5 5 Z" className="mm-car" />
        </g>
      </svg>
      <span className="mm-n">N</span>
    </button>
  )
}

function Modal() {
  const { t } = useT()
  const modal = useStore((s) => s.modal)
  const closeAll = useStore((s) => s.closeAll)
  const dialog = useRef()

  useEffect(() => {
    if (modal) dialog.current?.focus()
  }, [modal])

  if (!modal) return null
  let content = null
  if (modal.type === 'about') content = <AboutContent />
  else if (modal.type === 'skills') content = <SkillsContent />
  else if (modal.type === 'contact') content = <ContactContent />
  else if (modal.type === 'project') content = <ProjectContent id={modal.id} />
  else if (modal.type === 'credits') content = <CreditsContent />
  else content = <ControlsContent />

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && closeAll()}>
      <div className="modal" role="dialog" aria-modal="true" tabIndex={-1} ref={dialog}>
        <button className="icon-button modal-close" onClick={closeAll} aria-label={`${t('close')} (Esc)`}>
          <Icon name="close" />
        </button>
        <div className="prose">{content}</div>
      </div>
    </div>
  )
}

function Toasts() {
  const toasts = useStore((s) => s.toasts)
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.key} className={toast.info ? 'toast info' : 'toast'}>
          <span className="toast-icon">
            <Icon name={toast.info ? 'cube' : 'trophy'} size={20} />
          </span>
          <div>
            <strong>{toast.title}</strong>
            <span>{toast.text}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function Panel({ id, title, children }) {
  const { t } = useT()
  const togglePanel = useStore((s) => s.togglePanel)
  return (
    <div className={`panel panel-${id}`} role="dialog" aria-label={title}>
      <div className="panel-head">
        <h2>{title}</h2>
        <button className="icon-button" onClick={() => togglePanel(id)} aria-label={t('close')}>
          <Icon name="close" size={18} />
        </button>
      </div>
      {children}
    </div>
  )
}

// Harita: canlı araç konumu + bölgelere ışınlanma
function MapPanel() {
  const { t } = useT()
  const open = useStore((s) => s.panel === 'map')
  const togglePanel = useStore((s) => s.togglePanel)
  const visited = useStore((s) => s.progress.explorer ?? NONE)
  const collected = useStore((s) => s.progress.collector ?? NONE)
  const car = useRef()

  useEffect(() => {
    if (!open) return
    let frame
    const loop = () => {
      const { x, z } = vehicleState.position
      const deg = (-vehicleState.heading * 180) / Math.PI
      car.current?.setAttribute('transform', `translate(${x} ${z}) rotate(${deg})`)
      frame = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(frame)
  }, [open])

  if (!open) return null
  const go = (area) => {
    useStore.getState().cancelRace()
    teleport(area.spawn, area.yaw)
    togglePanel('map')
  }
  const s = WORLD_HALF + 4
  return (
    <Panel id="map" title={t('map')}>
      <svg viewBox={`${-s} ${-s} ${s * 2} ${s * 2}`} className="map">
        <rect x={-WORLD_HALF} y={-WORLD_HALF} width={WORLD_HALF * 2} height={WORLD_HALF * 2} rx="10" className="map-ground" />
        <circle cx="0" cy="0" r="66" className="map-ring" />
        <path d="M0 0 V-30 M0 0 H28 M0 0 H-28 M0 0 V66 M-8 8 L-22 22" className="map-path" />
        {COLLECTIBLES.filter((c) => !collected.includes(c.id)).map((c) => (
          <rect key={c.id} x={c.x - 1.6} y={c.z - 1.6} width="3.2" height="3.2" transform={`rotate(45 ${c.x} ${c.z})`} className="map-core" />
        ))}
        {AREAS.map((a) => (
          <g key={a.id} className="map-area" onClick={() => go(a)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go(a)}>
            <circle cx={a.center[0]} cy={a.center[2]} r={Math.max(a.radius, 9)} fill={a.color} opacity={visited.includes(a.id) ? 0.85 : 0.45} />
            <text x={a.center[0]} y={a.center[2]} textAnchor="middle" dominantBaseline="middle">
              {t(a.label)}
            </text>
          </g>
        ))}
        <g ref={car}>
          <path d="M4 0 L-3 -3 L-1.5 0 L-3 3 Z" className="map-car" />
        </g>
      </svg>
      <p className="muted">{t('mapHint')}</p>
    </Panel>
  )
}

function AchievementsPanel() {
  const { t, L } = useT()
  const open = useStore((s) => s.panel === 'achievements')
  const state = useStore()
  if (!open) return null
  return (
    <Panel id="achievements" title={`${t('achievements')} · ${Object.keys(state.unlocked).length}/${ACHIEVEMENTS.length}`}>
      <ul className="achievement-list">
        {ACHIEVEMENTS.map((a) => {
          const done = !!state.unlocked[a.id]
          const p = progressOf(state, a)
          return (
            <li key={a.id} className={done ? 'done' : ''}>
              <span className="achievement-icon">
                <Icon name={done ? 'check' : 'trophy'} size={18} />
              </span>
              <div>
                <strong>{L(a.title)}</strong>
                <span>{L(a.text)}</span>
              </div>
              {p && !done && (
                <span className="achievement-progress">
                  {p.current}/{p.goal}
                </span>
              )}
            </li>
          )
        })}
      </ul>
      <button className="link" onClick={state.resetProgress}>
        {t('resetProgress')}
      </button>
    </Panel>
  )
}

function LeaderboardPanel() {
  const { t } = useT()
  const open = useStore((s) => s.panel === 'leaderboard')
  if (!open) return null
  return (
    <Panel id="leaderboard" title={t('leaderboard')}>
      <LeaderboardContent />
    </Panel>
  )
}

function MenuPanel() {
  const { t } = useT()
  const open = useStore((s) => s.panel === 'menu')
  const quality = useStore((s) => s.quality)
  const setQuality = useStore((s) => s.setQuality)
  const openModal = useStore((s) => s.openModal)
  const togglePanel = useStore((s) => s.togglePanel)
  const setView = useStore((s) => s.setView)
  if (!open) return null
  return (
    <Panel id="menu" title={t('menu')}>
      <div className="menu-row">
        <span>{t('language')}</span>
        <LangSwitch />
      </div>
      <div className="menu-row">
        <span>{t('quality')}</span>
        <div className="lang-switch">
          {['high', 'low'].map((q) => (
            <button key={q} className={quality === q ? 'active' : ''} onClick={() => setQuality(q)} aria-pressed={quality === q}>
              {q === 'high' ? t('qualityHigh') : t('qualityLow')}
            </button>
          ))}
        </div>
      </div>
      <div className="menu-list">
        <button onClick={() => openModal({ type: 'welcome' })}>
          <Icon name="help" /> {t('help')}
        </button>
        <button onClick={() => togglePanel('leaderboard')}>
          <Icon name="flag" /> {t('leaderboard')}
        </button>
        <button onClick={() => openModal({ type: 'about' })}>
          <Icon name="heart" /> {t('about')}
        </button>
        <button onClick={() => openModal({ type: 'contact' })}>
          <Icon name="mail" /> {t('areaContact')}
        </button>
        <button onClick={() => openModal({ type: 'credits' })}>
          <Icon name="cube" /> {t('credits')}
        </button>
        <button onClick={() => setView('classic')}>
          <Icon name="globe" /> {t('classicView')}
        </button>
      </div>
    </Panel>
  )
}

// Mobil: sol altta joystick, sağ altta butonlar
function TouchControls() {
  const { t } = useT()
  const base = useRef()
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const pointer = useRef(null)
  const interact = useStore((s) => s.interact)
  const spot = useStore((s) => s.spot)

  const update = (e) => {
    const rect = base.current.getBoundingClientRect()
    const r = rect.width / 2
    let x = e.clientX - (rect.left + r)
    let y = e.clientY - (rect.top + r)
    const len = Math.hypot(x, y)
    if (len > r) {
      x = (x / len) * r
      y = (y / len) * r
    }
    setKnob({ x, y })
    input.touch.active = true
    input.touch.steer = -x / r
    input.touch.throttle = -y / r
  }
  const end = () => {
    pointer.current = null
    setKnob({ x: 0, y: 0 })
    input.touch.active = false
    input.touch.steer = 0
    input.touch.throttle = 0
  }

  return (
    <div className="touch">
      <div
        ref={base}
        className="joystick"
        onPointerDown={(e) => {
          pointer.current = e.pointerId
          e.currentTarget.setPointerCapture(e.pointerId)
          update(e)
        }}
        onPointerMove={(e) => pointer.current === e.pointerId && update(e)}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div className="joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <div className="touch-buttons">
        {spot && (
          <button className="touch-primary" onClick={interact}>
            {t('tap')}
          </button>
        )}
        <button
          onPointerDown={() => (input.touch.boost = true)}
          onPointerUp={() => (input.touch.boost = false)}
          onPointerCancel={() => (input.touch.boost = false)}
        >
          Turbo
        </button>
        <button onPointerDown={() => trigger('jump')}>{t('jump')}</button>
        <button onPointerDown={() => trigger('respawn')}>{t('reset')}</button>
      </div>
    </div>
  )
}
