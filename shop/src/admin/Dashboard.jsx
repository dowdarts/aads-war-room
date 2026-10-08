import { Link } from 'react-router-dom'
import { supabase, must } from './api.js'
import { useLoad, H1, Panel, Stat, StatusBadge, Empty } from './ui.jsx'
import { money, fmtDateTime } from '../lib/format.js'

async function load() {
  const count = async q => (await q).count || 0
  const head = { count: 'exact', head: true }
  const [newOrders, awaiting, inquiries, feedback, approvals, production, toShip, needImages, unpaidInv, recent, failedEmails] = await Promise.all([
    count(supabase.from('shop_orders').select('id', head).eq('status', 'new')),
    count(supabase.from('shop_orders').select('id', head).eq('status', 'awaiting_payment')),
    count(supabase.from('shop_design_projects').select('id', head).in('status', ['new_inquiry', 'under_review'])),
    count(supabase.from('shop_design_projects').select('id', head).in('status', ['revision_requested', 'mockup_in_progress'])),
    count(supabase.from('shop_design_projects').select('id', head).in('status', ['awaiting_feedback', 'initial_mockup_sent', 'revised_mockup_sent'])),
    count(supabase.from('shop_orders').select('id', head).in('status', ['payment_confirmed', 'awaiting_production', 'in_production'])),
    count(supabase.from('shop_orders').select('id', head).eq('status', 'production_complete')),
    count(supabase.from('shop_products').select('id', head).eq('needs_images', true).eq('status', 'active')),
    supabase.from('shop_invoices').select('balance_cents').eq('kind', 'invoice').eq('status', 'issued').gt('balance_cents', 0),
    supabase.from('shop_orders').select('id, order_number, order_type, contact_name, total_cents, status, payment_status, created_at').order('created_at', { ascending: false }).limit(8),
    count(supabase.from('shop_email_events').select('id', head).eq('status', 'failed')),
  ])
  const unpaid = must(unpaidInv)
  return {
    newOrders, awaiting, inquiries, feedback, approvals, production, toShip, needImages, failedEmails,
    unpaidCount: unpaid.length, unpaidCents: unpaid.reduce((s, i) => s + i.balance_cents, 0), recent: must(recent),
  }
}

export default function Dashboard() {
  const { data, loading, error } = useLoad(load)
  if (loading) return <Empty>Loading…</Empty>
  if (error) return <div className="err">{error.message}</div>
  return (
    <div className="space-y-5">
      <H1>Dashboard</H1>
      {data.failedEmails > 0 && <div className="err">{data.failedEmails} email(s) failed to send. <Link className="underline" to="/admin/settings#email-log">Review & retry</Link></div>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="New orders" value={data.newOrders} to="/admin/orders?status=new" tone="accent" />
        <Stat label="Awaiting payment" value={data.awaiting} to="/admin/orders?status=awaiting_payment" />
        <Stat label="Unpaid balances" value={money(data.unpaidCents)} to="/admin/invoices?unpaid=1" />
        <Stat label="New design inquiries" value={data.inquiries} to="/admin/projects?status=new" tone="accent" />
        <Stat label="Revisions to do" value={data.feedback} to="/admin/projects?status=work" tone="accent" />
        <Stat label="Awaiting customer feedback" value={data.approvals} to="/admin/projects?status=feedback" />
        <Stat label="In production" value={data.production} to="/admin/production" />
        <Stat label="Ready to ship" value={data.toShip} to="/admin/production" tone="accent" />
      </div>
      {data.needImages > 0 && <div className="note">{data.needImages} product(s) still use placeholder images. <Link className="underline" to="/admin/products/bulk">Upload artwork</Link></div>}
      <Panel title="Recent orders" actions={<Link to="/admin/orders" className="text-sm text-accent-2">All orders →</Link>}>
        {data.recent.length === 0 ? <Empty>No orders yet.</Empty> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Payment</th><th>Placed</th></tr></thead>
              <tbody>{data.recent.map(o => (
                <tr key={o.id}>
                  <td><Link className="font-bold text-accent-2" to={`/admin/orders/${o.id}`}>{o.order_number}</Link> <span className="badge">{o.order_type}</span></td>
                  <td>{o.contact_name}</td><td className="tabular-nums">{money(o.total_cents)}</td>
                  <td><StatusBadge value={o.status} /></td><td><StatusBadge value={o.payment_status} kind="payment" /></td>
                  <td className="whitespace-nowrap text-muted">{fmtDateTime(o.created_at)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
