const LOCALES = { fr: 'fr-FR', en: 'en-US', ar: 'fr-FR' }

export function formatPrice(price, lang) {
  const amount = Number(price || 0).toLocaleString(LOCALES[lang] || 'fr-FR')
  return lang === 'ar' ? `${amount} دج` : `${amount} DA`
}

export function formatDate(iso, lang) {
  return new Date(iso).toLocaleDateString(LOCALES[lang] || 'fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso, lang) {
  return new Date(iso).toLocaleString(LOCALES[lang] || 'fr-FR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}
