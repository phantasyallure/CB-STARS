// Ad pixels: Meta (Facebook) and TikTok. Both ids are set by the owner in
// Admin > Settings and loaded on the storefront only. The rest of the app just
// calls trackPixel('PageView' | 'ViewContent' | 'Purchase', data) with the Meta
// event names; each pixel receives it in its own vocabulary:
//   PageView    -> Meta PageView          | TikTok page()
//   ViewContent -> Meta ViewContent       | TikTok ViewContent
//   Purchase    -> Meta Purchase          | TikTok CompletePayment  (TikTok's purchase event)

let fbId = null
let ttId = null
let ready = false
const pending = [] // events fired before the ids finished loading

export function isValidPixelId(id) {
  return /^\d{6,20}$/.test(String(id || '').trim())
}

// TikTok pixel codes are letters + digits (e.g. 20 characters).
export function isValidTikTokPixelId(id) {
  return /^[A-Za-z0-9]{8,32}$/.test(String(id || '').trim())
}

/* ---------- Meta (Facebook) ---------- */
function loadFacebook(id) {
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

/* ---------- TikTok ---------- */
// The official TikTok base code, written out readably: it queues calls until
// events.js has loaded.
function loadTikTok(id) {
  const t = 'ttq'
  window.TiktokAnalyticsObject = t
  const ttq = (window[t] = window[t] || [])
  if (!ttq.load) {
    ttq.methods = [
      'page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group',
      'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent',
    ]
    ttq.setAndDefer = function (target, method) {
      target[method] = function () {
        target.push([method].concat(Array.prototype.slice.call(arguments, 0)))
      }
    }
    ttq.methods.forEach((m) => ttq.setAndDefer(ttq, m))
    ttq.instance = function (pixel) {
      const inst = ttq._i[pixel] || []
      ttq.methods.forEach((m) => ttq.setAndDefer(inst, m))
      return inst
    }
    ttq.load = function (pixel, options) {
      const src = 'https://analytics.tiktok.com/i18n/pixel/events.js'
      ttq._i = ttq._i || {}
      ttq._i[pixel] = []
      ttq._i[pixel]._u = src
      ttq._t = ttq._t || {}
      ttq._t[pixel] = +new Date()
      ttq._o = ttq._o || {}
      ttq._o[pixel] = options || {}
      const script = document.createElement('script')
      script.type = 'text/javascript'
      script.async = true
      script.src = `${src}?sdkid=${pixel}&lib=${t}`
      document.head.appendChild(script)
    }
  }
  ttq.load(id)
}

const TIKTOK_EVENTS = { ViewContent: 'ViewContent', Purchase: 'CompletePayment' }

// Meta-style data -> TikTok payload ({ contents: [...], content_type, value, currency }).
function toTikTokPayload(data = {}) {
  const qty = Number(data.num_items) || 1
  const value = Number(data.value) || 0
  return {
    contents: (data.content_ids || []).map((contentId) => ({
      content_id: String(contentId),
      content_name: data.content_name,
      quantity: qty,
      price: value / qty,
    })),
    content_type: 'product',
    value,
    currency: data.currency || 'DZD',
  }
}

function send(event, data) {
  if (fbId && window.fbq) {
    if (data) window.fbq('track', event, data)
    else window.fbq('track', event)
  }
  if (ttId && window.ttq) {
    if (event === 'PageView') window.ttq.page()
    else if (TIKTOK_EVENTS[event]) window.ttq.track(TIKTOK_EVENTS[event], toTikTokPayload(data))
  }
}

/* ---------- public API ---------- */

// Called once the ids are known (either may be empty = that pixel is off).
export function initPixels({ fb = '', tiktok = '' } = {}) {
  if (typeof window === 'undefined') return
  const fbClean = String(fb || '').trim()
  const ttClean = String(tiktok || '').trim()
  if (isValidPixelId(fbClean) && fbId !== fbClean) { fbId = fbClean; loadFacebook(fbClean) }
  if (isValidTikTokPixelId(ttClean) && ttId !== ttClean) { ttId = ttClean; loadTikTok(ttClean) }
  ready = true
  // PageView first, then whatever was fired while the ids were still loading
  pending.sort((a, b) => (b[0] === 'PageView') - (a[0] === 'PageView'))
  while (pending.length) {
    const [event, data] = pending.shift()
    send(event, data)
  }
}

export function trackPixel(event, data) {
  if (typeof window === 'undefined') return
  if (!ready) {
    // e.g. a product page fires ViewContent before the pixel ids have been fetched
    if (pending.length < 20) pending.push([event, data])
    return
  }
  send(event, data)
}
