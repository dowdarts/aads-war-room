import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../lib/catalog.js'
import { useCart, toPricingLines } from '../lib/cart.jsx'
import { useSettings, pricingSettings } from '../lib/settings.jsx'
import { ProductImage, Loading, PageTitle, Qty, PriceSummary } from '../components/ui.jsx'
import { money, lineDescription } from '../lib/format.js'
import { priceRetail, ERR, RETAIL } from '@pricing'

export function useCartPricing(discount = null) {
  const { catalog } = useCatalog()
  const { settings } = useSettings()
  const cart = useCart()
  return useMemo(() => {
    if (!catalog) return null
    return priceRetail({ lines: toPricingLines(cart.lines, catalog), discount, settings: pricingSettings(settings) })
  }, [catalog, cart.lines, settings, discount])
}

export default function Cart() {
  const { catalog, loading } = useCatalog()
  const { settings } = useSettings()
  const cart = useCart()
  const pricing = useCartPricing()

  if (loading) return <Loading />
  const missing = catalog ? cart.lines.filter(l => !catalog.productById[l.productId]) : []

  if (!cart.lines.length) {
    return (
      <div className="card mx-auto max-w-lg p-10 text-center">
        <h1 className="text-2xl font-black">Your cart is empty</h1>
        <p className="mt-2 text-muted">Find your next shirt in the Fall 2026 collections.</p>
        <Link to="/shop" className="btn btn-primary mt-6">Shop all shirts</Link>
      </div>
    )
  }

  const byKey = Object.fromEntries((pricing?.lines || []).map(l => [l.key, l]))
  const tooMany = pricing?.errors.includes(ERR.RETAIL_MAX_EXCEEDED)
  const noShipping = pricing?.errors.includes(ERR.SHIPPING_NOT_CONFIGURED)

  return (
    <div>
      <PageTitle eyebrow="Cart" title={`Your cart (${cart.units} shirt${cart.units === 1 ? '' : 's'})`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {missing.length > 0 && <div className="note">Some items are no longer available and were left out of your total. Remove them to continue.</div>}
          {cart.lines.map(l => {
            const p = catalog?.productById[l.productId]
            const priced = byKey[l.key]
            return (
              <div key={l.key} className="card flex gap-3 p-3 sm:gap-4">
                <Link to={p ? `/product/${p.slug}` : '/shop'} className="w-20 shrink-0 overflow-hidden rounded-xl sm:w-24"><ProductImage src={l.image || p?.image} alt="" /></Link>
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{p?.name || l.name}</div>
                  <div className="mt-0.5 text-sm text-muted">{lineDescription(l)}</div>
                  {priced && (
                    <div className="mt-1 text-xs text-muted">
                      {money(priced.baseUnitCents)} shirt
                      {priced.zipperUnitCents > 0 && ` + ${money(priced.zipperUnitCents)} zipper`}
                      {priced.pocketUnitCents > 0 && ` + ${money(priced.pocketUnitCents)} pocket`}
                      {` = ${money(priced.unitCents)} each`}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <Qty value={l.qty} onChange={q => cart.setQty(l.key, q)} max={RETAIL.maxQty} />
                    <button type="button" className="text-sm font-semibold text-muted underline" onClick={() => cart.remove(l.key)}>Remove</button>
                    {priced && <span className="ml-auto text-lg font-black">{money(priced.lineCents)}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <aside className="card h-fit p-5 lg:sticky lg:top-24">
          <h2 className="mb-3 font-black">Summary</h2>
          <PriceSummary pricing={pricing} />
          {pricing && pricing.qty < 3 && !tooMany && <p className="mt-3 text-xs text-muted">Add {3 - pricing.qty} more for {money(RETAIL.tiers[1].unitCents)} shirts and free shipping.</p>}
          {tooMany && <div className="err mt-3">{settings.retail_quote_message} <Link className="underline" to="/contact">Contact us</Link></div>}
          {noShipping && <div className="note mt-3">Shipping for 1–2 shirts is being set up. Add a third shirt for free shipping, or check back shortly.</div>}
          <Link to="/checkout" className={`btn btn-primary mt-4 w-full ${!pricing?.ok || missing.length ? 'pointer-events-none opacity-45' : ''}`} aria-disabled={!pricing?.ok || missing.length > 0}>Checkout</Link>
          <Link to="/shop" className="btn btn-ghost mt-2 w-full">Continue shopping</Link>
        </aside>
      </div>
    </div>
  )
}
