/**
 * One-time upload script — pushes all 100 ticket JPGs to Supabase Storage.
 * Run AFTER creating the "toc-tickets" bucket in the Supabase dashboard.
 *
 * Usage:
 *   node upload-tickets.mjs <SERVICE_ROLE_KEY>
 *
 * Get your service role key from:
 *   Supabase Dashboard → Project Settings → API → service_role (secret) key
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = 'https://gygwhznblajojwveikhg.supabase.co'
const SERVICE_KEY  = process.argv[2]
const BUCKET       = 'toc-tickets'
const IMAGES_DIR   = join(__dir, 'public', 'vip table one', 'AADS_TOC_2026_FINAL_TICKET_IMAGES')

if (!SERVICE_KEY) {
  console.error('Usage: node upload-tickets.mjs <SERVICE_ROLE_KEY>')
  console.error('Get it from: Supabase Dashboard → Project Settings → API → service_role key')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const files = readdirSync(IMAGES_DIR).filter(f => f.endsWith('.jpg') || f.endsWith('.JPG'))
console.log(`Found ${files.length} ticket images. Uploading to bucket "${BUCKET}"...\n`)

let ok = 0
let fail = 0

for (const file of files.sort()) {
  const buffer = readFileSync(join(IMAGES_DIR, file))
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(file, buffer, { contentType: 'image/jpeg', upsert: true })

  if (error) {
    console.error(`  ✗ ${file}  →  ${error.message}`)
    fail++
  } else {
    console.log(`  ✓ ${file}`)
    ok++
  }
}

console.log(`\nDone. ${ok} uploaded, ${fail} failed.`)
if (ok > 0) {
  console.log(`\nPublic URL pattern:`)
  console.log(`  ${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/VIP_001.jpg`)
}
