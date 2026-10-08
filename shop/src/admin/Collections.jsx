import { useState } from 'react'
import { supabase, must, audit, slugify } from './api.js'
import { useLoad, useAction, Msg, H1, Panel, Field, Empty } from './ui.jsx'
import { uploadProductImage, IMAGE_ACCEPT } from './images.js'
import { ProductImage } from '../components/ui.jsx'
import { loadCatalog } from '../lib/catalog.js'

function CollectionRow({ c, all, onSaved }) {
  const [v, setV] = useState(c)
  const { busy, msg, run } = useAction()
  const set = patch => setV(x => ({ ...x, ...patch }))
  const dirty = JSON.stringify(v) !== JSON.stringify(c)
  const save = patch => run(async () => {
    const row = { ...v, ...patch }
    must(await supabase.from('shop_collections').update({
      name: row.name, slug: row.slug, description: row.description, parent_id: row.parent_id || null, sort_order: row.sort_order,
      visible: row.visible, featured: row.featured, archived: row.archived, image_url: row.image_url || null,
    }).eq('id', c.id))
    await audit('collection.updated', 'shop_collections', c.id, { name: row.name })
    loadCatalog({ force: true }).catch(() => {})
    onSaved()
  }, 'Saved.')
  return (
    <div className={`grid gap-3 border-b border-line p-3 sm:grid-cols-[80px_1fr] ${c.parent_id ? 'sm:pl-10' : ''}`}>
      <label className="block cursor-pointer overflow-hidden rounded-lg border border-line" title="Upload cover image">
        <ProductImage src={v.image_url} alt="" label="Cover" />
        <input type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={e => {
          const f = e.target.files[0]; e.target.value = ''
          if (f) run(async () => { const url = await uploadProductImage(f, `collections/${v.slug}`, 'cover'); set({ image_url: url }); await save({ image_url: url }) })
        }} />
      </label>
      <div className="grid gap-2 sm:grid-cols-4">
        <Field label="Name"><input className="input" value={v.name} onChange={e => set({ name: e.target.value })} /></Field>
        <Field label="Slug"><input className="input" value={v.slug} onChange={e => set({ slug: slugify(e.target.value) })} /></Field>
        <Field label="Parent">
          <select className="select" value={v.parent_id || ''} onChange={e => set({ parent_id: e.target.value || null })}>
            <option value="">— Top level —</option>
            {all.filter(x => x.id !== c.id && !x.parent_id).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Field>
        <Field label="Order"><input type="number" className="input" value={v.sort_order} onChange={e => set({ sort_order: parseInt(e.target.value, 10) || 0 })} /></Field>
        <Field label="Description" className="sm:col-span-4"><input className="input" value={v.description || ''} onChange={e => set({ description: e.target.value })} /></Field>
        <div className="flex flex-wrap items-center gap-4 text-sm sm:col-span-4">
          <label className="flex items-center gap-2"><input type="checkbox" checked={v.visible} onChange={e => set({ visible: e.target.checked })} /> Visible</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={v.featured} onChange={e => set({ featured: e.target.checked })} /> Featured</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={v.archived} onChange={e => set({ archived: e.target.checked })} /> Archived</label>
          <button className="btn btn-primary btn-sm ml-auto" disabled={!dirty || busy} onClick={() => save()}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
        <div className="sm:col-span-4"><Msg msg={msg} /></div>
      </div>
    </div>
  )
}

export default function Collections() {
  const { data, loading, reload } = useLoad(async () => must(await supabase.from('shop_collections').select('*').order('sort_order')))
  const [name, setName] = useState('')
  const [parent, setParent] = useState('')
  const { busy, msg, run } = useAction()
  const ordered = data ? data.filter(c => !c.parent_id).flatMap(c => [c, ...data.filter(s => s.parent_id === c.id)]) : []
  const orphans = data ? data.filter(c => c.parent_id && !data.some(p => p.id === c.parent_id)) : []
  return (
    <div className="space-y-4">
      <H1>Collections</H1>
      <Panel title="Add collection">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Name"><input className="input" value={name} onChange={e => setName(e.target.value)} /></Field>
          <Field label="Parent (for a subcollection)">
            <select className="select" value={parent} onChange={e => setParent(e.target.value)}>
              <option value="">— Top level —</option>
              {data?.filter(c => !c.parent_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <button className="btn btn-primary" disabled={!name.trim() || busy} onClick={() => run(async () => {
            const row = must(await supabase.from('shop_collections').insert({ name: name.trim(), slug: slugify(name), parent_id: parent || null, sort_order: (data?.length || 0) * 10 + 10 }).select().single())
            await audit('collection.created', 'shop_collections', row.id, { name: row.name })
            setName(''); setParent(''); loadCatalog({ force: true }).catch(() => {}); await reload()
          }, 'Collection added.')}>Add</button>
        </div>
        <div className="mt-2"><Msg msg={msg} /></div>
      </Panel>
      {loading ? <Empty>Loading…</Empty> : (
        <div className="card overflow-hidden">{[...ordered, ...orphans].map(c => <CollectionRow key={c.id + c.updated_at} c={c} all={data} onSaved={reload} />)}</div>
      )}
    </div>
  )
}
