// Run: node --test supabase/functions/_shared/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { priceRetail, priceCustom, revisionPackagesNeeded, retailLineKey, mergeDiscounts, formatCents, ERR } from './pricing.js'

const ship = { shippingCents: 1500, freeShippingMinQty: 3, taxRatePercent: 0 }
const std = (qty, o = {}) => ({ qty, priceClass: 'standard', closure: 'button', pocket: false, ...o })
const rep = (qty, o = {}) => ({ qty, priceClass: 'replica', closure: 'button', pocket: false, ...o })

// ── Spec §19 ──────────────────────────────────────────────
test('retail 2 button/no pocket = $170 (+ shipping under 3)', () => {
  const r = priceRetail({ lines: [std(2)], settings: ship })
  assert.equal(r.subtotalCents, 17000)
  assert.equal(r.shippingCents, 1500)
  assert.equal(r.totalCents, 18500)
})

test('retail 3 zipper + pocket = $222, free shipping', () => {
  const r = priceRetail({ lines: [std(3, { closure: 'zipper', pocket: true })], settings: ship })
  assert.equal(r.totalCents, 22200)
  assert.equal(r.shippingCents, 0)
  assert.equal(r.surchargesCents, 1200)
})

test('custom 10 standard = $730', () => {
  assert.equal(priceCustom({ qty: 10 }).totalCents, 73000)
})

test('custom 12 standard = $830', () => {
  assert.equal(priceCustom({ qty: 12 }).totalCents, 83000)
})

test('custom 10 fixed $60 + fee waived = $600, saving $130', () => {
  const r = priceCustom({ qty: 10, discount: { kind: 'fixed', fixedUnitCents: 6000, waiveDesignFee: true } })
  assert.equal(r.totalCents, 60000)
  assert.equal(r.discountCents + r.designFeeWaivedCents, 13000)
})

test('custom 10 + one extra revision package = $755', () => {
  assert.equal(priceCustom({ qty: 10, extraRevisionPackages: 1 }).totalCents, 75500)
})

test('custom 10 with $50 already paid = $680 balance', () => {
  const r = priceCustom({ qty: 10, creditsCents: 5000 })
  assert.equal(r.totalCents, 73000)
  assert.equal(r.balanceCents, 68000)
})

test('custom examples table', () => {
  for (const [q, t] of [[1, 13500], [3, 27500], [6, 50000], [8, 59400], [10, 73000], [12, 83000], [24, 161000]]) {
    assert.equal(priceCustom({ qty: q }).totalCents, t, `qty ${q}`)
  }
})

test('custom zipper/pocket never surcharged', () => {
  const r = priceCustom({ lines: [{ qty: 3, closure: 'zipper', pocket: true }, { qty: 7, closure: 'button', pocket: false }] })
  assert.equal(r.qty, 10)
  assert.equal(r.surchargesCents, 0)
  assert.equal(r.totalCents, 73000)
})

// ── Retail tiers & replicas ───────────────────────────────
test('3 retail shirts use $70 base; recalculates on change', () => {
  assert.equal(priceRetail({ lines: [std(1), std(2)], settings: ship }).lines[0].baseUnitCents, 7000)
  assert.equal(priceRetail({ lines: [std(1), std(1)], settings: ship }).lines[0].baseUnitCents, 8500)
})

test('zipper and pocket add exactly $2 each, button/no pocket never subtract', () => {
  const base = priceRetail({ lines: [std(1)], settings: ship }).lines[0].unitCents
  assert.equal(base, 8500)
  assert.equal(priceRetail({ lines: [std(1, { closure: 'zipper' })], settings: ship }).lines[0].unitCents, 8700)
  assert.equal(priceRetail({ lines: [std(1, { pocket: true })], settings: ship }).lines[0].unitCents, 8700)
  assert.equal(priceRetail({ lines: [std(1, { closure: 'zipper', pocket: true })], settings: ship }).lines[0].unitCents, 8900)
})

test('1 replica = $90 + shipping', () => {
  const r = priceRetail({ lines: [rep(1)], settings: ship })
  assert.equal(r.subtotalCents, 9000)
  assert.equal(r.totalCents, 10500)
})

test('replica never gets zipper/pocket surcharges', () => {
  const r = priceRetail({ lines: [rep(1, { closure: 'zipper', pocket: true })], settings: ship })
  assert.equal(r.lines[0].unitCents, 9000)
})

test('replica counts toward tier and free shipping: 1 replica + 2 Elite zipper', () => {
  const r = priceRetail({ lines: [rep(1), std(2, { closure: 'zipper' })], settings: ship })
  assert.equal(r.qty, 3)
  assert.equal(r.shippingCents, 0)
  assert.equal(r.totalCents, 9000 + 2 * 7200)
})

test('7+ retail shirts are rejected', () => {
  const r = priceRetail({ lines: [std(7)], settings: ship })
  assert.equal(r.ok, false)
  assert.ok(r.errors.includes(ERR.RETAIL_MAX_EXCEEDED))
})

test('shipping not configured blocks under-3 orders only', () => {
  assert.ok(priceRetail({ lines: [std(1)], settings: { shippingCents: null } }).errors.includes(ERR.SHIPPING_NOT_CONFIGURED))
  assert.equal(priceRetail({ lines: [std(3)], settings: { shippingCents: null } }).ok, true)
})

// ── Discounts ─────────────────────────────────────────────
test('percent applies to base only, surcharges stay full', () => {
  const r = priceRetail({ lines: [std(3, { closure: 'zipper' })], discount: { kind: 'percent', percent: 10 }, settings: ship })
  assert.equal(r.lines[0].baseUnitCents, 6300)
  assert.equal(r.lines[0].unitCents, 6500)
  assert.equal(r.discountCents, 2100)
})

test('fixed and percent never stack — fixed wins when kind=fixed', () => {
  const r = priceRetail({ lines: [std(3)], discount: { kind: 'fixed', fixedUnitCents: 6000, percent: 50 }, settings: ship })
  assert.equal(r.lines[0].baseUnitCents, 6000)
})

test('restricted discount only touches eligible lines', () => {
  const r = priceRetail({
    lines: [std(2, { productId: 'a' }), std(1, { productId: 'b' })],
    discount: { kind: 'percent', percent: 50, productIds: ['a'] },
    settings: ship,
  })
  assert.equal(r.lines[0].baseUnitCents, 3500)
  assert.equal(r.lines[1].baseUnitCents, 7000)
})

test('percent discount does not touch design fee', () => {
  const r = priceCustom({ qty: 10, discount: { kind: 'percent', percent: 10 } })
  assert.equal(r.designFeeCents, 5000)
  assert.equal(r.totalCents, 61200 + 5000)
})

test('locked custom unit price overrides tier', () => {
  assert.equal(priceCustom({ qty: 12, lockedUnitCents: 6800 }).totalCents, 12 * 6800 + 5000)
})

// ── Helpers ───────────────────────────────────────────────
test('revision packages needed', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(revisionPackagesNeeded), [0, 0, 0, 1, 1, 2])
})

test('line key merges identical configs and separates different ones', () => {
  const a = { productId: 'p', size: 'L', closure: 'zipper', pocket: true, personalization: 'Matt Dow' }
  assert.equal(retailLineKey(a), retailLineKey({ ...a, personalization: ' matt dow ' }))
  assert.notEqual(retailLineKey(a), retailLineKey({ ...a, size: 'XL' }))
})

test('mergeDiscounts keeps one price adjustment and a single fee waiver', () => {
  assert.deepEqual(mergeDiscounts({ waiveDesignFee: true }, { kind: 'percent', percent: 10, waiveDesignFee: false }), { kind: 'percent', percent: 10, waiveDesignFee: true })
  assert.equal(mergeDiscounts(null, null), null)
  const r = priceCustom({ qty: 10, discount: mergeDiscounts({ waiveDesignFee: true }, { kind: 'fixed', fixedUnitCents: 6000 }) })
  assert.equal(r.totalCents, 60000)
})

test('formatCents', () => {
  assert.equal(formatCents(123456), '$1,234.56')
  assert.equal(formatCents(-1400), '-$14.00')
})
