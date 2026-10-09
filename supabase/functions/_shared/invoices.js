// Order → invoice → payment → receipt workflow.
//
//   confirmOrder      admin confirms a new order → order awaiting_payment + draft invoice built
//                     from the order's locked pricing snapshot (idempotent)
//   saveInvoice       admin edits lines/notes: drafts update in place, issued invoices get a new version
//   sendInvoice       issues the invoice, renders the PDF, emails it with the PDF attached
//   recordPayment     records a verified e-Transfer; when the balance hits $0 the receipt is
//                     created + emailed exactly once and the order moves to payment_confirmed
//
// Credits: payments on an order invoice include payments on that order plus any payments on the
// order's design project that weren't tied to another order (e.g. a $50 design deposit), so a
// design fee already paid is credited — never billed twice.
import { db, must, getSettings, audit } from './db.js'
import { HttpError } from './http.js'
import { renderInvoicePdf, bytesToBase64 } from './invoice-pdf.js'
import { sendEmail, templates, customerReplyTo } from './email.js'
import { priceCustom, formatCents } from './pricing.js'

export const DESIGN_FEE_TERMS = 'The one-time $50 design/setup/processing fee includes the initial shirt mockup and two rounds of requested design revisions. Additional revision rounds are available in packages of two for $25 each, charged only after the customer requests and approves them.'

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Halifax', year: 'numeric', month: 'long', day: 'numeric' })
const fmtDay = d => (d ? new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/Halifax', year: 'numeric', month: 'short', day: 'numeric' }) : '')
const closureLabel = c => (c === 'zipper' ? 'Zipper' : 'Button')

function itemOpts(it) {
  return [it.colour, it.size, closureLabel(it.closure), it.pocket ? 'Pocket' : 'No pocket', it.personalization ? `Name: ${it.personalization}` : null].filter(Boolean).join(' · ')
}

const L = (kind, description, qty, unitCents) => ({ kind, description, qty, unitCents, lineCents: qty * unitCents })

/** Invoice lines derived from an order's locked pricing snapshot. Lines always sum to the order total. */
export function linesFromOrder(order, items) {
  const snap = order.pricing_snapshot || {}
  const p = snap.pricing || {}
  const lines = []
  if (order.order_type === 'RETAIL') {
    const listByIdx = snap.items || []
    items.forEach((it, i) => {
      const listUnit = listByIdx[i]?.list_base_unit_cents ?? it.base_unit_cents
      lines.push(L('item', `${it.product_name}${it.price_class === 'replica' ? ' (player replica)' : ''} — ${itemOpts(it)}`, it.qty, listUnit))
    })
    const zipQty = items.filter(i => i.zipper_unit_cents > 0).reduce((s, i) => s + i.qty, 0)
    const pocketQty = items.filter(i => i.pocket_unit_cents > 0).reduce((s, i) => s + i.qty, 0)
    if (zipQty) lines.push(L('upgrade', 'Zipper polo upgrade', zipQty, 200))
    if (pocketQty) lines.push(L('upgrade', 'Chest pocket upgrade', pocketQty, 200))
  } else {
    const unit = p.listUnitCents ?? items[0]?.base_unit_cents ?? 0
    items.forEach(it => lines.push(L('item', `Custom shirt${snap.projectTitle ? ` — ${snap.projectTitle}` : ''} — ${itemOpts(it)}`, it.qty, unit)))
    if (p.designFeeCents) lines.push(L('fee', 'Design, setup & processing fee (incl. mockup + 2 revision rounds)', 1, p.designFeeCents))
    if (p.designFeeWaivedCents) lines.push(L('discount', 'Design fee waived', 1, -p.designFeeWaivedCents))
    if (p.revisionPackagesCents) lines.push(L('fee', 'Additional revision package(s) — 2 rounds each', p.revisionPackagesCents / 2500, 2500))
  }
  if (p.discountCents) lines.push(L('discount', `Discount${order.discount_code ? ` (${order.discount_code})` : ''}`, 1, -p.discountCents))
  lines.push(L('shipping', p.shippingCents ? 'Shipping' : 'Shipping (free)', 1, p.shippingCents || 0))
  if (p.taxCents) lines.push(L('tax', 'Tax', 1, p.taxCents))
  return lines
}

export function totalsFromLines(lines, creditsCents) {
  const sum = k => lines.filter(l => l.kind === k).reduce((s, l) => s + l.lineCents, 0)
  const totalCents = lines.reduce((s, l) => s + l.lineCents, 0)
  return {
    subtotalCents: totalCents - sum('shipping') - sum('tax'),
    discountCents: -sum('discount'),
    shippingCents: sum('shipping'),
    taxCents: sum('tax'),
    totalCents,
    creditsCents,
    balanceCents: Math.max(totalCents - creditsCents, 0),
  }
}

/** Verified payments that count toward an invoice (see header comment). */
export async function creditsFor({ orderId, projectId }) {
  const rows = []
  if (orderId) rows.push(...must(await db.from('shop_payments').select('id, amount_cents, received_on, reference, method, created_at').eq('status', 'verified').eq('order_id', orderId), 'payments'))
  if (projectId) rows.push(...must(await db.from('shop_payments').select('id, amount_cents, received_on, reference, method, created_at').eq('status', 'verified').eq('project_id', projectId).is('order_id', null), 'payments'))
  const seen = new Set()
  const list = rows.filter(r => !seen.has(r.id) && seen.add(r.id))
  return { creditsCents: list.reduce((s, r) => s + r.amount_cents, 0), payments: list }
}

async function loadOrder(orderId) {
  const order = must(await db.from('shop_orders').select('*').eq('id', orderId).maybeSingle(), 'order')
  if (!order) throw new HttpError(404, 'NOT_FOUND', 'Order not found.')
  const items = must(await db.from('shop_order_items').select('*').eq('order_id', orderId).order('sort_order'), 'items')
  return { order, items }
}

async function loadCustomer(id) {
  return must(await db.from('shop_customers').select('*').eq('id', id).single(), 'customer')
}

function baseSnapshot(settings, { kind, number, version, customer, order, project, lines, totals, notes, terms }) {
  return {
    kind,
    title: kind === 'quote' ? 'Quote' : kind === 'receipt' ? 'Receipt' : 'Invoice',
    number, version,
    issuedDate: today(),
    business: { name: settings.business_name || 'CGC Darts × MD Studios', contactEmail: customerReplyTo(settings) || '' },
    customer: { name: customer.name, email: customer.email, phone: customer.phone, team: customer.team },
    shipTo: order ? { street: order.ship_street, city: order.ship_city, province: order.ship_province, postal: order.ship_postal, country: order.ship_country } : null,
    reference: order?.order_number || project?.project_number || number,
    projectReference: project ? `${project.project_number} — ${project.title}` : null,
    lines, totals, notes: notes || null, terms: terms || null,
    payment: { email: settings.etransfer_email, instructions: settings.etransfer_instructions },
  }
}

function invoiceRow(snapshot, extra) {
  const t = snapshot.totals
  return {
    snapshot,
    subtotal_cents: t.subtotalCents, discount_cents: t.discountCents, shipping_cents: t.shippingCents, tax_cents: t.taxCents,
    total_cents: t.totalCents, credits_cents: t.creditsCents, balance_cents: t.balanceCents, notes: snapshot.notes,
    ...extra,
  }
}

/** Latest non-superseded invoice for an order (or null). */
export async function currentInvoice({ orderId, projectId, kind = 'invoice' }) {
  let q = db.from('shop_invoices').select('*').eq('kind', kind).in('status', ['draft', 'issued']).order('version', { ascending: false }).limit(1)
  q = orderId ? q.eq('order_id', orderId) : q.eq('project_id', projectId).is('order_id', null)
  const rows = must(await q, 'invoice')
  return rows[0] || null
}

/** Admin "Confirm Order": moves a new order to awaiting_payment and builds its invoice (idempotent). */
export async function confirmOrder(orderId, admin) {
  const { order, items } = await loadOrder(orderId)
  if (order.status === 'cancelled') throw new HttpError(400, 'CANCELLED', 'This order was cancelled.')
  const existing = await currentInvoice({ orderId })
  if (existing) return existing
  const settings = await getSettings()
  const customer = await loadCustomer(order.customer_id)
  const project = order.project_id ? must(await db.from('shop_design_projects').select('*').eq('id', order.project_id).single(), 'project') : null
  const { creditsCents } = await creditsFor({ orderId, projectId: order.project_id })
  const lines = linesFromOrder(order, items)
  const totals = totalsFromLines(lines, creditsCents)
  if (totals.totalCents !== order.total_cents) console.warn('invoice/order total mismatch', order.order_number, totals.totalCents, order.total_cents)
  const number = must(await db.rpc('shop_next_number', { p_prefix: 'INV' }), 'number')
  const snapshot = baseSnapshot(settings, {
    kind: 'invoice', number, version: 1, customer, order, project, lines, totals,
    terms: order.order_type === 'CUSTOM' ? DESIGN_FEE_TERMS : null,
  })
  const { data: inv, error } = await db.from('shop_invoices').insert(invoiceRow(snapshot, {
    invoice_number: number, version: 1, kind: 'invoice', status: 'draft', order_id: order.id, project_id: order.project_id, customer_id: order.customer_id,
  })).select().single()
  if (error) throw new HttpError(500, 'DB_ERROR', 'Could not create invoice.')
  if (order.status === 'new') {
    await db.from('shop_orders').update({ status: 'awaiting_payment', confirmed_at: new Date().toISOString() }).eq('id', order.id)
  }
  await audit({ actor: admin.id, actorLabel: admin.email, action: 'order.confirmed', entity: 'shop_orders', entityId: order.id, detail: { invoice: number } })
  return inv
}

/** Builds a quote or design-fee invoice for a design project (no order yet). */
export async function createProjectDocument(projectId, kind, admin) {
  if (!['quote', 'invoice'].includes(kind)) throw new HttpError(400, 'BAD_KIND', 'Unknown document type.')
  const project = must(await db.from('shop_design_projects').select('*').eq('id', projectId).maybeSingle(), 'project')
  if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found.')
  const existing = await currentInvoice({ projectId, kind })
  if (existing && existing.status === 'draft') return existing
  const settings = await getSettings()
  const customer = await loadCustomer(project.customer_id)
  const pricing = priceCustom({
    qty: project.estimated_qty || 1,
    lockedUnitCents: project.locked_unit_cents,
    extraRevisionPackages: project.extra_packages_approved,
    discount: project.design_fee_waived ? { waiveDesignFee: true } : null,
  })
  const lines = []
  if (kind === 'quote') {
    lines.push(L('item', `Custom shirts — ${project.title} (estimated quantity)`, pricing.qty, pricing.listUnitCents))
  }
  lines.push(L('fee', 'Design, setup & processing fee (incl. mockup + 2 revision rounds)', 1, pricing.designFeeCents))
  if (pricing.designFeeWaivedCents) lines.push(L('discount', 'Design fee waived', 1, -pricing.designFeeWaivedCents))
  if (pricing.revisionPackagesCents) lines.push(L('fee', 'Additional revision package(s) — 2 rounds each', project.extra_packages_approved, 2500))
  const { creditsCents } = kind === 'invoice' ? await creditsFor({ projectId }) : { creditsCents: 0 }
  const totals = totalsFromLines(lines, creditsCents)
  const number = must(await db.rpc('shop_next_number', { p_prefix: kind === 'quote' ? 'QTE' : 'INV' }), 'number')
  const snapshot = baseSnapshot(settings, {
    kind, number, version: 1, customer, project, lines, totals, terms: DESIGN_FEE_TERMS,
    notes: kind === 'quote' ? 'Estimate based on your estimated quantity. Final shirt pricing uses your final quantity; shipping quoted separately.' : null,
  })
  const inv = must(await db.from('shop_invoices').insert(invoiceRow(snapshot, {
    invoice_number: number, version: 1, kind, status: 'draft', project_id: projectId, customer_id: project.customer_id,
  })).select().single(), 'Could not create document')
  await audit({ actor: admin.id, actorLabel: admin.email, action: `project.${kind}_created`, entity: 'shop_design_projects', entityId: projectId, detail: { number } })
  return inv
}

/** Admin edits from the Invoice Builder. Totals are always recomputed server-side. */
export async function saveInvoice(invoiceId, { lines, notes }, admin) {
  const inv = must(await db.from('shop_invoices').select('*').eq('id', invoiceId).maybeSingle(), 'invoice')
  if (!inv) throw new HttpError(404, 'NOT_FOUND', 'Invoice not found.')
  if (inv.kind === 'receipt' || ['superseded', 'void'].includes(inv.status)) throw new HttpError(400, 'LOCKED', 'This document can no longer be edited.')
  if (!Array.isArray(lines) || !lines.length || lines.length > 60) throw new HttpError(400, 'BAD_LINES', 'Add at least one line.')
  const clean = lines.map(l => {
    const qty = Number(l.qty), unit = Number(l.unitCents)
    if (!Number.isInteger(qty) || qty < 0 || qty > 10000 || !Number.isInteger(unit) || Math.abs(unit) > 10_000_000) throw new HttpError(400, 'BAD_LINES', 'Each line needs a whole quantity and amount.')
    const kind = ['item', 'upgrade', 'discount', 'fee', 'shipping', 'tax', 'adjustment'].includes(l.kind) ? l.kind : 'adjustment'
    return L(kind, String(l.description || '').trim().slice(0, 300) || 'Item', qty, unit)
  })
  const { creditsCents } = await creditsFor({ orderId: inv.order_id, projectId: inv.project_id })
  const totals = totalsFromLines(clean, inv.kind === 'quote' ? 0 : creditsCents)
  const snapshot = { ...inv.snapshot, lines: clean, totals, notes: String(notes ?? inv.notes ?? '').slice(0, 2000) || null, issuedDate: today() }

  if (inv.status === 'draft') {
    const row = must(await db.from('shop_invoices').update(invoiceRow(snapshot, { pdf_path: null })).eq('id', inv.id).select().single(), 'Could not save invoice')
    await audit({ actor: admin.id, actorLabel: admin.email, action: 'invoice.edited', entity: 'shop_invoices', entityId: inv.id })
    return row
  }
  // Issued → new version (the issued one stays until the new version is sent).
  const version = inv.version + 1
  snapshot.version = version
  const row = must(await db.from('shop_invoices').insert(invoiceRow(snapshot, {
    invoice_number: inv.invoice_number, version, kind: inv.kind, status: 'draft', order_id: inv.order_id, project_id: inv.project_id, customer_id: inv.customer_id,
  })).select().single(), 'Could not create new version')
  await audit({ actor: admin.id, actorLabel: admin.email, action: 'invoice.new_version', entity: 'shop_invoices', entityId: row.id, detail: { number: inv.invoice_number, version } })
  return row
}

/** Refreshes credits/balance on a draft or issued invoice (after payments change). */
async function refreshCredits(inv) {
  const { creditsCents, payments } = await creditsFor({ orderId: inv.order_id, projectId: inv.project_id })
  const credits = inv.kind === 'quote' ? 0 : creditsCents
  const totals = { ...inv.snapshot.totals, creditsCents: credits, balanceCents: Math.max(inv.snapshot.totals.totalCents - credits, 0) }
  const snapshot = { ...inv.snapshot, totals }
  const row = must(await db.from('shop_invoices').update({ snapshot, credits_cents: credits, balance_cents: totals.balanceCents, pdf_path: null }).eq('id', inv.id).select().single(), 'invoice')
  return { inv: row, payments }
}

export async function pdfFor(inv) {
  const bytes = await renderInvoicePdf(inv.snapshot)
  const path = `${inv.kind}/${inv.invoice_number}-v${inv.version}.pdf`
  const { error } = await db.storage.from('shop-invoices').upload(path, bytes, { contentType: 'application/pdf', upsert: true })
  if (!error) await db.from('shop_invoices').update({ pdf_path: path }).eq('id', inv.id)
  return bytes
}

/** Issues (if draft) and emails an invoice/quote with its PDF. `force` re-sends an already-sent one. */
export async function sendInvoice(invoiceId, admin, { force = false } = {}) {
  let inv = must(await db.from('shop_invoices').select('*').eq('id', invoiceId).maybeSingle(), 'invoice')
  if (!inv) throw new HttpError(404, 'NOT_FOUND', 'Invoice not found.')
  if (['superseded', 'void'].includes(inv.status)) throw new HttpError(400, 'LOCKED', 'This version was replaced — send the latest version.')
  const settings = await getSettings()
  const customer = await loadCustomer(inv.customer_id)
  if (inv.kind !== 'receipt') inv = (await refreshCredits(inv)).inv

  const now = new Date().toISOString()
  if (inv.status === 'draft') {
    // Supersede older issued versions of the same document.
    await db.from('shop_invoices').update({ status: 'superseded' }).eq('invoice_number', inv.invoice_number).eq('kind', inv.kind).neq('id', inv.id).in('status', ['draft', 'issued'])
    inv = must(await db.from('shop_invoices').update({ status: 'issued', issued_at: now }).eq('id', inv.id).select().single(), 'invoice')
  }
  const bytes = await pdfFor(inv)
  const reference = inv.snapshot.reference || inv.invoice_number
  const subject = inv.kind === 'quote' ? `Your quote ${inv.invoice_number}` : `Invoice ${inv.invoice_number}${inv.version > 1 ? ` (updated)` : ''} — ${formatCents(inv.balance_cents)} due`
  const html = templates.invoice(settings, inv, {
    reference,
    intro: inv.kind === 'quote'
      ? 'Thanks for your design request! Your quote is attached. Reply to this email to go ahead or with any questions.'
      : `Hi ${customer.name.split(' ')[0]}, your invoice for <b>${reference}</b> is attached.`,
  })
  const result = await sendEmail({
    purpose: inv.kind === 'quote' ? 'quote' : 'invoice', to: customer.email, subject, html,
    from: settings.email_from, replyTo: customerReplyTo(settings),
    attachments: [{ filename: `${inv.invoice_number}${inv.version > 1 ? `-v${inv.version}` : ''}.pdf`, content: bytesToBase64(bytes) }],
    dedupeKey: `${inv.kind}:${inv.invoice_number}:v${inv.version}`, force,
    orderId: inv.order_id, projectId: inv.project_id, invoiceId: inv.id,
  })
  if (result.status === 'sent') {
    inv = must(await db.from('shop_invoices').update({ sent_at: now }).eq('id', inv.id).select().single(), 'invoice')
    if (inv.project_id && !inv.order_id) {
      await db.from('shop_design_projects').update({ invoice_status: inv.kind === 'quote' ? 'quoted' : 'invoiced' }).eq('id', inv.project_id).in('invoice_status', ['none', 'quoted'])
      await db.from('shop_design_projects').update({ status: inv.kind === 'quote' ? 'quote_sent' : 'awaiting_design_payment' }).eq('id', inv.project_id).in('status', ['new_inquiry', 'under_review', 'quote_sent'])
    }
  }
  await audit({ actor: admin.id, actorLabel: admin.email, action: `${inv.kind}.sent`, entity: 'shop_invoices', entityId: inv.id, detail: { email: result.status } })
  return { invoice: inv, email: result }
}

/**
 * Records a verified payment and, if the invoice is now fully paid, issues + emails the receipt
 * (exactly once). Target: an invoice id (preferred), or an order / project.
 */
export async function recordPayment({ invoiceId, orderId, projectId, amountCents, reference, receivedOn, notes, method = 'interac' }, admin) {
  if (!Number.isInteger(amountCents) || amountCents === 0) throw new HttpError(400, 'BAD_AMOUNT', 'Enter the amount received.')
  let inv = invoiceId ? must(await db.from('shop_invoices').select('*').eq('id', invoiceId).maybeSingle(), 'invoice') : null
  if (inv) { orderId = inv.order_id; projectId = inv.order_id ? null : inv.project_id }
  if (!orderId && !projectId) throw new HttpError(400, 'NO_TARGET', 'Choose an order or project.')

  const payment = must(await db.from('shop_payments').insert({
    order_id: orderId || null, project_id: orderId ? null : projectId, invoice_id: inv?.id || null,
    amount_cents: amountCents, method, reference: reference || null, received_on: receivedOn || null, notes: notes || null,
    status: 'verified', verified_by: admin.id, verified_at: new Date().toISOString(),
  }).select().single(), 'Could not record payment')
  await audit({ actor: admin.id, actorLabel: admin.email, action: 'payment.recorded', entity: 'shop_payments', entityId: payment.id, detail: { amountCents, orderId, projectId, reference } })

  if (!inv) inv = await currentInvoice(orderId ? { orderId } : { projectId })
  return settleAfterPayment({ inv, orderId, projectId, payment, admin })
}

async function settleAfterPayment({ inv, orderId, projectId, payment, admin }) {
  const settings = await getSettings()
  let balanceCents = null
  let receipt = null
  let paidCents = 0
  if (inv) {
    const refreshed = await refreshCredits(inv)
    inv = refreshed.inv
    balanceCents = inv.balance_cents
    paidCents = inv.credits_cents
  }

  if (orderId) {
    const order = must(await db.from('shop_orders').select('*').eq('id', orderId).single(), 'order')
    const { creditsCents } = await creditsFor({ orderId, projectId: order.project_id })
    const total = inv ? inv.total_cents : order.total_cents
    const paid = creditsCents >= total
    const patch = { payment_status: paid ? 'verified' : creditsCents > 0 ? 'partial' : 'awaiting' }
    if (paid && ['new', 'awaiting_payment'].includes(order.status)) patch.status = 'payment_confirmed'
    await db.from('shop_orders').update(patch).eq('id', orderId)
    if (paid && order.project_id) await db.from('shop_design_projects').update({ invoice_status: 'paid', status: 'in_production' }).eq('id', order.project_id).in('status', ['final_order_submitted', 'awaiting_balance'])
    balanceCents = Math.max(total - creditsCents, 0)
  } else if (projectId && inv) {
    await db.from('shop_design_projects').update({ invoice_status: balanceCents === 0 ? 'paid' : 'partial' }).eq('id', projectId)
  }

  if (inv && inv.kind === 'invoice' && balanceCents === 0) {
    receipt = await issueReceipt(inv, settings, admin)
  } else if (inv && payment && balanceCents > 0) {
    const customer = await loadCustomer(inv.customer_id)
    await sendEmail({
      purpose: 'payment_partial', to: customer.email, subject: `Payment received — ${formatCents(balanceCents)} remaining`,
      html: templates.paymentPartial(settings, { reference: inv.snapshot.reference, paidCents: payment.amount_cents, balanceCents }),
      from: settings.email_from, replyTo: customerReplyTo(settings), dedupeKey: `payment:${payment.id}`,
      orderId: inv.order_id, projectId: inv.project_id, invoiceId: inv.id,
    })
  }
  return { payment, invoice: inv, balanceCents, receipt }
}

/** Creates (once) and emails (once) the PAID receipt for a fully paid invoice. */
export async function issueReceipt(inv, settings, admin) {
  let receipt = must(await db.from('shop_invoices').select('*').eq('kind', 'receipt').eq('source_invoice_number', inv.invoice_number).maybeSingle(), 'receipt')
  if (!receipt) {
    const { payments } = await creditsFor({ orderId: inv.order_id, projectId: inv.project_id })
    const number = must(await db.rpc('shop_next_number', { p_prefix: 'RCT' }), 'number')
    const lastPaid = payments.map(p => p.received_on || p.created_at).sort().pop()
    const snapshot = {
      ...inv.snapshot, kind: 'receipt', title: 'Receipt', number, version: 1, issuedDate: today(), paidDate: fmtDay(lastPaid),
      reference: inv.snapshot.reference, notes: `Payment for invoice ${inv.invoice_number}. Thank you!`,
      payments: payments.map(p => ({ date: fmtDay(p.received_on || p.created_at), amountCents: p.amount_cents, reference: p.reference, method: 'Interac e-Transfer' })),
      totals: { ...inv.snapshot.totals, balanceCents: 0 }, payment: null,
    }
    const { data, error } = await db.from('shop_invoices').insert(invoiceRow(snapshot, {
      invoice_number: number, version: 1, kind: 'receipt', status: 'issued', issued_at: new Date().toISOString(),
      order_id: inv.order_id, project_id: inv.project_id, customer_id: inv.customer_id, source_invoice_number: inv.invoice_number,
    })).select().single()
    if (error?.code === '23505') {
      receipt = must(await db.from('shop_invoices').select('*').eq('kind', 'receipt').eq('source_invoice_number', inv.invoice_number).single(), 'receipt')
    } else if (error) {
      throw new HttpError(500, 'DB_ERROR', 'Could not create receipt.')
    } else {
      receipt = data
      await audit({ actor: admin?.id, actorLabel: admin?.email, action: 'receipt.issued', entity: 'shop_invoices', entityId: receipt.id, detail: { number, for: inv.invoice_number } })
    }
  }
  const customer = await loadCustomer(receipt.customer_id)
  const bytes = await pdfFor(receipt)
  const email = await sendEmail({
    purpose: 'receipt', to: customer.email, subject: `Payment received — ${receipt.snapshot.reference} confirmed`,
    html: templates.receipt(settings, receipt, { reference: receipt.snapshot.reference }),
    from: settings.email_from, replyTo: customerReplyTo(settings),
    attachments: [{ filename: `${receipt.invoice_number}.pdf`, content: bytesToBase64(bytes) }],
    dedupeKey: `receipt:${inv.invoice_number}`, orderId: receipt.order_id, projectId: receipt.project_id, invoiceId: receipt.id,
  })
  if (email.status === 'sent' && !receipt.sent_at) await db.from('shop_invoices').update({ sent_at: new Date().toISOString() }).eq('id', receipt.id)
  return { ...receipt, emailStatus: email.status }
}
