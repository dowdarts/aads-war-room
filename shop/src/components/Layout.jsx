import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useCart } from '../lib/cart.jsx'
import { useSettings } from '../lib/settings.jsx'

const NAV = [
  ['/', 'Home'],
  ['/shop', 'Shop All Shirts'],
  ['/collections', 'Collections'],
  ['/custom', 'Custom & Team Shirts'],
  ['/pricing', 'Pricing & Services'],
  ['/track', 'Track My Order'],
  ['/contact', 'Contact'],
]

function Logo() {
  const { settings } = useSettings()
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="CGC Darts Custom Apparel home">
      <img src={settings.logo_url || '/images/brand/cgc-darts.webp'} alt="CGC Darts" className="h-9 w-auto sm:h-10" width="111" height="36" />
      <span className="hidden flex-col leading-none sm:flex">
        <span className="text-[11px] font-black uppercase tracking-[.22em]">Custom Apparel</span>
        <span className="text-[10px] font-semibold uppercase tracking-[.18em] text-muted">× MD Studios</span>
      </span>
    </Link>
  )
}

function SearchBox({ onDone }) {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  return (
    <form role="search" className="relative" onSubmit={e => { e.preventDefault(); nav(`/shop?q=${encodeURIComponent(q.trim())}`); onDone?.() }}>
      <input className="input !py-2 !pl-9" type="search" placeholder="Search shirts…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search products" />
      <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
    </form>
  )
}

function CartIcon() {
  const { units } = useCart()
  return (
    <Link to="/cart" className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line" aria-label={`Cart, ${units} shirt${units === 1 ? '' : 's'}`}>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 7h12l-1 13H7L6 7Z" /><path d="M9 7a3 3 0 0 1 6 0" /></svg>
      {units > 0 && <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-accent px-1.5 text-center text-xs font-black leading-5 text-black">{units}</span>}
    </Link>
  )
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const { settings } = useSettings()
  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [loc.pathname])

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line lg:hidden" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <Logo />
          <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Main">
            {NAV.slice(1).map(([to, label]) => (
              <NavLink key={to} to={to} className={({ isActive }) => `rounded-lg px-2.5 py-2 text-sm font-semibold ${isActive ? 'text-accent-2' : 'text-muted hover:text-text'}`}>{label}</NavLink>
            ))}
          </nav>
          <div className="ml-auto hidden w-56 md:block"><SearchBox /></div>
          <div className="ml-auto md:ml-2"><CartIcon /></div>
        </div>
        {open && (
          <div className="border-t border-line px-4 pb-4 lg:hidden">
            <div className="py-3 md:hidden"><SearchBox onDone={() => setOpen(false)} /></div>
            <nav className="grid gap-1" aria-label="Mobile">
              {NAV.map(([to, label]) => (
                <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `rounded-lg px-3 py-3 font-semibold ${isActive ? 'bg-panel-2 text-accent-2' : ''}`}>{label}</NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-7xl px-4 pt-8">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            <img src="/images/brand/cgc-darts.webp" alt="CGC Darts" className="h-12 w-auto" loading="lazy" />
            <img src="/images/brand/md-studios.webp" alt="MD Studios" className="h-12 w-auto" loading="lazy" />
            <img src="/images/brand/aads-series.webp" alt="Atlantic Amateur Darts Series" className="h-14 w-auto" loading="lazy" />
          </div>
          <p className="mx-auto mt-5 max-w-2xl text-center text-sm text-muted">
            Proceeds from CGC Darts Custom Apparel go back into production equipment, dart boards, tablets, player prize funding
            and growing the <span className="text-text">Atlantic Amateur Darts Series</span>. CGC Darts has funded the production of AADS from day one.
          </p>
        </div>
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm text-muted sm:grid-cols-3">
          <div>
            <div className="font-black text-text">CGC Darts Custom Apparel × MD Studios</div>
            <p className="mt-1">Proud partners of the Atlantic Amateur Darts Series.</p>
          </div>
          <div className="grid gap-1">
            <Link to="/shop">Shop all shirts</Link>
            <Link to="/custom">Custom & team shirts</Link>
            <Link to="/track">Track my order</Link>
          </div>
          <div>
            <div>Payments by Interac e-Transfer · Prices in CAD</div>
            {settings.contact_email && <a className="mt-1 block" href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>}
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl items-center justify-between border-t border-line px-4 py-4 text-xs text-muted">
          <span>© {new Date().getFullYear()} CGC Darts Custom Apparel × MD Studios</span>
          <Link to="/admin" className="rounded-lg border border-line px-3 py-1.5 font-semibold hover:text-text">Admin sign in</Link>
        </div>
      </footer>
    </div>
  )
}
