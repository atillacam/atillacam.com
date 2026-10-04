import { useState } from 'react'
import { experience, profile, projects, skills } from '../content.js'
import credits from '../game/credits.json'
import { useT } from '../i18n.js'
import { useStore } from '../store.js'
import { formatTime } from '../format.js'
import { BrandIcon, Icon } from './Icons.jsx'

// 3D dünyadaki pencereler ve klasik görünüm aynı içerik bileşenlerini kullanır

export function AboutContent({ heading = true }) {
  const { t, L } = useT()
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
        {profile.highlights.map((h) => (
          <li key={h.value + h.label.en}>
            <strong>{h.value}</strong>
            <span>{L(h.label)}</span>
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
          ['Ctrl / B', 'Fren'],
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
          ['Ctrl / B', 'Brake'],
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

export function LeaderboardContent() {
  const { t, lang } = useT()
  const times = useStore((s) => s.times)
  return (
    <>
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
