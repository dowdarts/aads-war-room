// Private approved-design order links. Only the SHA-256 hash of the token is
// stored, so a database leak can't be turned into working links.
import { db, must } from './db.js'
import { HttpError, sha256Hex } from './http.js'

const GONE = 'This order link is invalid, expired or has already been used. Please contact us for a new link.'

export async function resolvePrivateLink(token, { allowUsed = false } = {}) {
  if (!token || token.length < 30 || token.length > 200) throw new HttpError(404, 'LINK_INVALID', GONE)
  const hash = await sha256Hex(token)
  const link = must(await db.from('shop_private_order_links').select('*').eq('token_hash', hash).maybeSingle(), 'link')
  if (!link || link.revoked) throw new HttpError(404, 'LINK_INVALID', GONE)
  if (link.expires_at && Date.parse(link.expires_at) < Date.now()) throw new HttpError(410, 'LINK_EXPIRED', GONE)
  if (link.used_at && !allowUsed) throw new HttpError(410, 'LINK_USED', 'This order has already been submitted. Check your email for your invoice, or contact us.')
  return link
}
