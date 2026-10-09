import { useState } from 'react'
import { supabase, must, admin, audit, toCents, toDollars } from './api.js'
import { useLoad, useAction, Msg, H1, Panel, Field, Empty, StatusBadge } from './ui.jsx'
import { uploadProductImage, IMAGE_ACCEPT } from './images.js'
import { fmtDateTime } from '../lib/format.js'

// type: money (stored as cents) | int | number | text | long | image
const FIELDS = [
  ['business_name', 'Business name', 'text'],
  ['shop_url', 'Shop URL', 'text', 'Used in email links, e.g. https://shop.aadsdarts.com'],
  ['logo_url', 'Logo', 'image', 'Shown in the shop header. Leave empty for the CGC text logo.'],
  ['contact_email', 'Public contact email', 'text'],
  ['etransfer_email', 'Interac e-Transfer email', 'text'],
  ['etransfer_instructions', 'Payment instructions', 'long'],
  ['shipping_cents', 'Retail shipping for 1–2 shirts ($)', 'money', 'Required before customers can check out with fewer than 3 shirts.'],
  ['free_shipping_min_qty', 'Free shipping from (shirts)', 'int'],
  ['custom_shipping_cents', 'Custom/team order shipping ($)', 'money'],
  ['tax_rate_percent', 'Tax rate (%)', 'number', '0 = no tax'],
  ['retail_quote_message', 'Message for 7+ retail shirts', 'long'],
  ['admin_notify_email', 'Admin notification email', 'text', 'Private — new order and design-request alerts are sent here.'],
  ['email_from', 'Sender for customer emails', 'text', 'Confirmations, invoices, receipts, mockups. Must be @aadsdarts.com (verified in Resend).'],
  ['reply_to_email', 'Customer reply-to address', 'text', 'Where customer replies go, e.g. shop@aadsdarts.com (forward it to your inbox).'],
  ['email_from_orders', 'Sender for new-order alerts', 'text', 'e.g. CGC Darts Invoices <invoice@aadsdarts.com> — filter on this to label orders.'],
  ['email_from_inquiries', 'Sender for design-request alerts', 'text', 'e.g. CGC Darts Custom <custom@aadsdarts.com> — filter on this to label requests.'],
]
const PUBLIC = new Set(['business_name', 'shop_url', 'logo_url', 'contact_email', 'etransfer_email', 'etransfer_instructions', 'shipping_cents', 'free_shipping_min_qty', 'custom_shipping_cents', 'tax_rate_percent', 'retail_quote_message'])

function toInput(type, v) {
  if (v == null) return ''
  if (type === 'money') return toDollars(v)
  return String(v)
}
function fromInput(type, s) {
  const t = String(s).trim()
  if (t === '') return null
  if (type === 'money') { const c = toCents(t); if (c == null || c < 0) throw new Error('Enter a dollar amount.'); return c }
  if (type === 'int') { const n = parseInt(t, 10); if (!Number.isInteger(n) || n < 0) throw new Error('Enter a whole number.'); return n }
  if (type === 'number') { const n = Number(t); if (!Number.isFinite(n) || n < 0) throw new Error('Enter a number.'); return n }
  return t
}

function SettingsForm({ rows, onSaved }) {
  const byKey = Object.fromEntries(rows.map(r => [r.key, r.value]))
  const [v, setV] = useState(Object.fromEntries(FIELDS.map(([k, , t]) => [k, toInput(t, byKey[k])])))
  const { busy, msg, run } = useAction()
  const save = () => run(async () => {
    const upserts = FIELDS.map(([k, , t]) => ({ key: k, value: fromInput(t, v[k]), is_public: PUBLIC.has(k), updated_at: new Date().toISOString() }))
    must(await supabase.from('shop_settings').upsert(upserts))
    await audit('settings.updated', 'shop_settings', null, Object.fromEntries(upserts.map(u => [u.key, u.value])))
    onSaved()
  }, 'Settings saved.')
  return (
    <Panel title="Store settings">
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(([k, label, type, hint]) => (
          <Field key={k} label={label} hint={hint} className={type === 'long' ? 'sm:col-span-2' : ''}>
            {type === 'long' ? <textarea className="textarea" rows={3} value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })} />
              : type === 'image' ? (
                <div className="flex items-center gap-3">
                  {v[k] && <img src={v[k]} alt="" className="h-10 rounded bg-panel-2 p-1" />}
                  <label className="btn btn-ghost btn-sm cursor-pointer">Upload<input type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={e => {
                    const f = e.target.files[0]; e.target.value = ''
                    if (f) run(async () => { const url = await uploadProductImage(f, 'branding', 'logo'); setV(x => ({ ...x, [k]: url })) }, 'Logo uploaded — click Save.')
                  }} /></label>
                  {v[k] && <button type="button" className="text-xs underline" onClick={() => setV({ ...v, [k]: '' })}>Remove</button>}
                </div>
              ) : <input className="input" inputMode={['money', 'int', 'number'].includes(type) ? 'decimal' : undefined} value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })} />}
          </Field>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>Save settings</button>
        <Msg msg={msg} />
      </div>
    </Panel>
  )
}

export default function Settings() {
  const settings = useLoad(async () => must(await supabase.from('shop_settings').select('*')))
  const emails = useLoad(async () => must(await supabase.from('shop_email_events').select('id, purpose, recipient, subject, status, error, attempts, created_at, sent_at').order('created_at', { ascending: false }).limit(100)))
  const logs = useLoad(async () => must(await supabase.from('shop_audit_logs').select('*').order('created_at', { ascending: false }).limit(100)))
  const { msg, run } = useAction()
  return (
    <div className="space-y-4">
      <H1>Settings</H1>
      {settings.data ? <SettingsForm rows={settings.data} onSaved={settings.reload} /> : <Empty>Loading…</Empty>}

      <Panel title="Email log" className="scroll-mt-4" actions={<button className="btn btn-ghost btn-sm" onClick={emails.reload}>Refresh</button>}>
        <div id="email-log" />
        <Msg msg={msg} />
        {!emails.data?.length ? <Empty>No emails yet.</Empty> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>When</th><th>Purpose</th><th>To</th><th>Subject</th><th>Status</th><th /></tr></thead>
              <tbody>{emails.data.map(e => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap text-muted">{fmtDateTime(e.created_at)}</td><td>{e.purpose.replace(/_/g, ' ')}</td><td>{e.recipient}</td><td>{e.subject}</td>
                  <td><StatusBadge value={e.status} />{e.error && <div className="text-xs text-bad">{e.error}</div>}</td>
                  <td>{e.status !== 'sent' && <button className="text-xs underline" onClick={() => run(async () => { await admin('retry_email', { eventId: e.id }); emails.reload() }, 'Retried.')}>Retry</button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Audit log (latest 100)">
        {!logs.data?.length ? <Empty>No activity yet.</Empty> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
              <tbody>{logs.data.map(l => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap text-muted">{fmtDateTime(l.created_at)}</td><td>{l.actor_label || '—'}</td><td>{l.action}</td>
                  <td className="max-w-md truncate text-xs text-muted" title={JSON.stringify(l.detail)}>{l.detail ? JSON.stringify(l.detail) : ''}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
