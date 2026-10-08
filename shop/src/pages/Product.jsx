import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCatalog } from '../lib/catalog.js'
import { useCart, toPricingLines } from '../lib/cart.jsx'
import { useSettings, pricingSettings } from '../lib/settings.jsx'
import { ProductImage, Loading, ErrorState, Qty } from '../components/ui.jsx'
import { money } from '../lib/format.js'
import { priceRetail, RETAIL, SIZES, ERR } from '@pricing'

export default function Product() {
  const { slug } = useParams()
  const { catalog, loading, error } = useCatalog()
  const { settings } = useSettings()
  const cart = useCart()
  const product = catalog?.productBySlug[slug]

  const [variantId, setVariantId] = useState(null)
  const [size, setSize] = useState('')
  const [closure, setClosure] = useState('zipper')
  const [pocket, setPocket] = useState(false)
  const [name, setName] = useState('')
  const [qty, setQty] = useState(1)
  const [view, setView] = useState(0)
  const [added, setAdded] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!product) return
    const firstAvail = product.variants.find(v => v.available)
    setVariantId(firstAvail?.id || null); setSize(''); setName(''); setQty(1); setView(0); setAdded(false)
  }, [product?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const variant = product?.variants.find(v => v.id === variantId) || null
  const images = useMemo(() => {
    if (!product) return []
    const front = variant?.front_image_url || product.front_image_url
    const back = variant?.back_image_url || product.back_image_url
    const gallery = Array.isArray(product.gallery) ? product.gallery.map(g => g.url || g).filter(Boolean) : []
    return [front && { src: front, label: 'Front' }, back && { src: back, label: 'Back' }, ...gallery.map((src, i) => ({ src, label: `Photo ${i + 1}` }))].filter(Boolean)
  }, [product, variant])

  const replica = product?.price_class === 'replica'
  const preview = useMemo(() => {
    if (!product || !catalog) return null
    const existing = toPricingLines(cart.lines, catalog)
    const mine = { key: '__new', qty, priceClass: product.price_class, closure, pocket, productId: product.id, collectionIds: product.collectionIds }
    return priceRetail({ lines: [...existing, mine], settings: pricingSettings(settings) })
  }, [product, catalog, cart.lines, qty, closure, pocket, settings])
  const myLine = preview?.lines.find(l => l.key === '__new')

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} />
  if (!product) return <div className="card p-10 text-center">Shirt not found. <Link className="text-accent-2" to="/shop">Back to shop</Link></div>

  const tooMany = preview?.errors.includes(ERR.RETAIL_MAX_EXCEEDED)

  function addToCart() {
    setFormError('')
    if (product.variants.length && !variant) return setFormError('Choose a colour.')
    if (!size) return setFormError('Choose a size.')
    if (tooMany) return setFormError(settings.retail_quote_message || 'Retail orders are limited to 6 shirts.')
    cart.add({
      productId: product.id,
      variantId: variant?.id || null,
      size,
      closure,
      pocket,
      personalization: product.personalization === 'locked' ? product.locked_name : product.personalization === 'custom' ? name.trim() : '',
      qty,
      // display-only snapshot; prices always come from the pricing engine
      name: product.name,
      colour: variant?.colour_name || null,
      image: images[0]?.src || null,
    })
    setAdded(true)
  }

  return (
    <div>
      <nav className="mb-4 text-sm text-muted" aria-label="Breadcrumb">
        <Link to="/shop">Shop</Link>
        {product.parentCollection && <> / <Link to={`/collections/${product.parentCollection.slug}`}>{product.parentCollection.name}</Link></>}
        {product.collection && <> / <Link to={`/collections/${product.collection.slug}`}>{product.collection.name}</Link></>}
      </nav>
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="card overflow-hidden">
            <ProductImage src={images[view]?.src} alt={`${product.name} ${images[view]?.label || ''}`} />
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {images.map((im, i) => (
                <button key={im.src + i} type="button" onClick={() => setView(i)} aria-label={im.label} aria-pressed={view === i}
                  className={`w-20 shrink-0 overflow-hidden rounded-xl border ${view === i ? 'border-accent' : 'border-line'}`}>
                  <ProductImage src={im.src} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="eyebrow">{product.collection?.name}</div>
          <h1 className="mt-1 text-3xl font-black tracking-tight">{product.name}</h1>
          {replica && <span className="badge badge-accent mt-2">Player replica</span>}
          {product.description && <p className="mt-3 text-muted">{product.description}</p>}

          <div className="mt-6 space-y-5">
            {product.variants.length > 0 && (
              <fieldset>
                <legend className="label">Colour{variant ? `: ${variant.colour_name}` : ''}</legend>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map(v => (
                    <button key={v.id} type="button" disabled={!v.available} aria-pressed={variantId === v.id} onClick={() => { setVariantId(v.id); setView(0) }}
                      className="opt flex items-center gap-2 disabled:opacity-40">
                      <span className="h-4 w-4 rounded-full border border-white/20" style={{ background: v.colour_hex || '#888' }} />{v.colour_name}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            <fieldset>
              <legend className="label">Size</legend>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                {SIZES.filter(s => product.sizes.includes(s)).map(s => (
                  <button key={s} type="button" className="opt !px-0" aria-pressed={size === s} onClick={() => setSize(s)}>{s}</button>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted">No size surcharge, S through 5XL.</p>
            </fieldset>

            <fieldset>
              <legend className="label">Collar</legend>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="opt text-left" aria-pressed={closure === 'zipper'} onClick={() => setClosure('zipper')}>
                  Zipper Polo <span className="block text-xs font-semibold text-muted">{replica ? 'Included' : `+${money(RETAIL.zipperCents)} per shirt · Recommended`}</span>
                </button>
                <button type="button" className="opt text-left" aria-pressed={closure === 'button'} onClick={() => setClosure('button')}>
                  Button Polo <span className="block text-xs font-semibold text-muted">Included</span>
                </button>
              </div>
            </fieldset>

            <fieldset>
              <legend className="label">Chest pocket</legend>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="opt" aria-pressed={!pocket} onClick={() => setPocket(false)}>No pocket</button>
                <button type="button" className="opt" aria-pressed={pocket} onClick={() => setPocket(true)}>
                  With pocket <span className="text-xs font-semibold text-muted">{replica ? '' : `+${money(RETAIL.pocketCents)}`}</span>
                </button>
              </div>
            </fieldset>

            {product.personalization === 'custom' && (
              <div>
                <label className="label" htmlFor="pname">Name on shirt <span className="normal-case tracking-normal">(optional)</span></label>
                <input id="pname" className="input" maxLength={24} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Matt Dow — leave blank for no name" />
              </div>
            )}
            {product.personalization === 'locked' && (
              <div className="note">Player replica — the name on this shirt is <b>{product.locked_name}</b>.</div>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <div>
                <div className="label">Quantity</div>
                <Qty value={qty} onChange={setQty} max={RETAIL.maxQty} />
              </div>
              {myLine && (
                <div className="ml-auto text-right">
                  <div className="text-sm text-muted">{money(myLine.unitCents)} each</div>
                  <div className="text-2xl font-black">{money(myLine.lineCents)}</div>
                </div>
              )}
            </div>

            {!replica && preview && preview.qty < 3 && !tooMany && (
              <div className="note">Add {3 - preview.qty} more shirt{3 - preview.qty === 1 ? '' : 's'} to your order and every regular shirt drops to {money(RETAIL.tiers[1].unitCents)} with free shipping.</div>
            )}
            {tooMany && <div className="err">{settings.retail_quote_message || 'Retail orders are limited to 6 shirts.'} <Link className="underline" to="/custom">Team & bulk orders →</Link></div>}
            {formError && <div className="err" role="alert">{formError}</div>}

            {added ? (
              <div className="ok flex flex-wrap items-center gap-3">
                <span className="font-bold">Added to cart.</span>
                <Link to="/cart" className="btn btn-primary btn-sm">View cart</Link>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdded(false)}>Add another</button>
                <Link to="/shop" className="btn btn-ghost btn-sm">Continue shopping</Link>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn btn-primary flex-1" onClick={addToCart}>Add to cart</button>
                <Link to="/shop" className="btn btn-ghost">Continue shopping</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
