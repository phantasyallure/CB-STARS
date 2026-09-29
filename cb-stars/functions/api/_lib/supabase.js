import { createClient } from '@supabase/supabase-js'
import { HttpError } from './http.js'

// Service-role client: bypasses row-level security. Server code only —
// never import this from anything under /src.
// `env` is Cloudflare's per-request environment (context.env), set as
// environment variables in the Cloudflare project settings (Settings > Variables and Secrets).
export function serviceClient(env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  const missing = [!url && 'SUPABASE_URL', !key && 'SUPABASE_SERVICE_ROLE_KEY'].filter(Boolean)
  if (missing.length > 0) {
    // On Cloudflare Workers, "Build" variables (used by Vite for the browser) are NOT visible here.
    // These must be set under the Worker's Settings > Variables and Secrets (runtime).
    throw new HttpError(
      500,
      `Server is missing ${missing.join(' and ')}. Add ${missing.length > 1 ? 'them' : 'it'} under your Worker's Settings > Variables and Secrets (the runtime one, not Build), then redeploy.`
    )
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
