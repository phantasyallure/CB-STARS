import { HttpError } from './http.js'
import { serviceClient } from './supabase.js'

// Checks the caller's Supabase session token and returns their admin profile.
//   need = undefined  → any active admin
//   need = 'owner'    → owners only
//   need = 'products' → owners, or staff who were given that permission
export async function requireAdmin(context, need) {
  const header = context.request.headers.get('Authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) throw new HttpError(401, 'Please sign in again.')

  const db = serviceClient(context.env)
  const { data, error } = await db.auth.getUser(token)
  if (error || !data?.user) throw new HttpError(401, 'Your session has expired. Please sign in again.')

  const { data: profile } = await db
    .from('admin_profiles')
    .select('*')
    .eq('user_id', data.user.id)
    .maybeSingle()

  if (!profile || !profile.active) throw new HttpError(403, 'This account has no admin access.')

  const isOwner = profile.role === 'owner'
  if (need === 'owner' && !isOwner) throw new HttpError(403, 'Only the owner can do this.')
  if (need && need !== 'owner' && !isOwner && !profile.permissions.includes(need)) {
    throw new HttpError(403, 'You do not have permission to do this.')
  }
  return { db, user: data.user, profile }
}
