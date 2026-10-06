import { useEffect, useState } from 'react'
import { experience, labExperiments, profile, projects, skills } from '../content.js'
import credits from '../game/credits.json'
import { useT } from '../i18n.js'
import { useStore } from '../store.js'
import { formatTime } from '../format.js'
import { highlights, relativeTime, repoFor } from '../stats.js'
import { BrandIcon, Icon } from './Icons.jsx'
import { vehicleState } from '../game/input.js'
import { LIMITS, ONLINE, fetchScores, postWhisper, savedName, submitScore, submittedBest, whisperCooldown } from '../online.js'

// 3D dünyadaki pencereler ve klasik görünüm aynı içerik bileşenlerini kullanır

export function AboutContent({ heading = true }) {
  const { t, L, lang } = useT()
  return (
    <>
      {heading && (
        <>
          <p className="eyebrow">{t('about')}</p>
          <h2>{profile.name}</h2>
          <p className="lead">
            {L(profile.title)} · {L(profile.location)}
          </p>
        </>
      )}
      {L(profile.about).map((p) => (
        <p key={p}>{p}</p>
      ))}
      <ul className="stats">
        {highlights(lang).map((h) => (
          <li key={h.label} className={h.small ? 'small' : undefined}>
            <strong>{h.value}</strong>
            <span>{h.label}</span>
          </li>
        ))}
      </ul>
      {experience.length > 0 && (
        <>
          <h3>{t('experience')}</h3>
          <ol className="timeline">
            {experience.map((e) => (
              <li key={e.period + e.role}>
                <span className="timeline-period">{e.period}</span>
                <strong>
                  {L(e.role)} — {e.company}
                </strong>
                <span>{L(e.text)}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  )
}

export function SkillsContent({ heading = true }) {
  const { t, L, lang } = useT()
  return (
    <>
      {heading && (
        <>
          <p className="eyebrow">{t('skillsTitle')}</p>
          <h2>{t('skillsLead')}</h2>
        </>
      )}
      <div className="skill-groups">
        {skills.map((g) => (
          <div key={g.group.en} className="skill-group">
            <h3>{L(g.group)}</h3>
            <ul className="chips">
              {(lang === 'en' && g.itemsEn ? g.itemsEn : g.items).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  )
}

export function SocialLinks({ compact = false }) {
  return (
    <ul className={compact ? 'socials compact' : 'socials'}>
      {profile.socials.map((s) => (
        <li key={s.id}>
          <a
            href={s.url}
            target="_blank"
            rel="noreferrer"
            aria-label={s.label}
            className={`social social-${s.id}`}
            onClick={() => useStore.getState().unlock('social')}
          >
            <BrandIcon id={s.id} size={compact ? 18 : 20} />
            {!compact && (
              <span>
                <strong>{s.label}</strong>
                <small>{s.handle}</small>
              </span>
            )}
          </a>
        </li>
      ))}
    </ul>
  )
}

export function EmailButton() {
  const { t } = useT()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(profile.email)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // pano izni yoksa sessizce geç
    }
  }
  return (
    <div className="email-row">
      <a className="button primary" href={`mailto:${profile.email}`}>
        <Icon name="mail" size={18} /> {profile.email}
      </a>
      <button className="button ghost" onClick={copy}>
        <Icon name={copied ? 'check' : 'copy'} size={18} /> {copied ? t('copied') : t('copyEmail')}
      </button>
    </div>
  )
}

export function ContactContent({ heading = true }) {
  const { t } = useT()
  return (
    <>
      {heading && (
        <>
          <p className="eyebrow">{t('areaContact')}</p>
          <h2>{t('contactTitle')}</h2>
        </>
      )}
      {profile.available && <p className="badge">{t('openToWork')}</p>}
      <p className="lead">{t('contactLead')}</p>
      <EmailButton />
      <SocialLinks />
    </>
  )
}

// Proje deposunun GitHub'daki gerçek bilgileri: yıldız, dil, son güncelleme
export function RepoMeta({ link }) {
  const { lang } = useT()
  const repo = repoFor(link)
  if (!repo) return null
  const tr = lang === 'tr'
  return (
    <p className="repo-meta">
      <span title={tr ? 'GitHub yıldızı' : 'GitHub stars'}>★ {repo.stars}</span>
      {repo.language && <span>{repo.language}</span>}
      <span>
        {tr ? 'Güncellendi: ' : 'Updated '}
        {relativeTime(repo.pushedAt, lang)}
      </span>
    </p>
  )
}

export function ProjectContent({ id }) {
  const { t, L } = useT()
  const project = projects.find((p) => p.id === id)
  if (!project) return null
  return (
    <>
      <p className="eyebrow" style={{ color: project.color }}>
        {project.year}
      </p>
      <h2>{L(project.title)}</h2>
      <RepoMeta link={project.link} />
      <p className="lead">{L(project.summary)}</p>
      <ul className="bullets">
        {L(project.description).map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
      <ul className="chips">
        {project.tags.map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>
      {project.link && (
        <a className="button primary" href={project.link} target="_blank" rel="noreferrer">
          <BrandIcon id="github" size={18} /> {t('viewProject')} <Icon name="external" size={16} />
        </a>
      )}
    </>
  )
}

export function ControlsContent() {
  const { t, lang } = useT()
  const rows =
    lang === 'tr'
      ? [
          ['W A S D / Oklar', 'Sür'],
          ['Shift', 'Turbo'],
          ['Boşluk', 'Zıpla'],
          ['Ctrl / B', 'El freni (drift)'],
          ['F', 'Farlar'],
          ['C', 'Kamera modu'],
          ['1 – 5', 'Hidrolik zıplatma'],
          ['Enter / E', 'Etkileşim'],
          ['H', 'Korna'],
          ['R', 'Kurtar / düzelt'],
          ['M', 'Harita ve ışınlanma'],
          ['N', 'Gündüz / gece'],
          ['L', 'Ses'],
          ['Sürükle / Tekerlek', 'Kamera / yakınlaştırma'],
          ['Esc', 'Pencereyi kapat'],
        ]
      : [
          ['W A S D / Arrows', 'Drive'],
          ['Shift', 'Boost'],
          ['Space', 'Jump'],
          ['Ctrl / B', 'Handbrake (drift)'],
          ['F', 'Headlights'],
          ['C', 'Camera mode'],
          ['1 – 5', 'Hydraulics'],
          ['Enter / E', 'Interact'],
          ['H', 'Honk'],
          ['R', 'Reset / unflip'],
          ['M', 'Map & teleport'],
          ['N', 'Day / night'],
          ['L', 'Sound'],
          ['Drag / Wheel', 'Camera / zoom'],
          ['Esc', 'Close window'],
        ]
  return (
    <>
      <p className="eyebrow">{t('spotWelcome')}</p>
      <h2>{t('welcomeTitle')}</h2>
      <p>{t('welcomeText')}</p>
      <h3>{t('controls')}</h3>
      <dl className="controls">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="muted">{t('gamepadHint')}</p>
    </>
  )
}

export function CreditsContent() {
  const { t } = useT()
  return (
    <>
      <p className="eyebrow">{t('credits')}</p>
      <h2>{t('credits')}</h2>
      <p>{t('creditsLead')}</p>
      <ul className="credits">
        {credits.map((c) => (
          <li key={c.key}>
            <a href={c.source} target="_blank" rel="noreferrer">
              {c.title}
            </a>
            <span>{c.author?.replace(/\s*\(.*\)$/, '')}</span>
          </li>
        ))}
      </ul>
      <p className="muted">{t('creditsTech')}</p>
    </>
  )
}

function WorldRanking() {
  const { t } = useT()
  const times = useStore((s) => s.times)
  const carId = useStore((s) => s.carId)
  const [scores, setScores] = useState(null)
  const [state, setState] = useState('loading') // loading | ready | error
  const [name, setName] = useState(savedName)
  const [sent, setSent] = useState(submittedBest)
  const [busy, setBusy] = useState(false)
  const best = times[0]?.ms ?? 0

  const load = () =>
    fetchScores()
      .then((rows) => {
        setScores(rows ?? [])
        setState('ready')
      })
      .catch(() => setState('error'))
  useEffect(() => {
    load()
  }, [])

  const canSubmit = best >= LIMITS.minRaceMs && (!sent || best < sent)
  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      await submitScore({ name, ms: best, car: carId })
      setSent(Math.round(best))
      await load()
    } catch {
      setState('error')
    }
    setBusy(false)
  }

  return (
    <section className="world-ranking">
      <h3>{t('worldRanking')}</h3>
      {state === 'loading' && <p className="muted">{t('fetching')}</p>}
      {state === 'error' && <p className="muted">{t('errorGeneric')}</p>}
      {state === 'ready' && scores.length === 0 && <p className="muted">{t('noWorldScores')}</p>}
      {state === 'ready' && scores.length > 0 && (
        <ol className="leaderboard">
          {scores.map((r, i) => (
            <li key={r.id}>
              <span className="rank">{i + 1}</span>
              <span className="who">{r.name}</span>
              <strong>{formatTime(r.time_ms)}</strong>
            </li>
          ))}
        </ol>
      )}
      {canSubmit && (
        <form className="inline-form" onSubmit={submit}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.name} placeholder={t('yourName')} aria-label={t('yourName')} required />
          <button className="button primary small" disabled={busy || !name.trim()}>
            {busy ? t('sending') : `${t('submitBest')} · ${formatTime(best)}`}
          </button>
        </form>
      )}
      {!canSubmit && sent > 0 && <p className="muted">{t('submitted')}</p>}
    </section>
  )
}

export function LeaderboardContent() {
  const { t, lang } = useT()
  const times = useStore((s) => s.times)
  return (
    <>
      {ONLINE && <WorldRanking />}
      {ONLINE && <h3>{t('yourBest')}</h3>}
      {times.length === 0 ? (
        <p className="muted">{t('raceNoScore')}</p>
      ) : (
        <ol className="leaderboard">
          {times.map((r, i) => (
            <li key={r.at}>
              <span className="rank">{i + 1}</span>
              <strong>{formatTime(r.ms)}</strong>
              <small>{new Date(r.at).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB')}</small>
            </li>
          ))}
        </ol>
      )}
      <p className="muted">{t('raceHint')}</p>
    </>
  )
}

export function WhisperContent() {
  const { t } = useT()
  const [name, setName] = useState(savedName)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState(null) // null | 'sending' | 'error' | 'cooldown'
  const [wait, setWait] = useState(() => whisperCooldown())

  useEffect(() => {
    if (wait <= 0) return
    const id = setTimeout(() => setWait(whisperCooldown()), 1000)
    return () => clearTimeout(id)
  }, [wait])

  const submit = async (e) => {
    e.preventDefault()
    if (status === 'sending' || !name.trim() || !message.trim()) return
    setStatus('sending')
    try {
      const p = vehicleState.position
      const whisper = await postWhisper({ name, message, x: p.x, z: p.z })
      const store = useStore.getState()
      store.addWhisper(whisper)
      store.toast('💬', t('whisperSent'))
      store.closeAll()
    } catch (err) {
      if (err.message === 'cooldown') {
        setWait(whisperCooldown())
        setStatus('cooldown')
      } else setStatus('error')
    }
  }

  return (
    <>
      <p className="eyebrow">{t('whisper')}</p>
      <h2>{t('whisperTitle')}</h2>
      <p>{t('whisperIntro')}</p>
      <form className="whisper-form" onSubmit={submit}>
        <label>
          <span>{t('yourName')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.name} required autoComplete="nickname" />
        </label>
        <label>
          <span>
            {t('message')} <small>{message.length}/{LIMITS.message}</small>
          </span>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={LIMITS.message} rows={3} required />
        </label>
        {status === 'error' && <p className="form-error">{t('errorGeneric')}</p>}
        {wait > 0 && <p className="muted">{t('whisperCooldown').replace('{s}', Math.ceil(wait / 1000))}</p>}
        <button className="button primary" disabled={status === 'sending' || wait > 0 || !name.trim() || !message.trim()}>
          {status === 'sending' ? t('sending') : t('send')}
        </button>
      </form>
      <p className="muted">{ONLINE ? t('whisperPublic') : t('whisperLocal')}</p>
    </>
  )
}

export function LabContent() {
  const { t, L } = useT()
  return (
    <>
      <p className="eyebrow">{t('areaLab')}</p>
      <h2>{t('sub_lab')}</h2>
      <ul className="bullets">
        {labExperiments.map((e) => (
          <li key={e.id}>
            <strong>{L(e.title)}</strong> — {L(e.text)}
          </li>
        ))}
      </ul>
      <p className="muted">Three.js · GLSL · React Three Fiber</p>
    </>
  )
}
