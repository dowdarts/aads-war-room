// Admin authentication for privileged edge-function actions.
import { db } from './db.js'
import { HttpError } from './http.js'

/** Verifies the caller's Supabase Auth JWT and that they're in shop_admins. Returns { id, email }. */
export async function requireAdmin(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in required.')
  const { data, error } = await db.auth.getUser(token)
  if (error || !data?.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in required.')
  const { data: admin } = await db.from('shop_admins').select('user_id, email').eq('user_id', data.user.id).maybeSingle()
  if (!admin) throw new HttpError(403, 'FORBIDDEN', 'Admin access required.')
  return { id: data.user.id, email: admin.email }
}
