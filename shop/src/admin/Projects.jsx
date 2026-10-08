import { useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase, must, admin, audit, signedFileUrl, toCents, toDollars } from './api.js'
import { useLoad, useAction, Msg, H1, Panel, Field, Empty, StatusBadge } from './ui.jsx'
import { InvoiceBuilder } from './Invoices.jsx'
import { CopyButton } from '../components/ui.jsx'
import { money, fmtDate, fmtDateTime, PROJECT_LABELS } from '../lib/format.js'
import { CUSTOM, priceCustom } from '@pricing'

const GROUPS = {
  new: ['new_inquiry', 'under_review'],
  work: ['revision_requested', 'mockup_in_progress'],
  feedback: ['awaiting_feedback', 'initial_mockup_sent', 'revised_mockup_sent'],
}

export function InquiriesList() {
  const { data, loading } = useLoad(async () => must(await supabase.from('shop_design_inquiries')
    .select('id, inquiry_number, estimated_qty, estimate_cents, team, brief, created_at, shop_customers(name, email), shop_design_projects(id, status, project_number), shop_design_files(id)')
    .order('created_at', { ascending: false }).limit(300)))
  return (
    <div>
      <H1>Design inquiries</H1>
      {loading ? <Empty>Loading…</Empty> : !data?.length ? <Empty>No inquiries yet.</Empty> : (
        <div className="card divide-y divide-line">
          {data.map(i => {
            const proj = i.shop_design_projects?.[0]
            return (
              <Link key={i.id} to={proj ? `/admin/projects/${proj.id}` : '#'} className="block p-4 hover:bg-panel-2">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{i.inquiry_number}</b><span>{i.shop_customers?.name}</span>{i.team && <span className="text-muted">· {i.team}</span>}
                  {proj && <StatusBadge value={proj.status} kind="project" />}
                  <span className="ml-auto text-sm text-muted">{fmtDateTime(i.created_at)}</span>
                </div>
                <div className="mt-1 text-sm text-muted">{i.estimated_qty} shirts · est. {money(i.estimate_cents)} · {i.shop_design_files.length} file(s)</div>
                <p className="mt-1 line-clamp-2 text-sm">{i.brief}</p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ProjectsList() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') || ''
  const { data, loading } = useLoad(async () => {
    let q = supabase.from('shop_design_projects').select('id, project_number, title, status, invoice_status, estimated_qty, revisions_used, extra_packages_approved, updated_at, shop_customers(name)').order('updated_at', { ascending: false }).limit(300)
    if (GROUPS[status]) q = q.in('status', GROUPS[status]); else if (status) q = q.eq('status', status)
    return must(await q)
  }, [status])
  return (
    <div>
      <H1>Custom design projects</H1>
      <div className="card mb-4 p-3">
        <select className="select sm:!w-72" value={status} onChange={e => setParams(e.target.value ? { status: e.target.value } : {}, { replace: true })}>
          <option value="">All projects</option>
          <option value="new">New / under review</option><option value="work">Revisions to do</option><option value="feedback">Awaiting customer feedback</option>
          {Object.entries(PROJECT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {loading ? <Empty>Loading…</Empty> : !data?.length ? <Empty>No projects.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Project</th><th>Customer</th><th>Status</th><th>Invoice</th><th className="text-right">Est. qty</th><th>Revisions</th><th>Updated</th></tr></thead>
            <tbody>{data.map(p => (
              <tr key={p.id}>
                <td><Link className="font-bold text-accent-2" to={`/admin/projects/${p.id}`}>{p.project_number}</Link><div className="text-xs text-muted">{p.title}</div></td>
                <td>{p.shop_customers?.name}</td><td><StatusBadge value={p.status} kind="project" /></td><td><StatusBadge value={p.invoice_status} /></td>
                <td className="text-right">{p.estimated_qty}</td>
                <td>{p.revisions_used} / {CUSTOM.includedRevisionRounds + p.extra_packages_approved * CUSTOM.roundsPerPackage}</td>
                <td className="text-muted">{fmtDate(p.updated_at)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

async function loadProject(id) {
  const [p, files, events, invoices, links, orders] = await Promise.all([
    supabase.from('shop_design_projects').select('*, shop_customers(*), shop_design_inquiries(*)').eq('id', id).single(),
    supabase.from('shop_design_files').select('*').eq('project_id', id).order('created_at'),
    supabase.from('shop_revision_events').select('*').eq('project_id', id).order('created_at'),
    supabase.from('shop_invoices').select('*').eq('project_id', id).is('order_id', null).in('status', ['draft', 'issued']).order('created_at'),
    supabase.from('shop_private_order_links').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('shop_orders').select('id, order_number, status, total_cents, created_at').eq('project_id', id),
  ])
  return { project: must(p), files: must(files), events: must(events), invoices: must(invoices), links: must(links), orders: must(orders) }
}

function FileLink({ f }) {
  const [busy, setBusy] = useState(false)
  return (
    <button className="text-left text-accent-2 underline" disabled={busy} onClick={async () => {
      setBusy(true)
      try { window.open(await signedFileUrl(f.storage_path, { download: f.mime_type === 'image/svg+xml' }), '_blank', 'noopener') } finally { setBusy(false) }
    }}>{f.file_name}</button>
  )
}

function ProjectSettings({ project, onSaved }) {
  const [v, setV] = useState({
    title: project.title, status: project.status, estimated_qty: project.estimated_qty || '', locked: toDollars(project.locked_unit_cents),
    design_fee_waived: project.design_fee_waived, public_description: project.public_description || '', notes: project.notes || '',
  })
  const { busy, msg, run } = useAction()
  const est = priceCustom({ qty: parseInt(v.estimated_qty, 10) || 1, lockedUnitCents: v.locked ? toCents(v.locked) : null, discount: v.design_fee_waived ? { waiveDesignFee: true } : null, extraRevisionPackages: project.extra_packages_approved })
  return (
    <Panel title="Project">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title"><input className="input" value={v.title} onChange={e => setV({ ...v, title: e.target.value })} /></Field>
        <Field label="Status">
          <select className="select" value={v.status} onChange={e => setV({ ...v, status: e.target.value })}>
            {Object.entries(PROJECT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Estimated shirts"><input className="input" inputMode="numeric" value={v.estimated_qty} onChange={e => setV({ ...v, estimated_qty: e.target.value })} /></Field>
        <Field label="Locked price per shirt ($)" hint="Optional special price that overrides the quantity tiers"><input className="input" inputMode="decimal" value={v.locked} onChange={e => setV({ ...v, locked: e.target.value })} placeholder="Tier pricing" /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.design_fee_waived} onChange={e => setV({ ...v, design_fee_waived: e.target.checked })} /> Waive the $50 design fee</label>
        <div className="text-sm text-muted sm:text-right">Estimate: {est.qty} × {money(est.unitCents)} + fees = <b className="text-text">{money(est.totalCents)}</b></div>
        <Field label="Description shown on the private order page" className="sm:col-span-2"><textarea className="textarea" rows={2} value={v.public_description} onChange={e => setV({ ...v, public_description: e.target.value })} /></Field>
        <Field label="Internal notes" className="sm:col-span-2"><textarea className="textarea" rows={2} value={v.notes} onChange={e => setV({ ...v, notes: e.target.value })} /></Field>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(async () => {
          await admin('set_project', { projectId: project.id, patch: {
            title: v.title, status: v.status, estimated_qty: parseInt(v.estimated_qty, 10) || null, locked_unit_cents: v.locked ? toCents(v.locked) : null,
            design_fee_waived: v.design_fee_waived, public_description: v.public_description || null, notes: v.notes || null,
          } })
          onSaved()
        }, 'Saved.')}>Save project</button>
        <Msg msg={msg} />
      </div>
    </Panel>
  )
}

function Files({ project, files, onChanged }) {
  const input = useRef(null)
  const [kind, setKind] = useState('mockup')
  const [note, setNote] = useState('')
  const { busy, msg, run } = useAction()
  const mockups = files.filter(f => f.kind === 'mockup')
  async function upload(list) {
    await run(async () => {
      for (const file of list) {
        if (file.size > 25 * 1024 * 1024) throw new Error(`${file.name} is over 25 MB.`)
        if (!['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'image/svg+xml'].includes(file.type)) throw new Error(`${file.name}: PNG, JPG, WebP, SVG or PDF only.`)
        const ext = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
        const path = `projects/${project.id}/${crypto.randomUUID()}.${ext}`
        const { error } = await supabase.storage.from('shop-design-files').upload(path, file, { contentType: file.type })
        if (error) throw new Error(error.message)
        must(await supabase.from('shop_design_files').insert({
          project_id: project.id, kind, version: kind === 'mockup' ? mockups.length + 1 : null, file_name: file.name.slice(-120),
          mime_type: file.type, size_bytes: file.size, storage_path: path,
        }))
      }
      await audit('project.files_uploaded', 'shop_design_projects', project.id, { kind, count: list.length })
      onChanged()
    }, 'Uploaded.')
  }
  return (
    <Panel title="Files & mockups">
      <div className="overflow-x-auto">
        <table className="table">
          <thead><tr><th>File</th><th>Type</th><th>Version</th><th>Added</th><th>Sent</th><th /></tr></thead>
          <tbody>{files.map(f => (
            <tr key={f.id}>
              <td><FileLink f={f} /><div className="text-xs text-muted">{Math.ceil(f.size_bytes / 1024)} KB</div></td>
              <td>{f.kind.replace(/_/g, ' ')}</td><td>{f.version ? `v${f.version}` : '—'}</td><td className="text-muted">{fmtDate(f.created_at)}</td>
              <td>{f.sent_at ? <span className="badge badge-good">{fmtDate(f.sent_at)}</span> : '—'}</td>
              <td>{f.kind === 'mockup' && (
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(async () => {
                  const r = await admin('send_mockup', { projectId: project.id, fileId: f.id, note, force: !!f.sent_at })
                  if (r.email.status === 'skipped') throw new Error('Logged, but email isn’t configured — send the file manually.')
                  if (r.email.status === 'failed') throw new Error(`Email failed: ${r.email.error}`)
                  setNote(''); onChanged()
                }, 'Mockup emailed to the customer.')}>{f.sent_at ? 'Resend' : 'Email to customer'}</button>
              )}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr_auto] sm:items-end">
        <Field label="Upload as">
          <select className="select" value={kind} onChange={e => setKind(e.target.value)}>
            <option value="mockup">Mockup (v{mockups.length + 1})</option><option value="final_front">Final front art</option><option value="final_back">Final back art</option><option value="other">Other</option>
          </select>
        </Field>
        <Field label="Message with next mockup email (optional)"><input className="input" value={note} onChange={e => setNote(e.target.value)} /></Field>
        <button className="btn btn-ghost" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Working…' : 'Upload files'}</button>
        <input ref={input} type="file" multiple className="hidden" accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf" onChange={e => { const l = [...e.target.files]; e.target.value = ''; upload(l) }} />
      </div>
      <div className="mt-2"><Msg msg={msg} /></div>
    </Panel>
  )
}

function Revisions({ project, events, onChanged }) {
  const [detail, setDetail] = useState('')
  const { busy, msg, run } = useAction()
  const allowed = CUSTOM.includedRevisionRounds + project.extra_packages_approved * CUSTOM.roundsPerPackage
  return (
    <Panel title="Revisions">
      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        <span className="badge">Used {project.revisions_used} of {allowed}</span>
        <span className="badge">2 included</span>
        {project.extra_packages_approved > 0 && <span className="badge badge-accent">{project.extra_packages_approved} extra package(s) · {money(project.extra_packages_approved * CUSTOM.revisionPackageCents)}</span>}
      </div>
      <Field label="Customer’s requested changes"><textarea className="textarea" rows={2} value={detail} onChange={e => setDetail(e.target.value)} /></Field>
      <div className="mt-2 flex flex-wrap gap-2">
        <button className="btn btn-ghost btn-sm" disabled={busy || !detail.trim()} onClick={() => run(async () => { await admin('record_revision', { projectId: project.id, detail }); setDetail(''); onChanged() }, 'Revision round recorded.')}>Record revision request</button>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => confirm('Has the customer requested and approved an extra 2-round revision package for $25?') && run(async () => { await admin('approve_package', { projectId: project.id }); onChanged() }, 'Package recorded — remember to add it to their invoice.')}>+ Customer approved $25 package</button>
      </div>
      <Msg msg={msg} />
      {events.length > 0 && (
        <ol className="mt-4 space-y-2 border-l border-line pl-4 text-sm">
          {events.map(e => (
            <li key={e.id}>
              <span className="font-bold">{({ mockup_sent: 'Initial mockup sent (v1)', revised_mockup_sent: `Revised mockup sent`, revision_requested: `Revision ${e.round} requested`, package_approved: 'Extra package approved', approved: 'Design approved', note: 'Note' })[e.event]}</span>
              <span className="text-muted"> · {fmtDateTime(e.created_at)}</span>
              {e.detail && <div className="whitespace-pre-wrap text-muted">{e.detail}</div>}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

function Approval({ project, files, onChanged }) {
  const images = files.filter(f => f.mime_type.startsWith('image/') && f.mime_type !== 'image/svg+xml' && f.kind !== 'customer_upload')
  const [v, setV] = useState({ note: '', front: files.find(f => f.kind === 'final_front')?.id || '', back: files.find(f => f.kind === 'final_back')?.id || '' })
  const { busy, msg, run } = useAction()
  if (project.approved_at) {
    return (
      <Panel title="Approval">
        <div className="ok">Approved {fmtDateTime(project.approved_at)}</div>
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{project.approval_note}</p>
      </Panel>
    )
  }
  return (
    <Panel title="Record email approval">
      <p className="mb-3 text-sm text-muted">Once the customer approves the design by email, record it here. This unlocks the private ordering link. Upload the final art first (PNG/JPG).</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Approved front design">
          <select className="select" value={v.front} onChange={e => setV({ ...v, front: e.target.value })}>
            <option value="">Choose…</option>{images.map(f => <option key={f.id} value={f.id}>{f.file_name} ({f.kind.replace(/_/g, ' ')})</option>)}
          </select>
        </Field>
        <Field label="Approved back design (optional)">
          <select className="select" value={v.back} onChange={e => setV({ ...v, back: e.target.value })}>
            <option value="">None</option>{images.map(f => <option key={f.id} value={f.id}>{f.file_name} ({f.kind.replace(/_/g, ' ')})</option>)}
          </select>
        </Field>
        <Field label="Customer’s approval email (paste or summarize, with date)" className="sm:col-span-2"><textarea className="textarea" rows={3} value={v.note} onChange={e => setV({ ...v, note: e.target.value })} /></Field>
      </div>
      <button className="btn btn-primary btn-sm mt-3" disabled={busy} onClick={() => run(async () => { await admin('record_approval', { projectId: project.id, note: v.note, frontFileId: v.front || null, backFileId: v.back || null }); onChanged() }, 'Approval recorded.')}>Record approval</button>
      <div className="mt-2"><Msg msg={msg} /></div>
    </Panel>
  )
}

function LinksPanel({ project, links, onChanged }) {
  const [days, setDays] = useState(30)
  const [email, setEmail] = useState(true)
  const [created, setCreated] = useState(null)
  const { busy, msg, run } = useAction()
  return (
    <Panel title="Private order link">
      {!project.approved_at ? <p className="text-sm text-muted">Available after you record the customer’s approval.</p> : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Expires after (days)"><input className="input !w-24" type="number" min="1" max="365" value={days} onChange={e => setDays(e.target.value)} /></Field>
            <label className="flex items-center gap-2 pb-3 text-sm"><input type="checkbox" checked={email} onChange={e => setEmail(e.target.checked)} /> Email it to the customer</label>
            <button className="btn btn-primary btn-sm mb-1" disabled={busy} onClick={() => run(async () => {
              if (links.some(l => !l.revoked && !l.used_at) && !confirm('This replaces the current active link. Continue?')) return
              const r = await admin('create_private_link', { projectId: project.id, expiresInDays: Number(days), sendEmail: email })
              setCreated(r); onChanged()
            }, 'Link created.')}>{links.length ? 'Create new link' : 'Create link'}</button>
          </div>
          {created && (
            <div className="note mt-3 break-all">
              <div className="mb-1 font-bold">Copy this link now — it can’t be shown again.</div>
              <div className="flex flex-wrap items-center gap-2"><code className="text-text">{created.url}</code><CopyButton text={created.url} /></div>
              {created.email && <div className="mt-1 text-xs">Email: {created.email.status}</div>}
            </div>
          )}
        </>
      )}
      {links.length > 0 && (
        <table className="table mt-3">
          <thead><tr><th>Link</th><th>Created</th><th>Expires</th><th>Status</th><th /></tr></thead>
          <tbody>{links.map(l => (
            <tr key={l.id}>
              <td className="font-mono text-xs">…{l.token_hint}</td><td>{fmtDate(l.created_at)}</td><td>{fmtDate(l.expires_at)}</td>
              <td>{l.used_at ? <span className="badge badge-good">Used {fmtDate(l.used_at)}</span> : l.revoked ? <span className="badge badge-bad">Revoked</span> : new Date(l.expires_at) < new Date() ? <span className="badge">Expired</span> : <span className="badge badge-accent">Active</span>}</td>
              <td>{!l.revoked && !l.used_at && <button className="text-xs underline" onClick={() => run(async () => { await admin('revoke_link', { linkId: l.id }); onChanged() })}>Revoke</button>}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
      <Msg msg={msg} />
    </Panel>
  )
}

export function ProjectDetail() {
  const { id } = useParams()
  const { data, loading, error, reload } = useLoad(() => loadProject(id), [id])
  const { busy, msg, run } = useAction()
  if (loading) return <Empty>Loading…</Empty>
  if (error) return <div className="err">{error.message}</div>
  const { project, files, events, invoices, links, orders } = data
  const c = project.shop_customers
  const inq = project.shop_design_inquiries
  const uploads = files.filter(f => f.kind === 'customer_upload')
  const work = files.filter(f => f.kind !== 'customer_upload')

  return (
    <div className="space-y-4">
      <H1 actions={<Link to="/admin/projects" className="btn btn-ghost btn-sm">← Projects</Link>}>{project.project_number} · {project.title}</H1>
      <div className="flex flex-wrap gap-2"><StatusBadge value={project.status} kind="project" /><StatusBadge value={project.invoice_status} /></div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Panel title={`Brief${inq ? ` · ${inq.inquiry_number}` : ''}`}>
          {inq ? (
            <div className="space-y-2 text-sm">
              <p className="whitespace-pre-wrap">{inq.brief}</p>
              <dl className="grid gap-x-4 gap-y-1 text-muted sm:grid-cols-2">
                <div>Estimated shirts: <b className="text-text">{inq.estimated_qty}</b></div>
                {inq.colour_palette && <div>Colours: {inq.colour_palette}</div>}
                {inq.style_notes && <div>Style: {inq.style_notes}</div>}
                {inq.sponsor_notes && <div>Sponsors: {inq.sponsor_notes}</div>}
                {inq.player_names_notes && <div>Names: {inq.player_names_notes}</div>}
                {inq.instructions && <div className="sm:col-span-2">Instructions: {inq.instructions}</div>}
              </dl>
              {uploads.length > 0 && <div><div className="label mt-3">Customer files</div><ul className="space-y-1">{uploads.map(f => <li key={f.id}><FileLink f={f} /></li>)}</ul></div>}
            </div>
          ) : <p className="text-sm text-muted">No inquiry attached.</p>}
        </Panel>
        <Panel title="Customer">
          <div className="text-sm"><b>{c.name}</b><br /><a className="text-accent-2" href={`mailto:${c.email}`}>{c.email}</a><br />{c.phone}{c.team && <><br />{c.team}</>}</div>
          <Link className="mt-2 inline-block text-xs underline" to={`/admin/customers/${c.id}`}>Customer history</Link>
        </Panel>
      </div>

      <ProjectSettings key={project.updated_at} project={project} onSaved={reload} />

      <Panel title="Quotes & invoices" actions={<>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(async () => { await admin('create_project_document', { projectId: project.id, kind: 'quote' }); await reload() }, 'Quote created.')}>New quote</button>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(async () => { await admin('create_project_document', { projectId: project.id, kind: 'invoice' }); await reload() }, 'Design-fee invoice created.')}>New design-fee invoice</button>
      </>}>
        <Msg msg={msg} />
        {invoices.length === 0 ? <p className="text-sm text-muted">Create a quote from the estimate, or a design-fee invoice to collect the $50 before mockups. Any design fee paid here is credited on the final order automatically.</p>
          : <div className="space-y-6">{invoices.map(inv => <InvoiceBuilder key={inv.id} invoice={inv} onChanged={reload} />)}</div>}
      </Panel>

      <Files project={project} files={work} onChanged={reload} />
      <Revisions project={project} events={events} onChanged={reload} />
      <Approval project={project} files={files} onChanged={reload} />
      <LinksPanel project={project} links={links} onChanged={reload} />

      {orders.length > 0 && (
        <Panel title="Final orders">
          {orders.map(o => <div key={o.id} className="text-sm"><Link className="font-bold text-accent-2" to={`/admin/orders/${o.id}`}>{o.order_number}</Link> · {money(o.total_cents)} · <StatusBadge value={o.status} /></div>)}
        </Panel>
      )}
    </div>
  )
}

export function PrivateLinks() {
  const { data, loading } = useLoad(async () => must(await supabase.from('shop_private_order_links').select('*, shop_design_projects(id, project_number, title), shop_customers(name)').order('created_at', { ascending: false }).limit(300)))
  return (
    <div>
      <H1>Private order links</H1>
      <p className="mb-4 text-sm text-muted">Links are created from a design project after the customer’s approval is recorded. Only the last 4 characters are stored in readable form.</p>
      {loading ? <Empty>Loading…</Empty> : !data?.length ? <Empty>No links yet.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Project</th><th>Customer</th><th>Link</th><th>Created</th><th>Expires</th><th>Status</th></tr></thead>
            <tbody>{data.map(l => (
              <tr key={l.id}>
                <td><Link className="text-accent-2" to={`/admin/projects/${l.project_id}`}>{l.shop_design_projects?.project_number}</Link><div className="text-xs text-muted">{l.shop_design_projects?.title}</div></td>
                <td>{l.shop_customers?.name}</td><td className="font-mono text-xs">…{l.token_hint}</td><td>{fmtDate(l.created_at)}</td><td>{fmtDate(l.expires_at)}</td>
                <td>{l.used_at ? <span className="badge badge-good">Used</span> : l.revoked ? <span className="badge badge-bad">Revoked</span> : new Date(l.expires_at) < new Date() ? <span className="badge">Expired</span> : <span className="badge badge-accent">Active</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
