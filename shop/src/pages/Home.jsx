import { Link } from 'react-router-dom'
import { useCatalog, childCollections, productsInCollection } from '../lib/catalog.js'
import { ProductCard, ProductImage, Loading, ErrorState } from '../components/ui.jsx'
import { money } from '../lib/format.js'
import { RETAIL } from '@pricing'

export default function Home() {
  const { catalog, loading, error } = useCatalog()
  return (
    <div className="space-y-14">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-[#1a1008] via-panel to-ink px-6 py-12 sm:px-12 sm:py-16">
        <div className="eyebrow">Fall 2026 · Now Available</div>
        <h1 className="mt-3 max-w-3xl text-4xl font-black leading-[1.02] tracking-tight sm:text-6xl">
          Official <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">CGC Darts</span> apparel.
        </h1>
        <p className="mt-4 max-w-xl text-muted">Elite, Legacy, Ignite and Forged — four new lines built for the oche. Designed and produced by MD Studios.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/shop" className="btn btn-primary">Shop all shirts</Link>
          <Link to="/custom" className="btn btn-ghost">Custom & team shirts</Link>
        </div>
        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span><b className="text-accent-2">{money(RETAIL.tiers[0].unitCents)}</b> <span className="text-muted">per shirt</span></span>
          <span><b className="text-accent-2">{money(RETAIL.tiers[1].unitCents)}</b> <span className="text-muted">each on 3–6 shirts</span></span>
          <span><b className="text-accent-2">Free shipping</b> <span className="text-muted">on 3+ shirts</span></span>
        </div>
      </section>

      {loading && <Loading />}
      {error && <ErrorState error={error} />}
      {catalog && <>
        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-2xl font-black">Collections</h2>
            <Link to="/collections" className="text-sm font-bold text-accent-2">View all →</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
            {childCollections(catalog.collections).map(c => {
              const first = productsInCollection(catalog, c)[0]
              return (
                <Link key={c.id} to={`/collections/${c.slug}`} className="card group overflow-hidden">
                  <ProductImage src={c.image_url || first?.image} alt={c.name} label={c.name} />
                  <div className="p-3 font-black">{c.name}</div>
                </Link>
              )
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-black">Featured</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {catalog.products.filter(p => p.featured).slice(0, 8).map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      </>}

      <section className="card grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-10">
        <div>
          <div className="eyebrow">Custom & Team Apparel</div>
          <h2 className="mt-2 text-2xl font-black">Your team. Your design.</h2>
          <p className="mt-2 max-w-xl text-muted">Send us your idea, logos and sponsors. We’ll mock it up, revise it with you, and set up a private order page once you approve.</p>
        </div>
        <Link to="/custom" className="btn btn-primary">Request a custom design</Link>
      </section>
    </div>
  )
}
