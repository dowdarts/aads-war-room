// Custom & team design inquiry. Accepts the brief + up to 10 artwork files,
// validates file types by their magic bytes (not the browser-supplied type),
// stores them in the private shop-design-files bucket, and creates the
// inquiry + design project. Never creates an order or cart.
import { serve, json, str, HttpError, EMAIL_RE } from '../_shared/http.js'
import { db, must, getSettings, rateLimit, audit } from '../_shared/db.js'
import { sendEmail, templates, customerReplyTo } from '../_shared/email.js'
import { priceCustom } from '../_shared/pricing.js'

const MAX_FILES = 10
const MAX_BYTES = 10 * 1024 * 1024

function sniff(bytes) {
  const b = bytes.subarray(0, 8)
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: 'image/png', ext: 'png' }
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' }
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return { mime: 'application/pdf', ext: 'pdf' }
  const head = new TextDecoder().decode(bytes.subarray(0, 2048)).trimStart().toLowerCase()
  if ((head.startsWith('<?xml') || head.startsWith('<svg') || head.startsWith('<!--')) && head.includes('<svg')) return { mime: 'image/svg+xml', ext: 'svg' }
  return null
}

const safeName = n => String(n || 'file').replace(/[^\w.\- ]+/g, '_').slice(-80)

serve(async req => {
  if (req.method !== 'POST') throw new HttpError(405, 'METHOD', 'POST only.')
  await rateLimit(req, 'inquiry', { windowSeconds: 3600, max: 6 })
  let form
  try { form = await req.formData() } catch { throw new HttpError(400, 'BAD_FORM', 'Invalid form submission.') }
  const f = k => str(form.get(k), 4000)

  const name = str(form.get('name'), 120), email = str(form.get('email'), 200).toLowerCase()
  const qty = parseInt(form.get('qty'), 10)
  const brief = f('brief')
  if (!name) throw new HttpError(400, 'MISSING_FIELD', 'Enter your name.')
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'MISSING_FIELD', 'Enter a valid email address.')
  if (!Number.isInteger(qty) || qty < 1 || qty > 9999) throw new HttpError(400, 'MISSING_FIELD', 'Enter your estimated number of shirts.')
  if (brief.length < 20) throw new HttpError(400, 'MISSING_FIELD', 'Please describe your design in a little more detail.')

  const files = form.getAll('files').filter(x => x instanceof File)
  if (files.length > MAX_FILES) throw new HttpError(400, 'TOO_MANY_FILES', `Up to ${MAX_FILES} files.`)
  const inquiryId = crypto.randomUUID()
  const uploaded = []
  try {
    for (const file of files) {
      if (file.size > MAX_BYTES) throw new HttpError(400, 'FILE_TOO_BIG', `${safeName(file.name)} is over 10 MB.`)
      const bytes = new Uint8Array(await file.arrayBuffer())
      const kind = sniff(bytes)
      if (!kind) throw new HttpError(400, 'FILE_TYPE', `${safeName(file.name)} isn’t a PNG, JPG, SVG or PDF file.`)
      const path = `inquiries/${inquiryId}/${crypto.randomUUID()}.${kind.ext}`
      const { error } = await db.storage.from('shop-design-files').upload(path, bytes, { contentType: kind.mime, upsert: false })
      if (error) throw new HttpError(500, 'UPLOAD_FAILED', 'A file couldn’t be uploaded. Please try again.')
      uploaded.push({ path, mime: kind.mime, size: bytes.length, name: safeName(file.name) })
    }

    const settings = await getSettings()
    const customerId = must(await db.rpc('shop_upsert_customer', { p_name: name, p_email: email, p_phone: f('phone'), p_team: f('team') }), 'customer')
    const estimate = priceCustom({ qty })
    const inquiryNumber = must(await db.rpc('shop_next_number', { p_prefix: 'INQ' }), 'number')
    const inquiry = must(await db.from('shop_design_inquiries').insert({
      id: inquiryId, inquiry_number: inquiryNumber, customer_id: customerId, estimated_qty: qty, brief,
      team: f('team') || null, colour_palette: f('palette') || null, style_notes: f('style') || null,
      sponsor_notes: f('sponsors') || null, player_names_notes: f('names') || null, instructions: f('instructions') || null,
      estimate_cents: estimate.totalCents,
    }).select().single(), 'Could not save your request')
    const projectNumber = must(await db.rpc('shop_next_number', { p_prefix: 'PRJ' }), 'number')
    const project = must(await db.from('shop_design_projects').insert({
      project_number: projectNumber, inquiry_id: inquiry.id, customer_id: customerId,
      title: f('team') ? `${f('team')} custom shirt` : `${name} custom shirt`, estimated_qty: qty,
    }).select().single(), 'Could not save your request')
    if (uploaded.length) {
      must(await db.from('shop_design_files').insert(uploaded.map(u => ({
        project_id: project.id, inquiry_id: inquiry.id, kind: 'customer_upload', file_name: u.name, mime_type: u.mime, size_bytes: u.size, storage_path: u.path,
      }))), 'Could not save files')
    }
    await audit({ actorLabel: 'customer', action: 'inquiry.created', entity: 'shop_design_inquiries', entityId: inquiry.id, detail: { inquiryNumber, projectNumber, files: uploaded.length } })

    const customer = must(await db.from('shop_customers').select('*').eq('id', customerId).single(), 'customer')
    await Promise.all([
      sendEmail({ purpose: 'inquiry_ack', to: email, subject: `We got your design request — ${inquiryNumber}`, html: templates.inquiryAck(settings, inquiry, customer), from: settings.email_from, replyTo: customerReplyTo(settings), dedupeKey: `inquiry_ack:${inquiryNumber}`, projectId: project.id }),
      settings.admin_notify_email && sendEmail({ purpose: 'admin_new_inquiry', to: settings.admin_notify_email, subject: `New design inquiry ${inquiryNumber} — ${qty} shirts`, html: templates.inquiryAdmin(settings, inquiry, customer, project, uploaded.length), from: settings.email_from_inquiries || settings.email_from, replyTo: email, dedupeKey: `admin_inquiry:${inquiryNumber}`, projectId: project.id }),
    ])
    return json({ inquiryNumber, projectNumber, estimateCents: estimate.totalCents })
  } catch (err) {
    if (uploaded.length) await db.storage.from('shop-design-files').remove(uploaded.map(u => u.path))
    throw err
  }
})
