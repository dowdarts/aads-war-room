import { Link, useLocation, useParams } from 'react-router-dom'
import { CopyButton, PriceSummary } from '../components/ui.jsx'
import { money, lineDescription } from '../lib/format.js'

export default function OrderPlaced() {
  const { orderNumber } = useParams()
  const loc = useLocation()
  let order = loc.state
  if (!order) { try { order = JSON.parse(sessionStorage.getItem(`cgc_order_${orderNumber}`) || 'null') } catch { order = null } }

  if (!order) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-2xl font-black">Order {orderNumber}</h1>
        <p className="mt-2 text-muted">Check your email for your order details, or look it up on the tracking page.</p>
        <Link to="/track" className="btn btn-primary mt-6">Track my order</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-accent to-accent-2 px-6 py-3 text-sm font-black uppercase tracking-widest text-black">✓ Order received</div>
        <div className="space-y-6 p-6">
          <div>
            <div className="label">Order number</div>
            <div className="flex items-center gap-3"><span className="text-3xl font-black tracking-tight">{order.orderNumber}</span><CopyButton text={order.orderNumber} /></div>
            <p className="mt-2 text-muted">Thanks, {order.contactName?.split(' ')[0] || 'there'}! We’ve emailed a confirmation to <b className="text-text">{order.contactEmail}</b>.</p>
          </div>

          <ul className="divide-y divide-line rounded-xl border border-line text-sm">
            {order.items?.map((it, i) => (
              <li key={i} className="flex justify-between gap-3 p-3">
                <span><b>{it.qty}×</b> {it.product_name}<span className="block text-xs text-muted">{lineDescription(it)}</span></span>
                <span className="tabular-nums">{money(it.line_cents)}</span>
              </li>
            ))}
          </ul>
          <PriceSummary pricing={order.pricing} />

          <div className="rounded-xl border border-line p-4">
            <h2 className="font-black">What happens next</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
              <li>We review your order and email your <b className="text-text">invoice</b>.</li>
              <li>Pay the invoice by <b className="text-text">Interac e-Transfer</b> to <b className="text-text">{order.etransferEmail}</b> with <b className="text-text">{order.orderNumber}</b> in the message.</li>
              <li>Once payment is verified you’ll get a <b className="text-text">receipt</b> and your shirts go into production.</li>
            </ol>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/track" className="btn btn-ghost">Track my order</Link>
            <Link to="/shop" className="btn btn-primary">Keep shopping</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
