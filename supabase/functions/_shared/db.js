// Service-role database access + settings/audit/rate-limit helpers.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { HttpError, sha256Hex, clientIp } from './http.js'

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

export const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

/** Throws on a Supabase error, returns data otherwise. */
export function must({ data, error }, what = 'Database error') {
  if (error) { console.error(what, error); throw new HttpError(500, 'DB_ERROR', what) }
  return data
}

export async function getSettings() {
  const rows = must(await db.from('shop_settings').select('key, value'), 'Could not load settings')
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

/** Settings shape expected by pricing.js */
export function pricingSettings(s) {
  return {
    shippingCents: Number.isInteger(s.shipping_cents) ? s.shipping_cents : null,
    freeShippingMinQty: Number.isInteger(s.free_shipping_min_qty) ? s.free_shipping_min_qty : 3,
    customShippingCents: Number.isInteger(s.custom_shipping_cents) ? s.custom_shipping_cents : 0,
    taxRatePercent: Number(s.tax_rate_percent) || 0,
  }
}

export async function audit({ actor = null, actorLabel = null, action, entity, entityId = null, detail = null }) {
  const { error } = await db.from('shop_audit_logs').insert({ actor, actor_label: actorLabel, action, entity, entity_id: entityId ? String(entityId) : null, detail })
  if (error) console.error('audit failed', error)
}

/** Fixed-window rate limit keyed by hashed client IP. */
export async function rateLimit(req, bucket, { windowSeconds = 3600, max = 20 } = {}) {
  const key = await sha256Hex(`${bucket}:${clientIp(req)}`)
  const { data, error } = await db.rpc('shop_rate_limit_hit', { p_bucket: bucket, p_key_hash: key, p_window_seconds: windowSeconds, p_max: max })
  if (error) { console.error('rate limit check failed', error); return }
  if (data === false) throw new HttpError(429, 'RATE_LIMITED', 'Too many requests. Please wait a while and try again.')
}
