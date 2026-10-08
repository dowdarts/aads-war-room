import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase, must, admin, downloadInvoicePdf, toCents, toDollars } from './api.js'
import { useLoad, useAction, Msg, H1, Panel, Field, Empty, StatusBadge } from './ui.jsx'
import { money, fmtDate, fmtDateTime } from '../lib/format.js'

const KINDS = [['item', 'Item'], ['upgrade', 'Upgrade'], ['fee', 'Fee'], ['discount', 'Discount'], ['shipping', 'Shipping'], ['tax', 'Tax'], ['adjustment', 'Adjustment']]

/**
 * Invoice Builder: preview, edit lines/notes, download the PDF, send to the
 * customer, and record payments (which trigger the receipt once paid in full).
 */
export function InvoiceBuilder({ invoice, onChanged }) {
  const editable = invoice.kind !== 'receipt' && ['draft', 'issued'].includes(invoice.status)
  const [editing, setEditing] = useState(false)
  const [lines, setLines] = useState(invoice.snapshot.lines)
  const [notes, setNotes] = useState(invoice.notes || '')
  const [pay, setPay] = useState({ amount: '', reference: '', receivedOn: new Date().toISOString().slice(0, 10), notes: '' })
  const { busy, msg, run } = useAction()
  useEffect(() => { setLines(invoice.snapshot.lines); setNotes(invoice.notes || ''); setEditing(false) }, [invoice.id, invoice.version, invoice.snapshot])

  const total = useMemo(() => lines.reduce((s, l) => s + (l.qty || 0) * (l.unitCents || 0), 0), [lines])
  const credits = invoice.kind === 'quote' ? 0 : invoice.credits_cents
  const upd = (i, patch) => setLines(ls => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  const save = () => run(async () => {
    const r = await admin('save_invoice', { invoiceId: invoice.id, lines: lines.map(l => ({ kind: l.kind, description: l.description, qty: l.qty, unitCents: l.unitCents })), notes })
    setEditing(false); onChanged?.(r.invoice)
  }, invoice.status === 'issued' ? 'Saved as a new version — send it to the customer when ready.' : 'Saved.')

  const send = force => run(async () => {
    const r = await admin('send_invoice', { invoiceId: invoice.id, force })
    onChanged?.(r.invoice)
    if (r.email.status === 'skipped') throw new Error('Invoice issued, but email isn’t configured yet (RESEND_API_KEY). Download the PDF and send it manually.')
    if (r.email.status === 'failed') throw new Error(`Invoice issued, but the email failed: ${r.email.error}`)
    return r
  }, `Invoice sent to ${invoice.snapshot.customer?.email}.`)

  const recordPayment = () => run(async () => {
    const amountCents = toCents(pay.amount)
    if (!amountCents) throw new Error('Enter the amount received.')
    const r = await admin('record_payment', { invoiceId: invoice.id, amountCents, reference: pay.reference, receivedOn: pay.receivedOn, notes: pay.notes })
    setPay(p => ({ ...p, amount: '', reference: '', notes: '' }))
    onChanged?.(r.invoice)
    return r
  }, r => (r.receipt ? `Payment recorded — paid in full. Receipt ${r.receipt.invoice_number} ${r.receipt.emailStatus === 'sent' ? 'emailed to the customer' : '(email not sent — check Settings → Email log)'}.` : `Payment recorded. Remaining balance ${money(r.balanceCents)}.`))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-black">{invoice.kind === 'quote' ? 'Quote' : invoice.kind === 'receipt' ? 'Receipt' : 'Invoice'} {invoice.invoice_number}</span>
        {invoice.version > 1 && <span className="badge">v{invoice.version}</span>}
        <StatusBadge value={invoice.status} />
        {invoice.sent_at ? <span className="badge badge-good">Sent ✓ {fmtDateTime(invoice.sent_at)}</span> : invoice.kind !== 'receipt' && <span className="badge">Not sent</span>}
        {invoice.kind === 'invoice' && invoice.status === 'issued' && (invoice.balance_cents === 0 ? <span className="badge badge-good">Paid</span> : <span className="badge badge-accent">{money(invoice.balance_cents)} due</span>)}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="table">
          <thead><tr><th>Description</th>{editing && <th>Type</th>}<th className="text-right">Qty</th><th className="text-right">Unit</th><th className="text-right">Amount</th>{editing && <th />}</tr></thead>
          <tbody>
            {lines.map((l, i) => editing ? (
              <tr key={i}>
                <td><input className="input !py-1.5" value={l.description} onChange={e => upd(i, { description: e.target.value })} /></td>
                <td><select className="select !py-1.5" value={l.kind} onChange={e => upd(i, { kind: e.target.value })}>{KINDS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                <td><input className="input !w-16 !py-1.5 text-right" inputMode="numeric" value={l.qty} onChange={e => upd(i, { qty: parseInt(e.target.value, 10) || 0 })} /></td>
                <td><input className="input !w-24 !py-1.5 text-right" inputMode="decimal" defaultValue={toDollars(l.unitCents)} onBlur={e => upd(i, { unitCents: toCents(e.target.value) ?? 0 })} /></td>
                <td className="text-right tabular-nums">{money((l.qty || 0) * (l.unitCents || 0))}</td>
                <td><button className="text-muted" aria-label="Remove line" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}>✕</button></td>
              </tr>
            ) : (
              <tr key={i}><td>{l.description}</td><td className="text-right">{l.qty}</td><td className="text-right tabular-nums">{money(l.unitCents)}</td><td className="text-right font-bold tabular-nums">{money(l.lineCents)}</td></tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={editing ? 4 : 3} className="text-right font-black">Total</td><td className="text-right font-black tabular-nums">{money(editing ? total : invoice.total_cents)}</td>{editing && <td />}</tr>
            {credits > 0 && <tr><td colSpan={editing ? 4 : 3} className="text-right text-muted">Paid / credited</td><td className="text-right tabular-nums text-muted">−{money(credits)}</td>{editing && <td />}</tr>}
            {invoice.kind !== 'quote' && <tr><td colSpan={editing ? 4 : 3} className="text-right font-black">Balance due</td><td className="text-right font-black tabular-nums">{money(Math.max((editing ? total : invoice.total_cents) - credits, 0))}</td>{editing && <td />}</tr>}
          </tfoot>
        </table>
      </div>

      {editing ? (
        <div className="space-y-3">
          <button className="btn btn-ghost btn-sm" onClick={() => setLines(ls => [...ls, { kind: 'adjustment', description: '', qty: 1, unitCents: 0 }])}>+ Add line</button>
          <Field label="Notes on invoice"><textarea className="textarea" rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
          <p className="text-xs text-muted">Use a negative amount for discounts or waivers (e.g. −50.00). {invoice.status === 'issued' && 'This invoice was already issued, so saving creates a new version.'}</p>
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>Save invoice</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setLines(invoice.snapshot.lines); setNotes(invoice.notes || ''); setEditing(false) }}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          {invoice.notes && <p className="text-sm text-muted">Notes: {invoice.notes}</p>}
          <div className="flex flex-wrap gap-2">
            {editable && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit</button>}
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(() => downloadInvoicePdf(invoice))}>Download PDF</button>
            {editable && (invoice.sent_at
              ? <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => confirm('Email this invoice to the customer again?') && send(true)}>Resend to customer</button>
              : <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => send(false)}>{busy ? 'Sending…' : 'Send to customer'}</button>)}
          </div>
        </>
      )}

      {invoice.kind === 'invoice' && invoice.status === 'issued' && invoice.balance_cents > 0 && !editing && (
        <div className="rounded-xl border border-line p-3">
          <div className="mb-2 font-bold">Record e-Transfer payment</div>
          <div className="grid gap-2 sm:grid-cols-[120px_1fr_150px]">
            <Field label="Amount ($)"><input className="input" inputMode="decimal" placeholder={toDollars(invoice.balance_cents)} value={pay.amount} onChange={e => setPay({ ...pay, amount: e.target.value })} /></Field>
            <Field label="e-Transfer reference"><input className="input" value={pay.reference} onChange={e => setPay({ ...pay, reference: e.target.value })} /></Field>
            <Field label="Received"><input type="date" className="input" value={pay.receivedOn} onChange={e => setPay({ ...pay, receivedOn: e.target.value })} /></Field>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setPay({ ...pay, amount: toDollars(invoice.balance_cents) })}>Full balance</button>
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={recordPayment}>Confirm payment received</button>
          </div>
          <p className="mt-2 text-xs text-muted">Only record money you’ve actually received in your bank. When the balance reaches $0 the order is marked paid and the customer is emailed a receipt automatically.</p>
        </div>
      )}
      {invoice.status === 'issued' && invoice.kind === 'invoice' && !invoice.sent_at && <p className="text-xs text-muted">Not emailed yet.</p>}
      <Msg msg={msg} />
    </div>
  )
}

export function InvoicesList() {
  const [params] = useSearchParams()
  const [kind, setKind] = useState('')
  const [unpaid, setUnpaid] = useState(params.get('unpaid') === '1')
  const { data, loading } = useLoad(async () => {
    let q = supabase.from('shop_invoices').select('id, invoice_number, version, kind, status, total_cents, balance_cents, sent_at, created_at, order_id, project_id, snapshot->customer->>name, snapshot->>reference').order('created_at', { ascending: false }).limit(300)
    if (kind) q = q.eq('kind', kind)
    if (unpaid) q = q.eq('kind', 'invoice').eq('status', 'issued').gt('balance_cents', 0)
    else q = q.neq('status', 'superseded')
    return must(await q)
  }, [kind, unpaid])
  return (
    <div>
      <H1>Quotes & Invoices</H1>
      <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
        <select className="select !w-auto" value={kind} onChange={e => setKind(e.target.value)}>
          <option value="">All documents</option><option value="invoice">Invoices</option><option value="quote">Quotes</option><option value="receipt">Receipts</option>
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={unpaid} onChange={e => setUnpaid(e.target.checked)} /> Unpaid only</label>
      </div>
      {loading ? <Empty>Loading…</Empty> : !data?.length ? <Empty>No documents yet. Invoices are created when you confirm an order or from a design project.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Number</th><th>Customer</th><th>For</th><th>Status</th><th className="text-right">Total</th><th className="text-right">Balance</th><th>Sent</th></tr></thead>
            <tbody>{data.map(i => (
              <tr key={i.id}>
                <td><Link className="font-bold text-accent-2" to={`/admin/invoices/${i.id}`}>{i.invoice_number}</Link>{i.version > 1 && <span className="ml-1 text-xs text-muted">v{i.version}</span>} <span className="badge">{i.kind}</span></td>
                <td>{i.name}</td><td className="text-muted">{i.reference}</td><td><StatusBadge value={i.status} /></td>
                <td className="text-right tabular-nums">{money(i.total_cents)}</td>
                <td className="text-right tabular-nums">{i.kind === 'invoice' ? money(i.balance_cents) : '—'}</td>
                <td className="text-muted">{i.sent_at ? fmtDate(i.sent_at) : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function InvoiceBuilderPage() {
  const { id } = useParams()
  const { data, loading, error, reload } = useLoad(async () => must(await supabase.from('shop_invoices').select('*').eq('id', id).single()), [id])
  if (loading) return <Empty>Loading…</Empty>
  if (error) return <div className="err">{error.message}</div>
  return (
    <div className="space-y-4">
      <H1 actions={<>
        {data.order_id && <Link className="btn btn-ghost btn-sm" to={`/admin/orders/${data.order_id}`}>Open order</Link>}
        {data.project_id && <Link className="btn btn-ghost btn-sm" to={`/admin/projects/${data.project_id}`}>Open project</Link>}
      </>}>{data.snapshot.title} {data.invoice_number}</H1>
      {data.status === 'superseded' && <div className="note">This version was replaced by a newer one.</div>}
      <Panel>
        <div className="mb-4 grid gap-1 text-sm sm:grid-cols-2">
          <div><b>{data.snapshot.customer?.name}</b><div className="text-muted">{data.snapshot.customer?.email} · {data.snapshot.customer?.phone}</div></div>
          <div className="sm:text-right"><div>Reference: <b>{data.snapshot.reference}</b></div><div className="text-muted">Created {fmtDateTime(data.created_at)}</div></div>
        </div>
        <InvoiceBuilder invoice={data} onChanged={inv => (inv && inv.id !== id ? window.location.assign(`/admin/invoices/${inv.id}`) : reload())} />
      </Panel>
    </div>
  )
}
