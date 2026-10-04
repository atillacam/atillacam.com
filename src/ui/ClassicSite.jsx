import { profile, projects } from '../content.js'
import { useStore } from '../store.js'
import { useT } from '../i18n.js'
import { AboutContent, ContactContent, CreditsContent, SkillsContent, SocialLinks } from './Sections.jsx'
import { LangSwitch } from './Overlay.jsx'
import { BrandIcon, Icon } from './Icons.jsx'

const YEAR = new Date().getFullYear()

// Hızlı, erişilebilir, arama motoru dostu görünüm. WebGL olmayan cihazlarda da otomatik açılır.
export default function ClassicSite({ webgl }) {
  const { t, L } = useT()
  const setView = useStore((s) => s.setView)
  return (
    <div className="classic">
      <header className="classic-nav">
        <a className="brand" href="#top">
          <span className="monogram small" aria-hidden="true">
            AÇ
          </span>
          <strong>{profile.name}</strong>
        </a>
        <nav aria-label="Sections">
          <a href="#projects">{t('navProjects')}</a>
          <a href="#about">{t('navAbout')}</a>
          <a href="#skills">{t('navSkills')}</a>
          <a href="#contact">{t('navContact')}</a>
        </nav>
        <div className="nav-actions">
          <LangSwitch />
          {webgl && (
            <button className="button small primary" onClick={() => setView('3d')}>
              <Icon name="cube" size={16} /> <span className="hide-sm">{t('back3d')}</span>
            </button>
          )}
        </div>
      </header>

      <main id="top">
        <section className="classic-hero">
          <div className="hero-glow" aria-hidden="true" />
          {profile.available && <p className="badge">{t('openToWork')}</p>}
          <p className="eyebrow">{L(profile.title)} · {L(profile.location)}</p>
          <h1>{profile.name}</h1>
          <p className="lead">{L(profile.tagline)}</p>
          <div className="hero-actions">
            <a className="button primary" href="#projects">
              {t('heroCta')}
            </a>
            <a className="button ghost" href={`mailto:${profile.email}`}>
              <Icon name="mail" size={18} /> {t('heroContact')}
            </a>
            {webgl && (
              <button className="button ghost" onClick={() => setView('3d')}>
                <Icon name="cube" size={18} /> {t('heroWorld')}
              </button>
            )}
          </div>
          <SocialLinks compact />
        </section>

        <section id="projects" className="classic-section">
          <p className="eyebrow">{t('selectedWork')}</p>
          <h2>{t('projects')}</h2>
          <div className="project-grid">
            {projects.map((p) => (
              <article key={p.id} className="project-card" style={{ '--project': p.color }}>
                <span className="project-year">{p.year}</span>
                <h3>{L(p.title)}</h3>
                <p>{L(p.summary)}</p>
                <ul className="bullets small">
                  {L(p.description).map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
                <ul className="chips">
                  {p.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
                {p.link && (
                  <a className="project-link" href={p.link} target="_blank" rel="noreferrer">
                    <BrandIcon id="github" size={16} /> {t('viewCode')} <Icon name="external" size={14} />
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>

        <section id="about" className="classic-section">
          <p className="eyebrow">{t('about')}</p>
          <h2>{L(profile.title)}</h2>
          <div className="prose narrow">
            <AboutContent heading={false} />
          </div>
        </section>

        <section id="skills" className="classic-section">
          <p className="eyebrow">{t('skillsTitle')}</p>
          <h2>{t('skillsLead')}</h2>
          <div className="prose">
            <SkillsContent heading={false} />
          </div>
        </section>

        <section id="contact" className="classic-section contact-section">
          <p className="eyebrow">{t('navContact')}</p>
          <h2>{t('contactTitle')}</h2>
          <div className="prose narrow">
            <ContactContent heading={false} />
          </div>
        </section>

        <section id="credits" className="classic-section">
          <details className="credits-details">
            <summary>{t('credits')}</summary>
            <div className="prose narrow">
              <CreditsContent />
            </div>
          </details>
        </section>
      </main>

      <footer className="classic-footer">
        <span>
          © {YEAR} {profile.name} · {profile.domain}
        </span>
        <span>{t('footer')}</span>
      </footer>
    </div>
  )
}
