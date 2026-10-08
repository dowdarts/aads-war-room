import { useMemo, useState } from 'react'
import { supabase, must } from './api.js'
import { useLoad, H1, Panel, Stat, Empty } from './ui.jsx'
import { money } from '../lib/format.js'
import { SIZES } from '@pricing'

function Bars({ rows, format = v => v }) {
  const max = Math.max(1, ...rows.map(r => r[1]))
  return (
    <div className="space-y-1.5">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-sm">
          <div className="relative min-w-0 overflow-hidden rounded-md bg-panel-2">
            <div className="absolute inset-y-0 left-0 bg-accent/25" style={{ width: `${(value / max) * 100}%` }} />
            <div className="relative truncate px-2 py-1">{label}</div>
          </div>
          <div className="w-20 text-right tabular-nums">{format(value)}</div>
        </div>
      ))}
      {rows.length === 0 && <div className="text-sm text-muted">No data.</div>}
    </div>
  )
}

const tally = (list, key, val = () => 1) => Object.entries(list.reduce((m, x) => { const k = key(x); if (k != null) m[k] = (m[k] || 0) + val(x); return m }, {})).sort((a, b) => b[1] - a[1])

export default function Reports() {
  const year = new Date().getFullYear()
  const [from, setFrom] = useState(`${year}-01-01`)
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))
  const { data, loading } = useLoad(async () => {
    const end = new Date(`${to}T23:59:59`).toISOString(), start = new Date(`${from}T00:00:00`).toISOString()
    const [orders, payments, invoices, reds] = await Promise.all([
      supabase.from('shop_orders').select('id, order_type, status, total_cents, discount_cents, created_at, shop_order_items(qty, size, closure, pocket, product_name, collection_name, price_class, line_cents)').gte('created_at', start).lte('created_at', end).neq('status', 'cancelled'),
      supabase.from('shop_payments').select('amount_cents, received_on, created_at').eq('status', 'verified').gte('created_at', start).lte('created_at', end),
      supabase.from('shop_invoices').select('total_cents, balance_cents, issued_at').eq('kind', 'invoice').eq('status', 'issued'),
      supabase.from('shop_discount_redemptions').select('savings_cents').gte('created_at', start).lte('created_at', end),
    ])
    return { orders: must(orders), payments: must(payments), invoices: must(invoices), reds: must(reds) }
  }, [from, to])

  const r = useMemo(() => {
    if (!data) return null
    const items = data.orders.flatMap(o => o.shop_order_items.map(i => ({ ...i, type: o.order_type })))
    const sum = (l, f) => l.reduce((s, x) => s + f(x), 0)
    const issuedInRange = data.invoices.filter(i => i.issued_at && i.issued_at.slice(0, 10) >= from && i.issued_at.slice(0, 10) <= to)
    return {
      retail: sum(data.orders.filter(o => o.order_type === 'RETAIL'), o => o.total_cents),
      custom: sum(data.orders.filter(o => o.order_type === 'CUSTOM'), o => o.total_cents),
      units: sum(items, i => i.qty),
      paid: sum(data.payments, p => p.amount_cents),
      invoiced: sum(issuedInRange, i => i.total_cents),
      outstanding: sum(data.invoices, i => i.balance_cents),
      outstandingCount: data.invoices.filter(i => i.balance_cents > 0).length,
      savings: sum(data.reds, x => x.savings_cents),
      redemptions: data.reds.length,
      byCollection: tally(items, i => i.collection_name || 'Custom', i => i.qty),
      byProduct: tally(items, i => i.product_name, i => i.qty).slice(0, 10),
      bySize: SIZES.map(s => [s, sum(items.filter(i => i.size === s), i => i.qty)]),
      byConfig: tally(items, i => `${i.closure === 'zipper' ? 'Zipper' : 'Button'} · ${i.pocket ? 'Pocket' : 'No pocket'}`, i => i.qty),
      byStatus: tally(data.orders, o => o.status),
    }
  }, [data, from, to])

  return (
    <div className="space-y-4">
      <H1>Reports</H1>
      <div className="card flex flex-wrap items-end gap-3 p-3">
        <label><span className="label">From</span><input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label><span className="label">To</span><input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} /></label>
      </div>
      {loading || !r ? <Empty>Loading…</Empty> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Retail sales" value={money(r.retail)} />
            <Stat label="Custom sales" value={money(r.custom)} />
            <Stat label="Shirts sold" value={r.units} />
            <Stat label="Payments received" value={money(r.paid)} />
            <Stat label="Invoiced (issued)" value={money(r.invoiced)} />
            <Stat label="Outstanding (all time)" value={`${money(r.outstanding)}`} />
            <Stat label="Discount savings" value={money(r.savings)} />
            <Stat label="Codes redeemed" value={r.redemptions} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Shirts by collection"><Bars rows={r.byCollection} /></Panel>
            <Panel title="Top products"><Bars rows={r.byProduct} /></Panel>
            <Panel title="Sizes"><Bars rows={r.bySize} /></Panel>
            <Panel title="Configurations"><Bars rows={r.byConfig} /></Panel>
            <Panel title="Orders by status (production queue)"><Bars rows={r.byStatus} /></Panel>
            <Panel title="Paid vs invoiced"><Bars rows={[['Invoiced', r.invoiced], ['Paid', r.paid], ['Outstanding', r.outstanding]]} format={money} /></Panel>
          </div>
        </>
      )}
    </div>
  )
}
