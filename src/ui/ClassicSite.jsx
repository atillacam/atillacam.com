import { useEffect, useRef, useState } from 'react'
import { career, profile, projects, skills } from '../content.js'
import { useStore } from '../store.js'
import { useT } from '../i18n.js'
import { CreditsContent } from './Sections.jsx'
import { LangSwitch } from './Overlay.jsx'
import { BrandIcon, Icon } from './Icons.jsx'

const YEAR = new Date().getFullYear()
const SECTIONS = ['projects', 'about', 'career', 'skills', 'contact']

// Kaydırınca beliren bölümler: görünür olunca "in" sınıfı eklenir (hareket azaltma tercihine CSS uyar)
function useReveal() {
  useEffect(() => {
    const items = document.querySelectorAll('.classic .reveal')
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('in'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          e.target.classList.add('in')
          io.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    items.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

// Menüde, ekranda okunan bölümü işaretle
function useActiveSection() {
  const [active, setActive] = useState(null)
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        // Hero görünürken hiçbir bölüm işaretli olmasın
        if (visible[0]) setActive(visible[0].target.id === 'hero' ? null : visible[0].target.id)
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: [0, 0.25, 0.5] },
    )
    ;['hero', ...SECTIONS].forEach((id) => {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [])
  return active
}

function Nav({ webgl }) {
  const { t } = useT()
  const setView = useStore((s) => s.setView)
  const active = useActiveSection()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const labels = { projects: t('navProjects'), about: t('navAbout'), career: t('c_career'), skills: t('navSkills'), contact: t('navContact') }
  return (
    <header className={scrolled ? 'classic-nav scrolled' : 'classic-nav'}>
      <a className="brand" href="#top" onClick={() => setOpen(false)}>
        <span className="monogram small" aria-hidden="true">
          AÇ
        </span>
        <strong>{profile.name}</strong>
      </a>
      <nav aria-label={t('menu')} className={open ? 'open' : ''}>
        {SECTIONS.map((id) => (
          <a key={id} href={`#${id}`} className={active === id ? 'active' : ''} aria-current={active === id ? 'true' : undefined} onClick={() => setOpen(false)}>
            {labels[id]}
          </a>
        ))}
      </nav>
      <div className="nav-actions">
        <LangSwitch />
        {webgl && (
          <button className="button small primary" onClick={() => setView('3d')}>
            <Icon name="cube" size={16} /> <span className="hide-sm">{t('back3d')}</span>
          </button>
        )}
        <button className="icon-button nav-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? t('close') : t('menu')}>
          <Icon name={open ? 'close' : 'menu'} />
        </button>
      </div>
    </header>
  )
}

// Hero'daki kod kartı: profil bilgileri bir nesne gibi, sözdizimi renkleriyle
function CodeCard() {
  const { L, lang } = useT()
  const focus = lang === 'tr' ? ['Yapay zekâ', 'Backend', '3D web'] : ['AI', 'Backend', '3D web']
  const stack = ['Python', 'TypeScript', 'React', 'Docker']
  const str = (v) => <span className="tok-str">&apos;{v}&apos;</span>
  const list = (arr) => (
    <>
      [
      {arr.map((v, i) => (
        <span key={v}>
          {str(v)}
          {i < arr.length - 1 ? ', ' : ''}
        </span>
      ))}
      ]
    </>
  )
  return (
    <figure className="code-card" aria-label={`${profile.name} · ${L(profile.title)}`}>
      <div className="code-bar" aria-hidden="true">
        <span />
        <span />
        <span />
        <em>atilla.ts</em>
      </div>
      <pre aria-hidden="true">
        <code>
          <span className="tok-key">const</span> <span className="tok-var">atilla</span> = {'{'}
          {'\n  '}role: {str(L(profile.title))},
          {'\n  '}location: {str(L(profile.location))},
          {'\n  '}focus: {list(focus)},
          {'\n  '}stack: {list(stack)},
          {'\n  '}openToWork: <span className="tok-bool">{String(profile.available)}</span>,
          {'\n'}
          {'}'}
          <span className="caret" />
        </code>
      </pre>
    </figure>
  )
}

function Hero({ webgl }) {
  const { t, L } = useT()
  const setView = useStore((s) => s.setView)
  return (
    <section id="hero" className="classic-hero">
      <div className="hero-glow" aria-hidden="true" />
      <div className="hero-copy">
        <div className="hero-meta">
          <img src="/icon-192.png" alt="Atilla Çam - Yazılım Geliştirici" className="hero-avatar" width="56" height="56" loading="eager" />
          {profile.available && <p className="badge">{t('openToWork')}</p>}
        </div>
        <p className="eyebrow">
          {L(profile.title)} · {L(profile.location)}
        </p>
        <h1>{profile.name}</h1>
        <p className="lead">{L(profile.tagline)}</p>
        <div className="hero-actions">
          <a className="button primary" href="#projects">
            {t('heroCta')}
          </a>
          <a className="button ghost" href="#contact">
            <Icon name="mail" size={18} /> {t('heroContact')}
          </a>
          {webgl && (
            <button className="button ghost" onClick={() => setView('3d')}>
              <Icon name="cube" size={18} /> {t('heroWorld')}
            </button>
          )}
        </div>
      </div>
      <CodeCard />
      <ul className="hero-stats">
        {profile.highlights.map((h) => (
          <li key={h.value}>
            <strong>{h.value}</strong>
            <span>{L(h.label)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ProjectCard({ project, index }) {
  const { t, L } = useT()
  const [open, setOpen] = useState(false)
  const id = `project-${project.id}`
  return (
    <article className="project-card reveal" style={{ '--project': project.color, '--delay': `${index * 70}ms` }}>
      <div className="project-head">
        <span className="project-index">{String(index + 1).padStart(2, '0')}</span>
        <span className="project-year">{project.year}</span>
      </div>
      <h3>{L(project.title)}</h3>
      <p>{L(project.summary)}</p>
      <ul className="chips">
        {project.tags.map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>
      <div id={id} className={open ? 'project-details open' : 'project-details'} hidden={!open}>
        <ul className="bullets small">
          {L(project.description).map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </div>
      <div className="project-foot">
        <button className="link-button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id}>
          {open ? t('c_less') : t('c_more')}
          <span className={open ? 'chev up' : 'chev'} aria-hidden="true">
            ⌄
          </span>
        </button>
        {project.link && (
          <a className="project-link" href={project.link} target="_blank" rel="noreferrer">
            <BrandIcon id="github" size={16} /> {t('viewCode')} <Icon name="external" size={14} />
          </a>
        )}
      </div>
    </article>
  )
}

const FOCUS = [
  { icon: '🤖', title: 'c_focusAi', text: 'c_focusAiText' },
  { icon: '⚙️', title: 'c_focusBackend', text: 'c_focusBackendText' },
  { icon: '🧊', title: 'c_focusWeb', text: 'c_focusWebText' },
]

function About() {
  const { t, L } = useT()
  return (
    <section id="about" className="classic-section">
      <header className="section-head reveal">
        <p className="eyebrow">{L(profile.title)}</p>
        <h2>{t('about')}</h2>
      </header>
      <div className="about-grid">
        <div className="about-text reveal">
          {L(profile.about).map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <ul className="focus-list">
          {FOCUS.map((f, i) => (
            <li key={f.title} className="focus-card reveal" style={{ '--delay': `${i * 90}ms` }}>
              <span className="focus-icon" aria-hidden="true">
                {f.icon}
              </span>
              <div>
                <h3>{t(f.title)}</h3>
                <p>{t(f.text)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Career() {
  const { t, L } = useT()
  return (
    <section id="career" className="classic-section">
      <header className="section-head reveal">
        <p className="eyebrow">{t('c_careerLead')}</p>
        <h2>{t('c_career')}</h2>
      </header>
      <ol className="timeline">
        {[...career].reverse().map((m, i) => (
          <li key={i} className="reveal" style={{ '--delay': `${i * 80}ms` }}>
            <span className="timeline-year">{m.year}</span>
            <div className="timeline-body">
              <h3>{L(m.title)}</h3>
              <p>{L(m.text)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Skills() {
  const { t, L, lang } = useT()
  return (
    <section id="skills" className="classic-section">
      <header className="section-head reveal">
        <p className="eyebrow">{t('skillsLead')}</p>
        <h2>{t('skillsTitle')}</h2>
      </header>
      <div className="skill-grid">
        {skills.map((g, i) => (
          <article key={i} className="skill-card reveal" style={{ '--delay': `${i * 70}ms` }}>
            <h3>{L(g.group)}</h3>
            <ul className="chips">
              {(lang === 'en' && g.itemsEn ? g.itemsEn : g.items).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}

function Contact() {
  const { t } = useT()
  const [copied, setCopied] = useState(false)
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(profile.email)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      window.location.href = `mailto:${profile.email}`
    }
  }
  return (
    <section id="contact" className="classic-section">
      <div className="contact-card reveal">
        <div className="contact-glow" aria-hidden="true" />
        <p className="eyebrow">{t('contactTitle')}</p>
        <h2>{t('c_contactHeading')}</h2>
        <p className="lead">{t('c_contactLead')}</p>
        <div className="contact-actions">
          <a className="button primary big" href={`mailto:${profile.email}`}>
            <Icon name="mail" size={18} /> {profile.email}
          </a>
          <button className="button ghost big" onClick={copy} aria-live="polite">
            {copied ? `✓ ${t('c_copied')}` : t('c_copy')}
          </button>
        </div>
        <ul className="contact-socials">
          {profile.socials.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noreferrer" className={`social-pill ${s.id}`}>
                <BrandIcon id={s.id} size={18} />
                <span>
                  <strong>{s.label}</strong>
                  <small>{s.handle}</small>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default function ClassicSite({ webgl }) {
  const { t, L } = useT()
  const setView = useStore((s) => s.setView)
  useReveal()
  return (
    <div className="classic">
      <a className="skip-link" href="#projects">
        {t('c_skip')}
      </a>
      <Nav webgl={webgl} />

      <main id="top">
        <Hero webgl={webgl} />

        <section id="projects" className="classic-section">
          <header className="section-head reveal">
            <p className="eyebrow">{t('selectedWork')}</p>
            <h2>{t('projects')}</h2>
          </header>
          <div className="project-grid">
            {projects.map((p, i) => (
              <ProjectCard key={p.id} project={p} index={i} />
            ))}
          </div>
        </section>

        <About />
        <Career />
        <Skills />
        <Contact />

        <section id="credits" className="classic-section slim">
          <details className="credits-details">
            <summary>{t('credits')}</summary>
            <div className="prose narrow">
              <CreditsContent />
            </div>
          </details>
        </section>
      </main>

      <footer className="classic-footer">
        <div className="footer-brand">
          <span className="monogram small" aria-hidden="true">
            AÇ
          </span>
          <div>
            <strong>{profile.name}</strong>
            <small>
              {L(profile.title)} · {L(profile.location)}
            </small>
          </div>
        </div>
        <nav aria-label="Footer">
          {SECTIONS.map((id) => (
            <a key={id} href={`#${id}`}>
              {id === 'career' ? t('c_career') : t(`nav${id[0].toUpperCase()}${id.slice(1)}`)}
            </a>
          ))}
          {webgl && (
            <button className="link-button" onClick={() => setView('3d')}>
              {t('heroWorld')}
            </button>
          )}
        </nav>
        <div className="footer-bottom">
          <span>
            © {YEAR} {profile.name} · {profile.domain} · {t('footer')}
          </span>
          <a href="#top" className="to-top">
            {t('c_top')} ↑
          </a>
        </div>
      </footer>
    </div>
  )
}
