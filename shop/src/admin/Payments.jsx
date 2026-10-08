import { Link } from 'react-router-dom'
import { supabase, must } from './api.js'
import { useLoad, H1, Empty, StatusBadge } from './ui.jsx'
import { money, fmtDate } from '../lib/format.js'

export default function Payments() {
  const { data, loading } = useLoad(async () => must(await supabase.from('shop_payments')
    .select('*, shop_orders(id, order_number, contact_name), shop_design_projects(id, project_number, title)')
    .order('created_at', { ascending: false }).limit(500)))
  const verified = (data || []).filter(p => p.status === 'verified')
  return (
    <div>
      <H1>Payments</H1>
      <p className="mb-4 text-sm text-muted">Record payments from an order’s or project’s invoice once the e-Transfer lands in your account. Verified total: <b className="text-text">{money(verified.reduce((s, p) => s + p.amount_cents, 0))}</b></p>
      {loading ? <Empty>Loading…</Empty> : !data.length ? <Empty>No payments recorded yet.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Received</th><th>For</th><th>Customer</th><th className="text-right">Amount</th><th>Reference</th><th>Status</th></tr></thead>
            <tbody>{data.map(p => (
              <tr key={p.id}>
                <td>{fmtDate(p.received_on || p.created_at)}</td>
                <td>
                  {p.shop_orders && <Link className="text-accent-2" to={`/admin/orders/${p.shop_orders.id}`}>{p.shop_orders.order_number}</Link>}
                  {!p.shop_orders && p.shop_design_projects && <Link className="text-accent-2" to={`/admin/projects/${p.shop_design_projects.id}`}>{p.shop_design_projects.project_number}</Link>}
                </td>
                <td>{p.shop_orders?.contact_name || p.shop_design_projects?.title}</td>
                <td className="text-right tabular-nums">{money(p.amount_cents)}</td>
                <td>{p.reference || '—'}</td>
                <td><StatusBadge value={p.status} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
