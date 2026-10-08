// Invoice / quote / receipt PDF rendering with pdf-lib. Renders purely from a
// stored invoice snapshot, so a re-download always matches what was issued.
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'
import { formatCents } from './pricing.js'

const INK = rgb(0.043, 0.043, 0.047)
const ACCENT = rgb(1, 0.478, 0)
const MUTED = rgb(0.44, 0.44, 0.48)
const LINE = rgb(0.88, 0.88, 0.9)
const GOOD = rgb(0.09, 0.55, 0.27)

// Standard PDF fonts only cover WinAnsi; map common Unicode and drop the rest.
const MAP = { '−': '-', '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...', '×': 'x', ' ': ' ' }
function safe(s) {
  return String(s ?? '').replace(/[−–—‘’“”…× ]/g, c => MAP[c]).replace(/[^\x20-\x7e\xa0-\xff\n]/g, '?')
}
const money = c => formatCents(c).replace('−', '-')

function wrap(text, font, size, maxWidth) {
  const out = []
  for (const para of safe(text).split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) { out.push(line); line = word } else line = test
    }
    out.push(line)
  }
  return out
}

/**
 * @param {object} snap  shop_invoices.snapshot
 * @returns {Promise<Uint8Array>}
 */
export async function renderInvoicePdf(snap) {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`${snap.title} ${snap.number}`)
  pdf.setAuthor(snap.business?.name || 'CGC Darts')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const W = 612, H = 792, M = 48
  let page = pdf.addPage([W, H])
  let y = H

  const text = (t, x, yy, { f = font, size = 10, color = INK } = {}) => page.drawText(safe(t), { x, y: yy, size, font: f, color })
  const right = (t, xr, yy, opts = {}) => {
    const f = opts.f || font, size = opts.size || 10
    text(t, xr - f.widthOfTextAtSize(safe(t), size), yy, opts)
  }
  const ensure = need => {
    if (y - need < M + 40) { page = pdf.addPage([W, H]); y = H - M }
  }

  // Header band
  page.drawRectangle({ x: 0, y: H - 78, width: W, height: 78, color: INK })
  page.drawRectangle({ x: 0, y: H - 82, width: W, height: 4, color: ACCENT })
  text('CGC', M, H - 48, { f: bold, size: 26, color: rgb(1, 1, 1) })
  text('.', M + bold.widthOfTextAtSize('CGC', 26), H - 48, { f: bold, size: 26, color: ACCENT })
  text(snap.business?.name || 'CGC Darts x MD Studios', M, H - 64, { size: 9, color: rgb(0.75, 0.75, 0.78) })
  right(snap.title.toUpperCase(), W - M, H - 46, { f: bold, size: 20, color: rgb(1, 1, 1) })
  right(`${snap.number}${snap.version > 1 ? `  (v${snap.version})` : ''}`, W - M, H - 64, { size: 10, color: rgb(0.85, 0.85, 0.88) })
  y = H - 112

  // Meta + parties
  const col2 = 330
  text('BILL TO', M, y, { f: bold, size: 8, color: MUTED })
  text('DETAILS', col2, y, { f: bold, size: 8, color: MUTED })
  y -= 14
  const billLines = [snap.customer?.name, snap.customer?.team, snap.customer?.email, snap.customer?.phone].filter(Boolean)
  const shipLines = snap.shipTo ? [snap.shipTo.street, [snap.shipTo.city, snap.shipTo.province, snap.shipTo.postal].filter(Boolean).join(', '), snap.shipTo.country].filter(Boolean) : []
  const meta = [
    ['Date', snap.issuedDate],
    snap.reference && ['Reference', snap.reference],
    snap.projectReference && ['Project', snap.projectReference],
    snap.paidDate && ['Paid', snap.paidDate],
  ].filter(Boolean)
  let yl = y, yr = y
  billLines.forEach((l, i) => { text(l, M, yl, { f: i === 0 ? bold : font }); yl -= 13 })
  if (shipLines.length) {
    yl -= 6; text('SHIP TO', M, yl, { f: bold, size: 8, color: MUTED }); yl -= 13
    shipLines.forEach(l => { text(l, M, yl); yl -= 13 })
  }
  meta.forEach(([k, v]) => { text(k, col2, yr, { color: MUTED }); text(v, col2 + 70, yr, { f: bold }); yr -= 13 })
  y = Math.min(yl, yr) - 18

  // Lines table
  const cQty = 380, cUnit = 470, cAmt = W - M
  page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 20, color: rgb(0.96, 0.96, 0.97) })
  text('Description', M + 6, y, { f: bold, size: 9 })
  right('Qty', cQty, y, { f: bold, size: 9 }); right('Unit', cUnit, y, { f: bold, size: 9 }); right('Amount', cAmt - 6, y, { f: bold, size: 9 })
  y -= 22
  for (const l of snap.lines || []) {
    const desc = wrap(l.description, font, 9.5, cQty - M - 60)
    ensure(desc.length * 12 + 10)
    desc.forEach((d, i) => text(d, M + 6, y - i * 12, { size: 9.5 }))
    right(String(l.qty), cQty, y, { size: 9.5 })
    right(money(l.unitCents), cUnit, y, { size: 9.5 })
    right(money(l.lineCents), cAmt - 6, y, { size: 9.5, f: bold })
    y -= desc.length * 12 + 6
    page.drawLine({ start: { x: M, y: y + 2 }, end: { x: W - M, y: y + 2 }, thickness: 0.5, color: LINE })
    y -= 8
  }

  // Totals
  ensure(120)
  const t = snap.totals || {}
  const tot = (label, val, strong = false) => {
    text(label, 360, y, { f: strong ? bold : font, size: strong ? 12 : 10, color: strong ? INK : MUTED })
    right(val, cAmt - 6, y, { f: strong ? bold : font, size: strong ? 12 : 10 })
    y -= strong ? 18 : 14
  }
  y -= 4
  tot('Total', money(t.totalCents), true)
  if (t.creditsCents) tot('Paid / credited', `-${money(t.creditsCents)}`)
  tot(snap.kind === 'receipt' ? 'Balance' : 'Balance due', money(t.balanceCents), true)
  text('All amounts in CAD', 360, y, { size: 8, color: MUTED })
  y -= 18

  if (snap.kind === 'receipt') {
    page.drawRectangle({ x: M, y: y - 40, width: 150, height: 44, borderColor: GOOD, borderWidth: 2.5 })
    text('PAID', M + 42, y - 28, { f: bold, size: 26, color: GOOD })
    y -= 56
    if (snap.payments?.length) {
      text('PAYMENTS RECEIVED', M, y, { f: bold, size: 8, color: MUTED }); y -= 13
      for (const p of snap.payments) { ensure(14); text(`${p.date || ''}  ${p.method || 'Interac e-Transfer'}${p.reference ? ` (${p.reference})` : ''}`, M, y, { size: 9.5 }); right(money(p.amountCents), cAmt - 6, y, { size: 9.5 }); y -= 13 }
      y -= 6
    }
  } else if (snap.payment && t.balanceCents > 0) {
    ensure(90)
    const instr = wrap(snap.payment.instructions || '', font, 9, W - 2 * M - 24)
    const boxH = 50 + instr.length * 11
    page.drawRectangle({ x: M, y: y - boxH + 12, width: W - 2 * M, height: boxH, color: rgb(1, 0.97, 0.93), borderColor: rgb(1, 0.84, 0.66), borderWidth: 1 })
    text('PAY BY INTERAC E-TRANSFER', M + 12, y - 4, { f: bold, size: 9, color: rgb(0.6, 0.2, 0.05) })
    text(`Send ${money(t.balanceCents)} to ${snap.payment.email || ''}`, M + 12, y - 18, { f: bold, size: 10 })
    text(`Message: ${snap.reference || snap.number}`, M + 12, y - 31, { size: 10 })
    instr.forEach((l, i) => text(l, M + 12, y - 45 - i * 11, { size: 9, color: MUTED }))
    y -= boxH + 10
  }

  if (snap.notes) {
    const lines = wrap(snap.notes, font, 9, W - 2 * M)
    ensure(lines.length * 11 + 20)
    text('NOTES', M, y, { f: bold, size: 8, color: MUTED }); y -= 12
    lines.forEach(l => { text(l, M, y, { size: 9 }); y -= 11 })
    y -= 8
  }
  if (snap.terms) {
    const lines = wrap(snap.terms, font, 8.5, W - 2 * M)
    ensure(lines.length * 10 + 20)
    text('TERMS', M, y, { f: bold, size: 8, color: MUTED }); y -= 12
    lines.forEach(l => { text(l, M, y, { size: 8.5, color: MUTED }); y -= 10 })
  }

  // Footer on every page
  for (const pg of pdf.getPages()) {
    pg.drawText(safe(`${snap.business?.name || 'CGC Darts x MD Studios'}${snap.business?.contactEmail ? ` - ${snap.business.contactEmail}` : ''}`), { x: M, y: 28, size: 8, font, color: MUTED })
  }
  return await pdf.save()
}

export function bytesToBase64(bytes) {
  let s = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(s)
}
