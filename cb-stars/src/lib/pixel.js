// Meta (Facebook) Pixel helpers. The pixel id is set by the owner in
// Admin > Settings and loaded on the storefront only.

let loadedId = null

export function isValidPixelId(id) {
  return /^\d{6,20}$/.test(String(id || '').trim())
}

export function initPixel(id) {
  if (typeof window === 'undefined' || !isValidPixelId(id) || loadedId === id) return
  loadedId = id

  if (!window.fbq) {
    const fbq = function () {
      if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments)
      else fbq.queue.push(arguments)
    }
    fbq.push = fbq
    fbq.loaded = true
    fbq.version = '2.0'
    fbq.queue = []
    window.fbq = fbq
    if (!window._fbq) window._fbq = fbq

    const script = document.createElement('script')
    script.async = true
    script.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.appendChild(script)
  }
  window.fbq('init', id)
}

export function trackPixel(event, data) {
  if (typeof window === 'undefined' || !loadedId || !window.fbq) return
  if (data) window.fbq('track', event, data)
  else window.fbq('track', event)
}
