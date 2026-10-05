import { useId } from 'react'
import { siGithub, siInstagram } from 'simple-icons'
import { C_STROKE, GLYPH, GLYPH_SHIFT_Y, LOGO_COLORS } from '../../scripts/logo.mjs'

// AÇ logosu ("Monolit"): favicon ve uygulama ikonlarıyla aynı vektör çizim (scripts/logo.mjs)
export function Logo({ size = 38, className = 'logo' }) {
  const id = useId().replace(/:/g, '')
  const { from, to, bgTop, bgBottom } = LOGO_COLORS
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}ink`} gradientUnits="userSpaceOnUse" x1="8" y1="14" x2="56" y2="52">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={bgTop} />
          <stop offset="1" stopColor={bgBottom} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${id}bg)`} />
      <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="13.25" fill="none" stroke={`url(#${id}ink)`} strokeOpacity="0.55" strokeWidth="1.5" />
      <g transform={`translate(0 ${GLYPH_SHIFT_Y})`}>
        <path fill={`url(#${id}ink)`} fillRule="evenodd" d={GLYPH.a} />
        <path fill="none" stroke={`url(#${id}ink)`} strokeWidth={C_STROKE} d={GLYPH.c} />
        <path fill={`url(#${id}ink)`} d={GLYPH.cedilla} />
      </g>
    </svg>
  )
}

const LINKEDIN =
  'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z'

const BRAND = { github: siGithub.path, linkedin: LINKEDIN, instagram: siInstagram.path }

export function BrandIcon({ id, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={BRAND[id]} />
    </svg>
  )
}

// Basit çizgi ikonlar (24×24, currentColor)
const STROKES = {
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14',
  trophy: 'M8 21h8m-4-4v4m-5-17h10v5a5 5 0 0 1-10 0V4Zm10 2h3a3 3 0 0 1-3 3M7 6H4a3 3 0 0 0 3 3',
  flag: 'M5 21V4m0 0h11l-2 4 2 4H5',
  sun: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
  volume: 'M11 5 6 9H3v6h3l5 4V5Zm4.5 3.5a5 5 0 0 1 0 7m2.5-10a9 9 0 0 1 0 13',
  mute: 'M11 5 6 9H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
  help: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3m.1 4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0 0c2.5-2.6 4-6.2 4-10S14.5 4.6 12 2m0 20c-2.5-2.6-4-6.2-4-10S9.5 4.6 12 2M2.5 9h19m-19 6h19',
  mail: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm0 1 8 7 8-7',
  external: 'M14 4h6v6m0-6-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  copy: 'M9 9h10v11H9V9Zm-4 6H4V4h11v1',
  whisper: 'M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 20.5l1.4-5A8.5 8.5 0 1 1 21 11.5ZM8.5 11.5h.01m3.49 0h.01m3.49 0h.01',
  cube: 'm12 2 9 5v10l-9 5-9-5V7l9-5Zm0 0v20m9-15-9 5-9-5',
  gauge: 'M12 14l4-4M3.3 17a9 9 0 1 1 17.4 0',
  heart: 'M12 20s-7-4.5-9.3-9A5 5 0 0 1 12 6a5 5 0 0 1 9.3 5C19 15.5 12 20 12 20Z',
  check: 'M5 12l5 5 9-10',
}

export function Icon({ name, size = 20, strokeWidth = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={STROKES[name]} />
    </svg>
  )
}
