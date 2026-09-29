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

const numOrNull = (v) => (v === null || v === undefined || v === '' ? null : Number(v))

// Reduced price, or null when the product is not on promotion
// (no reduced price, or one that is not actually lower than the normal price).
export function salePriceOf(product) {
  const price = Number(product?.price || 0)
  const sale = numOrNull(product?.sale_price)
  return sale !== null && sale > 0 && sale < price ? sale : null
}

// The price the customer really pays for the product itself.
export function currentPrice(product) {
  return salePriceOf(product) ?? Number(product?.price || 0)
}
