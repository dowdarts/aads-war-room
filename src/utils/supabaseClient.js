/**
 * Supabase Client Configuration
 *
 * Environment Variables Required:
 * - VITE_SUPABASE_URL: Your Supabase project URL
 * - VITE_SUPABASE_ANON_KEY: Your Supabase anonymous key
 */

let client = null

const FALLBACK_URL = 'https://gygwhznblajojwveikhg.supabase.co'
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5Z3doem5ibGFqb2p3dmVpa2hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjU5NzgsImV4cCI6MjA4ODk0MTk3OH0.BI9KlRsCxAvNnFHCGq6hjXfdsaNgo7afY4Xa5uxwjak'

export function initSupabaseClient() {
  // Dynamic import to allow optional Supabase usage
  return import('@supabase/supabase-js').then(({ createClient }) => {
    const url = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_KEY

    client = createClient(url, key)
    return client
  }).catch(err => {
    console.warn('⚠️ Supabase module not available:', err.message)
    return null
  })
}

export function getSupabaseClient() {
  return client
}

/**
 * Insert a signed acknowledgement record
 * @param {string} name - Signer's full name
 * @param {string} role - 'player' | 'volunteer' | 'spectator'
 */
export async function insertAcknowledgement(name, role) {
  if (!client) return { error: 'Supabase not initialized' }
  const { error } = await client
    .from('acknowledgements')
    .insert({ name, role })
  return { error }
}

/**
 * Fetch all acknowledgement submissions (staff view)
 */
export async function fetchAcknowledgements() {
  if (!client) return { data: [], error: 'Supabase not initialized' }
  const { data, error } = await client
    .from('acknowledgements')
    .select('id, name, role, submitted_at')
    .order('submitted_at', { ascending: false })
  return { data: data || [], error }
}

// ── SHIRT ORDERS ─────────────────────────────────────
/**
 * Required table schema (run in Supabase SQL Editor):
 *   CREATE TABLE shirt_orders (
 *     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *     order_number text UNIQUE NOT NULL,
 *     customer_name text NOT NULL,
 *     shirt_name text,
 *     no_name boolean DEFAULT false,
 *     size text NOT NULL,
 *     color text NOT NULL,
 *     status text DEFAULT 'pending'
 *       CHECK (status IN ('pending','confirmed','finalized')),
 *     created_at timestamptz DEFAULT now(),
 *     confirmed_at timestamptz
 *   );
 */

export async function getShirtOrderCount() {
  if (!client) return { count: 0, error: 'Supabase not initialized' }
  const { count, error } = await client
    .from('shirt_orders')
    .select('id', { count: 'exact', head: true })
  return { count: count ?? 0, error }
}

export async function insertShirtOrder({ orderNumber, customerName, shirtName, noName, size, color }) {
  if (!client) return { error: 'Supabase not initialized' }
  const { error } = await client
    .from('shirt_orders')
    .insert({
      order_number: orderNumber,
      customer_name: customerName,
      shirt_name: shirtName || null,
      no_name: noName || false,
      size,
      color,
    })
  return { error }
}

export async function fetchShirtOrders() {
  if (!client) return { data: [], error: 'Supabase not initialized' }
  const { data, error } = await client
    .from('shirt_orders')
    .select('id, order_number, customer_name, shirt_name, no_name, size, color, status, created_at, confirmed_at')
    .order('created_at', { ascending: false })
  return { data: data || [], error }
}

export async function confirmShirtOrder(id) {
  if (!client) return { error: 'Supabase not initialized' }
  const { error } = await client
    .from('shirt_orders')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', id)
  return { error }
}

export async function finalizeShirtOrder(id) {
  if (!client) return { error: 'Supabase not initialized' }
  const { error } = await client
    .from('shirt_orders')
    .update({ status: 'finalized' })
    .eq('id', id)
  return { error }
}
