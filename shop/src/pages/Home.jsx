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
        <div className="flex flex-wrap items-center gap-3">
          <img src="/images/brand/aads-series.webp" alt="Atlantic Amateur Darts Series" className="h-10 w-auto" />
          <span className="text-[11px] font-black uppercase tracking-[.2em] text-muted">Proud partners of the Atlantic Amateur Darts Series</span>
        </div>
        <div className="eyebrow mt-6">Fall 2026 · Now Available</div>
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

      <section className="card grid items-center gap-6 overflow-hidden p-4 sm:p-6 lg:grid-cols-2">
        <Link to="/custom" className="block overflow-hidden rounded-2xl">
          <img src="/images/brand/custom-team-shirts-ad.webp" alt="CGC Darts Custom Apparel × MD Studios — custom team shirts: polo, zip polo or button-up, with or without pocket, any colour, any theme." className="w-full" loading="lazy" width="1254" height="1254" />
        </Link>
        <div className="p-2 sm:p-4">
          <div className="eyebrow">Custom Team Shirts</div>
          <h2 className="mt-2 text-3xl font-black">Bring your team’s ideas to reality.</h2>
          <p className="mt-3 text-muted">Teams, clubs, leagues and events. Any colour, any theme — polo, zip polo or button-up, with or without pocket. High-quality sublimation print built for darts.</p>
          <p className="mt-3 text-muted">Send us your idea, logos and sponsors. We’ll mock it up, revise it with you, and set up a private order page once you approve.</p>
          <Link to="/custom" className="btn btn-primary mt-6">Get your quote today</Link>
        </div>
      </section>
    </div>
  )
}
