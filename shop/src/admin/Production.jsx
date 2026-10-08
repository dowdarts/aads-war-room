import { Link } from 'react-router-dom'
import { supabase, must, admin } from './api.js'
import { useLoad, useAction, Msg, H1, Empty } from './ui.jsx'
import { STATUS_LABELS, fmtDate } from '../lib/format.js'

const COLUMNS = ['payment_confirmed', 'awaiting_production', 'in_production', 'production_complete', 'shipped']
const NEXT = { payment_confirmed: 'awaiting_production', awaiting_production: 'in_production', in_production: 'production_complete', shipped: 'delivered' }

export default function Production() {
  const { data, loading, reload } = useLoad(async () => must(await supabase.from('shop_orders')
    .select('id, order_number, order_type, contact_name, status, created_at, shop_order_items(qty, size, product_name)')
    .in('status', COLUMNS).order('created_at')))
  const { busy, msg, run } = useAction()
  return (
    <div>
      <H1>Production & shipping</H1>
      <p className="mb-4 text-sm text-muted">Paid orders move left to right. Mark an order shipped from its order page to email tracking to the customer.</p>
      <Msg msg={msg} />
      {loading ? <Empty>Loading…</Empty> : (
        <div className="grid gap-3 md:grid-cols-5">
          {COLUMNS.map(col => {
            const orders = data.filter(o => o.status === col)
            return (
              <div key={col} className="card p-3">
                <div className="mb-2 flex items-center justify-between text-sm font-black"><span>{STATUS_LABELS[col]}</span><span className="badge">{orders.length}</span></div>
                <div className="space-y-2">
                  {orders.map(o => {
                    const units = o.shop_order_items.reduce((s, i) => s + i.qty, 0)
                    const sizes = Object.entries(o.shop_order_items.reduce((m, i) => ({ ...m, [i.size]: (m[i.size] || 0) + i.qty }), {})).map(([s, q]) => `${q}×${s}`).join(' ')
                    return (
                      <div key={o.id} className="rounded-xl border border-line bg-panel-2 p-2.5 text-sm">
                        <Link className="font-bold text-accent-2" to={`/admin/orders/${o.id}`}>{o.order_number}</Link>
                        <div>{o.contact_name}</div>
                        <div className="text-xs text-muted">{units} shirts · {sizes}</div>
                        <div className="text-xs text-muted">{fmtDate(o.created_at)} · {o.order_type}</div>
                        {NEXT[col] && (
                          <button className="btn btn-ghost btn-sm mt-2 w-full" disabled={busy} onClick={() => run(async () => { await admin('set_order_status', { orderId: o.id, status: NEXT[col] }); await reload() })}>
                            → {STATUS_LABELS[NEXT[col]]}
                          </button>
                        )}
                        {col === 'production_complete' && <Link className="btn btn-primary btn-sm mt-2 w-full" to={`/admin/orders/${o.id}`}>Ship…</Link>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
