// Server-side retail cart validation + pricing. Never trusts client prices:
// products, price classes, variants and sizes all come from the database.
import { db, must } from './db.js'
import { HttpError, str } from './http.js'
import { priceRetail, retailLineKey, SIZES, CLOSURES, RETAIL } from './pricing.js'

const bad = msg => { throw new HttpError(400, 'INVALID_CART', msg) }

/** Validates raw cart lines against the catalogue. Returns normalized lines (merged) + product lookup. */
export async function loadRetailLines(rawLines) {
  if (!Array.isArray(rawLines) || rawLines.length === 0) bad('Your cart is empty.')
  if (rawLines.length > 50) bad('Too many cart lines.')
  const productIds = [...new Set(rawLines.map(l => l?.productId).filter(Boolean))]
  const products = must(await db.from('shop_products')
    .select('id, name, slug, status, price_class, personalization, locked_name, sizes, front_image_url, collection_id, shop_collections!shop_products_collection_id_fkey(id, name, parent_id, visible, archived), shop_product_variants(id, colour_name, available, front_image_url)')
    .in('id', productIds), 'Could not load products')
  const byId = Object.fromEntries(products.map(p => [p.id, p]))

  const merged = new Map()
  for (const raw of rawLines) {
    const p = byId[raw?.productId]
    if (!p || p.status !== 'active' || !p.shop_collections?.visible || p.shop_collections?.archived) bad('A shirt in your cart is no longer available. Please remove it and try again.')
    const qty = Number(raw.qty)
    if (!Number.isInteger(qty) || qty < 1 || qty > RETAIL.maxQty) bad('Invalid quantity.')
    if (!SIZES.includes(raw.size) || !p.sizes.includes(raw.size)) bad(`Size ${raw.size} isn’t available for ${p.name}.`)
    if (!CLOSURES.includes(raw.closure)) bad('Choose button or zipper.')
    const variants = p.shop_product_variants || []
    let variant = null
    if (variants.length) {
      variant = variants.find(v => v.id === raw.variantId)
      if (!variant || !variant.available) bad(`Choose an available colour for ${p.name}.`)
    }
    let personalization = ''
    if (p.personalization === 'locked') personalization = p.locked_name || ''
    else if (p.personalization === 'custom') personalization = str(raw.personalization, 24)
    const line = { productId: p.id, variantId: variant?.id || null, size: raw.size, closure: raw.closure, pocket: raw.pocket === true, personalization, qty }
    const key = retailLineKey(line)
    const prev = merged.get(key)
    merged.set(key, prev ? { ...prev, qty: prev.qty + qty } : { ...line, key, product: p, variant })
  }
  return [...merged.values()]
}

export function collectionIdsOf(p) {
  return [p.shop_collections?.id, p.shop_collections?.parent_id].filter(Boolean)
}

/** Prices validated lines and returns pricing + order_items rows. */
export function priceRetailLines(lines, { discount = null, settings }) {
  const pricing = priceRetail({
    lines: lines.map(l => ({ key: l.key, qty: l.qty, priceClass: l.product.price_class, closure: l.closure, pocket: l.pocket, productId: l.productId, collectionIds: collectionIdsOf(l.product) })),
    discount,
    settings,
  })
  const byKey = Object.fromEntries(pricing.lines.map(l => [l.key, l]))
  const items = lines.map(l => {
    const pl = byKey[l.key]
    return {
      product_id: l.productId,
      variant_id: l.variantId,
      product_name: l.product.name,
      collection_name: l.product.shop_collections?.name || null,
      colour: l.variant?.colour_name || null,
      size: l.size,
      closure: l.closure,
      pocket: l.pocket,
      personalization: l.personalization || null,
      price_class: l.product.price_class,
      qty: l.qty,
      base_unit_cents: pl.baseUnitCents,
      zipper_unit_cents: pl.zipperUnitCents,
      pocket_unit_cents: pl.pocketUnitCents,
      unit_cents: pl.unitCents,
      line_cents: pl.lineCents,
      image_url: l.variant?.front_image_url || l.product.front_image_url || null,
    }
  })
  return { pricing, items }
}
