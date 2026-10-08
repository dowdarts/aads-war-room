import { useState } from 'react'
import { supabase, must, audit, toCents, toDollars } from './api.js'
import { useLoad, useAction, Msg, H1, Panel, Field, Empty, StatusBadge } from './ui.jsx'
import { money, fmtDate } from '../lib/format.js'

const BLANK = {
  code: '', label: '', description: '', adjustment: 'percent', percent: '10', fixed: '60.00', waive_design_fee: false, channel: 'any',
  collection_ids: [], customer_email: '', project_number: '', starts_at: '', expires_at: '', max_redemptions: '', max_per_customer: '', min_qty: '', max_qty: '',
}

const toLocalInput = d => (d ? new Date(d).toISOString().slice(0, 16) : '')

function CodeForm({ initial, collections, onSaved, onCancel }) {
  const [v, setV] = useState(initial)
  const { busy, msg, run } = useAction()
  const set = patch => setV(x => ({ ...x, ...patch }))
  const save = () => run(async () => {
    const code = v.code.trim().toUpperCase()
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw new Error('Codes are 3–40 letters, numbers, - or _.')
    if (v.adjustment === 'none' && !v.waive_design_fee) throw new Error('A code needs a price adjustment, a design-fee waiver, or both.')
    let customer_id = null, project_id = null
    if (v.customer_email.trim()) {
      const c = must(await supabase.from('shop_customers').select('id').ilike('email', v.customer_email.trim()).maybeSingle())
      if (!c) throw new Error('No customer with that email yet.')
      customer_id = c.id
    }
    if (v.project_number.trim()) {
      const p = must(await supabase.from('shop_design_projects').select('id, customer_id').eq('project_number', v.project_number.trim().toUpperCase()).maybeSingle())
      if (!p) throw new Error('No project with that number.')
      project_id = p.id; customer_id = customer_id || p.customer_id
    }
    const row = {
      code, label: v.label || null, description: v.description || null,
      kind: v.adjustment === 'none' ? null : v.adjustment,
      percent: v.adjustment === 'percent' ? Number(v.percent) : null,
      fixed_unit_cents: v.adjustment === 'fixed' ? toCents(v.fixed) : null,
      waive_design_fee: v.waive_design_fee, channel: v.channel, collection_ids: v.collection_ids, customer_id, project_id,
      starts_at: v.starts_at ? new Date(v.starts_at).toISOString() : null, expires_at: v.expires_at ? new Date(v.expires_at).toISOString() : null,
      max_redemptions: parseInt(v.max_redemptions, 10) || null, max_per_customer: parseInt(v.max_per_customer, 10) || null,
      min_qty: parseInt(v.min_qty, 10) || null, max_qty: parseInt(v.max_qty, 10) || null,
    }
    if (row.kind === 'percent' && !(row.percent > 0 && row.percent <= 100)) throw new Error('Percent must be between 1 and 100.')
    if (row.kind === 'fixed' && !(row.fixed_unit_cents >= 0)) throw new Error('Enter the fixed price per shirt.')
    if (v.id) {
      must(await supabase.from('shop_discount_codes').update(row).eq('id', v.id))
      await audit('discount.updated', 'shop_discount_codes', v.id, { code })
    } else {
      const saved = must(await supabase.from('shop_discount_codes').insert(row).select().single())
      await audit('discount.created', 'shop_discount_codes', saved.id, { code })
    }
    onSaved()
  })
  return (
    <Panel title={v.id ? `Edit ${v.code}` : 'New discount code'}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Code"><input className="input uppercase" value={v.code} onChange={e => set({ code: e.target.value })} /></Field>
        <Field label="Label"><input className="input" value={v.label} onChange={e => set({ label: e.target.value })} placeholder="e.g. Halifax Darts League deal" /></Field>
        <Field label="Channel">
          <select className="select" value={v.channel} onChange={e => set({ channel: e.target.value })}>
            <option value="any">Retail + custom</option><option value="RETAIL">Retail store only</option><option value="CUSTOM">Custom/team orders only</option>
          </select>
        </Field>
        <Field label="Shirt price adjustment" hint="One adjustment per code — never stacked">
          <select className="select" value={v.adjustment} onChange={e => set({ adjustment: e.target.value })}>
            <option value="percent">Percent off shirts</option><option value="fixed">Fixed price per shirt</option><option value="none">None (fee waiver only)</option>
          </select>
        </Field>
        {v.adjustment === 'percent' && <Field label="Percent off"><input className="input" inputMode="decimal" value={v.percent} onChange={e => set({ percent: e.target.value })} /></Field>}
        {v.adjustment === 'fixed' && <Field label="Price per shirt ($)" hint="Replaces the tier price"><input className="input" inputMode="decimal" value={v.fixed} onChange={e => set({ fixed: e.target.value })} /></Field>}
        <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" checked={v.waive_design_fee} onChange={e => set({ waive_design_fee: e.target.checked })} /> Waive $50 design fee (custom)</label>
        <Field label="Only for customer (email)"><input className="input" value={v.customer_email} onChange={e => set({ customer_email: e.target.value })} placeholder="Anyone" /></Field>
        <Field label="Only for project #"><input className="input" value={v.project_number} onChange={e => set({ project_number: e.target.value })} placeholder="Any" /></Field>
        <Field label="Only for collections" hint="Ctrl/⌘-click for several; none = all">
          <select multiple className="select h-24" value={v.collection_ids} onChange={e => set({ collection_ids: [...e.target.selectedOptions].map(o => o.value) })}>
            {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Starts"><input type="datetime-local" className="input" value={v.starts_at} onChange={e => set({ starts_at: e.target.value })} /></Field>
        <Field label="Expires"><input type="datetime-local" className="input" value={v.expires_at} onChange={e => set({ expires_at: e.target.value })} /></Field>
        <Field label="Total uses"><input className="input" inputMode="numeric" value={v.max_redemptions} onChange={e => set({ max_redemptions: e.target.value })} placeholder="Unlimited" /></Field>
        <Field label="Uses per customer"><input className="input" inputMode="numeric" value={v.max_per_customer} onChange={e => set({ max_per_customer: e.target.value })} placeholder="Unlimited" /></Field>
        <Field label="Min shirts"><input className="input" inputMode="numeric" value={v.min_qty} onChange={e => set({ min_qty: e.target.value })} /></Field>
        <Field label="Max shirts"><input className="input" inputMode="numeric" value={v.max_qty} onChange={e => set({ max_qty: e.target.value })} /></Field>
        <Field label="Internal description" className="sm:col-span-3"><input className="input" value={v.description} onChange={e => set({ description: e.target.value })} /></Field>
      </div>
      <div className="mt-3 flex gap-2">
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>Save code</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
      <div className="mt-2"><Msg msg={msg} /></div>
    </Panel>
  )
}

export default function DiscountCodes() {
  const { data, loading, reload } = useLoad(async () => {
    const [codes, cols, reds] = await Promise.all([
      supabase.from('shop_discount_codes').select('*, shop_customers(email), shop_design_projects(project_number)').order('created_at', { ascending: false }),
      supabase.from('shop_collections').select('id, name').order('sort_order'),
      supabase.from('shop_discount_redemptions').select('code_id, savings_cents, order_id, created_at, shop_orders(order_number)').order('created_at', { ascending: false }),
    ])
    return { codes: must(codes), collections: must(cols), redemptions: must(reds) }
  })
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(null)
  const { msg, run } = useAction()

  const edit = c => setEditing({
    ...BLANK, id: c.id, code: c.code, label: c.label || '', description: c.description || '', adjustment: c.kind || 'none',
    percent: c.percent != null ? String(Number(c.percent)) : '10', fixed: c.fixed_unit_cents != null ? toDollars(c.fixed_unit_cents) : '60.00',
    waive_design_fee: c.waive_design_fee, channel: c.channel, collection_ids: c.collection_ids || [],
    customer_email: c.shop_customers?.email || '', project_number: c.shop_design_projects?.project_number || '',
    starts_at: toLocalInput(c.starts_at), expires_at: toLocalInput(c.expires_at), max_redemptions: c.max_redemptions || '', max_per_customer: c.max_per_customer || '',
    min_qty: c.min_qty || '', max_qty: c.max_qty || '',
  })

  return (
    <div className="space-y-4">
      <H1 actions={!editing && <button className="btn btn-primary btn-sm" onClick={() => setEditing({ ...BLANK })}>+ New code</button>}>Discount codes</H1>
      {editing && data && <CodeForm initial={editing} collections={data.collections} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
      <Msg msg={msg} />
      {loading ? <Empty>Loading…</Empty> : !data.codes.length ? <Empty>No codes yet.</Empty> : (
        <div className="card divide-y divide-line">
          {data.codes.map(c => {
            const reds = data.redemptions.filter(r => r.code_id === c.id)
            const saved = reds.reduce((s, r) => s + r.savings_cents, 0)
            const expired = c.expires_at && new Date(c.expires_at) < new Date()
            return (
              <div key={c.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-lg font-black">{c.code}</span>
                  <StatusBadge value={expired ? 'expired' : c.status} />
                  <span className="text-sm">{[c.kind === 'percent' && `${Number(c.percent)}% off`, c.kind === 'fixed' && `${money(c.fixed_unit_cents)}/shirt`, c.waive_design_fee && 'design fee waived'].filter(Boolean).join(' + ')}</span>
                  <span className="badge">{c.channel === 'any' ? 'Retail + custom' : c.channel}</span>
                  {c.shop_customers && <span className="badge badge-accent">{c.shop_customers.email}</span>}
                  {c.shop_design_projects && <span className="badge badge-accent">{c.shop_design_projects.project_number}</span>}
                </div>
                <div className="mt-1 text-sm text-muted">
                  {c.label && <>{c.label} · </>}Used {c.redemption_count}{c.max_redemptions ? ` / ${c.max_redemptions}` : ''} · Saved customers {money(saved)}
                  {c.expires_at && <> · Expires {fmtDate(c.expires_at)}</>}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="btn btn-ghost btn-sm" onClick={() => edit(c)}>Edit</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => run(async () => {
                    must(await supabase.from('shop_discount_codes').update({ status: c.status === 'active' ? 'disabled' : 'active' }).eq('id', c.id))
                    await audit(c.status === 'active' ? 'discount.disabled' : 'discount.enabled', 'shop_discount_codes', c.id, { code: c.code }); reload()
                  })}>{c.status === 'active' ? 'Disable' : 'Enable'}</button>
                  {reds.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? 'Hide' : 'Show'} orders ({reds.length})</button>}
                </div>
                {open === c.id && (
                  <ul className="mt-2 text-sm">{reds.map((r, i) => <li key={i}>{r.shop_orders?.order_number || 'Order'} · saved {money(r.savings_cents)} · {fmtDate(r.created_at)}</li>)}</ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
