import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fails loudly during dev instead of silently breaking every request.
  console.error(
    'Missing Supabase env vars. Copy .env.example to .env and fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.'
  )
}

// Some mobile networks (and Safari's own networking stack in particular)
// occasionally stall a request indefinitely instead of failing fast — the
// browser never fires an error, so a plain `await fetch(...)` just hangs
// forever with no way to recover. This wraps every Supabase request with a
// hard timeout and a couple of quick retries, so a stalled connection turns
// into "try again" instead of an infinite spinner.
async function resilientFetch(input, init = {}, attempt = 1) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000) // 10s per attempt
  try {
    const res = await fetch(input, { ...init, signal: controller.signal })
    return res
  } catch (err) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 400 * attempt)) // brief backoff
      return resilientFetch(input, init, attempt + 1)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export const supabase = createClient(url || 'http://localhost', anonKey || 'missing', {
  global: { fetch: resilientFetch },
})

export const PRODUCT_IMAGES_BUCKET = 'product-images'
