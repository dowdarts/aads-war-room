import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCatalog, searchProducts } from '../lib/catalog.js'
import { ProductCard, Loading, ErrorState, PageTitle, fromPrice } from '../components/ui.jsx'
import { SIZES } from '@pricing'

const SORTS = { featured: 'Featured', az: 'A–Z', za: 'Z–A', price_asc: 'Price: low to high', price_desc: 'Price: high to low', newest: 'Newest' }

export function sortProducts(list, sort) {
  const l = [...list]
  switch (sort) {
    case 'az': return l.sort((a, b) => a.name.localeCompare(b.name))
    case 'za': return l.sort((a, b) => b.name.localeCompare(a.name))
    case 'price_asc': return l.sort((a, b) => fromPrice(a) - fromPrice(b) || a.name.localeCompare(b.name))
    case 'price_desc': return l.sort((a, b) => fromPrice(b) - fromPrice(a) || a.name.localeCompare(b.name))
    case 'newest': return l.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    default: return l.sort((a, b) => (b.featured - a.featured) || (a.collection?.sort_order - b.collection?.sort_order) || (a.sort_order - b.sort_order))
  }
}

export default function ShopAll() {
  const { catalog, loading, error } = useCatalog()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const col = params.get('collection') || ''
  const colour = params.get('colour') || ''
  const cat = params.get('category') || ''
  const size = params.get('size') || ''
  const sort = params.get('sort') || 'featured'

  const set = (k, v) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v); else next.delete(k)
    setParams(next, { replace: true })
  }

  const options = useMemo(() => {
    if (!catalog) return { colours: [], categories: [] }
    const colours = [...new Set(catalog.products.flatMap(p => p.variants.map(v => v.colour_name)))].sort()
    const categories = [...new Set(catalog.products.map(p => p.category).filter(Boolean))].sort()
    return { colours, categories }
  }, [catalog])

  const results = useMemo(() => {
    if (!catalog) return []
    let list = searchProducts(catalog.products, q)
    if (col) { const c = catalog.collectionBySlug[col]; list = c ? list.filter(p => p.collectionIds.includes(c.id)) : [] }
    if (colour) list = list.filter(p => p.variants.some(v => v.colour_name === colour && v.available))
    if (cat) list = list.filter(p => p.category === cat)
    if (size) list = list.filter(p => p.sizes.includes(size))
    return sortProducts(list, sort)
  }, [catalog, q, col, colour, cat, size, sort])

  return (
    <div>
      <PageTitle eyebrow="Shop" title={q ? `Results for “${q}”` : 'All shirts'} />
      {loading && <Loading />}
      {error && <ErrorState error={error} />}
      {catalog && <>
        <div className="card mb-6 grid grid-cols-2 gap-3 p-3 sm:p-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <label className="label" htmlFor="f-q">Search</label>
            <input id="f-q" className="input" type="search" value={q} placeholder="Name, colour, style…" onChange={e => set('q', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="f-col">Collection</label>
            <select id="f-col" className="select" value={col} onChange={e => set('collection', e.target.value)}>
              <option value="">All</option>
              {catalog.collections.map(c => <option key={c.id} value={c.slug}>{c.parent_id ? '— ' : ''}{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-colour">Colour</label>
            <select id="f-colour" className="select" value={colour} onChange={e => set('colour', e.target.value)}>
              <option value="">Any</option>
              {options.colours.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-cat">Category</label>
            <select id="f-cat" className="select" value={cat} onChange={e => set('category', e.target.value)}>
              <option value="">Any</option>
              {options.categories.map(c => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-size">Size</label>
            <select id="f-size" className="select" value={size} onChange={e => set('size', e.target.value)}>
              <option value="">Any</option>
              {SIZES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-sort">Sort</label>
            <select id="f-sort" className="select" value={sort} onChange={e => set('sort', e.target.value)}>
              {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="mb-3 text-sm text-muted">{results.length} shirt{results.length === 1 ? '' : 's'}</div>
        {results.length === 0
          ? <div className="card p-10 text-center text-muted">No shirts match those filters.</div>
          : <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">{results.map(p => <ProductCard key={p.id} product={p} />)}</div>}
      </>}
    </div>
  )
}
