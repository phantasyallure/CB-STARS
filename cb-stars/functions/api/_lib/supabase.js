import { createClient } from '@supabase/supabase-js'
import { HttpError } from './http.js'

// Service-role client: bypasses row-level security. Server code only —
// never import this from anything under /src.
// `env` is Cloudflare's per-request environment (context.env), set as
// environment variables in the Cloudflare project settings (Settings > Variables and Secrets).
export function serviceClient(env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new HttpError(
      500,
      "Server is missing SUPABASE_SERVICE_ROLE_KEY. Add it in your Cloudflare project's Settings > Variables and Secrets, then redeploy."
    )
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
