import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { supabase } from './api.js'
import Dashboard from './Dashboard.jsx'
import { ProductsList, ProductEdit, BulkUpload } from './Products.jsx'
import Collections from './Collections.jsx'
import { OrdersList, OrderDetail } from './Orders.jsx'
import { InquiriesList, ProjectsList, ProjectDetail, PrivateLinks } from './Projects.jsx'
import DiscountCodes from './Discounts.jsx'
import { InvoicesList, InvoiceBuilderPage } from './Invoices.jsx'
import Payments from './Payments.jsx'
import Production from './Production.jsx'
import { CustomersList, CustomerDetail } from './Customers.jsx'
import Reports from './Reports.jsx'
import Settings from './Settings.jsx'

const MENU = [
  ['', 'Dashboard'], ['products', 'Products'], ['collections', 'Collections'], ['orders', 'Retail Orders'],
  ['inquiries', 'Design Inquiries'], ['projects', 'Custom Design Projects'], ['links', 'Private Order Links'],
  ['discounts', 'Discount Codes'], ['invoices', 'Quotes & Invoices'], ['payments', 'Payments'],
  ['production', 'Production & Shipping'], ['customers', 'Customers'], ['reports', 'Reports'], ['settings', 'Settings'],
]

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setErr(error.message)
    setBusy(false)
  }
  async function reset() {
    if (!email) return setErr('Enter your email first.')
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/admin` })
    if (error) setErr(error.message); else setResetSent(true)
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <div><div className="eyebrow">CGC Darts Shop</div><h1 className="mt-1 text-2xl font-black">Admin sign in</h1></div>
        <label className="block"><span className="label">Email</span><input className="input" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="block"><span className="label">Password</span><input className="input" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
        {err && <div className="err">{err}</div>}
        {resetSent && <div className="ok">Check your email for a reset link.</div>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <button type="button" className="w-full text-center text-xs text-muted underline" onClick={reset}>Forgot password?</button>
      </form>
    </div>
  )
}

function SetPassword({ onDone }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form className="card w-full max-w-sm space-y-4 p-6" onSubmit={async e => {
        e.preventDefault()
        const { error } = await supabase.auth.updateUser({ password: pw })
        if (error) setErr(error.message); else onDone()
      }}>
        <h1 className="text-2xl font-black">Set a new password</h1>
        <input className="input" type="password" minLength={10} required value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" />
        {err && <div className="err">{err}</div>}
        <button className="btn btn-primary w-full">Save password</button>
      </form>
    </div>
  )
}

export default function AdminApp() {
  const [session, setSession] = useState(undefined)
  const [isAdmin, setIsAdmin] = useState(null)
  const [recovery, setRecovery] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const loc = useLocation()

  useEffect(() => {
    document.title = 'Admin · CGC Darts Shop'
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!session) { setIsAdmin(null); return }
    supabase.from('shop_admins').select('user_id').eq('user_id', session.user.id).maybeSingle().then(({ data }) => setIsAdmin(!!data))
  }, [session])
  useEffect(() => setMenuOpen(false), [loc.pathname])

  if (session === undefined) return <div className="p-10 text-center text-muted">Loading…</div>
  if (recovery) return <SetPassword onDone={() => setRecovery(false)} />
  if (!session) return <Login />
  if (isAdmin === null) return <div className="p-10 text-center text-muted">Checking access…</div>
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="card max-w-sm space-y-4 p-6 text-center">
          <h1 className="text-xl font-black">No admin access</h1>
          <p className="text-sm text-muted">{session.user.email} isn’t an admin for this shop.</p>
          <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className={`border-line bg-panel lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto lg:border-r ${menuOpen ? 'block' : 'hidden'}`}>
        <div className="hidden p-4 lg:block"><div className="text-xl font-black">CGC<span className="text-accent">.</span> Admin</div></div>
        <nav className="grid gap-0.5 p-2" aria-label="Admin">
          {MENU.map(([to, label]) => (
            <NavLink key={to} to={`/admin${to ? `/${to}` : ''}`} end={!to}
              className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? 'bg-panel-2 text-accent-2' : 'text-muted hover:text-text'}`}>{label}</NavLink>
          ))}
        </nav>
        <div className="space-y-2 border-t border-line p-4 text-xs text-muted">
          <div className="truncate">{session.user.email}</div>
          <div className="flex gap-3"><a href="/" className="underline">View shop</a><button className="underline" onClick={() => supabase.auth.signOut()}>Sign out</button></div>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-ink/95 px-4 py-3 lg:hidden">
          <button className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(o => !o)} aria-expanded={menuOpen}>Menu</button>
          <div className="font-black">CGC<span className="text-accent">.</span> Admin</div>
        </div>
        <main className="mx-auto max-w-6xl p-4 sm:p-6">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<ProductsList />} />
            <Route path="products/bulk" element={<BulkUpload />} />
            <Route path="products/:id" element={<ProductEdit />} />
            <Route path="collections" element={<Collections />} />
            <Route path="orders" element={<OrdersList />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="inquiries" element={<InquiriesList />} />
            <Route path="projects" element={<ProjectsList />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="links" element={<PrivateLinks />} />
            <Route path="discounts" element={<DiscountCodes />} />
            <Route path="invoices" element={<InvoicesList />} />
            <Route path="invoices/:id" element={<InvoiceBuilderPage />} />
            <Route path="payments" element={<Payments />} />
            <Route path="production" element={<Production />} />
            <Route path="customers" element={<CustomersList />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
