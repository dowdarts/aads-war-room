import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCatalog, childCollections, productsInCollection } from '../lib/catalog.js'
import { ProductCard, ProductImage, Loading, ErrorState, PageTitle } from '../components/ui.jsx'
import { sortProducts } from './ShopAll.jsx'

export function CollectionsIndex() {
  const { catalog, loading, error } = useCatalog()
  return (
    <div>
      <PageTitle eyebrow="Browse" title="Collections" />
      {loading && <Loading />}
      {error && <ErrorState error={error} />}
      {catalog && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {childCollections(catalog.collections).map(c => {
            const subs = childCollections(catalog.collections, c.id)
            const items = productsInCollection(catalog, c)
            return (
              <div key={c.id} className="card overflow-hidden">
                <Link to={`/collections/${c.slug}`}><ProductImage src={c.image_url || items[0]?.image} alt={c.name} label={c.name} /></Link>
                <div className="p-4">
                  <Link to={`/collections/${c.slug}`} className="text-xl font-black">{c.name}</Link>
                  {c.description && <p className="mt-1 text-sm text-muted">{c.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="badge">{items.length} shirt{items.length === 1 ? '' : 's'}</span>
                    {subs.map(s => <Link key={s.id} to={`/collections/${s.slug}`} className="chip">{s.name}</Link>)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function CollectionPage() {
  const { slug } = useParams()
  const { catalog, loading, error } = useCatalog()
  const [sort, setSort] = useState('featured')
  if (loading) return <Loading />
  if (error) return <ErrorState error={error} />
  const c = catalog.collectionBySlug[slug]
  if (!c) return <div className="card p-10 text-center">Collection not found. <Link className="text-accent-2" to="/collections">See all collections</Link></div>
  const parent = c.parent_id ? catalog.collections.find(x => x.id === c.parent_id) : null
  const subs = childCollections(catalog.collections, c.id)
  const items = sortProducts(productsInCollection(catalog, c), sort)
  return (
    <div>
      <nav className="mb-3 text-sm text-muted" aria-label="Breadcrumb">
        <Link to="/collections">Collections</Link>{parent && <> / <Link to={`/collections/${parent.slug}`}>{parent.name}</Link></>} / <span className="text-text">{c.name}</span>
      </nav>
      <PageTitle eyebrow="Collection" title={c.name}>{c.description}</PageTitle>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {subs.length > 0 && <>
          <span className="chip chip-on">All {c.name}</span>
          {subs.map(s => <Link key={s.id} to={`/collections/${s.slug}`} className="chip">{s.name}</Link>)}
        </>}
        <select aria-label="Sort" className="select ml-auto !w-auto" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="featured">Featured</option><option value="az">A–Z</option><option value="za">Z–A</option>
          <option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="newest">Newest</option>
        </select>
      </div>
      {items.length === 0
        ? <div className="card p-10 text-center text-muted">New designs are coming soon.</div>
        : <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">{items.map(p => <ProductCard key={p.id} product={p} />)}</div>}
    </div>
  )
}
