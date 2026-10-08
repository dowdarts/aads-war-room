// Admin-only actions that need the service role (emails, PDFs, numbering,
// payments, private links). Plain catalogue/settings CRUD is done directly from
// the admin UI under RLS. Every action here is audited.
import { serve, json, readJson, str, HttpError, randomToken, sha256Hex, CORS_HEADERS } from '../_shared/http.js'
import { db, must, getSettings, audit } from '../_shared/db.js'
import { requireAdmin } from '../_shared/auth.js'
import { sendEmail, retryEmail, templates } from '../_shared/email.js'
import { bytesToBase64 } from '../_shared/invoice-pdf.js'
import { confirmOrder, saveInvoice, sendInvoice, recordPayment, createProjectDocument, pdfFor, issueReceipt, creditsFor } from '../_shared/invoices.js'
import { CUSTOM } from '../_shared/pricing.js'

const id = v => { const s = str(v, 64); if (!/^[0-9a-f-]{36}$/i.test(s)) throw new HttpError(400, 'BAD_ID', 'Missing id.'); return s }
const cents = v => { const n = Number(v); if (!Number.isInteger(n)) throw new HttpError(400, 'BAD_AMOUNT', 'Enter an amount in cents.'); return n }

async function loadProject(projectId) {
  const p = must(await db.from('shop_design_projects').select('*').eq('id', projectId).maybeSingle(), 'project')
  if (!p) throw new HttpError(404, 'NOT_FOUND', 'Project not found.')
  return p
}

async function refreshOrderPayment(orderId) {
  const order = must(await db.from('shop_orders').select('*').eq('id', orderId).single(), 'order')
  const { creditsCents } = await creditsFor({ orderId, projectId: order.project_id })
  const inv = must(await db.from('shop_invoices').select('total_cents').eq('order_id', orderId).eq('kind', 'invoice').in('status', ['draft', 'issued']).order('version', { ascending: false }).limit(1), 'inv')[0]
  const total = inv?.total_cents ?? order.total_cents
  const payment_status = creditsCents >= total && total > 0 ? 'verified' : creditsCents > 0 ? 'partial' : 'awaiting'
  await db.from('shop_orders').update({ payment_status }).eq('id', orderId)
}

const actions = {
  async confirm_order(b, admin) {
    const inv = await confirmOrder(id(b.orderId), admin)
    return { invoice: inv }
  },

  async save_invoice(b, admin) {
    return { invoice: await saveInvoice(id(b.invoiceId), { lines: b.lines, notes: b.notes }, admin) }
  },

  async send_invoice(b, admin) {
    return await sendInvoice(id(b.invoiceId), admin, { force: !!b.force })
  },

  async create_project_document(b, admin) {
    return { invoice: await createProjectDocument(id(b.projectId), b.kind === 'quote' ? 'quote' : 'invoice', admin) }
  },

  async record_payment(b, admin) {
    return await recordPayment({
      invoiceId: b.invoiceId ? id(b.invoiceId) : null, orderId: b.orderId ? id(b.orderId) : null, projectId: b.projectId ? id(b.projectId) : null,
      amountCents: cents(b.amountCents), reference: str(b.reference, 120), receivedOn: str(b.receivedOn, 10) || null, notes: str(b.notes, 500),
    }, admin)
  },

  async void_payment(b, admin) {
    const p = must(await db.from('shop_payments').update({ status: 'void' }).eq('id', id(b.paymentId)).select().single(), 'payment')
    if (p.order_id) await refreshOrderPayment(p.order_id)
    await audit({ actor: admin.id, actorLabel: admin.email, action: 'payment.voided', entity: 'shop_payments', entityId: p.id, detail: { amount: p.amount_cents } })
    return { payment: p }
  },

  async resend_receipt(b, admin) {
    const r = must(await db.from('shop_invoices').select('*').eq('id', id(b.receiptId)).eq('kind', 'receipt').single(), 'receipt')
    const src = must(await db.from('shop_invoices').select('*').eq('invoice_number', r.source_invoice_number).eq('kind', 'invoice').order('version', { ascending: false }).limit(1), 'inv')[0]
    const settings = await getSettings()
    const ev = must(await db.from('shop_email_events').select('id').eq('dedupe_key', `receipt:${r.source_invoice_number}`).maybeSingle(), 'ev')
    if (ev) return { email: await retryEmail(ev.id, { from: settings.email_from }) }
    return { receipt: await issueReceipt(src, settings, admin) }
  },

  async set_project(b, admin) {
    const projectId = id(b.projectId)
    const allowed = ['status', 'title', 'estimated_qty', 'locked_unit_cents', 'design_fee_waived', 'public_description', 'notes']
    const patch = Object.fromEntries(Object.entries(b.patch || {}).filter(([k]) => allowed.includes(k)))
    const p = must(await db.from('shop_design_projects').update(patch).eq('id', projectId).select().single(), 'Could not update project')
    await audit({ actor: admin.id, actorLabel: admin.email, action: 'project.updated', entity: 'shop_design_projects', entityId: projectId, detail: patch })
    return { project: p }
  },

  /** Emails a mockup file and logs it as the initial mockup (v1) or a revised mockup. */
  async send_mockup(b, admin) {
    const project = await loadProject(id(b.projectId))
    const file = must(await db.from('shop_design_files').select('*').eq('id', id(b.fileId)).eq('project_id', project.id).single(), 'file')
    const settings = await getSettings()
    const customer = must(await db.from('shop_customers').select('*').eq('id', project.customer_id).single(), 'customer')
    // The first mockup is version 1 and uses no revision rounds.
    const { count: priorMockups } = await db.from('shop_revision_events').select('id', { count: 'exact', head: true }).eq('project_id', project.id).eq('event', 'mockup_sent')
    const initial = (priorMockups || 0) === 0
    const roundLabel = initial ? 'Your initial mockup' : `Revised mockup (revision ${project.revisions_used})`
    const { data: blob, error } = await db.storage.from('shop-design-files').download(file.storage_path)
    if (error) throw new HttpError(500, 'FILE_ERROR', 'Could not read the mockup file.')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const email = await sendEmail({
      purpose: 'mockup', to: customer.email, subject: `${roundLabel} — ${project.title}`,
      html: templates.mockup(settings, project, customer, { roundLabel, note: str(b.note, 2000) }),
      from: settings.email_from, replyTo: settings.contact_email,
      attachments: bytes.length < 9_000_000 ? [{ filename: file.file_name, content: bytesToBase64(bytes) }] : undefined,
      dedupeKey: `mockup:${file.id}`, force: !!b.force, projectId: project.id,
    })
    if (email.status === 'sent' || email.status === 'skipped') {
      await db.from('shop_design_files').update({ sent_at: new Date().toISOString() }).eq('id', file.id)
      await db.from('shop_revision_events').insert({ project_id: project.id, event: initial ? 'mockup_sent' : 'revised_mockup_sent', round: initial ? 0 : project.revisions_used, file_id: file.id, detail: str(b.note, 2000) || null })
      await db.from('shop_design_projects').update({ status: 'awaiting_feedback' }).eq('id', project.id)
    }
    await audit({ actor: admin.id, actorLabel: admin.email, action: 'project.mockup_sent', entity: 'shop_design_projects', entityId: project.id, detail: { file: file.id, email: email.status } })
    return { email }
  },

  /** Records a customer revision request. Rounds beyond the included 2 need approved $25 packages. */
  async record_revision(b, admin) {
    const project = await loadProject(id(b.projectId))
    const next = project.revisions_used + 1
    const allowed = CUSTOM.includedRevisionRounds + project.extra_packages_approved * CUSTOM.roundsPerPackage
    if (next > allowed) throw new HttpError(400, 'PACKAGE_REQUIRED', `Revision ${next} exceeds the ${allowed} included/approved rounds. Record an approved $25 two-round package first.`)
    const p = must(await db.from('shop_design_projects').update({ revisions_used: next, status: 'revision_requested' }).eq('id', project.id).select().single(), 'project')
    await db.from('shop_revision_events').insert({ project_id: project.id, event: 'revision_requested', round: next, detail: str(b.detail, 4000) || null })
    await audit({ actor: admin.id, actorLabel: admin.email, action: 'project.revision_requested', entity: 'shop_design_projects', entityId: project.id, detail: { round: next } })
    return { project: p }
  },

  async approve_package(b, admin) {
    const project = await loadProject(id(b.projectId))
    const p = must(await db.from('shop_design_projects').update({ extra_packages_approved: project.extra_packages_approved + 1 }).eq('id', project.id).select().single(), 'project')
    await db.from('shop_revision_events').insert({ project_id: project.id, event: 'package_approved', detail: str(b.detail, 1000) || 'Customer approved an additional 2-round revision package ($25).' })
    await audit({ actor: admin.id, actorLabel: admin.email, action: 'project.package_approved', entity: 'shop_design_projects', entityId: project.id })
    return { project: p }
  },

  /** Records the customer's email approval and the final front/back artwork. Required before private links. */
  async record_approval(b, admin) {
    const project = await loadProject(id(b.projectId))
    const note = str(b.note, 2000)
    if (!note) throw new HttpError(400, 'MISSING_FIELD', 'Paste or summarize the customer’s approval email.')
    const front = b.frontFileId ? id(b.frontFileId) : null
    const back = b.backFileId ? id(b.backFileId) : null
    if (!front) throw new HttpError(400, 'MISSING_FIELD', 'Choose the approved front design file.')
    for (const f of [front, back].filter(Boolean)) {
      const ok = must(await db.from('shop_design_files').select('id').eq('id', f).eq('project_id', project.id).maybeSingle(), 'file')
      if (!ok) throw new HttpError(400, 'BAD_FILE', 'Approved files must belong to this project.')
    }
    const p = must(await db.from('shop_design_projects').update({
      approved_at: new Date().toISOString(), approval_note: note, approved_front_file_id: front, approved_back_file_id: back, status: 'design_approved',
    }).eq('id', project.id).select().single(), 'project')
    await db.from('shop_revision_events').insert({ project_id: project.id, event: 'approved', detail: note })
    await audit({ actor: admin.id, actorLabel: admin.email, action: 'project.approved', entity: 'shop_design_projects', entityId: project.id })
    return { project: p }
  },

  /** Creates a private ordering link (revoking any active one) and optionally emails it. The raw token is returned once. */
  async create_private_link(b, admin) {
    const project = await loadProject(id(b.projectId))
    if (!project.approved_at) throw new HttpError(400, 'NOT_APPROVED', 'Record the customer’s email approval before creating an order link.')
    const settings = await getSettings()
    await db.from('shop_private_order_links').update({ revoked: true }).eq('project_id', project.id).eq('revoked', false).is('used_at', null)
    const token = randomToken(32)
    const days = Number(b.expiresInDays) || 30
    const link = must(await db.from('shop_private_order_links').insert({
      project_id: project.id, customer_id: project.customer_id, token_hash: await sha256Hex(token), token_hint: token.slice(-4),
      expires_at: new Date(Date.now() + Math.min(Math.max(days, 1), 365) * 86400000).toISOString(),
    }).select().single(), 'Could not create link')
    const url = `${settings.shop_url}/custom-order/${token}`
    if (['design_approved', 'private_link_created'].includes(project.status)) await db.from('shop_design_projects').update({ status: 'private_link_created' }).eq('id', project.id)
    let email = null
    if (b.sendEmail) {
      const customer = must(await db.from('shop_customers').select('*').eq('id', project.customer_id).single(), 'customer')
      email = await sendEmail({
        purpose: 'private_link', to: customer.email, subject: `Your approved design is ready to order — ${project.title}`,
        html: templates.privateLink(settings, project, customer, url), from: settings.email_from, replyTo: settings.contact_email,
        dedupeKey: `private_link:${link.id}`, projectId: project.id,
      })
    }
    await audit({ actor: admin.id, actorLabel: admin.email, action: 'private_link.created', entity: 'shop_private_order_links', entityId: link.id, detail: { project: project.project_number, emailed: email?.status || 'no' } })
    return { link, url, email }
  },

  async revoke_link(b, admin) {
    const link = must(await db.from('shop_private_order_links').update({ revoked: true }).eq('id', id(b.linkId)).select().single(), 'link')
    await audit({ actor: admin.id, actorLabel: admin.email, action: 'private_link.revoked', entity: 'shop_private_order_links', entityId: link.id })
    return { link }
  },

  async mark_shipped(b, admin) {
    const orderId = id(b.orderId)
    const order = must(await db.from('shop_orders').select('*').eq('id', orderId).single(), 'order')
    const shipment = must(await db.from('shop_shipments').insert({
      order_id: orderId, carrier: str(b.carrier, 60) || null, tracking_number: str(b.trackingNumber, 80) || null,
      tracking_url: /^https?:\/\//.test(str(b.trackingUrl, 500)) ? str(b.trackingUrl, 500) : null,
      dispatched_on: str(b.dispatchedOn, 10) || new Date().toISOString().slice(0, 10), status: 'shipped',
    }).select().single(), 'Could not save shipment')
    await db.from('shop_orders').update({ status: 'shipped' }).eq('id', orderId)
    if (order.project_id) await db.from('shop_design_projects').update({ status: 'shipped' }).eq('id', order.project_id)
    let email = null
    if (b.notify !== false) {
      const settings = await getSettings()
      email = await sendEmail({
        purpose: 'shipped', to: order.contact_email, subject: `Your order ${order.order_number} has shipped`,
        html: templates.shipped(settings, order, shipment), from: settings.email_from, replyTo: settings.contact_email,
        dedupeKey: `shipped:${shipment.id}`, orderId,
      })
      if (email.status === 'sent') await db.from('shop_shipments').update({ notified_at: new Date().toISOString() }).eq('id', shipment.id)
    }
    await audit({ actor: admin.id, actorLabel: admin.email, action: 'order.shipped', entity: 'shop_orders', entityId: orderId, detail: { carrier: shipment.carrier, tracking: shipment.tracking_number } })
    return { shipment, email }
  },

  async set_order_status(b, admin) {
    const orderId = id(b.orderId)
    const status = str(b.status, 40)
    const o = must(await db.from('shop_orders').update({ status }).eq('id', orderId).select().single(), 'Could not update status')
    if (status === 'cancelled') {
      // Release any discount redemption so the code can be used again.
      const reds = must(await db.from('shop_discount_redemptions').select('id, code_id').eq('order_id', orderId), 'redemptions')
      for (const r of reds) {
        await db.from('shop_discount_redemptions').delete().eq('id', r.id)
        const c = must(await db.from('shop_discount_codes').select('redemption_count').eq('id', r.code_id).single(), 'code')
        await db.from('shop_discount_codes').update({ redemption_count: Math.max(0, c.redemption_count - 1) }).eq('id', r.code_id)
      }
      await db.from('shop_invoices').update({ status: 'void' }).eq('order_id', orderId).in('status', ['draft', 'issued']).neq('kind', 'receipt')
    }
    await audit({ actor: admin.id, actorLabel: admin.email, action: 'order.status', entity: 'shop_orders', entityId: orderId, detail: { status } })
    return { order: o }
  },

  async retry_email(b, admin) {
    const settings = await getSettings()
    const ev = must(await db.from('shop_email_events').select('*').eq('id', id(b.eventId)).single(), 'email')
    // Invoice/receipt emails need their PDF regenerated as an attachment.
    if (ev.invoice_id && ['invoice', 'quote'].includes(ev.purpose)) return await sendInvoice(ev.invoice_id, admin, { force: true })
    if (ev.invoice_id && ev.purpose === 'receipt') return await actions.resend_receipt({ receiptId: ev.invoice_id }, admin)
    const result = await retryEmail(ev.id, { from: settings.email_from })
    await audit({ actor: admin.id, actorLabel: admin.email, action: 'email.retried', entity: 'shop_email_events', entityId: ev.id, detail: { status: result.status } })
    return { email: result }
  },
}

serve(async req => {
  const admin = await requireAdmin(req)
  const url = new URL(req.url)
  // PDF download: GET ?invoice=<id>
  if (req.method === 'GET' && url.searchParams.get('invoice')) {
    const inv = must(await db.from('shop_invoices').select('*').eq('id', id(url.searchParams.get('invoice'))).single(), 'invoice')
    const bytes = await pdfFor(inv)
    return new Response(bytes, { headers: { ...CORS_HEADERS, 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${inv.invoice_number}${inv.version > 1 ? `-v${inv.version}` : ''}.pdf"` } })
  }
  const body = await readJson(req)
  const fn = actions[body.action]
  if (!fn) throw new HttpError(400, 'BAD_ACTION', 'Unknown action.')
  return json(await fn(body, admin))
})
