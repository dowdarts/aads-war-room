// Private approved-design ordering (/custom-order/<token>).
//   action 'get'    → approved front/back art (short-lived signed URLs) + agreed terms
//   action 'submit' → final per-shirt order at custom pricing (options always $0),
//                     design fee once, verified deposits credited, link consumed.
import { serve, json, readJson, str, HttpError, randomToken, sha256Hex } from '../_shared/http.js'
import { db, must, getSettings, pricingSettings, rateLimit, audit } from '../_shared/db.js'
import { resolvePrivateLink } from '../_shared/private-links.js'
import { validateCode } from '../_shared/discounts.js'
import { readContact, dbErrorToHttp, orderResponse, notifyNewOrder } from '../_shared/orders.js'
import { priceCustom, mergeDiscounts, SIZES, CLOSURES } from '../_shared/pricing.js'

async function projectTerms(link, settings) {
  const project = must(await db.from('shop_design_projects').select('*').eq('id', link.project_id).single(), 'project')
  if (!project.approved_at) throw new HttpError(404, 'LINK_INVALID', 'This design hasn’t been approved yet.')
  // Design fee is billed once per design: only the project's first final order carries it.
  const { count } = await db.from('shop_orders').select('id', { count: 'exact', head: true }).eq('project_id', project.id).neq('status', 'cancelled')
  const firstOrder = (count || 0) === 0
  const credits = must(await db.from('shop_payments').select('amount_cents').eq('project_id', project.id).is('order_id', null).eq('status', 'verified'), 'payments')
  const s = pricingSettings(settings)
  return {
    project,
    terms: {
      lockedUnitCents: project.locked_unit_cents,
      includeDesignFee: firstOrder,
      extraRevisionPackages: firstOrder ? project.extra_packages_approved : 0,
      discount: project.design_fee_waived ? { waiveDesignFee: true } : null,
      customShippingCents: s.customShippingCents,
      taxRatePercent: s.taxRatePercent,
      creditsCents: credits.reduce((sum, p) => sum + p.amount_cents, 0),
    },
  }
}

async function signed(fileId) {
  if (!fileId) return null
  const f = must(await db.from('shop_design_files').select('storage_path, mime_type').eq('id', fileId).maybeSingle(), 'file')
  if (!f || f.mime_type === 'image/svg+xml') return null
  const { data } = await db.storage.from('shop-design-files').createSignedUrl(f.storage_path, 3600)
  return data?.signedUrl || null
}

function readLines(raw) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 100) throw new HttpError(400, 'BAD_LINES', 'Add at least one shirt.')
  return raw.map(l => {
    const qty = Number(l?.qty)
    if (!Number.isInteger(qty) || qty < 1 || qty > 500) throw new HttpError(400, 'BAD_LINES', 'Each line needs a quantity.')
    if (!SIZES.includes(l.size)) throw new HttpError(400, 'BAD_LINES', 'Choose a size for each line.')
    if (!CLOSURES.includes(l.closure)) throw new HttpError(400, 'BAD_LINES', 'Choose zipper or button for each line.')
    return { qty, size: l.size, closure: l.closure, pocket: l.pocket === true, personalization: str(l.personalization, 24) }
  })
}

serve(async req => {
  await rateLimit(req, 'private-order', { windowSeconds: 3600, max: 60 })
  const body = await readJson(req)
  const token = str(body.token, 200)
  const settings = await getSettings()

  if (body.action === 'get') {
    const link = await resolvePrivateLink(token)
    const { project, terms } = await projectTerms(link, settings)
    const customer = must(await db.from('shop_customers').select('name, email, phone, team').eq('id', link.customer_id).single(), 'customer')
    return json({
      project: { projectNumber: project.project_number, title: project.title, team: customer.team, description: project.public_description },
      art: { front: await signed(project.approved_front_file_id), back: await signed(project.approved_back_file_id) },
      customer: { name: customer.name, email: customer.email, phone: customer.phone },
      terms,
    })
  }

  if (body.action !== 'submit') throw new HttpError(400, 'BAD_ACTION', 'Unknown action.')
  const idempotencyKey = str(body.idempotencyKey, 100)
  if (idempotencyKey.length < 8) throw new HttpError(400, 'BAD_REQUEST', 'Missing request key — please refresh and try again.')
  const prior = must(await db.from('shop_orders').select('id').eq('idempotency_key', idempotencyKey).maybeSingle(), 'order')
  if (prior) return json(await orderResponse(prior.id, { duplicate: true }))

  const link = await resolvePrivateLink(token)
  const { project, terms } = await projectTerms(link, settings)
  const { contact, shipping, instructions } = readContact(body)
  const lines = readLines(body.lines)
  const qty = lines.reduce((s, l) => s + l.qty, 0)

  let code = null
  if (str(body.discountCode, 60)) code = await validateCode(body.discountCode, { channel: 'CUSTOM', customerId: link.customer_id, projectId: project.id, qty })
  const discount = mergeDiscounts(terms.discount, code?.terms)

  const pricing = priceCustom({
    lines, lockedUnitCents: terms.lockedUnitCents, includeDesignFee: terms.includeDesignFee, extraRevisionPackages: terms.extraRevisionPackages,
    discount, settings: { customShippingCents: terms.customShippingCents, taxRatePercent: terms.taxRatePercent }, creditsCents: terms.creditsCents,
  })
  if (!pricing.ok) throw new HttpError(400, 'BAD_LINES', 'Please check your shirt lines.')

  const items = lines.map(l => ({
    product_name: `Custom — ${project.title}`, collection_name: 'Custom', colour: null, size: l.size, closure: l.closure, pocket: l.pocket,
    personalization: l.personalization || null, price_class: 'custom', qty: l.qty,
    base_unit_cents: pricing.unitCents, zipper_unit_cents: 0, pocket_unit_cents: 0, unit_cents: pricing.unitCents, line_cents: pricing.unitCents * l.qty,
  }))
  const trackingToken = randomToken(24)
  const { data, error } = await db.rpc('shop_create_order', {
    p: {
      idempotency_key: idempotencyKey, order_type: 'CUSTOM', project_id: project.id, private_link_id: link.id, lookup_token_hash: await sha256Hex(trackingToken),
      contact_name: contact.name, contact_email: contact.email, contact_phone: contact.phone, team: '',
      ship_street: shipping.street, ship_city: shipping.city, ship_province: shipping.province, ship_postal: shipping.postal, ship_country: shipping.country,
      instructions, discount_code_id: code?.row.id || null, discount_code: code ? code.row.code : null,
      pricing_snapshot: { pricing, projectTitle: project.title, projectNumber: project.project_number, terms, discount: code ? { code: code.row.code, summary: code.summary, terms: code.terms } : null },
      subtotal_cents: pricing.subtotalCents, discount_cents: pricing.discountCents + pricing.designFeeWaivedCents, design_fee_cents: pricing.designFeeCents,
      shipping_cents: pricing.shippingCents, tax_cents: pricing.taxCents, total_cents: pricing.totalCents,
      savings_cents: pricing.discountCents + pricing.designFeeWaivedCents, items,
    },
  })
  if (error) throw dbErrorToHttp(error)
  if (!data.duplicate) {
    // Move the project's unassigned verified deposits onto this order so they're credited exactly once.
    await db.from('shop_payments').update({ order_id: data.order_id }).eq('project_id', project.id).is('order_id', null).eq('status', 'verified')
    await db.from('shop_design_projects').update({ status: 'final_order_submitted' }).eq('id', project.id)
    await audit({ actorLabel: 'customer', action: 'private_order.submitted', entity: 'shop_design_projects', entityId: project.id, detail: { order: data.order_number } })
    await notifyNewOrder(data.order_id, trackingToken)
  }
  return json(await orderResponse(data.order_id, { duplicate: !!data.duplicate, pricing }))
})
