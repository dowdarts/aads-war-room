// Central pricing engine for the CGC Darts × MD Studios apparel store.
//
// Single source of truth for every price in the system: the shop frontend
// imports this file (via the `@pricing` Vite alias) for live previews, and the
// shop-* edge functions import it to recompute totals authoritatively before
// anything is written. All money is integer cents — never floats.
//
// Order of operations follows spec §18:
//   1. channel → 2. eligible quantity → 3. base tier → 4. discount (percent OR
//   fixed override, never both) → 5. retail zipper/pocket surcharges →
//   6. custom options at $0 → 7. design fee once + approved revision packages →
//   8. design-fee waiver → 9. shipping + tax → 10. credit verified payments →
//   11. caller snapshots the returned breakdown.

export const RETAIL = Object.freeze({
  tiers: Object.freeze([
    { min: 1, max: 2, unitCents: 8500 },
    { min: 3, max: 6, unitCents: 7000 },
  ]),
  maxQty: 6,
  replicaUnitCents: 9000,
  zipperCents: 200,
  pocketCents: 200,
  defaultFreeShippingMinQty: 3,
})

export const CUSTOM = Object.freeze({
  tiers: Object.freeze([
    { min: 1, max: 2, unitCents: 8500 },
    { min: 3, max: 6, unitCents: 7500 },
    { min: 7, max: 10, unitCents: 6800 },
    { min: 11, max: Infinity, unitCents: 6500 },
  ]),
  designFeeCents: 5000,
  revisionPackageCents: 2500,
  includedRevisionRounds: 2,
  roundsPerPackage: 2,
})

export const SIZES = Object.freeze(['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'])
export const CLOSURES = Object.freeze(['button', 'zipper'])

export const ERR = Object.freeze({
  EMPTY: 'EMPTY',
  RETAIL_MAX_EXCEEDED: 'RETAIL_MAX_EXCEEDED',
  SHIPPING_NOT_CONFIGURED: 'SHIPPING_NOT_CONFIGURED',
  INVALID_LINE: 'INVALID_LINE',
})

function tierUnit(tiers, qty) {
  const t = tiers.find(t => qty >= t.min && qty <= t.max)
  return t ? t.unitCents : null
}

export function retailTierUnitCents(qty) { return tierUnit(RETAIL.tiers, qty) }
export function customTierUnitCents(qty) { return tierUnit(CUSTOM.tiers, qty) }

function isPosInt(n) { return Number.isInteger(n) && n > 0 }
function nonNegInt(n) { return Number.isInteger(n) && n >= 0 ? n : 0 }

/**
 * Whether a discount applies to a given line. A discount with no product /
 * collection restriction applies to every line in its channel.
 */
export function discountAppliesToLine(discount, line) {
  if (!discount) return false
  const prods = discount.productIds || []
  const cols = discount.collectionIds || []
  if (!prods.length && !cols.length) return true
  if (line.productId && prods.includes(line.productId)) return true
  const lineCols = line.collectionIds || []
  return lineCols.some(c => cols.includes(c))
}

/** Applies a percentage OR fixed-unit override to a base unit price. */
function discountedBase(baseCents, discount) {
  if (!discount) return baseCents
  if (discount.kind === 'fixed' && Number.isInteger(discount.fixedUnitCents)) {
    // Fixed price is an override, never a price increase.
    return Math.min(baseCents, discount.fixedUnitCents)
  }
  if (discount.kind === 'percent' && Number.isFinite(discount.percent)) {
    const pct = Math.min(Math.max(discount.percent, 0), 100)
    return Math.round(baseCents * (100 - pct) / 100)
  }
  return baseCents
}

function taxOn(cents, taxRatePercent) {
  const r = Number(taxRatePercent) || 0
  return r > 0 ? Math.round(cents * r / 100) : 0
}

/**
 * Price a retail cart.
 *
 * @param {object} p
 * @param {Array<{key?:string, qty:number, priceClass:'standard'|'replica', closure:'button'|'zipper', pocket:boolean, productId?:string, collectionIds?:string[]}>} p.lines
 * @param {object|null} [p.discount]  { kind:'percent'|'fixed'|null, percent?, fixedUnitCents?, productIds?, collectionIds? }
 * @param {object} [p.settings]       { shippingCents:number|null, freeShippingMinQty?:number, taxRatePercent?:number }
 * @param {number} [p.creditsCents]   verified payments already received
 */
export function priceRetail({ lines = [], discount = null, settings = {}, creditsCents = 0 } = {}) {
  const errors = []
  const qty = lines.reduce((s, l) => s + (isPosInt(l.qty) ? l.qty : 0), 0)
  if (lines.some(l => !isPosInt(l.qty))) errors.push(ERR.INVALID_LINE)
  if (qty === 0) errors.push(ERR.EMPTY)
  if (qty > RETAIL.maxQty) errors.push(ERR.RETAIL_MAX_EXCEEDED)

  const standardUnit = retailTierUnitCents(Math.min(Math.max(qty, 1), RETAIL.maxQty))
  const priced = lines.map(l => {
    const q = isPosInt(l.qty) ? l.qty : 0
    const replica = l.priceClass === 'replica'
    const listBase = replica ? RETAIL.replicaUnitCents : standardUnit
    const applies = discountAppliesToLine(discount, l)
    const base = applies ? discountedBase(listBase, discount) : listBase
    // Replicas are all-in: never zipper/pocket surcharges.
    const zipper = !replica && l.closure === 'zipper' ? RETAIL.zipperCents : 0
    const pocket = !replica && l.pocket ? RETAIL.pocketCents : 0
    const unit = base + zipper + pocket
    return {
      key: l.key ?? null,
      qty: q,
      priceClass: replica ? 'replica' : 'standard',
      listBaseUnitCents: listBase,
      baseUnitCents: base,
      zipperUnitCents: zipper,
      pocketUnitCents: pocket,
      unitCents: unit,
      lineCents: unit * q,
      discountApplied: applies && base !== listBase,
    }
  })

  const listShirtsCents = priced.reduce((s, l) => s + l.listBaseUnitCents * l.qty, 0)
  const shirtsCents = priced.reduce((s, l) => s + l.baseUnitCents * l.qty, 0)
  const surchargesCents = priced.reduce((s, l) => s + (l.zipperUnitCents + l.pocketUnitCents) * l.qty, 0)
  const discountCents = listShirtsCents - shirtsCents

  const freeMin = Number.isInteger(settings.freeShippingMinQty) ? settings.freeShippingMinQty : RETAIL.defaultFreeShippingMinQty
  let shippingCents = 0
  if (qty > 0 && qty < freeMin) {
    if (Number.isInteger(settings.shippingCents) && settings.shippingCents >= 0) shippingCents = settings.shippingCents
    else errors.push(ERR.SHIPPING_NOT_CONFIGURED)
  }

  const subtotalCents = shirtsCents + surchargesCents
  const taxCents = taxOn(subtotalCents + shippingCents, settings.taxRatePercent)
  const totalCents = subtotalCents + shippingCents + taxCents
  const credits = nonNegInt(creditsCents)

  return {
    channel: 'RETAIL',
    ok: errors.length === 0,
    errors,
    qty,
    standardTierUnitCents: standardUnit,
    lines: priced,
    listShirtsCents,
    shirtsCents,
    surchargesCents,
    discountCents,
    designFeeCents: 0,
    designFeeWaivedCents: 0,
    revisionPackagesCents: 0,
    shippingCents,
    taxCents,
    subtotalCents,
    totalCents,
    creditsCents: credits,
    balanceCents: Math.max(totalCents - credits, 0),
  }
}

/**
 * Price a custom/team order (estimate, quote or private final order).
 *
 * Closure/pocket choices are always $0 here. The design fee is part of the
 * project total exactly once; anything already paid (e.g. a design-fee deposit)
 * arrives as `creditsCents`, so it is credited rather than billed twice.
 *
 * @param {object} p
 * @param {number} [p.qty]                       total shirts (estimate) — or pass lines
 * @param {Array<{qty:number}>} [p.lines]
 * @param {number|null} [p.lockedUnitCents]      admin-locked special price (overrides tier)
 * @param {object|null} [p.discount]             { kind, percent?, fixedUnitCents?, waiveDesignFee? }
 * @param {boolean} [p.includeDesignFee=true]    false for re-orders of an existing approved design
 * @param {number} [p.extraRevisionPackages=0]   approved extra 2-round packages
 * @param {object} [p.settings]                  { customShippingCents?, taxRatePercent? }
 * @param {number} [p.creditsCents=0]
 */
export function priceCustom({
  qty,
  lines,
  lockedUnitCents = null,
  discount = null,
  includeDesignFee = true,
  extraRevisionPackages = 0,
  settings = {},
  creditsCents = 0,
} = {}) {
  const errors = []
  let total = 0
  if (Array.isArray(lines)) {
    if (lines.some(l => !isPosInt(l.qty))) errors.push(ERR.INVALID_LINE)
    total = lines.reduce((s, l) => s + (isPosInt(l.qty) ? l.qty : 0), 0)
  } else {
    total = isPosInt(qty) ? qty : 0
  }
  if (total === 0) errors.push(ERR.EMPTY)

  const tierUnit = customTierUnitCents(Math.max(total, 1))
  const listUnit = Number.isInteger(lockedUnitCents) && lockedUnitCents >= 0 ? lockedUnitCents : tierUnit
  // Custom codes are scoped by customer/project (validated server-side), not by product.
  const unit = discountedBase(listUnit, discount)

  const listShirtsCents = listUnit * total
  const shirtsCents = unit * total
  const discountCents = listShirtsCents - shirtsCents

  const designFeeCents = includeDesignFee ? CUSTOM.designFeeCents : 0
  const designFeeWaivedCents = includeDesignFee && discount?.waiveDesignFee ? designFeeCents : 0
  const revisionPackagesCents = nonNegInt(extraRevisionPackages) * CUSTOM.revisionPackageCents

  const shippingCents = nonNegInt(settings.customShippingCents)
  const subtotalCents = shirtsCents + designFeeCents - designFeeWaivedCents + revisionPackagesCents
  const taxCents = taxOn(subtotalCents + shippingCents, settings.taxRatePercent)
  const totalCents = subtotalCents + shippingCents + taxCents
  const credits = nonNegInt(creditsCents)

  return {
    channel: 'CUSTOM',
    ok: errors.length === 0,
    errors,
    qty: total,
    tierUnitCents: tierUnit,
    listUnitCents: listUnit,
    unitCents: unit,
    lockedUnit: listUnit !== tierUnit,
    listShirtsCents,
    shirtsCents,
    surchargesCents: 0,
    discountCents,
    designFeeCents,
    designFeeWaivedCents,
    revisionPackagesCents,
    shippingCents,
    taxCents,
    subtotalCents,
    totalCents,
    creditsCents: credits,
    balanceCents: Math.max(totalCents - credits, 0),
  }
}

/**
 * Combines a project-level arrangement (e.g. admin-waived design fee) with a
 * customer-entered code. The code supplies the single shirt-price adjustment;
 * a fee waiver from either source applies once.
 */
export function mergeDiscounts(projectTerms, codeTerms) {
  if (!projectTerms && !codeTerms) return null
  const base = codeTerms?.kind ? codeTerms : projectTerms || {}
  return { ...base, waiveDesignFee: !!(projectTerms?.waiveDesignFee || codeTerms?.waiveDesignFee) }
}

/** Number of extra 2-round packages required for a given count of requested revision rounds. */
export function revisionPackagesNeeded(roundsUsed) {
  const extra = Math.max(0, (roundsUsed | 0) - CUSTOM.includedRevisionRounds)
  return Math.ceil(extra / CUSTOM.roundsPerPackage)
}

export function formatCents(cents, { currency = true } = {}) {
  const c = Number(cents) || 0
  const s = (Math.abs(c) / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${c < 0 ? '-' : ''}${currency ? '$' : ''}${s}`
}

/** Stable key for a retail cart line so identical configurations merge. */
export function retailLineKey({ productId, variantId = null, size, closure, pocket, personalization = '' }) {
  return [productId, variantId || '-', size, closure, pocket ? 'P' : 'N', (personalization || '').trim().toLowerCase()].join('|')
}
