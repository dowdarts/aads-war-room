import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSettings } from '../lib/settings.jsx'
import { callFn } from '../lib/supabase.js'
import { PageTitle } from '../components/ui.jsx'
import { money, fmtDate, STATUS_LABELS, PAYMENT_LABELS } from '../lib/format.js'
import { CustomPriceTable, DESIGN_FEE_TERMS } from './Custom.jsx'
import { RETAIL } from '@pricing'

export function Pricing() {
  const { settings } = useSettings()
  const ship = Number.isInteger(settings.shipping_cents) ? money(settings.shipping_cents) : 'TBA'
  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Pricing & Services" title="Simple, transparent pricing">All prices in Canadian dollars. Payment by Interac e-Transfer.</PageTitle>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-xl font-black">Official CGC collections</h2>
          <p className="mt-1 text-sm text-muted">Elite, Legacy, Ignite, Forged, AADS and Vintage CGC. Quantity counts across your whole order.</p>
          <table className="table mt-4">
            <thead><tr><th>Shirts in your order</th><th className="text-right">Price each</th></tr></thead>
            <tbody>
              {RETAIL.tiers.map(t => <tr key={t.min}><td>{t.min}–{t.max}</td><td className="text-right font-bold">{money(t.unitCents)}</td></tr>)}
              <tr><td>Player replica shirts (any quantity)</td><td className="text-right font-bold">{money(RETAIL.replicaUnitCents)}</td></tr>
              <tr><td>Zipper polo upgrade</td><td className="text-right font-bold">+{money(RETAIL.zipperCents)}</td></tr>
              <tr><td>Chest pocket upgrade</td><td className="text-right font-bold">+{money(RETAIL.pocketCents)}</td></tr>
              <tr><td>Shipping, 1–2 shirts</td><td className="text-right font-bold">{ship}</td></tr>
              <tr><td>Shipping, 3+ shirts</td><td className="text-right font-bold">Free</td></tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">Sizes S–5XL at no extra charge. Button polo and no pocket are standard. Player replicas include zipper and pocket options at no extra cost, and count toward your 3-shirt total. Ordering more than 6? <Link className="underline" to="/custom">Ask about team pricing</Link>.</p>
        </section>
        <section className="card p-5">
          <h2 className="text-xl font-black">Custom & team shirts</h2>
          <p className="mt-1 mb-4 text-sm text-muted">Your own design, mocked up and revised with you.</p>
          <CustomPriceTable />
          <p className="mt-3 text-xs text-muted">Sizes S–5XL, zipper or button, with or without pocket — all included. {DESIGN_FEE_TERMS}</p>
          <Link to="/custom" className="btn btn-primary mt-4">Request a custom design</Link>
        </section>
      </div>
    </div>
  )
}

export function Contact() {
  const { settings } = useSettings()
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle eyebrow="Contact" title="Get in touch">Questions about an order, sizing, or a large team order? We’re happy to help.</PageTitle>
      <div className="card space-y-3 p-6">
        {settings.contact_email && <p>Email: <a className="font-bold text-accent-2" href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a></p>}
        <p className="text-muted">Include your order or invoice number if you have one.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/custom" className="card p-5"><div className="font-black">Custom & team design</div><p className="mt-1 text-sm text-muted">Start a design request with your logos and ideas.</p></Link>
        <Link to="/track" className="card p-5"><div className="font-black">Track my order</div><p className="mt-1 text-sm text-muted">Check status with your order number and email.</p></Link>
      </div>
    </div>
  )
}

export function Track() {
  const params = new URLSearchParams(window.location.search)
  const [orderNumber, setOrderNumber] = useState(params.get('order') || '')
  const [email, setEmail] = useState('')
  const [token] = useState(params.get('t') || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  async function lookup(e) {
    e?.preventDefault()
    setBusy(true); setError(''); setResult(null)
    try { setResult(await callFn('shop-track', { orderNumber: orderNumber.trim(), email: email.trim(), token })) }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  // Links from our emails carry a tracking token — look the order up straight away.
  useEffect(() => { if (token && orderNumber) lookup() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageTitle eyebrow="Track" title="Track my order">Enter the order number from your confirmation email and the email you ordered with.</PageTitle>
      <form onSubmit={lookup} className="card space-y-4 p-5">
        <div><label className="label" htmlFor="t-num">Order number</label><input id="t-num" className="input" required placeholder="ORD-2026-00001" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} /></div>
        {!token && <div><label className="label" htmlFor="t-email">Email</label><input id="t-email" type="email" className="input" required value={email} onChange={e => setEmail(e.target.value)} /></div>}
        {error && <div className="err">{error}</div>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Looking up…' : 'Find my order'}</button>
      </form>
      {result && (
        <div className="card space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xl font-black">{result.orderNumber}</div>
            <span className="badge badge-accent">{STATUS_LABELS[result.status] || result.status}</span>
          </div>
          <div className="text-sm text-muted">Placed {fmtDate(result.createdAt)} · {result.units} shirt{result.units === 1 ? '' : 's'} · Total {money(result.totalCents)}</div>
          <div className="text-sm">Payment: <b>{PAYMENT_LABELS[result.paymentStatus] || result.paymentStatus}</b>{result.balanceCents > 0 && <> · Balance due <b>{money(result.balanceCents)}</b></>}</div>
          {result.shipments?.map((s, i) => (
            <div key={i} className="rounded-xl border border-line p-3 text-sm">
              <div className="font-bold">{s.carrier || 'Shipment'} · {s.status}</div>
              {s.trackingNumber && <div>Tracking: {s.trackingUrl ? <a className="text-accent-2 underline" href={s.trackingUrl} target="_blank" rel="noreferrer">{s.trackingNumber}</a> : s.trackingNumber}</div>}
              {s.dispatchedOn && <div className="text-muted">Shipped {fmtDate(s.dispatchedOn)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function NotFound() {
  return (
    <div className="card mx-auto max-w-lg p-10 text-center">
      <h1 className="text-3xl font-black">Page not found</h1>
      <Link to="/" className="btn btn-primary mt-6">Go home</Link>
    </div>
  )
}
