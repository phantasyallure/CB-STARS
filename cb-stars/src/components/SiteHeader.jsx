import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import './SiteHeader.css'

function IconGlobe(props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.4 2.3 3.7 5.2 3.7 8.5s-1.3 6.2-3.7 8.5c-2.4-2.3-3.7-5.2-3.7-8.5S9.6 5.8 12 3.5Z" />
    </svg>
  )
}

const LANGS = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
]

export default function SiteHeader() {
  const { lang, setLang, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onEscape = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  const choose = (code) => {
    setLang(code)
    setOpen(false)
  }

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link to="/" className="site-header__brand" aria-label="CB Stars">
          <span className="signature site-header__mark">CB Stars</span>
        </Link>

        <div className="lang-switch" ref={wrapRef}>
          <button
            type="button"
            className={`lang-switch__trigger ${open ? 'is-open' : ''}`}
            onClick={() => setOpen((v) => !v)}
            aria-label={t('nav.language')}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <IconGlobe />
          </button>

          {open && (
            <ul className="lang-switch__menu" role="listbox">
              {LANGS.map((l) => (
                <li key={l.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={lang === l.code}
                    className={`lang-switch__option ${lang === l.code ? 'is-active' : ''}`}
                    onClick={() => choose(l.code)}
                  >
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </header>
  )
}
