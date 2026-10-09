import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { callFn } from '../lib/supabase.js'
import { PageTitle } from '../components/ui.jsx'
import { Field } from './Checkout.jsx'
import { money } from '../lib/format.js'
import { priceCustom, CUSTOM } from '@pricing'

export const DESIGN_FEE_TERMS = 'The one-time $50 design/setup/processing fee includes the initial shirt mockup and two rounds of requested design revisions. Additional revision rounds are available in packages of two for $25 each, charged only after the customer requests and approves them.'

const MAX_FILES = 10
const MAX_BYTES = 10 * 1024 * 1024
const ACCEPT = ['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf']

export function CustomPriceTable() {
  return (
    <table className="table">
      <thead><tr><th>Total custom/team shirts</th><th className="text-right">Price each</th></tr></thead>
      <tbody>
        {CUSTOM.tiers.map(t => (
          <tr key={t.min}><td>{t.max === Infinity ? `${t.min}+` : `${t.min}–${t.max}`}</td><td className="text-right font-bold">{money(t.unitCents)}</td></tr>
        ))}
        <tr><td>Design, setup & processing (once per new design)</td><td className="text-right font-bold">{money(CUSTOM.designFeeCents)}</td></tr>
        <tr><td>Additional revision package (2 rounds)</td><td className="text-right font-bold">{money(CUSTOM.revisionPackageCents)}</td></tr>
      </tbody>
    </table>
  )
}

export default function Custom() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', team: '', qty: '10', brief: '', palette: '', style: '', sponsors: '', names: '', instructions: '' })
  const [files, setFiles] = useState([])
  const [fileErr, setFileErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  const fileInput = useRef(null)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const qty = parseInt(form.qty, 10)
  const estimate = useMemo(() => (qty > 0 ? priceCustom({ qty }) : null), [qty])

  function addFiles(list) {
    setFileErr('')
    const next = [...files]
    for (const f of list) {
      if (!ACCEPT.includes(f.type)) { setFileErr(`${f.name}: only PNG, JPG, SVG or PDF files.`); continue }
      if (f.size > MAX_BYTES) { setFileErr(`${f.name}: files must be 10 MB or smaller.`); continue }
      if (next.length >= MAX_FILES) { setFileErr(`Up to ${MAX_FILES} files.`); break }
      next.push(f)
    }
    setFiles(next)
  }

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setError('')
    if (!(qty > 0)) return setError('Enter your estimated number of shirts.')
    setBusy(true)
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, v))
    files.forEach(f => fd.append('files', f, f.name))
    try {
      setDone(await callFn('shop-inquiry', fd))
      window.scrollTo(0, 0)
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  if (done) {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <div className="eyebrow">Request received</div>
        <h1 className="mt-2 text-3xl font-black">Thanks — we’re on it.</h1>
        <p className="mt-3 text-muted">Your reference is <b className="text-text">{done.inquiryNumber}</b>. We’ve emailed a copy to you and will reply with a quote and next steps for your mockup.</p>
        <Link to="/" className="btn btn-primary mt-6">Back to home</Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8 grid items-center gap-6 lg:grid-cols-[1fr_420px]">
        <PageTitle eyebrow="Custom & Team Apparel" title="Request a custom design">
          Teams, clubs, leagues and events — any colour, any theme. Tell us about your team shirt and we’ll quote it, build your mockup,
          revise it with you by email, and send you a private order page once you approve the design.
        </PageTitle>
        <img src="/images/brand/custom-team-shirts-ad.webp" alt="CGC Darts Custom Apparel custom team shirts" className="w-full rounded-2xl border border-line" width="1254" height="1254" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <form onSubmit={submit} className="space-y-6">
          <section className="card space-y-4 p-5">
            <h2 className="font-black">About you</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name *" id="i-name"><input id="i-name" className="input" required value={form.name} onChange={set('name')} autoComplete="name" /></Field>
              <Field label="Email *" id="i-email"><input id="i-email" type="email" className="input" required value={form.email} onChange={set('email')} autoComplete="email" /></Field>
              <Field label="Phone" id="i-phone"><input id="i-phone" type="tel" className="input" value={form.phone} onChange={set('phone')} autoComplete="tel" /></Field>
              <Field label="Team / organization" id="i-team"><input id="i-team" className="input" value={form.team} onChange={set('team')} /></Field>
            </div>
          </section>
          <section className="card space-y-4 p-5">
            <h2 className="font-black">Your design</h2>
            <Field label="Estimated number of shirts *" id="i-qty" hint="Your best estimate — the final quantity is confirmed when you order.">
              <input id="i-qty" type="number" min="1" max="999" inputMode="numeric" className="input" required value={form.qty} onChange={set('qty')} />
            </Field>
            <Field label="Describe your design *" id="i-brief" hint="Colours, look and feel, what goes where, anything you have in mind.">
              <textarea id="i-brief" className="textarea" rows={6} required minLength={20} value={form.brief} onChange={set('brief')} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Preferred colour palette" id="i-pal"><input id="i-pal" className="input" value={form.palette} onChange={set('palette')} /></Field>
              <Field label="Artwork / style" id="i-style"><input id="i-style" className="input" value={form.style} onChange={set('style')} /></Field>
              <Field label="Sponsor logo positions" id="i-spons"><input id="i-spons" className="input" value={form.sponsors} onChange={set('sponsors')} /></Field>
              <Field label="Player name placement" id="i-names"><input id="i-names" className="input" value={form.names} onChange={set('names')} /></Field>
            </div>
            <Field label="Other instructions" id="i-instr"><textarea id="i-instr" className="textarea" rows={3} value={form.instructions} onChange={set('instructions')} /></Field>
          </section>
          <section className="card space-y-3 p-5">
            <h2 className="font-black">Logos & reference files</h2>
            <p className="text-sm text-muted">Sketches, existing shirts, inspiration, team and sponsor logos. PNG, JPG, SVG or PDF — up to {MAX_FILES} files, 10 MB each.</p>
            <div
              className="rounded-xl border-2 border-dashed border-line p-6 text-center"
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
            >
              <button type="button" className="btn btn-ghost" onClick={() => fileInput.current?.click()}>Choose files</button>
              <p className="mt-2 text-xs text-muted">or drag them here</p>
              <input ref={fileInput} type="file" multiple accept={ACCEPT.join(',')} className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
            </div>
            {fileErr && <div className="err">{fileErr}</div>}
            {files.length > 0 && (
              <ul className="divide-y divide-line rounded-xl border border-line text-sm">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 p-2.5">
                    <span className="truncate">{f.name} <span className="text-muted">({Math.ceil(f.size / 1024)} KB)</span></span>
                    <button type="button" className="text-muted underline" onClick={() => setFiles(files.filter((_, j) => j !== i))}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {error && <div className="err" role="alert">{error}</div>}
          <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={busy}>{busy ? 'Sending…' : 'Submit design request'}</button>
        </form>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <div className="card p-5">
            <h2 className="font-black">Your estimate</h2>
            {estimate ? (
              <div className="mt-3 text-sm">
                <div className="flex justify-between py-1"><span>{estimate.qty} × {money(estimate.unitCents)}</span><span>{money(estimate.shirtsCents)}</span></div>
                <div className="flex justify-between py-1"><span>Design, setup & processing</span><span>{money(estimate.designFeeCents)}</span></div>
                <div className="my-2 border-t border-line" />
                <div className="flex justify-between text-lg font-black"><span>Estimate</span><span>{money(estimate.totalCents)}</span></div>
              </div>
            ) : <p className="mt-2 text-sm text-muted">Enter a quantity to see an estimate.</p>}
            <p className="mt-3 text-xs text-muted">Estimate only — final pricing uses your final shirt quantity. Sizes S–5XL, zipper or button, pocket or no pocket are all included at no extra cost. Shipping and any extra revision packages are quoted separately.</p>
          </div>
          <div className="card p-5"><CustomPriceTable /></div>
          <p className="text-xs text-muted">{DESIGN_FEE_TERMS}</p>
        </aside>
      </div>
    </div>
  )
}
