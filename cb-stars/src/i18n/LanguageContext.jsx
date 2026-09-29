import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { translations } from './translations'

const STORAGE_KEY = 'cbstars_lang'
const SUPPORTED = ['fr', 'en', 'ar']
const LanguageContext = createContext(null)

function readInitialLang() {
  if (typeof window === 'undefined') return 'fr'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return SUPPORTED.includes(stored) ? stored : 'fr'
}

function resolve(dict, key) {
  return key.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), dict)
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(readInitialLang)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, lang)
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.title = resolve(translations[lang], 'meta.title') || document.title
  }, [lang])

  const value = useMemo(() => {
    const dict = translations[lang] || translations.fr

    const t = (key, vars) => {
      const raw = resolve(dict, key) ?? resolve(translations.fr, key)
      let str = typeof raw === 'string' ? raw : key
      if (vars) {
        Object.entries(vars).forEach(([name, val]) => {
          str = str.replaceAll(`{${name}}`, val)
        })
      }
      return str
    }

    // Admin panel: French or English inline. Arabic visitors' admin falls back to French.
    const tx = (fr, en) => (lang === 'en' ? en : fr)

    return {
      lang,
      setLang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      t,
      tx,
    }
  }, [lang])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider')
  return ctx
}

export { SUPPORTED as SUPPORTED_LANGS }
