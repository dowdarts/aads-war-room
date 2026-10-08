import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { STATUS_LABELS, PAYMENT_LABELS, PROJECT_LABELS } from '../lib/format.js'

/** Loads async data with loading/error state and a reload function. */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: s.data == null, error: null }))
    try { setState({ data: await fn(), loading: false, error: null }) }
    catch (error) { setState({ data: null, loading: false, error }) }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])
  return { ...state, reload: load }
}

/** Wraps an async action with busy + message state. */
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const run = async (fn, okText) => {
    setBusy(true); setMsg(null)
    try { const r = await fn(); if (okText) setMsg({ ok: true, text: typeof okText === 'function' ? okText(r) : okText }); return r }
    catch (e) { setMsg({ ok: false, text: e.message }); return undefined }
    finally { setBusy(false) }
  }
  return { busy, msg, run, setMsg }
}

export function Msg({ msg }) {
  if (!msg) return null
  return <div className={msg.ok ? 'ok' : 'err'} role="status">{msg.text}</div>
}

export function H1({ children, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-black tracking-tight">{children}</h1>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Panel({ title, children, actions, className = '' }) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="font-black">{title}</h2>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

const tone = s => (['verified', 'payment_confirmed', 'completed', 'delivered', 'paid', 'sent', 'design_approved', 'active'].includes(s) ? 'badge-good'
  : ['cancelled', 'failed', 'void', 'refunded', 'disabled'].includes(s) ? 'badge-bad'
  : ['new', 'new_inquiry', 'awaiting', 'awaiting_payment', 'partial', 'draft', 'revision_requested', 'awaiting_feedback'].includes(s) ? 'badge-accent' : '')

export function StatusBadge({ value, kind = 'order' }) {
  const labels = kind === 'payment' ? PAYMENT_LABELS : kind === 'project' ? PROJECT_LABELS : STATUS_LABELS
  return <span className={`badge ${tone(value)}`}>{labels[value] || String(value || '').replace(/_/g, ' ')}</span>
}

export function Empty({ children }) {
  return <div className="py-10 text-center text-sm text-muted">{children}</div>
}

export function Field({ label, children, hint, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function Stat({ label, value, to, tone: t }) {
  const inner = (
    <>
      <div className="text-xs font-bold uppercase tracking-widest text-muted">{label}</div>
      <div className={`mt-1 text-3xl font-black tabular-nums ${t === 'accent' && value ? 'text-accent-2' : ''}`}>{value}</div>
    </>
  )
  return to ? <Link to={to} className="card block p-4 hover:border-accent/60">{inner}</Link> : <div className="card p-4">{inner}</div>
}
