import { allow, body, handle, HttpError, json } from './_lib/http.js'
import { requireAdmin } from './_lib/auth.js'
import { PROVIDERS, loadKeys } from './_lib/providers.js'

// Requires the "nodejs_compat" compatibility flag (for Buffer) — see README.

const MAX_BASE64_CHARS = 5_500_000 // ~4 MB of image
const TIMEOUT_MS = 20_000

const GEMINI_PROMPT =
  'Remove the background from this product photo. Keep the main subject exactly as it is: ' +
  'same shape, colours, texture, details and lighting (if a person is wearing the item, keep the person too). ' +
  'Place it centred on a plain, pure white (#FFFFFF) background. Do not add text, props or extra objects, ' +
  'and do not change the product in any way.'

const OPENAI_PROMPT =
  'Remove the background completely. Keep the main product exactly as it is (shape, colours, texture, ' +
  'details; keep the person if one is wearing it). Fully transparent background, nothing else changed.'

class ProviderError extends Error {
  constructor(kind, message) {
    super(message)
    this.kind = kind // 'limit' | 'invalid_key' | 'error'
  }
}

function classify(status, text = '') {
  const t = text.toLowerCase()
  if (status === 429 || status === 402 || t.includes('quota') || t.includes('resource_exhausted') || t.includes('insufficient') || t.includes('credits')) {
    return 'limit'
  }
  if (status === 401 || status === 403 || t.includes('api key not valid') || t.includes('invalid api key')) {
    return 'invalid_key'
  }
  return 'error'
}

async function failIfNotOk(res) {
  if (res.ok) return
  const text = await res.text().catch(() => '')
  throw new ProviderError(classify(res.status, text), `HTTP ${res.status}`)
}

const ext = (mime) => (mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg')

const runners = {
  async gemini(key, { b64, mime }, env) {
    const model = env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image'
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: GEMINI_PROMPT }, { inline_data: { mime_type: mime, data: b64 } }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    })
    await failIfNotOk(res)
    const j = await res.json()
    const parts = j.candidates?.[0]?.content?.parts || []
    const img = parts.map((p) => p.inlineData || p.inline_data).find((d) => d?.data)
    if (!img) throw new ProviderError('error', 'No image returned')
    return { b64: img.data, mime: img.mimeType || img.mime_type || 'image/png' }
  },

  async openai(key, { b64, mime }, env) {
    const form = new FormData()
    form.append('model', env.OPENAI_IMAGE_MODEL || 'gpt-image-1')
    form.append('image', new Blob([Buffer.from(b64, 'base64')], { type: mime }), `product.${ext(mime)}`)
    form.append('prompt', OPENAI_PROMPT)
    form.append('background', 'transparent')
    form.append('output_format', 'png')
    form.append('quality', 'medium')
    const res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS + 15_000),
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    })
    await failIfNotOk(res)
    const j = await res.json()
    const out = j.data?.[0]?.b64_json
    if (!out) throw new ProviderError('error', 'No image returned')
    return { b64: out, mime: 'image/png' }
  },

  async removebg(key, { b64, mime }) {
    const form = new FormData()
    form.append('image_file', new Blob([Buffer.from(b64, 'base64')], { type: mime }), `product.${ext(mime)}`)
    form.append('size', 'auto')
    form.append('format', 'png')
    const res = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'X-Api-Key': key },
      body: form,
    })
    await failIfNotOk(res)
    return { b64: Buffer.from(await res.arrayBuffer()).toString('base64'), mime: 'image/png' }
  },

  async clipdrop(key, { b64, mime }) {
    const form = new FormData()
    form.append('image_file', new Blob([Buffer.from(b64, 'base64')], { type: mime }), `product.${ext(mime)}`)
    const res = await fetch('https://clipdrop-api.co/remove-background/v1', {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'x-api-key': key },
      body: form,
    })
    await failIfNotOk(res)
    return { b64: Buffer.from(await res.arrayBuffer()).toString('base64'), mime: 'image/png' }
  },
}

export const onRequest = handle(async (context) => {
  allow(context, ['POST'])
  const { db } = await requireAdmin(context, 'products')

  const { image, mime } = await body(context)
  if (!image || typeof image !== 'string') throw new HttpError(400, 'Missing image.')
  if (image.length > MAX_BASE64_CHARS) throw new HttpError(413, 'Image too large. Try a smaller photo.')
  const type = ['image/jpeg', 'image/png', 'image/webp'].includes(mime) ? mime : 'image/jpeg'

  const keys = await loadKeys(db, context.env)
  const configured = PROVIDERS.filter((p) => keys[p.id])
  if (configured.length === 0) {
    throw new HttpError(400, 'no_keys', { code: 'no_keys', tried: [] })
  }

  const tried = []
  for (const p of configured) {
    try {
      const out = await runners[p.id](keys[p.id].key, { b64: image, mime: type }, context.env)
      return json({ image: out.b64, mime: out.mime, provider: p.id, providerLabel: p.label, tried })
    } catch (err) {
      const kind = err instanceof ProviderError ? err.kind : err?.name === 'TimeoutError' ? 'timeout' : 'error'
      tried.push({ provider: p.id, label: p.label, reason: kind })
    }
  }

  throw new HttpError(502, 'all_failed', { code: 'all_failed', tried })
})
