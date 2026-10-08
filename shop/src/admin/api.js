import { supabase, callFn, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase.js'

export { supabase }

/** Calls an action on the shop-admin edge function. */
export const admin = (action, body = {}) => callFn('shop-admin', { action, ...body })

/** Throws on a Supabase error; returns data. */
export function must({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

export async function audit(action, entity, entityId, detail = null) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('shop_audit_logs').insert({ actor: user?.id, actor_label: user?.email, action, entity, entity_id: entityId ? String(entityId) : null, detail })
}

export async function downloadInvoicePdf(invoice) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/shop-admin?invoice=${invoice.id}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session?.access_token}` },
  })
  if (!res.ok) throw new Error('Could not generate PDF')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${invoice.invoice_number}${invoice.version > 1 ? `-v${invoice.version}` : ''}.pdf`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export async function signedFileUrl(path, { download = false } = {}) {
  const { data, error } = await supabase.storage.from('shop-design-files').createSignedUrl(path, 600, download ? { download: true } : undefined)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

export const slugify = s => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)

/** Dollars string ↔ cents. */
export const toCents = v => {
  const n = Math.round(parseFloat(String(v).replace(/[$,\s]/g, '')) * 100)
  return Number.isFinite(n) ? n : null
}
export const toDollars = c => (c == null ? '' : (c / 100).toFixed(2))
