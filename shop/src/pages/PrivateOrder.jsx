import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { callFn } from '../lib/supabase.js'
import { Loading, PriceSummary, ProductImage, Qty } from '../components/ui.jsx'
import { Field } from './Checkout.jsx'
import { money, newIdempotencyKey, CLOSURE_LABELS } from '../lib/format.js'
import { priceCustom, mergeDiscounts, SIZES } from '@pricing'

const blankLine = () => ({ id: Math.random().toString(36).slice(2), size: 'L', closure: 'zipper', pocket: false, personalization: '', qty: 1 })

export default function PrivateOrder() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loadErr, setLoadErr] = useState('')
  const [lines, setLines] = useState([blankLine()])
  const [form, setForm] = useState({ name: '', email: '', phone: '', street: '', city: '', province: 'NS', postal: '', country: 'Canada', instructions: '' })
  const [code, setCode] = useState('')
  const [discount, setDiscount] = useState(null)
  const [codeMsg, setCodeMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  const [idem] = useState(newIdempotencyKey)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    callFn('shop-private-order', { action: 'get', token })
      .then(d => { setData(d); setForm(f => ({ ...f, name: d.customer?.name || '', email: d.customer?.email || '', phone: d.customer?.phone || '' })) })
      .catch(e => setLoadErr(e.message))
  }, [token])

  const pricing = useMemo(() => data && priceCustom({
    lines,
    lockedUnitCents: data.terms.lockedUnitCents,
    includeDesignFee: data.terms.includeDesignFee,
    extraRevisionPackages: data.terms.extraRevisionPackages,
    discount: mergeDiscounts(data.terms.discount, discount?.terms),
    settings: { customShippingCents: data.terms.customShippingCents, taxRatePercent: data.terms.taxRatePercent },
    creditsCents: data.terms.creditsCents,
  }), [data, lines, discount])

  if (loadErr) return <div className="card mx-auto max-w-lg p-8 text-center"><h1 className="text-2xl font-black">Link unavailable</h1><p className="mt-2 text-muted">{loadErr}</p></div>
  if (!data) return <Loading />
  if (done) {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <div className="eyebrow">Order submitted</div>
        <h1 className="mt-2 text-3xl font-black">{done.orderNumber}</h1>
        <p className="mt-3 text-muted">Thank you! We’ve emailed your order summary. Your invoice for the balance of <b className="text-text">{money(done.pricing.balanceCents)}</b> will follow with Interac e-Transfer instructions.</p>
      </div>
    )
  }

  const updateLine = (id, patch) => setLines(ls => ls.map(l => l.id === id ? { ...l, ...patch } : l))

  async function applyCode() {
    setCodeMsg(null)
    if (!code.trim()) { setDiscount(null); return }
    try {
      const res = await callFn('shop-validate-code', { code: code.trim(), channel: 'CUSTOM', token, qty: pricing.qty })
      setDiscount(res); setCodeMsg({ ok: true, text: res.summary })
    } catch (e) { setDiscount(null); setCodeMsg({ ok: false, text: e.message }) }
  }

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const res = await callFn('shop-private-order', {
        action: 'submit', token, idempotencyKey: idem,
        contact: { name: form.name, email: form.email, phone: form.phone },
        shipping: { street: form.street, city: form.city, province: form.province, postal: form.postal, country: form.country },
        instructions: form.instructions,
        discountCode: discount ? code.trim() : '',
        lines: lines.map(({ id, ...l }) => l),
      })
      setDone(res); window.scrollTo(0, 0)
    } catch (err) { setError(err.message); setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <div className="eyebrow">Private order · {data.project.projectNumber}</div>
        <h1 className="mt-1 text-3xl font-black tracking-tight">{data.project.title}</h1>
        {data.project.team && <p className="text-muted">{data.project.team}</p>}
        {data.project.description && <p className="mt-2 max-w-2xl text-muted">{data.project.description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <figure className="card overflow-hidden"><ProductImage src={data.art.front} alt="Approved front design" label="Front" /><figcaption className="p-3 text-sm font-bold">Front</figcaption></figure>
        <figure className="card overflow-hidden"><ProductImage src={data.art.back} alt="Approved back design" label="Back" /><figcaption className="p-3 text-sm font-bold">Back</figcaption></figure>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card space-y-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-black">Your shirts</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLines(ls => [...ls, blankLine()])}>+ Add line</button>
            </div>
            <p className="text-sm text-muted">Add one line per size/style combination. Zipper or button and pocket or no pocket are included at no extra cost.</p>
            {lines.map(l => (
              <div key={l.id} className="grid grid-cols-2 gap-2 rounded-xl border border-line p-3 sm:grid-cols-[90px_1fr_1fr_1.4fr_auto_auto] sm:items-end">
                <div><label className="label">Size</label><select className="select" value={l.size} onChange={e => updateLine(l.id, { size: e.target.value })}>{SIZES.map(s => <option key={s}>{s}</option>)}</select></div>
                <div><label className="label">Collar</label><select className="select" value={l.closure} onChange={e => updateLine(l.id, { closure: e.target.value })}>{Object.entries(CLOSURE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className="label">Pocket</label><select className="select" value={l.pocket ? 'y' : 'n'} onChange={e => updateLine(l.id, { pocket: e.target.value === 'y' })}><option value="n">No pocket</option><option value="y">Pocket</option></select></div>
                <div className="col-span-2 sm:col-span-1"><label className="label">Player name</label><input className="input" maxLength={24} value={l.personalization} onChange={e => updateLine(l.id, { personalization: e.target.value })} placeholder="Optional" /></div>
                <div><label className="label">Qty</label><Qty value={l.qty} onChange={q => updateLine(l.id, { qty: q })} max={200} /></div>
                <button type="button" className="btn btn-ghost btn-sm" disabled={lines.length === 1} onClick={() => setLines(ls => ls.filter(x => x.id !== l.id))}>Remove</button>
              </div>
            ))}
          </section>
          <section className="card space-y-4 p-5">
            <h2 className="font-black">Contact & shipping</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" id="p-name"><input id="p-name" className="input" required value={form.name} onChange={set('name')} /></Field>
              <Field label="Email" id="p-email"><input id="p-email" type="email" className="input" required value={form.email} onChange={set('email')} /></Field>
              <Field label="Phone" id="p-phone"><input id="p-phone" type="tel" className="input" required value={form.phone} onChange={set('phone')} /></Field>
              <Field label="Street address" id="p-street"><input id="p-street" className="input" required value={form.street} onChange={set('street')} /></Field>
              <Field label="City" id="p-city"><input id="p-city" className="input" required value={form.city} onChange={set('city')} /></Field>
              <Field label="Province" id="p-prov"><input id="p-prov" className="input" required value={form.province} onChange={set('province')} /></Field>
              <Field label="Postal code" id="p-postal"><input id="p-postal" className="input" required value={form.postal} onChange={set('postal')} /></Field>
              <Field label="Country" id="p-country"><input id="p-country" className="input" required value={form.country} onChange={set('country')} /></Field>
            </div>
            <Field label="Notes (optional)" id="p-notes"><textarea id="p-notes" className="textarea" rows={3} value={form.instructions} onChange={set('instructions')} /></Field>
          </section>
        </div>
        <aside className="card h-fit space-y-4 p-5 lg:sticky lg:top-24">
          <h2 className="font-black">Order summary</h2>
          <div className="text-sm text-muted">{pricing.qty} shirt{pricing.qty === 1 ? '' : 's'} × {money(pricing.unitCents)}{pricing.lockedUnit ? ' (agreed price)' : ''}</div>
          <div>
            <label className="label" htmlFor="pcode">Discount code</label>
            <div className="flex gap-2">
              <input id="pcode" className="input" value={code} onChange={e => { setCode(e.target.value); setDiscount(null); setCodeMsg(null) }} />
              <button type="button" className="btn btn-ghost" onClick={applyCode}>Apply</button>
            </div>
            {codeMsg && <p className={`mt-1 text-sm ${codeMsg.ok ? 'text-good' : 'text-bad'}`}>{codeMsg.text}</p>}
          </div>
          <PriceSummary pricing={pricing} />
          {error && <div className="err" role="alert">{error}</div>}
          <button className="btn btn-primary w-full" disabled={busy || !pricing.ok}>{busy ? 'Submitting…' : 'Submit final order'}</button>
          <p className="text-xs text-muted">After you submit, we’ll email your invoice for the balance with Interac e-Transfer instructions.</p>
        </aside>
      </div>
    </form>
  )
}
