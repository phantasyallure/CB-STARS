import { supabase } from './supabaseClient'

// Calls our serverless functions (/api/...) with the admin's session token.
export async function apiFetch(path, { method = 'GET', body } = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const res = await fetch(`/api/${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  let json = null
  try { json = await res.json() } catch { /* not JSON */ }

  if (!res.ok) {
    const err = new Error(json?.error || 'API_UNAVAILABLE')
    err.status = res.status
    err.code = json?.code || (json ? null : 'API_UNAVAILABLE')
    err.data = json
    throw err
  }
  return json
}
