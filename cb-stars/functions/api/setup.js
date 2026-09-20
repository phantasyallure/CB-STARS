import { allow, body, handle, HttpError, json } from './_lib/http.js'
import { serviceClient } from './_lib/supabase.js'

// One-time creation of the first owner account.
// Instead of a shared secret typed into a public page, setup is gated by an
// allowlist of owner emails set server-side (ADMIN_OWNER_EMAILS). Only those
// exact addresses can ever complete setup, and it refuses to run once an
// owner exists.
export const onRequest = handle(async (context) => {
  allow(context, ['POST'])
  const allowList = String(context.env.ADMIN_OWNER_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (allowList.length === 0) {
    throw new HttpError(500, 'ADMIN_OWNER_EMAILS is not set on the server. Add it in Cloudflare Pages environment variables and redeploy.')
  }

  const { email, password } = await body(context)
  if (!/^\S+@\S+\.\S+$/.test(email || '')) throw new HttpError(400, 'Enter a valid email address.')
  if (!allowList.includes(String(email).trim().toLowerCase())) {
    // Same error as "an owner already exists" so a stranger probing this
    // page can't tell whether their email was rejected or setup is closed.
    throw new HttpError(409, 'Setup is not available for this account.')
  }
  if (!password || password.length < 8) throw new HttpError(400, 'The password needs at least 8 characters.')

  const db = serviceClient(context.env)
  const { count } = await db
    .from('admin_profiles')
    .select('user_id', { count: 'exact', head: true })
    .eq('role', 'owner')
  if (count > 0) throw new HttpError(409, 'Setup is not available for this account.')

  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw new HttpError(400, error.message)

  const { error: profileError } = await db.from('admin_profiles').insert({
    user_id: data.user.id,
    email,
    full_name: '',
    role: 'owner',
    permissions: [],
    active: true,
  })
  if (profileError) {
    await db.auth.admin.deleteUser(data.user.id)
    throw new HttpError(500, 'Could not create the owner profile. Did you run supabase/schema.sql?')
  }

  return json({ ok: true })
})
