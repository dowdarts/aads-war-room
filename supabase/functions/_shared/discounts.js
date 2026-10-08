// Discount-code validation. Final redemption limits are re-checked atomically
// inside the shop_reserve_discount() SQL function when the order is written.
import { db, must } from './db.js'
import { HttpError } from './http.js'
import { formatCents } from './pricing.js'

const fail = message => { throw new HttpError(400, 'DISCOUNT_INVALID', message) }

export function discountTerms(row) {
  return {
    kind: row.kind,
    percent: row.percent != null ? Number(row.percent) : undefined,
    fixedUnitCents: row.fixed_unit_cents ?? undefined,
    waiveDesignFee: !!row.waive_design_fee,
    productIds: row.product_ids || [],
    collectionIds: row.collection_ids || [],
  }
}

export function discountSummary(row) {
  const parts = []
  if (row.kind === 'percent') parts.push(`${Number(row.percent)}% off shirts`)
  if (row.kind === 'fixed') parts.push(`${formatCents(row.fixed_unit_cents)} per shirt`)
  if (row.waive_design_fee) parts.push('design fee waived')
  return `Code applied: ${parts.join(' + ')}.`
}

/**
 * @param {string} code
 * @param {{channel:'RETAIL'|'CUSTOM', customerId?:string|null, email?:string, projectId?:string|null, qty?:number, lines?:Array<{productId:string, collectionIds:string[]}>}} ctx
 */
export async function validateCode(code, ctx) {
  const clean = String(code || '').trim()
  if (!clean) fail('Enter a discount code.')
  const row = must(await db.from('shop_discount_codes').select('*').ilike('code', clean.replace(/[%_\\]/g, '\\$&')).maybeSingle(), 'Could not check code')
  if (!row || row.status !== 'active') fail('That code isn’t valid.')
  const now = Date.now()
  if (row.starts_at && now < Date.parse(row.starts_at)) fail('That code isn’t active yet.')
  if (row.expires_at && now > Date.parse(row.expires_at)) fail('That code has expired.')
  if (row.channel !== 'any' && row.channel !== ctx.channel) fail(row.channel === 'CUSTOM' ? 'That code is only for custom team orders.' : 'That code is only for retail orders.')
  if (row.project_id && row.project_id !== ctx.projectId) fail('That code isn’t valid for this order.')

  let customerId = ctx.customerId || null
  if (!customerId && ctx.email) {
    const c = must(await db.from('shop_customers').select('id').ilike('email', ctx.email.trim()).maybeSingle(), 'Could not check code')
    customerId = c?.id || null
  }
  if (row.customer_id && row.customer_id !== customerId) {
    fail(ctx.email || ctx.customerId ? 'That code is assigned to a different customer.' : 'Enter your email first — this code is assigned to a specific customer.')
  }
  if (row.max_redemptions != null && row.redemption_count >= row.max_redemptions) fail('That code has been fully used.')
  if (row.max_per_customer != null && customerId) {
    const { count } = await db.from('shop_discount_redemptions').select('id', { count: 'exact', head: true }).eq('code_id', row.id).eq('customer_id', customerId)
    if ((count || 0) >= row.max_per_customer) fail('You’ve already used this code.')
  }
  if (row.min_qty != null && (ctx.qty || 0) < row.min_qty) fail(`That code needs at least ${row.min_qty} shirts.`)
  if (row.max_qty != null && (ctx.qty || 0) > row.max_qty) fail(`That code applies to orders of up to ${row.max_qty} shirts.`)

  const terms = discountTerms(row)
  if (ctx.channel === 'RETAIL' && (terms.productIds.length || terms.collectionIds.length) && ctx.lines) {
    const eligible = ctx.lines.some(l => terms.productIds.includes(l.productId) || (l.collectionIds || []).some(c => terms.collectionIds.includes(c)))
    if (!eligible) fail('That code doesn’t apply to the shirts in your cart.')
  }
  if (ctx.channel === 'RETAIL' && !terms.kind) fail('That code only applies to custom design orders.')
  return { row, terms, summary: discountSummary(row) }
}
