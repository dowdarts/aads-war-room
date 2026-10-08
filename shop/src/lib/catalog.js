import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'

let cache = null
let inflight = null
const listeners = new Set()

function enrich(collections, products, variants) {
  const colById = Object.fromEntries(collections.map(c => [c.id, c]))
  const vByProduct = {}
  for (const v of variants) (vByProduct[v.product_id] ||= []).push(v)
  const list = products.map(p => {
    const col = colById[p.collection_id] || null
    const parent = col?.parent_id ? colById[col.parent_id] : null
    const vars = (vByProduct[p.id] || []).sort((a, b) => a.sort_order - b.sort_order)
    return {
      ...p,
      collection: col,
      parentCollection: parent,
      collectionIds: [col?.id, parent?.id].filter(Boolean),
      variants: vars,
      image: p.front_image_url || vars[0]?.front_image_url || null,
    }
  }).filter(p => p.collection) // hide products whose collection is hidden
  return {
    collections: collections.sort((a, b) => a.sort_order - b.sort_order),
    products: list,
    productBySlug: Object.fromEntries(list.map(p => [p.slug, p])),
    productById: Object.fromEntries(list.map(p => [p.id, p])),
    collectionBySlug: Object.fromEntries(collections.map(c => [c.slug, c])),
  }
}

export async function loadCatalog({ force = false } = {}) {
  if (cache && !force) return cache
  if (inflight && !force) return inflight
  inflight = (async () => {
    const [c, p, v] = await Promise.all([
      supabase.from('shop_collections').select('*').eq('visible', true).eq('archived', false),
      supabase.from('shop_products').select('*').eq('status', 'active').order('sort_order'),
      supabase.from('shop_product_variants').select('*'),
    ])
    const err = c.error || p.error || v.error
    if (err) throw err
    cache = enrich(c.data, p.data, v.data)
    listeners.forEach(fn => fn(cache))
    return cache
  })()
  try { return await inflight } finally { inflight = null }
}

export function useCatalog() {
  const [state, setState] = useState({ catalog: cache, loading: !cache, error: null })
  useEffect(() => {
    const fn = catalog => setState({ catalog, loading: false, error: null })
    listeners.add(fn)
    if (!cache) loadCatalog().catch(error => setState({ catalog: null, loading: false, error }))
    return () => listeners.delete(fn)
  }, [])
  return state
}

/** Child collections of a parent (or top-level when parentId is null). */
export function childCollections(collections, parentId = null) {
  return collections.filter(c => (c.parent_id || null) === parentId)
}

/** Products in a collection, including its subcollections. */
export function productsInCollection(catalog, collection) {
  return catalog.products.filter(p => p.collectionIds.includes(collection.id))
}

export function searchProducts(products, q) {
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return products
  return products.filter(p => {
    const hay = [p.name, p.description, p.category, p.style_keywords, p.collection?.name, p.parentCollection?.name,
      p.locked_name, ...p.variants.map(v => v.colour_name)].filter(Boolean).join(' ').toLowerCase()
    return terms.every(t => hay.includes(t))
  })
}
