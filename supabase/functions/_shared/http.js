// HTTP helpers shared by the shop-* edge functions.

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export class HttpError extends Error {
  constructor(status, code, message) { super(message || code); this.status = status; this.code = code }
}

export function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extra } })
}

/** Wraps a handler with CORS preflight + uniform error responses. */
export function serve(handler) {
  Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
    try {
      return await handler(req)
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.code, message: err.message }, err.status)
      console.error(err)
      return json({ error: 'SERVER_ERROR', message: 'Something went wrong. Please try again or contact us.' }, 500)
    }
  })
}

export async function readJson(req) {
  try { return await req.json() } catch { throw new HttpError(400, 'BAD_JSON', 'Invalid request body.') }
}

export const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function requireFields(obj, fields) {
  for (const [key, label] of fields) {
    if (!str(obj[key])) throw new HttpError(400, 'MISSING_FIELD', `${label} is required.`)
  }
}

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/** URL-safe random token (default 32 bytes ≈ 256 bits). */
export function randomToken(bytes = 32) {
  const a = crypto.getRandomValues(new Uint8Array(bytes))
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function clientIp(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('cf-connecting-ip') || 'unknown'
}

export const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
