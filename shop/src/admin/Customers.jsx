import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, must, audit } from './api.js'
import { useLoad, useAction, Msg, H1, Panel, Field, Empty, StatusBadge } from './ui.jsx'
import { money, fmtDate } from '../lib/format.js'

export function CustomersList() {
  const [q, setQ] = useState('')
  const { data, loading } = useLoad(async () => must(await supabase.from('shop_customers').select('*, shop_orders(total_cents, status)').order('created_at', { ascending: false }).limit(1000)))
  const list = (data || []).filter(c => !q || `${c.name} ${c.email} ${c.team || ''}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <H1>Customers</H1>
      <input className="input mb-4 sm:!w-80" placeholder="Search name, email, team…" value={q} onChange={e => setQ(e.target.value)} />
      {loading ? <Empty>Loading…</Empty> : !list.length ? <Empty>No customers.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Team</th><th className="text-right">Orders</th><th className="text-right">Spent</th><th>Since</th></tr></thead>
            <tbody>{list.map(c => {
              const live = c.shop_orders.filter(o => o.status !== 'cancelled')
              return (
                <tr key={c.id}>
                  <td><Link className="font-bold text-accent-2" to={`/admin/customers/${c.id}`}>{c.name}</Link></td>
                  <td>{c.email}</td><td>{c.team || '—'}</td><td className="text-right">{live.length}</td>
                  <td className="text-right tabular-nums">{money(live.reduce((s, o) => s + o.total_cents, 0))}</td><td className="text-muted">{fmtDate(c.created_at)}</td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function CustomerDetail() {
  const { id } = useParams()
  const { data, loading, reload } = useLoad(async () => {
    const [c, orders, projects] = await Promise.all([
      supabase.from('shop_customers').select('*').eq('id', id).single(),
      supabase.from('shop_orders').select('id, order_number, order_type, total_cents, status, payment_status, created_at').eq('customer_id', id).order('created_at', { ascending: false }),
      supabase.from('shop_design_projects').select('id, project_number, title, status').eq('customer_id', id).order('created_at', { ascending: false }),
    ])
    return { customer: must(c), orders: must(orders), projects: must(projects) }
  }, [id])
  const [v, setV] = useState(null)
  const { busy, msg, run } = useAction()
  if (loading) return <Empty>Loading…</Empty>
  const c = v || data.customer
  return (
    <div className="space-y-4">
      <H1 actions={<Link className="btn btn-ghost btn-sm" to="/admin/customers">← Customers</Link>}>{data.customer.name}</H1>
      <Panel title="Details">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input className="input" value={c.name} onChange={e => setV({ ...c, name: e.target.value })} /></Field>
          <Field label="Email"><input className="input" value={c.email} onChange={e => setV({ ...c, email: e.target.value })} /></Field>
          <Field label="Phone"><input className="input" value={c.phone || ''} onChange={e => setV({ ...c, phone: e.target.value })} /></Field>
          <Field label="Team"><input className="input" value={c.team || ''} onChange={e => setV({ ...c, team: e.target.value })} /></Field>
          <Field label="Notes" className="sm:col-span-2"><textarea className="textarea" rows={2} value={c.notes || ''} onChange={e => setV({ ...c, notes: e.target.value })} /></Field>
        </div>
        <button className="btn btn-primary btn-sm mt-3" disabled={!v || busy} onClick={() => run(async () => {
          must(await supabase.from('shop_customers').update({ name: c.name, email: c.email.trim().toLowerCase(), phone: c.phone || null, team: c.team || null, notes: c.notes || null }).eq('id', id))
          await audit('customer.updated', 'shop_customers', id); setV(null); reload()
        }, 'Saved.')}>Save</button>
        <div className="mt-2"><Msg msg={msg} /></div>
      </Panel>
      <Panel title="Orders">
        {data.orders.length === 0 ? <p className="text-sm text-muted">No orders.</p> : data.orders.map(o => (
          <div key={o.id} className="flex flex-wrap items-center gap-2 border-b border-line py-2 text-sm">
            <Link className="font-bold text-accent-2" to={`/admin/orders/${o.id}`}>{o.order_number}</Link><span className="badge">{o.order_type}</span>
            <span className="tabular-nums">{money(o.total_cents)}</span><StatusBadge value={o.status} /><StatusBadge value={o.payment_status} kind="payment" />
            <span className="ml-auto text-muted">{fmtDate(o.created_at)}</span>
          </div>
        ))}
      </Panel>
      <Panel title="Design projects">
        {data.projects.length === 0 ? <p className="text-sm text-muted">No projects.</p> : data.projects.map(p => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 border-b border-line py-2 text-sm">
            <Link className="font-bold text-accent-2" to={`/admin/projects/${p.id}`}>{p.project_number}</Link><span>{p.title}</span><StatusBadge value={p.status} kind="project" />
          </div>
        ))}
      </Panel>
    </div>
  )
}
