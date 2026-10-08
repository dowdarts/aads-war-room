import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useCatalog } from '../lib/catalog.js'
import { useCart } from '../lib/cart.jsx'
import { callFn } from '../lib/supabase.js'
import { PageTitle, PriceSummary, Loading } from '../components/ui.jsx'
import { money, lineDescription, newIdempotencyKey } from '../lib/format.js'
import { useCartPricing } from './Cart.jsx'

const PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']
const IDEM_KEY = 'cgc_shop_checkout_idem'

/** One idempotency key per cart contents, so a retried submit can't create a second order. */
function idempotencyKeyFor(lines) {
  const sig = JSON.stringify(lines.map(l => [l.key, l.qty]))
  try {
    const saved = JSON.parse(sessionStorage.getItem(IDEM_KEY) || 'null')
    if (saved?.sig === sig) return saved.key
    const key = newIdempotencyKey()
    sessionStorage.setItem(IDEM_KEY, JSON.stringify({ sig, key }))
    return key
  } catch { return newIdempotencyKey() }
}

export function Field({ label, id, children, hint }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

export default function Checkout() {
  const nav = useNavigate()
  const { catalog, loading } = useCatalog()
  const cart = useCart()
  const [form, setForm] = useState({ name: '', email: '', phone: '', street: '', city: '', province: 'NS', postal: '', country: 'Canada', instructions: '' })
  const [code, setCode] = useState('')
  const [discount, setDiscount] = useState(null)
  const [codeMsg, setCodeMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pricing = useCartPricing(discount?.terms || null)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const payloadLines = useMemo(() => cart.lines.map(l => ({
    productId: l.productId, variantId: l.variantId, size: l.size, closure: l.closure, pocket: l.pocket, personalization: l.personalization || '', qty: l.qty,
  })), [cart.lines])

  if (loading) return <Loading />
  if (!cart.lines.length) return <Navigate to="/cart" replace />

  async function applyCode() {
    setCodeMsg(null)
    if (!code.trim()) { setDiscount(null); return }
    try {
      const res = await callFn('shop-validate-code', { code: code.trim(), channel: 'RETAIL', email: form.email, lines: payloadLines })
      setDiscount(res)
      setCodeMsg({ ok: true, text: res.summary })
    } catch (e) {
      setDiscount(null)
      setCodeMsg({ ok: false, text: e.message })
    }
  }

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const res = await callFn('shop-checkout', {
        idempotencyKey: idempotencyKeyFor(cart.lines),
        contact: { name: form.name, email: form.email, phone: form.phone },
        shipping: { street: form.street, city: form.city, province: form.province, postal: form.postal, country: form.country },
        instructions: form.instructions,
        discountCode: discount ? code.trim() : '',
        lines: payloadLines,
        clientTotalCents: pricing?.totalCents,
      })
      try { sessionStorage.setItem(`cgc_order_${res.orderNumber}`, JSON.stringify(res)); sessionStorage.removeItem(IDEM_KEY) } catch { /* ignore */ }
      cart.clear()
      nav(`/order/${res.orderNumber}`, { state: res, replace: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const canSubmit = pricing?.ok && !busy

  return (
    <form onSubmit={submit}>
      <PageTitle eyebrow="Checkout" title="Shipping & payment" />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card space-y-4 p-5">
            <h2 className="font-black">Contact</h2>
            <Field label="Full name" id="c-name"><input id="c-name" className="input" required autoComplete="name" value={form.name} onChange={set('name')} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" id="c-email"><input id="c-email" className="input" type="email" required autoComplete="email" value={form.email} onChange={set('email')} /></Field>
              <Field label="Phone" id="c-phone"><input id="c-phone" className="input" type="tel" required autoComplete="tel" value={form.phone} onChange={set('phone')} /></Field>
            </div>
          </section>
          <section className="card space-y-4 p-5">
            <h2 className="font-black">Shipping address</h2>
            <Field label="Street address" id="s-street"><input id="s-street" className="input" required autoComplete="street-address" value={form.street} onChange={set('street')} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City" id="s-city"><input id="s-city" className="input" required autoComplete="address-level2" value={form.city} onChange={set('city')} /></Field>
              <Field label="Province" id="s-prov">
                <select id="s-prov" className="select" value={form.province} onChange={set('province')} autoComplete="address-level1">
                  {PROVINCES.map(p => <option key={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Postal code" id="s-postal"><input id="s-postal" className="input" required autoComplete="postal-code" value={form.postal} onChange={set('postal')} /></Field>
              <Field label="Country" id="s-country"><input id="s-country" className="input" required autoComplete="country-name" value={form.country} onChange={set('country')} /></Field>
            </div>
            <Field label="Order notes (optional)" id="s-notes"><textarea id="s-notes" className="textarea" rows={3} value={form.instructions} onChange={set('instructions')} /></Field>
          </section>
        </div>

        <aside className="card h-fit space-y-4 p-5 lg:sticky lg:top-24">
          <h2 className="font-black">Order review</h2>
          <ul className="space-y-2 text-sm">
            {cart.lines.map(l => {
              const p = pricing?.lines.find(x => x.key === l.key)
              return (
                <li key={l.key} className="flex justify-between gap-3">
                  <span><b>{l.qty}×</b> {catalog?.productById[l.productId]?.name || l.name}<span className="block text-xs text-muted">{lineDescription(l)}</span></span>
                  {p && <span className="tabular-nums">{money(p.lineCents)}</span>}
                </li>
              )
            })}
          </ul>
          <div>
            <label className="label" htmlFor="code">Discount code</label>
            <div className="flex gap-2">
              <input id="code" className="input" value={code} onChange={e => { setCode(e.target.value); setDiscount(null); setCodeMsg(null) }} autoCapitalize="characters" />
              <button type="button" className="btn btn-ghost" onClick={applyCode}>Apply</button>
            </div>
            {codeMsg && <p className={`mt-1 text-sm ${codeMsg.ok ? 'text-good' : 'text-bad'}`}>{codeMsg.text}</p>}
          </div>
          <PriceSummary pricing={pricing} />
          <div className="note text-xs">Payment is by Interac e-Transfer. Once you place your order we’ll review it and email your invoice with payment instructions. Your order is confirmed when payment is received and verified.</div>
          {error && <div className="err" role="alert">{error}</div>}
          <button type="submit" className="btn btn-primary w-full" disabled={!canSubmit}>{busy ? 'Placing order…' : `Place order · ${money(pricing?.totalCents || 0)}`}</button>
          <Link to="/cart" className="block text-center text-sm text-muted underline">Back to cart</Link>
        </aside>
      </div>
    </form>
  )
}
