export { formatCents as money } from '@pricing'

export const STATUS_LABELS = {
  new: 'New', awaiting_payment: 'Awaiting Payment', payment_confirmed: 'Payment Confirmed', awaiting_production: 'Awaiting Production',
  in_production: 'In Production', production_complete: 'Production Complete', shipped: 'Shipped', delivered: 'Delivered',
  completed: 'Completed', cancelled: 'Cancelled',
}
export const PAYMENT_LABELS = { awaiting: 'Awaiting', partial: 'Partial', received_unverified: 'Reported (Unverified)', verified: 'Verified', refunded: 'Refunded' }
export const PROJECT_LABELS = {
  new_inquiry: 'New Inquiry', under_review: 'Under Review', quote_sent: 'Quote/Invoice Sent', awaiting_design_payment: 'Awaiting Design Payment',
  mockup_in_progress: 'Mockup in Progress', initial_mockup_sent: 'Initial Mockup Sent', awaiting_feedback: 'Awaiting Feedback',
  revision_requested: 'Revision Requested', revised_mockup_sent: 'Revised Mockup Sent', design_approved: 'Design Approved',
  private_link_created: 'Private Link Created', final_order_submitted: 'Final Order Submitted', awaiting_balance: 'Awaiting Balance',
  in_production: 'In Production', shipped: 'Shipped', completed: 'Completed', on_hold: 'On Hold', cancelled: 'Cancelled',
}
export const CLOSURE_LABELS = { button: 'Button Polo', zipper: 'Zipper Polo' }

export function fmtDate(d, opts = { year: 'numeric', month: 'short', day: 'numeric' }) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-CA', opts)
}
export function fmtDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function lineDescription(l) {
  return [l.colour, l.size, CLOSURE_LABELS[l.closure] || l.closure, l.pocket ? 'Pocket' : 'No pocket', l.personalization ? `Name: ${l.personalization}` : null]
    .filter(Boolean).join(' · ')
}

export function newIdempotencyKey() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
