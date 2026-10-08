import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase, must, admin } from './api.js'
import { useLoad, useAction, Msg, H1, Panel, Field, Empty, StatusBadge } from './ui.jsx'
import { InvoiceBuilder } from './Invoices.jsx'
import { money, fmtDate, fmtDateTime, lineDescription, STATUS_LABELS } from '../lib/format.js'

export function OrdersList() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') || ''
  const type = params.get('type') || ''
  const [q, setQ] = useState('')
  const { data, loading } = useLoad(async () => {
    let query = supabase.from('shop_orders').select('id, order_number, order_type, contact_name, contact_email, total_cents, status, payment_status, created_at, shop_order_items(qty)').order('created_at', { ascending: false }).limit(500)
    if (status) query = query.eq('status', status)
    if (type) query = query.eq('order_type', type)
    return must(await query)
  }, [status, type])
  const set = (k, v) => { const n = new URLSearchParams(params); v ? n.set(k, v) : n.delete(k); setParams(n, { replace: true }) }
  const list = (data || []).filter(o => !q || `${o.order_number} ${o.contact_name} ${o.contact_email}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <H1>Orders</H1>
      <div className="card mb-4 grid gap-3 p-3 sm:grid-cols-3">
        <input className="input" placeholder="Search order #, name, email…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="select" value={status} onChange={e => set('status', e.target.value)}>
          <option value="">All statuses</option>{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="select" value={type} onChange={e => set('type', e.target.value)}>
          <option value="">Retail + custom</option><option value="RETAIL">Retail</option><option value="CUSTOM">Custom</option>
        </select>
      </div>
      {loading ? <Empty>Loading…</Empty> : list.length === 0 ? <Empty>No orders match.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Order</th><th>Customer</th><th className="text-right">Shirts</th><th className="text-right">Total</th><th>Status</th><th>Payment</th><th>Placed</th></tr></thead>
            <tbody>{list.map(o => (
              <tr key={o.id}>
                <td><Link className="font-bold text-accent-2" to={`/admin/orders/${o.id}`}>{o.order_number}</Link> <span className="badge">{o.order_type}</span></td>
                <td>{o.contact_name}<div className="text-xs text-muted">{o.contact_email}</div></td>
                <td className="text-right">{o.shop_order_items.reduce((s, i) => s + i.qty, 0)}</td>
                <td className="text-right tabular-nums">{money(o.total_cents)}</td>
                <td><StatusBadge value={o.status} /></td><td><StatusBadge value={o.payment_status} kind="payment" /></td>
                <td className="whitespace-nowrap text-muted">{fmtDateTime(o.created_at)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

async function loadOrder(id) {
  const [o, items, invoices, payments, shipments, emails] = await Promise.all([
    supabase.from('shop_orders').select('*').eq('id', id).single(),
    supabase.from('shop_order_items').select('*').eq('order_id', id).order('sort_order'),
    supabase.from('shop_invoices').select('*').eq('order_id', id).order('created_at'),
    supabase.from('shop_payments').select('*').eq('order_id', id).order('created_at'),
    supabase.from('shop_shipments').select('*').eq('order_id', id).order('created_at'),
    supabase.from('shop_email_events').select('id, purpose, recipient, status, error, created_at, sent_at').eq('order_id', id).order('created_at'),
  ])
  return { order: must(o), items: must(items), invoices: must(invoices), payments: must(payments), shipments: must(shipments), emails: must(emails) }
}

export function OrderDetail() {
  const { id } = useParams()
  const { data, loading, error, reload } = useLoad(() => loadOrder(id), [id])
  const { busy, msg, run } = useAction()
  const [ship, setShip] = useState({ carrier: 'Canada Post', trackingNumber: '', trackingUrl: '', dispatchedOn: new Date().toISOString().slice(0, 10), notify: true })
  if (loading) return <Empty>Loading…</Empty>
  if (error) return <div className="err">{error.message}</div>
  const { order, items, invoices, payments, shipments, emails } = data
  const current = [...invoices].reverse().find(i => i.kind === 'invoice' && ['draft', 'issued'].includes(i.status))
  const receipts = invoices.filter(i => i.kind === 'receipt')
  const p = order.pricing_snapshot?.pricing || {}

  return (
    <div className="space-y-4">
      <H1 actions={<Link to="/admin/orders" className="btn btn-ghost btn-sm">← Orders</Link>}>
        {order.order_number} <span className="badge align-middle">{order.order_type}</span>
      </H1>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge value={order.status} /><StatusBadge value={order.payment_status} kind="payment" />
        <span className="text-sm text-muted">Placed {fmtDateTime(order.created_at)}</span>
        {order.project_id && <Link className="text-sm text-accent-2 underline" to={`/admin/projects/${order.project_id}`}>Design project</Link>}
      </div>

      {order.status === 'new' && (
        <div className="card flex flex-wrap items-center gap-3 border-accent/50 p-4">
          <div className="flex-1"><div className="font-black">Review this order</div><div className="text-sm text-muted">Confirming creates the invoice from the order’s locked prices. You can edit it before sending.</div></div>
          <button className="btn btn-primary" disabled={busy} onClick={() => run(async () => { await admin('confirm_order', { orderId: order.id }); await reload() }, 'Order confirmed — invoice created below.')}>Confirm order & create invoice</button>
        </div>
      )}
      <Msg msg={msg} />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Panel title="Items">
          <ul className="divide-y divide-line text-sm">
            {items.map(it => (
              <li key={it.id} className="flex justify-between gap-3 py-2">
                <span><b>{it.qty}×</b> {it.product_name}{it.price_class === 'replica' && <span className="badge ml-1">Replica</span>}<span className="block text-xs text-muted">{lineDescription(it)}</span></span>
                <span className="whitespace-nowrap text-right tabular-nums">{money(it.unit_cents)} ea<br /><b>{money(it.line_cents)}</b></span>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid gap-1 border-t border-line pt-3 text-sm">
            {p.discountCents > 0 && <div className="flex justify-between"><span>Discount {order.discount_code && `(${order.discount_code})`}</span><span>−{money(p.discountCents)}</span></div>}
            {p.designFeeCents > 0 && <div className="flex justify-between"><span>Design fee</span><span>{money(p.designFeeCents)}</span></div>}
            {p.designFeeWaivedCents > 0 && <div className="flex justify-between"><span>Design fee waived</span><span>−{money(p.designFeeWaivedCents)}</span></div>}
            <div className="flex justify-between"><span>Shipping</span><span>{order.shipping_cents ? money(order.shipping_cents) : 'Free'}</span></div>
            {order.tax_cents > 0 && <div className="flex justify-between"><span>Tax</span><span>{money(order.tax_cents)}</span></div>}
            <div className="flex justify-between text-base font-black"><span>Order total</span><span>{money(order.total_cents)}</span></div>
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel title="Customer">
            <div className="text-sm">
              <div className="font-bold">{order.contact_name}</div>
              <a className="text-accent-2" href={`mailto:${order.contact_email}`}>{order.contact_email}</a>
              <div>{order.contact_phone}</div>
              <div className="mt-2 text-muted">{order.ship_street}<br />{order.ship_city}, {order.ship_province} {order.ship_postal}<br />{order.ship_country}</div>
              {order.instructions && <div className="note mt-2">{order.instructions}</div>}
              <Link className="mt-2 inline-block text-xs underline" to={`/admin/customers/${order.customer_id}`}>Customer history</Link>
            </div>
          </Panel>
          <Panel title="Status">
            <select className="select" value={order.status} disabled={busy} onChange={e => {
              const s = e.target.value
              if (s === 'cancelled' && !confirm('Cancel this order? Its invoice will be voided and any discount code released.')) return
              run(async () => { await admin('set_order_status', { orderId: order.id, status: s }); await reload() }, 'Status updated.')
            }}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Panel>
        </div>
      </div>

      {current && <Panel title="Invoice"><InvoiceBuilder invoice={current} onChanged={reload} /></Panel>}
      {receipts.map(r => <Panel key={r.id} title="Receipt"><InvoiceBuilder invoice={r} onChanged={reload} /></Panel>)}

      <Panel title="Payments">
        {payments.length === 0 ? <p className="text-sm text-muted">No payments recorded yet.{current?.status === 'issued' ? ' Record one from the invoice above.' : ''}</p> : (
          <table className="table">
            <thead><tr><th>Date</th><th>Amount</th><th>Reference</th><th>Status</th><th /></tr></thead>
            <tbody>{payments.map(pm => (
              <tr key={pm.id}>
                <td>{fmtDate(pm.received_on || pm.created_at)}</td><td className="tabular-nums">{money(pm.amount_cents)}</td><td>{pm.reference || '—'}</td><td><StatusBadge value={pm.status} /></td>
                <td>{pm.status === 'verified' && <button className="text-xs text-muted underline" onClick={() => confirm('Void this payment record?') && run(async () => { await admin('void_payment', { paymentId: pm.id }); await reload() })}>Void</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Panel>

      <Panel title="Shipping">
        {shipments.map(s => (
          <div key={s.id} className="mb-2 rounded-xl border border-line p-3 text-sm">
            <b>{s.carrier || 'Shipment'}</b> · {s.tracking_number || 'no tracking #'} · shipped {fmtDate(s.dispatched_on)} {s.notified_at ? <span className="badge badge-good">Customer notified</span> : null}
          </div>
        ))}
        {!['cancelled'].includes(order.status) && (
          <div className="grid gap-2 sm:grid-cols-4">
            <Field label="Carrier"><input className="input" value={ship.carrier} onChange={e => setShip({ ...ship, carrier: e.target.value })} /></Field>
            <Field label="Tracking #"><input className="input" value={ship.trackingNumber} onChange={e => setShip({ ...ship, trackingNumber: e.target.value })} /></Field>
            <Field label="Tracking link"><input className="input" placeholder="https://…" value={ship.trackingUrl} onChange={e => setShip({ ...ship, trackingUrl: e.target.value })} /></Field>
            <Field label="Shipped on"><input type="date" className="input" value={ship.dispatchedOn} onChange={e => setShip({ ...ship, dispatchedOn: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" checked={ship.notify} onChange={e => setShip({ ...ship, notify: e.target.checked })} /> Email the customer their tracking info</label>
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(async () => { await admin('mark_shipped', { orderId: order.id, ...ship }); await reload() }, 'Marked as shipped.')}>Mark shipped</button>
          </div>
        )}
      </Panel>

      <Panel title="Emails">
        {emails.length === 0 ? <p className="text-sm text-muted">No emails yet.</p> : (
          <table className="table">
            <tbody>{emails.map(e => (
              <tr key={e.id}>
                <td>{e.purpose.replace(/_/g, ' ')}</td><td className="text-muted">{e.recipient}</td><td><StatusBadge value={e.status} /></td>
                <td className="text-muted">{fmtDateTime(e.sent_at || e.created_at)}</td>
                <td>{e.status !== 'sent' && <button className="text-xs underline" onClick={() => run(async () => { await admin('retry_email', { eventId: e.id }); await reload() }, 'Retried.')}>Retry</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
