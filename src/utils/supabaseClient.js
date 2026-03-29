/**
 * Supabase Client Configuration
 * Handles initialization of Supabase for real-time cue light updates
 * 
 * Environment Variables Required:
 * - VITE_SUPABASE_URL: Your Supabase project URL
 * - VITE_SUPABASE_ANON_KEY: Your Supabase anonymous key
 */

let client = null
let channel = null

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
 * Subscribe to real-time cue status changes
 * @param {Function} onStatusChange - Callback when status changes
 * @returns {Function} Unsubscribe function
 */
export async function subscribeToCueChanges(onStatusChange) {
  if (!client) {
    console.warn('⚠️ Supabase not initialized. Changes will not sync across sessions.')
    return () => {}
  }

  try {
    // Subscribe to the 'cue' table via Postgres Changes
    channel = client
      .channel('cue_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cue'
        },
        (payload) => {
          const newStatus = payload.new?.status || 'OFF'
          onStatusChange(newStatus)
        }
      )
      .subscribe()

    console.log('✓ Subscribed to cue light changes')

    // Return unsubscribe function
    return () => {
      if (channel) {
        client.removeChannel(channel)
        console.log('✓ Unsubscribed from cue light changes')
      }
    }
  } catch (err) {
    console.error('❌ Failed to subscribe to cue changes:', err)
    return () => {}
  }
}

/**
 * Update cue status in the database
 * @param {string} status - Status to set ('GO', 'STANDBY', 'OFF')
 * @returns {Promise<boolean>} Success status
 */
export async function updateCueStatus(status) {
  if (!client) {
    console.warn('⚠️ Supabase not initialized. Update skipped.')
    return false
  }

  if (!['GO', 'STANDBY', 'OFF'].includes(status)) {
    console.error(`❌ Invalid cue status: ${status}`)
    return false
  }

  try {
    const { error } = await client
      .from('cue')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', 1) // Assuming single cue light with ID 1

    if (error) {
      console.error('❌ Failed to update cue status:', error)
      return false
    }

    console.log(`✓ Cue status updated to: ${status}`)
    return true
  } catch (err) {
    console.error('❌ Error updating cue status:', err)
    return false
  }
}

/**
 * Fetch current cue status from database
 * @returns {Promise<string|null>} Current status or null if unavailable
 */
export async function fetchCueStatus() {
  if (!client) return null

  try {
    const { data, error } = await client
      .from('cue')
      .select('status')
      .eq('id', 1)
      .single()

    if (error) {
      console.error('❌ Failed to fetch cue status:', error)
      return null
    }

    return data?.status || 'OFF'
  } catch (err) {
    console.error('❌ Error fetching cue status:', err)
    return null
  }
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

/**
 * Read payment link access control (for QR kill switch).
 * Expected table: payment_access, row id=1
 */
export async function fetchPaymentAccessControl() {
  if (!client) return { data: null, error: 'Supabase not initialized' }

  const { data, error } = await client
    .from('payment_access')
    .select('id, enabled, require_key, access_key, expires_at, disabled_message, expired_message, invalid_key_message, updated_at')
    .eq('id', 1)
    .maybeSingle()

  return { data: data || null, error }
}

/**
 * Fetch total scan count from payment_scans table.
 */
export async function fetchPaymentScanCount() {
  if (!client) return { count: null, error: 'Supabase not initialized' }

  const { count, error } = await client
    .from('payment_scans')
    .select('id', { count: 'exact', head: true })

  return { count: count ?? null, error }
}

/**
 * Update payment link access control row (id=1).
 */
export async function updatePaymentAccessControl(payload) {
  if (!client) return { error: 'Supabase not initialized' }

  const record = {
    id: 1,
    enabled: payload.enabled,
    require_key: payload.requireKey,
    access_key: payload.accessKey,
    expires_at: payload.expiresAt,
    updated_at: new Date().toISOString(),
  }

  const { error } = await client
    .from('payment_access')
    .upsert(record, { onConflict: 'id' })

  return { error }
}
