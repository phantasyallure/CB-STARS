import crypto from 'node:crypto'
import { allow, body, handle, HttpError } from './_lib/http.js'
import { serviceClient } from './_lib/supabase.js'

// One-time creation of the first owner account.
// Protected by ADMIN_SETUP_KEY (a server-side environment variable) and it
// refuses to run once an owner exists.
export default handle(async (req, res) => {
  allow(req, ['POST'])
  const expected = process.env.ADMIN_SETUP_KEY
  if (!expected) {
    throw new HttpError(500, 'ADMIN_SETUP_KEY is not set on the server. Add it in Vercel environment variables and redeploy.')
  }

  const { email, password, fullName, setupKey } = body(req)
  const a = Buffer.from(String(setupKey || ''))
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new HttpError(403, 'Wrong setup key.')
  }
  if (!/^\S+@\S+\.\S+$/.test(email || '')) throw new HttpError(400, 'Enter a valid email address.')
  if (!password || password.length < 8) throw new HttpError(400, 'The password needs at least 8 characters.')

  const db = serviceClient()
  const { count } = await db
    .from('admin_profiles')
    .select('user_id', { count: 'exact', head: true })
    .eq('role', 'owner')
  if (count > 0) throw new HttpError(409, 'An owner account already exists.')

  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw new HttpError(400, error.message)

  const { error: profileError } = await db.from('admin_profiles').insert({
    user_id: data.user.id,
    email,
    full_name: (fullName || '').trim(),
    role: 'owner',
    permissions: [],
    active: true,
  })
  if (profileError) {
    await db.auth.admin.deleteUser(data.user.id)
    throw new HttpError(500, 'Could not create the owner profile. Did you run supabase/schema.sql?')
  }

  res.status(200).json({ ok: true })
})
