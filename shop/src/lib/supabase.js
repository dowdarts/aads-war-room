import { createClient } from '@supabase/supabase-js'

// Public project URL + anon key (same project as the wiki). The anon key can
// only read the public catalogue — everything else is behind RLS or the
// shop-* edge functions.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://gygwhznblajojwveikhg.supabase.co'
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5Z3doem5ibGFqb2p3dmVpa2hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjU5NzgsImV4cCI6MjA4ODk0MTk3OH0.BI9KlRsCxAvNnFHCGq6hjXfdsaNgo7afY4Xa5uxwjak'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, storageKey: 'cgc-shop-admin-auth' },
})

export class ApiError extends Error {
  constructor(message, code, status) { super(message); this.code = code; this.status = status }
}

/** Calls a shop-* edge function. Sends the admin's JWT when signed in. */
export async function callFn(name, body, { method = 'POST', query = '' } = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}` }
  let payload
  if (body instanceof FormData) payload = body
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}${query}`, { method, headers, body: method === 'GET' ? undefined : payload })
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/pdf')) {
    if (!res.ok) throw new ApiError('Could not generate PDF', 'PDF_FAILED', res.status)
    return res.blob()
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.error) throw new ApiError(json.message || json.error || `Request failed (${res.status})`, json.code || json.error, res.status)
  return json
}
