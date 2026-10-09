import { useState } from 'react'
import { Link } from 'react-router-dom'
import { money } from '../lib/format.js'
import { RETAIL } from '@pricing'

/** Branded placeholder used until real artwork is uploaded. */
export function Placeholder({ label = 'CGC', className = '' }) {
  return (
    <div className={`flex aspect-[4/3] w-full flex-col items-center justify-center bg-gradient-to-br from-[#1d1d22] to-[#0f0f11] ${className}`}>
      <div className="text-3xl font-black tracking-tight text-white/90">CGC<span className="text-accent">.</span></div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-[.3em] text-muted">{label}</div>
    </div>
  )
}

export function ProductImage({ src, alt, className = '', label }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <Placeholder label={label || 'Artwork coming soon'} className={className} />
  // Mockups show front + back side by side, so fit the whole image rather than cropping.
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`aspect-[4/3] w-full bg-white object-contain ${className}`} />
}

export function fromPrice(product) {
  return product.price_class === 'replica' ? RETAIL.replicaUnitCents : RETAIL.tiers[0].unitCents
}

export function ProductCard({ product }) {
  return (
    <Link to={`/product/${product.slug}`} className="card group overflow-hidden transition hover:border-accent/60">
      <div className="overflow-hidden bg-panel-2">
        <ProductImage src={product.image} alt={product.name} className="transition duration-300 group-hover:scale-[1.03]" />
      </div>
      <div className="p-3">
        <div className="text-[11px] font-bold uppercase tracking-widest text-muted">{product.collection?.name}</div>
        <div className="mt-0.5 line-clamp-2 font-bold leading-snug">{product.name}</div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="font-black text-accent-2">{money(fromPrice(product))}</span>
          {product.price_class === 'replica'
            ? <span className="text-[11px] text-muted">Player replica</span>
            : <span className="text-[11px] text-muted">{money(RETAIL.tiers[1].unitCents)} each on 3+</span>}
        </div>
      </div>
    </Link>
  )
}

export function Loading({ label = 'Loading…' }) {
  return <div className="py-16 text-center text-muted">{label}</div>
}

export function ErrorState({ error }) {
  return <div className="err my-6">{error?.message || String(error) || 'Something went wrong.'}</div>
}

export function PageTitle({ eyebrow, title, children }) {
  return (
    <div className="mb-6">
      {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
      <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
      {children && <div className="mt-2 max-w-2xl text-muted">{children}</div>}
    </div>
  )
}

export function Qty({ value, onChange, min = 1, max = 99 }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-line">
      <button type="button" className="h-10 w-10 text-lg font-bold" aria-label="Decrease" onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <span className="w-8 text-center font-bold tabular-nums" aria-live="polite">{value}</span>
      <button type="button" className="h-10 w-10 text-lg font-bold" aria-label="Increase" onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  )
}

export function SummaryRow({ label, value, strong, muted }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1 ${strong ? 'text-lg font-black' : ''} ${muted ? 'text-muted' : ''}`}>
      <span>{label}</span><span className="tabular-nums">{value}</span>
    </div>
  )
}

/** Totals block shared by cart, checkout and confirmation. */
export function PriceSummary({ pricing, shippingLabel }) {
  if (!pricing) return null
  return (
    <div className="text-sm">
      <SummaryRow label={`Shirts (${pricing.qty})`} value={money(pricing.listShirtsCents)} />
      {pricing.discountCents > 0 && <SummaryRow label="Discount" value={`−${money(pricing.discountCents)}`} />}
      {pricing.surchargesCents > 0 && <SummaryRow label="Zipper / pocket upgrades" value={money(pricing.surchargesCents)} />}
      {pricing.designFeeCents > 0 && <SummaryRow label="Design, setup & processing" value={money(pricing.designFeeCents)} />}
      {pricing.designFeeWaivedCents > 0 && <SummaryRow label="Design fee waived" value={`−${money(pricing.designFeeWaivedCents)}`} />}
      {pricing.revisionPackagesCents > 0 && <SummaryRow label="Additional revision packages" value={money(pricing.revisionPackagesCents)} />}
      <SummaryRow label={shippingLabel || 'Shipping'} value={pricing.shippingCents ? money(pricing.shippingCents) : 'Free'} />
      {pricing.taxCents > 0 && <SummaryRow label="Tax" value={money(pricing.taxCents)} />}
      <div className="my-2 border-t border-line" />
      <SummaryRow label="Total (CAD)" value={money(pricing.totalCents)} strong />
      {pricing.creditsCents > 0 && <>
        <SummaryRow label="Paid / credited" value={`−${money(pricing.creditsCents)}`} muted />
        <SummaryRow label="Balance due" value={money(pricing.balanceCents)} strong />
      </>}
    </div>
  )
}

export function CopyButton({ text }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800) } catch { /* clipboard blocked */ }
    }}>{done ? 'Copied!' : 'Copy'}</button>
  )
}
