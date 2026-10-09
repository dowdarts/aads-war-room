// Retail checkout. Re-prices the cart from the database with the shared
// pricing engine, reserves any discount code, and writes the order in one
// transaction (shop_create_order). Idempotent on the client's key, so a
// double-submit or network retry returns the same order.
import { serve, json, readJson, str, HttpError, randomToken, sha256Hex } from '../_shared/http.js'
import { db, must, getSettings, pricingSettings, rateLimit } from '../_shared/db.js'
import { validateCode } from '../_shared/discounts.js'
import { loadRetailLines, priceRetailLines, collectionIdsOf } from '../_shared/retail.js'
import { readContact, dbErrorToHttp, orderResponse, notifyNewOrder } from '../_shared/orders.js'
import { ERR } from '../_shared/pricing.js'

serve(async req => {
  await rateLimit(req, 'checkout', { windowSeconds: 3600, max: 20 })
  const body = await readJson(req)
  const idempotencyKey = str(body.idempotencyKey, 100)
  if (idempotencyKey.length < 8) throw new HttpError(400, 'BAD_REQUEST', 'Missing request key — please refresh and try again.')

  // Repeat submit → same order, no new emails.
  const prior = must(await db.from('shop_orders').select('id').eq('idempotency_key', idempotencyKey).maybeSingle(), 'order')
  if (prior) return json(await orderResponse(prior.id, { duplicate: true }))

  const { contact, shipping, instructions } = readContact(body)
  const settings = await getSettings()
  const lines = await loadRetailLines(body.lines)
  const qty = lines.reduce((s, l) => s + l.qty, 0)

  let discount = null
  const code = str(body.discountCode, 60)
  if (code) {
    discount = await validateCode(code, {
      channel: 'RETAIL', email: contact.email, qty,
      lines: lines.map(l => ({ productId: l.productId, collectionIds: collectionIdsOf(l.product) })),
    })
  }

  const { pricing, items } = priceRetailLines(lines, { discount: discount?.terms || null, settings: pricingSettings(settings) })
  if (!pricing.ok) {
    if (pricing.errors.includes(ERR.RETAIL_MAX_EXCEEDED)) throw new HttpError(400, 'TOO_MANY', settings.retail_quote_message || 'Retail orders are limited to 6 shirts.')
    if (pricing.errors.includes(ERR.SHIPPING_NOT_CONFIGURED)) throw new HttpError(400, 'SHIPPING_NOT_SET', 'Shipping for 1–2 shirt orders isn’t available yet. Add a third shirt for free shipping, or contact us.')
    throw new HttpError(400, 'INVALID_CART', 'Please review your cart and try again.')
  }

  const trackingToken = randomToken(24)
  const listByKey = Object.fromEntries(pricing.lines.map(l => [l.key, l.listBaseUnitCents]))
  const { data, error } = await db.rpc('shop_create_order', {
    p: {
      idempotency_key: idempotencyKey, order_type: 'RETAIL', lookup_token_hash: await sha256Hex(trackingToken),
      contact_name: contact.name, contact_email: contact.email, contact_phone: contact.phone,
      ship_street: shipping.street, ship_city: shipping.city, ship_province: shipping.province, ship_postal: shipping.postal, ship_country: shipping.country,
      instructions, discount_code_id: discount?.row.id || null, discount_code: discount ? discount.row.code : null,
      pricing_snapshot: {
        pricing, discount: discount ? { code: discount.row.code, summary: discount.summary, terms: discount.terms } : null,
        items: lines.map(l => ({ key: l.key, list_base_unit_cents: listByKey[l.key] })),
        clientTotalCents: Number.isInteger(body.clientTotalCents) ? body.clientTotalCents : null,
      },
      subtotal_cents: pricing.subtotalCents, discount_cents: pricing.discountCents, design_fee_cents: 0,
      shipping_cents: pricing.shippingCents, tax_cents: pricing.taxCents, total_cents: pricing.totalCents,
      savings_cents: pricing.discountCents, items,
    },
  })
  if (error) throw dbErrorToHttp(error)
  if (!data.duplicate) await notifyNewOrder(data.order_id, trackingToken)
  return json(await orderResponse(data.order_id, { duplicate: !!data.duplicate }))
})
