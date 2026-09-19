import { createClient } from '@supabase/supabase-js'
import { HttpError } from './http.js'

// Service-role client: bypasses row-level security. Server code only —
// never import this from anything under /src.
export function serviceClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new HttpError(
      500,
      'Server is missing SUPABASE_SERVICE_ROLE_KEY. Add it in Vercel > Settings > Environment Variables, then redeploy.'
    )
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
