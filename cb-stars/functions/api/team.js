import { allow, body, handle, HttpError, json, query } from './_lib/http.js'
import { requireAdmin } from './_lib/auth.js'
import { ASSIGNABLE_PERMISSIONS } from './_lib/permissions.js'

// Owner-only: list, create, update and remove admin accounts.
export const onRequest = handle(async (context) => {
  const { request } = context
  allow(context, ['GET', 'POST', 'PATCH', 'DELETE'])
  const { db, profile: me } = await requireAdmin(context, 'owner')

  if (request.method === 'GET') {
    const { data: profiles, error } = await db
      .from('admin_profiles')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) throw new HttpError(500, error.message)

    const { data: list } = await db.auth.admin.listUsers({ perPage: 200 })
    const lastSeen = Object.fromEntries((list?.users || []).map((u) => [u.id, u.last_sign_in_at]))
    return json({
      members: profiles.map((p) => ({ ...p, last_sign_in_at: lastSeen[p.user_id] || null })),
    })
  }

  const input = request.method === 'DELETE' ? { userId: query(context).get('userId') } : await body(context)

  if (request.method === 'POST') {
    const { email, password, fullName, permissions } = input
    if (!/^\S+@\S+\.\S+$/.test(email || '')) throw new HttpError(400, 'Enter a valid email address.')
    if (!password || password.length < 8) throw new HttpError(400, 'The password needs at least 8 characters.')
    const perms = cleanPermissions(permissions)

    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw new HttpError(400, error.message)

    const { data: created, error: profileError } = await db
      .from('admin_profiles')
      .insert({
        user_id: data.user.id,
        email,
        full_name: (fullName || '').trim(),
        role: 'staff',
        permissions: perms,
        active: true,
      })
      .select()
      .single()
    if (profileError) {
      await db.auth.admin.deleteUser(data.user.id)
      throw new HttpError(500, profileError.message)
    }
    return json({ member: created }, 201)
  }

  const { userId } = input
  if (!userId) throw new HttpError(400, 'Missing userId.')
  const { data: target } = await db.from('admin_profiles').select('*').eq('user_id', userId).maybeSingle()
  if (!target) throw new HttpError(404, 'Member not found.')

  if (request.method === 'PATCH') {
    const { permissions, active, password, fullName } = input
    const isSelf = target.user_id === me.user_id

    if (target.role === 'owner' && !isSelf) throw new HttpError(403, 'Owner accounts cannot be edited by others.')
    if (isSelf && active === false) throw new HttpError(400, 'You cannot deactivate your own account.')

    if (password !== undefined) {
      if (password.length < 8) throw new HttpError(400, 'The password needs at least 8 characters.')
      const { error } = await db.auth.admin.updateUserById(userId, { password })
      if (error) throw new HttpError(400, error.message)
    }

    const patch = {}
    if (target.role !== 'owner' && permissions !== undefined) patch.permissions = cleanPermissions(permissions)
    if (target.role !== 'owner' && active !== undefined) patch.active = !!active
    if (fullName !== undefined) patch.full_name = String(fullName).trim()

    if (Object.keys(patch).length) {
      const { error } = await db.from('admin_profiles').update(patch).eq('user_id', userId)
      if (error) throw new HttpError(500, error.message)
    }
    return json({ ok: true })
  }

  // DELETE
  if (target.role === 'owner') throw new HttpError(403, 'Owner accounts cannot be removed.')
  const { error } = await db.auth.admin.deleteUser(userId)
  if (error) throw new HttpError(500, error.message)
  return json({ ok: true })
})

function cleanPermissions(list) {
  if (!Array.isArray(list)) return []
  return [...new Set(list.filter((p) => ASSIGNABLE_PERMISSIONS.includes(p)))]
}
