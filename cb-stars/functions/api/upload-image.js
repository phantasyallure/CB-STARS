import { allow, handle, HttpError, json } from './_lib/http.js'
import { requireAdmin } from './_lib/auth.js'

// Saves a product photo in the Cloudflare R2 bucket (binding "IMAGES") and returns its public URL.
// Only admins with the "products" permission can upload. The browser has already shrunk the photo
// (WebP, max 1600 px); we only check type and size here.
//
// Needs, in the Worker's Settings:
//   - R2 bucket binding  IMAGES        (declared in wrangler.toml)
//   - variable           R2_PUBLIC_URL (public address of the bucket, e.g. https://img.cbstars.store)

const MAX_BYTES = 5 * 1024 * 1024
const TYPES = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }

export const onRequest = handle(async (context) => {
  allow(context, ['POST'])
  const { request, env } = context
  await requireAdmin(context, 'products')

  if (!env.IMAGES) throw new HttpError(500, 'Photo storage is not connected: add the R2 binding "IMAGES" to the Worker.')
  const base = String(env.R2_PUBLIC_URL || '').replace(/\/+$/, '')
  if (!base) throw new HttpError(500, 'Missing variable R2_PUBLIC_URL (the public address of the photo bucket).')

  const type = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase()
  const ext = TYPES[type]
  if (!ext) throw new HttpError(415, 'Only WebP, JPEG or PNG photos are accepted.')

  const data = await request.arrayBuffer()
  if (data.byteLength === 0) throw new HttpError(400, 'Empty file.')
  if (data.byteLength > MAX_BYTES) throw new HttpError(413, 'Photo too large (5 MB max).')

  const key = `${crypto.randomUUID()}.${ext}`
  await env.IMAGES.put(key, data, {
    httpMetadata: {
      contentType: type,
      // Photos never change (every upload gets a new name), so browsers and Cloudflare can keep them for a year.
      cacheControl: 'public, max-age=31536000, immutable',
    },
  })
  return json({ url: `${base}/${key}`, key })
})
