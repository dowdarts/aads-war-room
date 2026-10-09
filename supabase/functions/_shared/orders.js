// Order helpers shared by shop-checkout and shop-private-order.
import { str, HttpError, EMAIL_RE } from './http.js'
import { db, must, getSettings } from './db.js'
import { sendEmail, templates, customerReplyTo } from './email.js'

const DISCOUNT_ERRORS = {
  DISCOUNT_INVALID: 'That discount code isn’t valid.', DISCOUNT_NOT_STARTED: 'That code isn’t active yet.', DISCOUNT_EXPIRED: 'That code has expired.',
  DISCOUNT_RESTRICTED: 'That code is assigned to a different customer.', DISCOUNT_USED_UP: 'That code has been fully used.', DISCOUNT_CUSTOMER_LIMIT: 'You’ve already used this code.',
}

export function readContact(body) {
  const c = body.contact || {}, s = body.shipping || {}
  const contact = { name: str(c.name, 120), email: str(c.email, 200).toLowerCase(), phone: str(c.phone, 40) }
  const shipping = { street: str(s.street, 200), city: str(s.city, 100), province: str(s.province, 60), postal: str(s.postal, 20), country: str(s.country, 60) || 'Canada' }
  if (!contact.name) throw new HttpError(400, 'MISSING_FIELD', 'Enter your full name.')
  if (!EMAIL_RE.test(contact.email)) throw new HttpError(400, 'MISSING_FIELD', 'Enter a valid email address.')
  if (!contact.phone) throw new HttpError(400, 'MISSING_FIELD', 'Enter a phone number.')
  for (const [k, label] of [['street', 'street address'], ['city', 'city'], ['province', 'province'], ['postal', 'postal code']]) {
    if (!shipping[k]) throw new HttpError(400, 'MISSING_FIELD', `Enter your ${label}.`)
  }
  return { contact, shipping, instructions: str(body.instructions, 1000) }
}

export function dbErrorToHttp(error) {
  const code = Object.keys(DISCOUNT_ERRORS).find(k => error?.message?.includes(k))
  if (code) return new HttpError(400, code, DISCOUNT_ERRORS[code])
  if (error?.message?.includes('LINK_INVALID')) return new HttpError(410, 'LINK_INVALID', 'This order link has already been used or is no longer valid.')
  console.error('create order failed', error)
  return new HttpError(500, 'DB_ERROR', 'We couldn’t place your order. Please try again.')
}

export async function orderResponse(orderId, extra = {}) {
  const order = must(await db.from('shop_orders').select('*').eq('id', orderId).single(), 'order')
  const items = must(await db.from('shop_order_items').select('*').eq('order_id', orderId).order('sort_order'), 'items')
  const settings = await getSettings()
  return {
    orderNumber: order.order_number, contactName: order.contact_name, contactEmail: order.contact_email,
    items, pricing: order.pricing_snapshot?.pricing, totalCents: order.total_cents, etransferEmail: settings.etransfer_email, ...extra,
  }
}

export async function notifyNewOrder(orderId, trackingToken) {
  const settings = await getSettings()
  const order = must(await db.from('shop_orders').select('*').eq('id', orderId).single(), 'order')
  const items = must(await db.from('shop_order_items').select('*').eq('order_id', orderId).order('sort_order'), 'items')
  const trackUrl = trackingToken ? `${settings.shop_url}/track?order=${encodeURIComponent(order.order_number)}&t=${trackingToken}` : null
  await Promise.all([
    sendEmail({
      purpose: 'order_received', to: order.contact_email, subject: `Order received — ${order.order_number}`,
      html: templates.orderReceivedCustomer(settings, order, items, trackUrl),
      from: settings.email_from, replyTo: customerReplyTo(settings), dedupeKey: `order_received:${order.order_number}`, orderId,
    }),
    settings.admin_notify_email && sendEmail({
      purpose: 'admin_new_order', to: settings.admin_notify_email, subject: `New order ${order.order_number} — ${order.contact_name}`,
      html: templates.orderReceivedAdmin(settings, order, items), from: settings.email_from_orders || settings.email_from, replyTo: order.contact_email,
      dedupeKey: `admin_new_order:${order.order_number}`, orderId,
    }),
  ])
}
