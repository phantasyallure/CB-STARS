import { createClient } from '@supabase/supabase-js'
import { HttpError } from './http.js'

// Service-role client: bypasses row-level security. Server code only —
// never import this from anything under /src.
// `env` is Cloudflare's per-request environment (context.env), set as
// environment variables in the Cloudflare Pages project settings.
export function serviceClient(env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new HttpError(
      500,
      'Server is missing SUPABASE_SERVICE_ROLE_KEY. Add it in Cloudflare Pages > Settings > Environment variables, then redeploy.'
    )
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
