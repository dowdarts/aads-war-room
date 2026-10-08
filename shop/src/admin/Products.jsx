import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, must, audit, slugify } from './api.js'
import { useLoad, useAction, Msg, H1, Panel, Field, Empty, StatusBadge } from './ui.jsx'
import { uploadProductImage, removeProductImage, parseImageFilename, IMAGE_ACCEPT } from './images.js'
import { ProductImage } from '../components/ui.jsx'
import { SIZES } from '@pricing'
import { loadCatalog } from '../lib/catalog.js'

async function loadAll() {
  const [p, c] = await Promise.all([
    supabase.from('shop_products').select('*, shop_product_variants(id)').order('sort_order'),
    supabase.from('shop_collections').select('*').order('sort_order'),
  ])
  return { products: must(p), collections: must(c) }
}

export function ProductsList() {
  const { data, loading, error } = useLoad(loadAll)
  const [q, setQ] = useState('')
  const [col, setCol] = useState('')
  const [filter, setFilter] = useState('')
  const nav = useNavigate()
  const colById = useMemo(() => Object.fromEntries((data?.collections || []).map(c => [c.id, c])), [data])
  const list = useMemo(() => (data?.products || []).filter(p =>
    (!q || p.name.toLowerCase().includes(q.toLowerCase())) &&
    (!col || p.collection_id === col || colById[p.collection_id]?.parent_id === col) &&
    (!filter || (filter === 'needs_images' ? p.needs_images : p.status === filter))), [data, q, col, filter, colById])
  const needImages = (data?.products || []).filter(p => p.needs_images && p.status === 'active').length

  return (
    <div>
      <H1 actions={<>
        <Link to="/admin/products/bulk" className="btn btn-ghost btn-sm">Bulk image upload</Link>
        <button className="btn btn-primary btn-sm" onClick={() => nav('/admin/products/new')}>+ New product</button>
      </>}>Products</H1>
      {needImages > 0 && <div className="note mb-4">{needImages} active product{needImages === 1 ? '' : 's'} still need images. <button className="underline" onClick={() => setFilter('needs_images')}>Show them</button></div>}
      <div className="card mb-4 grid gap-3 p-3 sm:grid-cols-3">
        <input className="input" placeholder="Search products…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="select" value={col} onChange={e => setCol(e.target.value)}>
          <option value="">All collections</option>
          {data?.collections.map(c => <option key={c.id} value={c.id}>{c.parent_id ? '— ' : ''}{c.name}</option>)}
        </select>
        <select className="select" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option>
          <option value="archived">Archived</option><option value="needs_images">Needs images</option>
        </select>
      </div>
      {loading && <Empty>Loading…</Empty>}
      {error && <div className="err">{error.message}</div>}
      {data && (list.length === 0 ? <Empty>No products.</Empty> : (
        <div className="card divide-y divide-line">
          {list.map(p => (
            <Link key={p.id} to={`/admin/products/${p.id}`} className="flex items-center gap-3 p-3 hover:bg-panel-2">
              <div className="w-14 shrink-0 overflow-hidden rounded-lg"><ProductImage src={p.front_image_url} alt="" label="" /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{p.name}</div>
                <div className="text-xs text-muted">{colById[p.collection_id]?.name || 'No collection'} · {p.price_class === 'replica' ? 'Replica $90' : 'Standard'}{p.shop_product_variants.length ? ` · ${p.shop_product_variants.length} colours` : ''}</div>
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                {p.featured && <span className="badge badge-accent">Featured</span>}
                {p.needs_images && <span className="badge badge-bad">Needs images</span>}
                <StatusBadge value={p.status} />
              </div>
            </Link>
          ))}
        </div>
      ))}
    </div>
  )
}

const BLANK = {
  name: '', slug: '', collection_id: '', description: '', category: 'polo', style_keywords: '', price_class: 'standard',
  personalization: 'custom', locked_name: '', sizes: [...SIZES], front_image_url: '', back_image_url: '', gallery: [],
  status: 'active', featured: false, sort_order: 100, needs_images: true,
}

function ImageSlot({ label, url, folder, name, onChange }) {
  const input = useRef(null)
  const { busy, msg, run } = useAction()
  const [external, setExternal] = useState('')
  return (
    <div className="space-y-2">
      <div className="label">{label}</div>
      <div className="w-full overflow-hidden rounded-xl border border-line"><ProductImage src={url} alt={label} label={label} /></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Uploading…' : url ? 'Replace' : 'Upload'}</button>
        {url && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { removeProductImage(url); onChange('') }}>Remove</button>}
      </div>
      <div className="flex gap-2">
        <input className="input !py-1.5 text-xs" placeholder="…or paste image URL" value={external} onChange={e => setExternal(e.target.value)} />
        <button type="button" className="btn btn-ghost btn-sm" disabled={!/^https:\/\//.test(external)} onClick={() => { onChange(external); setExternal('') }}>Use</button>
      </div>
      <input ref={input} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={e => {
        const f = e.target.files[0]; e.target.value = ''
        if (f) run(async () => onChange(await uploadProductImage(f, folder, name)))
      }} />
      <Msg msg={msg} />
    </div>
  )
}

function Variants({ productId, folder }) {
  const { data, reload } = useLoad(async () => must(await supabase.from('shop_product_variants').select('*').eq('product_id', productId).order('sort_order')), [productId])
  const { msg, run } = useAction()
  const [nv, setNv] = useState({ colour_name: '', colour_hex: '#ff7a00' })
  const save = (id, patch) => run(async () => { must(await supabase.from('shop_product_variants').update(patch).eq('id', id)); await reload() })
  return (
    <Panel title="Colour variants" actions={<span className="text-xs text-muted">Leave empty for single-colour products</span>}>
      <div className="space-y-3">
        {data?.map(v => (
          <div key={v.id} className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-[1fr_1fr_1fr]">
            <div className="space-y-2">
              <Field label="Colour name"><input className="input" defaultValue={v.colour_name} onBlur={e => e.target.value !== v.colour_name && save(v.id, { colour_name: e.target.value })} /></Field>
              <Field label="Swatch"><input type="color" className="h-10 w-full rounded-lg border border-line bg-panel-2" defaultValue={v.colour_hex || '#888888'} onBlur={e => save(v.id, { colour_hex: e.target.value })} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.available} onChange={e => save(v.id, { available: e.target.checked })} /> Available</label>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => confirm(`Delete ${v.colour_name}?`) && run(async () => { must(await supabase.from('shop_product_variants').delete().eq('id', v.id)); await reload() })}>Delete</button>
            </div>
            <ImageSlot label="Front" url={v.front_image_url} folder={folder} name={`${slugify(v.colour_name)}-front`} onChange={u => save(v.id, { front_image_url: u || null })} />
            <ImageSlot label="Back" url={v.back_image_url} folder={folder} name={`${slugify(v.colour_name)}-back`} onChange={u => save(v.id, { back_image_url: u || null })} />
          </div>
        ))}
        <div className="flex flex-wrap items-end gap-2">
          <Field label="New colour"><input className="input" value={nv.colour_name} onChange={e => setNv({ ...nv, colour_name: e.target.value })} /></Field>
          <input type="color" aria-label="Swatch" className="h-11 w-14 rounded-lg border border-line bg-panel-2" value={nv.colour_hex} onChange={e => setNv({ ...nv, colour_hex: e.target.value })} />
          <button type="button" className="btn btn-ghost" disabled={!nv.colour_name.trim()} onClick={() => run(async () => {
            must(await supabase.from('shop_product_variants').insert({ product_id: productId, colour_name: nv.colour_name.trim(), colour_hex: nv.colour_hex, sort_order: (data?.length || 0) + 1 }))
            setNv({ colour_name: '', colour_hex: '#ff7a00' }); await reload()
          })}>Add colour</button>
        </div>
        <Msg msg={msg} />
      </div>
    </Panel>
  )
}

export function ProductEdit() {
  const { id } = useParams()
  const isNew = id === 'new'
  const nav = useNavigate()
  const { data: cols } = useLoad(async () => must(await supabase.from('shop_collections').select('*').order('sort_order')))
  const { data: loaded, loading } = useLoad(async () => (isNew ? { ...BLANK } : must(await supabase.from('shop_products').select('*').eq('id', id).single())), [id])
  const [p, setP] = useState(null)
  useEffect(() => setP(null), [id])
  const { busy, msg, run } = useAction()
  const product = p || loaded
  const set = patch => setP({ ...product, ...patch })

  if (loading || !product) return <Empty>Loading…</Empty>
  const col = cols?.find(c => c.id === product.collection_id)
  const folder = `${col?.slug || 'uncategorized'}/${product.slug || 'new'}`
  const gallery = Array.isArray(product.gallery) ? product.gallery : []

  async function save() {
    await run(async () => {
      const row = {
        ...product,
        slug: product.slug || slugify(product.name),
        collection_id: product.collection_id || null,
        locked_name: product.personalization === 'locked' ? product.locked_name : null,
        front_image_url: product.front_image_url || null, back_image_url: product.back_image_url || null,
        needs_images: !product.front_image_url,
      }
      delete row.created_at; delete row.updated_at; delete row.shop_product_variants
      if (!row.name) throw new Error('Name is required.')
      if (!row.collection_id) throw new Error('Choose a collection.')
      if (row.personalization === 'locked' && !row.locked_name) throw new Error('Enter the locked player name.')
      if (!row.sizes.length) throw new Error('Pick at least one size.')
      if (isNew) {
        delete row.id
        const saved = must(await supabase.from('shop_products').insert(row).select().single())
        await audit('product.created', 'shop_products', saved.id, { name: saved.name })
        loadCatalog({ force: true }).catch(() => {})
        nav(`/admin/products/${saved.id}`, { replace: true })
      } else {
        must(await supabase.from('shop_products').update(row).eq('id', id))
        await audit('product.updated', 'shop_products', id, { name: row.name })
        loadCatalog({ force: true }).catch(() => {})
      }
    }, 'Saved.')
  }

  return (
    <div className="space-y-4">
      <H1 actions={<>
        <Link to="/admin/products" className="btn btn-ghost btn-sm">← All products</Link>
        {!isNew && <a href={`/product/${product.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">View in shop</a>}
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
      </>}>{isNew ? 'New product' : product.name}</H1>
      <Msg msg={msg} />
      <Panel title="Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><input className="input" value={product.name} onChange={e => set({ name: e.target.value, ...(isNew ? { slug: slugify(e.target.value) } : {}) })} /></Field>
          <Field label="URL slug" hint={`shop.aadsdarts.com/product/${product.slug || '…'}`}><input className="input" value={product.slug} onChange={e => set({ slug: slugify(e.target.value) })} /></Field>
          <Field label="Collection">
            <select className="select" value={product.collection_id || ''} onChange={e => set({ collection_id: e.target.value })}>
              <option value="">Choose…</option>
              {cols?.map(c => <option key={c.id} value={c.id}>{c.parent_id ? '— ' : ''}{c.name}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className="select" value={product.status} onChange={e => set({ status: e.target.value })}>
              <option value="active">Active (visible)</option><option value="inactive">Inactive (hidden)</option><option value="archived">Archived</option>
            </select>
          </Field>
          <Field label="Pricing">
            <select className="select" value={product.price_class} onChange={e => set({ price_class: e.target.value })}>
              <option value="standard">Standard — $85 / $70 on 3–6, +$2 zipper/pocket</option>
              <option value="replica">Player replica — $90, no upgrade charges</option>
            </select>
          </Field>
          <Field label="Category"><input className="input" value={product.category} onChange={e => set({ category: e.target.value })} /></Field>
          <Field label="Name personalization">
            <select className="select" value={product.personalization} onChange={e => set({ personalization: e.target.value })}>
              <option value="custom">Customer can add a name</option><option value="locked">Locked player name</option><option value="none">No name</option>
            </select>
          </Field>
          {product.personalization === 'locked' && <Field label="Locked player name"><input className="input" value={product.locked_name || ''} onChange={e => set({ locked_name: e.target.value })} /></Field>}
          <Field label="Description" className="sm:col-span-2"><textarea className="textarea" rows={3} value={product.description || ''} onChange={e => set({ description: e.target.value })} /></Field>
          <Field label="Search keywords" hint="Extra words for search, e.g. camo, pink, ladies"><input className="input" value={product.style_keywords || ''} onChange={e => set({ style_keywords: e.target.value })} /></Field>
          <Field label="Display order" hint="Lower shows first"><input type="number" className="input" value={product.sort_order} onChange={e => set({ sort_order: parseInt(e.target.value, 10) || 0 })} /></Field>
          <div className="sm:col-span-2">
            <div className="label">Sizes</div>
            <div className="flex flex-wrap gap-2">
              {SIZES.map(s => (
                <button key={s} type="button" className="opt !min-h-9 !py-1" aria-pressed={product.sizes.includes(s)}
                  onClick={() => set({ sizes: product.sizes.includes(s) ? product.sizes.filter(x => x !== s) : SIZES.filter(x => x === s || product.sizes.includes(x)) })}>{s}</button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={product.featured} onChange={e => set({ featured: e.target.checked })} /> Featured on home page</label>
        </div>
      </Panel>

      <Panel title="Images" actions={<span className="text-xs text-muted">Images are resized to 2000px and compressed automatically</span>}>
        <div className="grid gap-4 sm:grid-cols-3">
          <ImageSlot label="Front (main)" url={product.front_image_url} folder={folder} name="front" onChange={u => set({ front_image_url: u })} />
          <ImageSlot label="Back" url={product.back_image_url} folder={folder} name="back" onChange={u => set({ back_image_url: u })} />
          <div className="space-y-2">
            <div className="label">Gallery</div>
            <div className="grid grid-cols-3 gap-2">
              {gallery.map((g, i) => (
                <div key={g + i} className="group relative overflow-hidden rounded-lg border border-line">
                  <ProductImage src={g} alt="" label="" />
                  <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/70 px-1 text-xs">
                    <button type="button" disabled={i === 0} onClick={() => { const n = [...gallery]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; set({ gallery: n }) }} aria-label="Move left">◀</button>
                    <button type="button" onClick={() => set({ front_image_url: g, gallery: gallery.filter((_, j) => j !== i).concat(product.front_image_url ? [product.front_image_url] : []) })} title="Make main image">★</button>
                    <button type="button" onClick={() => { removeProductImage(g); set({ gallery: gallery.filter((_, j) => j !== i) }) }} aria-label="Delete">✕</button>
                  </div>
                </div>
              ))}
            </div>
            <GalleryAdd folder={folder} onAdd={urls => set({ gallery: [...gallery, ...urls] })} />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">Remember to Save after changing images.</p>
      </Panel>

      {!isNew && <Variants productId={id} folder={folder} />}

      {!isNew && (
        <div className="flex justify-end">
          <button className="btn btn-danger btn-sm" onClick={() => confirm('Archive this product? It will be hidden from the shop.') && run(async () => {
            must(await supabase.from('shop_products').update({ status: 'archived' }).eq('id', id)); await audit('product.archived', 'shop_products', id); nav('/admin/products')
          })}>Archive product</button>
        </div>
      )}
    </div>
  )
}

function GalleryAdd({ folder, onAdd }) {
  const input = useRef(null)
  const { busy, msg, run } = useAction()
  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Uploading…' : '+ Add photos'}</button>
      <input ref={input} type="file" multiple accept={IMAGE_ACCEPT} className="hidden" onChange={e => {
        const files = [...e.target.files]; e.target.value = ''
        run(async () => { const urls = []; for (const f of files) urls.push(await uploadProductImage(f, folder, 'gallery')); onAdd(urls) })
      }} />
      <Msg msg={msg} />
    </>
  )
}

export function BulkUpload() {
  const { data, reload } = useLoad(async () => {
    const [p, c, v] = await Promise.all([
      supabase.from('shop_products').select('id, slug, name, collection_id, front_image_url, back_image_url, gallery').neq('status', 'archived'),
      supabase.from('shop_collections').select('id, slug'),
      supabase.from('shop_product_variants').select('id, product_id, colour_name'),
    ])
    return { products: must(p), collections: must(c), variants: must(v) }
  })
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const input = useRef(null)

  const slugs = data?.products.map(p => p.slug) || []
  function addFiles(files) {
    setRows(r => [...r, ...[...files].map(f => {
      const m = parseImageFilename(f.name, slugs)
      return { key: f.name + f.size + Math.random(), file: f, slug: m?.slug || '', side: m?.side || 'front', colour: m?.colour || '', status: m ? 'matched' : 'unmatched' }
    })])
  }
  const update = (key, patch) => setRows(r => r.map(x => (x.key === key ? { ...x, ...patch, status: patch.slug !== undefined ? (patch.slug ? 'matched' : 'unmatched') : x.status } : x)))

  async function uploadAll() {
    setBusy(true)
    const colSlug = Object.fromEntries(data.collections.map(c => [c.id, c.slug]))
    for (const r of rows.filter(x => x.status === 'matched')) {
      try {
        update(r.key, { status: 'uploading' })
        const p = data.products.find(x => x.slug === r.slug)
        const folder = `${colSlug[p.collection_id] || 'uncategorized'}/${p.slug}`
        const variant = r.colour ? data.variants.find(v => v.product_id === p.id && slugify(v.colour_name) === slugify(r.colour)) : null
        if (r.colour && !variant) throw new Error(`No “${r.colour}” colour on ${p.name}`)
        const url = await uploadProductImage(r.file, folder, `${variant ? slugify(variant.colour_name) + '-' : ''}${r.side}`)
        if (variant) {
          if (r.side === 'gallery') throw new Error('Colour variants support front/back only')
          must(await supabase.from('shop_product_variants').update({ [`${r.side}_image_url`]: url }).eq('id', variant.id))
        } else if (r.side === 'gallery') {
          const fresh = must(await supabase.from('shop_products').select('gallery').eq('id', p.id).single())
          must(await supabase.from('shop_products').update({ gallery: [...(fresh.gallery || []), url] }).eq('id', p.id))
        } else {
          must(await supabase.from('shop_products').update({ [`${r.side}_image_url`]: url, ...(r.side === 'front' ? { needs_images: false } : {}) }).eq('id', p.id))
        }
        setRows(rs => rs.map(x => (x.key === r.key ? { ...x, status: 'done' } : x)))
      } catch (e) {
        setRows(rs => rs.map(x => (x.key === r.key ? { ...x, status: 'error', error: e.message } : x)))
      }
    }
    await audit('products.bulk_images', 'shop_products', null, { count: rows.length })
    loadCatalog({ force: true }).catch(() => {})
    await reload()
    setBusy(false)
  }

  return (
    <div className="space-y-4">
      <H1 actions={<Link to="/admin/products" className="btn btn-ghost btn-sm">← Products</Link>}>Bulk image upload</H1>
      <Panel>
        <p className="text-sm text-muted">Drop many images at once. Files are matched to products by filename:</p>
        <ul className="mt-2 list-disc pl-5 text-sm text-muted">
          <li><code className="text-text">elite-white-polo-front.jpg</code> → Elite White Polo, front image</li>
          <li><code className="text-text">elite-white-polo-back.jpg</code> → back image · <code className="text-text">elite-white-polo-gallery-2.jpg</code> → gallery</li>
          <li><code className="text-text">cgc-colour-polo--red-front.png</code> → the Red colour of CGC Colour Polo</li>
        </ul>
        <div className="mt-4 rounded-xl border-2 border-dashed border-line p-8 text-center" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files) }}>
          <button className="btn btn-ghost" onClick={() => input.current?.click()}>Choose images</button>
          <p className="mt-2 text-xs text-muted">or drag them here · JPG, PNG, WebP up to 10 MB</p>
          <input ref={input} type="file" multiple accept={IMAGE_ACCEPT} className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
        </div>
      </Panel>
      {rows.length > 0 && (
        <Panel title={`${rows.length} file(s)`} actions={<>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setRows(r => r.filter(x => x.status !== 'done'))}>Clear finished</button>
          <button className="btn btn-primary btn-sm" disabled={busy || !rows.some(r => r.status === 'matched')} onClick={uploadAll}>{busy ? 'Uploading…' : `Upload ${rows.filter(r => r.status === 'matched').length} matched`}</button>
        </>}>
          <div className="divide-y divide-line">
            {rows.map(r => (
              <div key={r.key} className="grid items-center gap-2 py-2 text-sm sm:grid-cols-[1.4fr_1.6fr_110px_120px_110px]">
                <div className="truncate" title={r.file.name}>{r.file.name}</div>
                <select className="select !py-1.5" value={r.slug} disabled={busy} onChange={e => update(r.key, { slug: e.target.value })}>
                  <option value="">— Assign to product —</option>
                  {data?.products.map(p => <option key={p.id} value={p.slug}>{p.name}</option>)}
                </select>
                <select className="select !py-1.5" value={r.side} disabled={busy} onChange={e => update(r.key, { side: e.target.value })}>
                  <option value="front">Front</option><option value="back">Back</option><option value="gallery">Gallery</option>
                </select>
                <input className="input !py-1.5" placeholder="Colour (optional)" value={r.colour} disabled={busy} onChange={e => update(r.key, { colour: e.target.value })} />
                <span className={`badge ${r.status === 'done' ? 'badge-good' : r.status === 'error' || r.status === 'unmatched' ? 'badge-bad' : 'badge-accent'}`} title={r.error}>{r.status}</span>
                {r.error && <div className="text-xs text-bad sm:col-span-5">{r.error}</div>}
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}
