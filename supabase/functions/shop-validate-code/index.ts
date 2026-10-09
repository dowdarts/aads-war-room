// Checks a discount code against a retail cart or a private custom order and
// returns its terms for the live price preview. Checkout re-validates and
// reserves the code atomically, so this is advisory only.
import { serve, json, readJson, str, HttpError } from '../_shared/http.js'
import { rateLimit } from '../_shared/db.js'
import { validateCode } from '../_shared/discounts.js'
import { loadRetailLines, collectionIdsOf } from '../_shared/retail.js'
import { resolvePrivateLink } from '../_shared/private-links.js'

serve(async req => {
  await rateLimit(req, 'validate-code', { windowSeconds: 3600, max: 60 })
  const body = await readJson(req)
  const channel = body.channel === 'CUSTOM' ? 'CUSTOM' : 'RETAIL'

  if (channel === 'RETAIL') {
    const lines = await loadRetailLines(body.lines)
    const qty = lines.reduce((s, l) => s + l.qty, 0)
    const { terms, summary } = await validateCode(body.code, {
      channel, email: str(body.email, 200), qty,
      lines: lines.map(l => ({ productId: l.productId, collectionIds: collectionIdsOf(l.product) })),
    })
    return json({ terms, summary })
  }

  const link = await resolvePrivateLink(str(body.token, 200))
  const qty = Number(body.qty)
  if (!Number.isInteger(qty) || qty < 1) throw new HttpError(400, 'BAD_QTY', 'Add your shirts first.')
  const { terms, summary } = await validateCode(body.code, { channel, customerId: link.customer_id, projectId: link.project_id, qty })
  return json({ terms, summary })
})
