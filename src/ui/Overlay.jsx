import { useEffect, useRef, useState } from 'react'
import { profile } from '../content.js'
import { ACHIEVEMENTS, progressOf, useStore } from '../store.js'
import { AREAS, COLLECTIBLES, LAKE, PATHS, RACE, RING_RADIUS, WORLD_HALF } from '../game/layout.js'
import { input, teleport, trigger, vehicleState } from '../game/input.js'
import { initAudio } from '../audio.js'
import { useT } from '../i18n.js'
import { formatTime } from '../format.js'
import { Icon } from './Icons.jsx'
import { CARS, PAINTS } from '../game/cars.js'
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
      {started && <GameHud />}
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

// Hız göstergesi, canlı drift puanı ve futbol sahasında gol sayacı
function GameHud() {
  const { t } = useT()
  const area = useStore((s) => s.area)
  const drift = useStore((s) => s.drift)
  const driftBest = useStore((s) => s.driftBest)
  const goals = useStore((s) => s.soccerSession)
  const pinsDown = useStore((s) => s.pinsDown)
  const speed = useRef()
  const recover = useRef()
  useEffect(() => {
    let frame
    const loop = () => {
      if (speed.current) speed.current.textContent = Math.round(Math.abs(vehicleState.speed) * 3.6)
      if (recover.current) {
        const k = vehicleState.recovering
        recover.current.style.opacity = k > 0.15 ? 1 : 0
        recover.current.style.setProperty('--k', k)
      }
      frame = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(frame)
  }, [])
  return (
    <>
      <div className="speedo" aria-hidden="true">
        <strong ref={speed}>0</strong>
        <span>km/h</span>
      </div>
      {(area === 'drift' || drift.active) && (
        <div className={drift.active ? 'game-hud drift active' : 'game-hud drift'}>
          <span>{t('driftLabel')}</span>
          <strong>{drift.combo}</strong>
          <small>
            {t('driftBest')}: {driftBest}
          </small>
        </div>
      )}
      <div className="recover" ref={recover} aria-hidden="true">
        <span className="recover-ring" />
        {t('recovering')}
      </div>
      {area === 'bowling' && (
        <div className="game-hud bowling">
          <span>🎳 {t('pins')}</span>
          <strong>
            {pinsDown} / 10
          </strong>
        </div>
      )}
      {area === 'soccer' && (
        <div className="game-hud soccer">
          <span>⚽ {t('goals')}</span>
          <strong>{goals}</strong>
        </div>
      )}
    </>
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

// Bölge ikonları (harita ve lejant)
const AREA_ICONS = {
  home: '🏠',
  projects: '💼',
  about: '👤',
  contact: '✉️',
  playground: '🎢',
  lake: '🌊',
  race: '🏁',
  soccer: '⚽',
  drift: '🌀',
  offroad: '🚙',
  lookout: '⛰️',
  bowling: '🎳',
}

// Harita çizimi: büyük harita ve mini harita aynı katmanları kullanır
function MapLayers({ collected, visited, onArea, labels = true, t }) {
  return (
    <>
      <rect x={-WORLD_HALF} y={-WORLD_HALF} width={WORLD_HALF * 2} height={WORLD_HALF * 2} rx="14" className="map-ground" />
      <circle cx="0" cy="0" r="98" className="map-hills" />
      <circle cx="0" cy="0" r={RING_RADIUS} className="map-ring" />
      {PATHS.map((p, i) => (
        <line key={i} x1={p.from[0]} y1={p.from[1]} x2={p.to[0]} y2={p.to[1]} className="map-path" />
      ))}
      <circle cx={LAKE.x} cy={LAKE.z} r={LAKE.radius} className="map-lake" />
      {AREAS.filter((a) => a.id !== 'lake').map((a) => (
        <g
          key={a.id}
          className={onArea ? 'map-area clickable' : 'map-area'}
          onClick={onArea ? () => onArea(a) : undefined}
          role={onArea ? 'button' : undefined}
          tabIndex={onArea ? 0 : undefined}
          onKeyDown={onArea ? (e) => e.key === 'Enter' && onArea(a) : undefined}
        >
          <circle cx={a.center[0]} cy={a.center[2]} r={Math.max(a.radius, 9)} fill={a.color} opacity={visited.includes(a.id) ? 0.9 : 0.45} />
          <circle cx={a.center[0]} cy={a.center[2]} r={Math.max(a.radius, 9)} className="map-area-ring" />
          <text x={a.center[0]} y={a.center[2] - (labels ? 1.5 : 0)} textAnchor="middle" dominantBaseline="middle" className="map-icon">
            {AREA_ICONS[a.id]}
          </text>
          {labels && (
            <text x={a.center[0]} y={a.center[2] + 6.5} textAnchor="middle" dominantBaseline="middle">
              {t(a.label)}
            </text>
          )}
        </g>
      ))}
      {COLLECTIBLES.filter((c) => !collected.includes(c.id)).map((c) => (
        <rect key={c.id} x={c.x - 2} y={c.z - 2} width="4" height="4" transform={'rotate(45 ' + c.x + ' ' + c.z + ')'} className="map-core" />
      ))}
    </>
  )
}

function useCarMarker(ref, active = true) {
  useEffect(() => {
    if (!active) return
    let frame
    const loop = () => {
      const { x, z } = vehicleState.position
      const deg = (-vehicleState.heading * 180) / Math.PI
      ref.current?.setAttribute('transform', 'translate(' + x + ' ' + z + ') rotate(' + deg + ')')
      frame = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(frame)
  }, [ref, active])
}

// Köşede sürekli görünen mini harita: araca odaklı yakın çevre; tıklayınca büyük harita
function MiniMap() {
  const { t } = useT()
  const togglePanel = useStore((s) => s.togglePanel)
  const collected = useStore((s) => s.progress.collector ?? NONE)
  const visited = useStore((s) => s.progress.explorer ?? NONE)
  const svg = useRef()
  const car = useRef()
  useCarMarker(car)
  useEffect(() => {
    let frame
    const loop = () => {
      const { x, z } = vehicleState.position
      const r = 62
      svg.current?.setAttribute('viewBox', x - r + ' ' + (z - r) + ' ' + r * 2 + ' ' + r * 2)
      frame = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(frame)
  }, [])
  return (
    <button className="minimap" onClick={() => togglePanel('map')} aria-label={t('openMap')} title={t('openMap') + ' (M)'}>
      <svg ref={svg} viewBox="-62 -62 124 124">
        <MapLayers collected={collected} visited={visited} labels={false} t={t} />
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

// Büyük harita: tekerlekle yakınlaştır, sürükleyerek kaydır, bölgeye tıklayınca bilgi kartı ve ışınlanma
const FULL_VIEW = { x: 0, y: 0, size: WORLD_HALF * 2 + 8 }

function clampView(v) {
  const size = Math.min(Math.max(v.size, 60), FULL_VIEW.size)
  const lim = FULL_VIEW.size / 2 - size / 2
  return { size, x: Math.min(Math.max(v.x, -lim), lim), y: Math.min(Math.max(v.y, -lim), lim) }
}

function MapPanel() {
  const { t } = useT()
  const open = useStore((s) => s.panel === 'map')
  const togglePanel = useStore((s) => s.togglePanel)
  const visited = useStore((s) => s.progress.explorer ?? NONE)
  const collected = useStore((s) => s.progress.collector ?? NONE)
  const car = useRef()
  const [view, setView] = useState(FULL_VIEW)
  const [selected, setSelected] = useState(null)
  const drag = useRef(null)
  useCarMarker(car, open)

  if (!open) return null
  const go = (area) => {
    useStore.getState().cancelRace()
    teleport(area.spawn, area.yaw)
    setSelected(null)
    togglePanel('map')
  }
  const onWheel = (e) => setView((v) => clampView({ ...v, size: v.size * (e.deltaY > 0 ? 1.15 : 0.87) }))
  const onDown = (e) => (drag.current = { x: e.clientX, y: e.clientY, view, moved: false })
  const onMove = (e) => {
    const d = drag.current
    if (!d) return
    const rect = e.currentTarget.getBoundingClientRect()
    const k = d.view.size / rect.width
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 3) d.moved = true
    setView(clampView({ ...d.view, x: d.view.x - (e.clientX - d.x) * k, y: d.view.y - (e.clientY - d.y) * k }))
  }
  const onUp = () => (drag.current = null)
  const pick = (area) => {
    if (drag.current?.moved) return
    setSelected(area)
  }

  return (
    <Panel id="map" title={t('map')}>
      <div className="map-wrap">
        <svg
          viewBox={view.x - view.size / 2 + ' ' + (view.y - view.size / 2) + ' ' + view.size + ' ' + view.size}
          className="map"
          onWheel={onWheel}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        >
          <MapLayers collected={collected} visited={visited} onArea={pick} t={t} />
          <g ref={car}>
            <path d="M5 0 L-4 -4 L-2 0 L-4 4 Z" className="map-car" />
          </g>
        </svg>
        <div className="map-compass" aria-hidden="true">
          <span>N</span>
        </div>
        <div className="map-tools">
          <button className="icon-button" onClick={() => setView((v) => clampView({ ...v, size: v.size * 0.8 }))} aria-label="+">
            +
          </button>
          <button className="icon-button" onClick={() => setView((v) => clampView({ ...v, size: v.size * 1.25 }))} aria-label="−">
            −
          </button>
          <button
            className="icon-button"
            onClick={() => setView(clampView({ size: 110, x: vehicleState.position.x, y: vehicleState.position.z }))}
            aria-label={t('youAreHere')}
            title={t('youAreHere')}
          >
            <Icon name="gauge" size={16} />
          </button>
        </div>
      </div>
      <div className="map-stats">
        <span>
          🧭 {visited.length}/{AREAS.length} {t('areasLabel')}
        </span>
        <span>
          💠 {collected.length}/{COLLECTIBLES.length}
        </span>
      </div>
      <ul className="map-legend">
        {AREAS.map((a) => (
          <li key={a.id}>
            <button onClick={() => go(a)} title={t('teleport')}>
              <span className="legend-icon" style={{ background: a.color }}>
                {AREA_ICONS[a.id]}
              </span>
              <span className="legend-name">{t(a.label)}</span>
              {visited.includes(a.id) && <span className="legend-check">✓</span>}
            </button>
          </li>
        ))}
      </ul>
      {selected ? (
        <div className="map-card" style={{ '--area': selected.color }}>
          <div>
            <strong>{t(selected.label)}</strong>
            <span>{t('sub_' + selected.id)}</span>
          </div>
          <button className="button small primary" onClick={() => go(selected)}>
            {t('teleport')}
          </button>
        </div>
      ) : (
        <p className="muted">{t('mapZoomHint')}</p>
      )}
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
  const headlights = useStore((s) => s.headlights)
  const cameraMode = useStore((s) => s.cameraMode)
  const weatherMode = useStore((s) => s.weatherMode)
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
      <div className="menu-row">
        <span>{t('headlights')}</span>
        <div className="lang-switch">
          {['auto', 'on', 'off'].map((h) => (
            <button key={h} className={headlights === h ? 'active' : ''} onClick={() => useStore.setState({ headlights: h })} aria-pressed={headlights === h}>
              {t(h === 'auto' ? 'hlAuto' : h === 'on' ? 'hlOn' : 'hlOff')}
            </button>
          ))}
        </div>
      </div>
      <div className="menu-row">
        <span>{t('cameraMode')}</span>
        <div className="lang-switch">
          {['follow', 'chase'].map((c) => (
            <button key={c} className={cameraMode === c ? 'active' : ''} onClick={() => useStore.setState({ cameraMode: c })} aria-pressed={cameraMode === c}>
              {t(c === 'follow' ? 'camFollow' : 'camChase')}
            </button>
          ))}
        </div>
      </div>
      <div className="menu-row">
        <span>{t('weather')}</span>
        <div className="lang-switch">
          {['auto', 'clear', 'rain', 'snow'].map((w) => (
            <button key={w} className={weatherMode === w ? 'active' : ''} onClick={() => useStore.getState().setWeatherMode(w)} aria-pressed={weatherMode === w}>
              {t(w === 'auto' ? 'wAuto' : w === 'clear' ? 'wClear' : w === 'rain' ? 'wRain' : 'wSnow')}
            </button>
          ))}
        </div>
      </div>
      <Garage />
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

// Garaj: araç modeli ve boya rengi
function Garage() {
  const { t, L } = useT()
  const carId = useStore((s) => s.carId)
  const carColor = useStore((s) => s.carColor)
  const setCar = useStore((s) => s.setCar)
  const setCarColor = useStore((s) => s.setCarColor)
  return (
    <div className="garage">
      <h3>{t('garage')}</h3>
      <div className="garage-cars">
        {CARS.map((c) => (
          <button key={c.id} className={carId === c.id ? 'active' : ''} onClick={() => setCar(c.id)} aria-pressed={carId === c.id}>
            {L(c.name)}
          </button>
        ))}
      </div>
      <div className="garage-paints" role="group" aria-label={t('carColor')}>
        {PAINTS.map((p) => (
          <button
            key={p.id}
            className={carColor === p.id ? 'swatch active' : 'swatch'}
            style={{ background: p.hex }}
            onClick={() => setCarColor(p.id)}
            aria-label={p.id}
            aria-pressed={carColor === p.id}
          />
        ))}
      </div>
    </div>
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
