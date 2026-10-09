// Order status lookup. Requires the order number plus either the email it was
// placed with or the private tracking token from the confirmation email.
// Never returns addresses or contact details.
import { serve, json, readJson, str, HttpError, sha256Hex } from '../_shared/http.js'
import { db, must, rateLimit } from '../_shared/db.js'
import { creditsFor } from '../_shared/invoices.js'

const NOT_FOUND = 'We couldn’t find an order with those details. Check your order number and email.'

serve(async req => {
  await rateLimit(req, 'track', { windowSeconds: 3600, max: 30 })
  const body = await readJson(req)
  const orderNumber = str(body.orderNumber, 40).toUpperCase()
  const email = str(body.email, 200).toLowerCase()
  const token = str(body.token, 200)
  if (!orderNumber || (!email && !token)) throw new HttpError(400, 'MISSING_FIELD', 'Enter your order number and email.')

  const order = must(await db.from('shop_orders').select('id, order_number, contact_email, lookup_token_hash, status, payment_status, total_cents, created_at, project_id').eq('order_number', orderNumber).maybeSingle(), 'order')
  if (!order) throw new HttpError(404, 'NOT_FOUND', NOT_FOUND)
  const okEmail = email && order.contact_email.toLowerCase() === email
  const okToken = token && (await sha256Hex(token)) === order.lookup_token_hash
  if (!okEmail && !okToken) throw new HttpError(404, 'NOT_FOUND', NOT_FOUND)

  const items = must(await db.from('shop_order_items').select('qty').eq('order_id', order.id), 'items')
  const inv = must(await db.from('shop_invoices').select('total_cents').eq('order_id', order.id).eq('kind', 'invoice').eq('status', 'issued').order('version', { ascending: false }).limit(1), 'invoice')[0]
  const { creditsCents } = await creditsFor({ orderId: order.id, projectId: order.project_id })
  const shipments = must(await db.from('shop_shipments').select('carrier, tracking_number, tracking_url, dispatched_on, status').eq('order_id', order.id).order('created_at'), 'shipments')
  const total = inv?.total_cents ?? order.total_cents

  return json({
    orderNumber: order.order_number, status: order.status, paymentStatus: order.payment_status, createdAt: order.created_at,
    units: items.reduce((s, i) => s + i.qty, 0), totalCents: total, balanceCents: Math.max(total - creditsCents, 0),
    shipments: shipments.map(s => ({ carrier: s.carrier, trackingNumber: s.tracking_number, trackingUrl: s.tracking_url, dispatchedOn: s.dispatched_on, status: s.status })),
  })
})
