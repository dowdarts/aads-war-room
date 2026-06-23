import { useState, useEffect } from 'react'
import { getBaseUrl } from '../utils/baseUrl.js'

const SUPABASE_URL = 'https://gygwhznblajojwveikhg.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5Z3doem5ibGFqb2p3dmVpa2hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjU5NzgsImV4cCI6MjA4ODk0MTk3OH0.BI9KlRsCxAvNnFHCGq6hjXfdsaNgo7afY4Xa5uxwjak'
const SESSION_KEY = 'aads_staff_session'

const ALL_TOOLS = [
  { id: 'interview', label: 'Denis Interview Assistant', icon: '🎙️', path: 'interview.html' },
  { id: 'commentator', label: 'Commentator', icon: '🎤', tabId: 'commentator' },
  { id: 'scanner', label: 'QR Scanner', icon: '📷', path: 'AADSTickets-Scanner.html' },
  { id: 'checkin', label: 'Ticket Check-in', icon: '✅', path: 'AADSTickets-Checkin.html' },
  { id: 'interview-admin', label: 'Interview Admin', icon: '📋', path: 'interview-admin.html' },
  { id: 'ticket-sales', label: 'Ticket Sales', icon: '🎟️', path: 'AADSTickets-Dashboard.html' },
  { id: 'shirt-admin', label: 'Shirt Admin', icon: '👕', path: 'shirt-admin.html' },
  { id: 'shirt-order', label: 'Shirt Order', icon: '🧾', path: 'shirt-order.html' },
  { id: 'merch', label: 'Merch Store', icon: '👕', path: 'merch.html' },
  { id: 'policy', label: 'Policy Docs', icon: '📋', tabId: 'policy' },
  { id: 'cue-light', label: 'Cue Light & Schedule', icon: '🚦', path: 'cue-light.html' },
  { id: 'staff-chat', label: 'Staff Chat', icon: '💬', path: 'staff-chat.html' },
]

const hdrs = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
const ONLINE_THRESHOLD_MS = 90 * 1000
const STAFF_LIST_POLL_MS = 20000

function isOnline(staff) {
  if (!staff.last_seen_at) return false
  return Date.now() - new Date(staff.last_seen_at).getTime() < ONLINE_THRESHOLD_MS
}

function formatRelativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(iso).toLocaleDateString()
}

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
}
function saveSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)) }
function clearSession() { localStorage.removeItem(SESSION_KEY) }

export default function StaffDashboard({ onSelect }) {
  const [session, setSession] = useState(() => loadSession())
  const [mode, setMode] = useState('choice')
  const [staffList, setStaffList] = useState([])
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [activityLog, setActivityLog] = useState([])
  const [logLoading, setLogLoading] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [toolPermissions, setToolPermissions] = useState([])
  const [allStaff, setAllStaff] = useState([])
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffPin, setNewStaffPin] = useState('')
  const [addStaffError, setAddStaffError] = useState('')
  const [editingStaff, setEditingStaff] = useState(null)
  const [draftName, setDraftName] = useState('')
  const [draftPin, setDraftPin] = useState('')
  const [draftActive, setDraftActive] = useState(true)
  const [draftTools, setDraftTools] = useState([])
  const [editError, setEditError] = useState('')
  const [showManageStaff, setShowManageStaff] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const base = getBaseUrl()

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/staff_accounts?select=name&is_active=eq.true&order=name.asc`, { headers: hdrs })
      .then(r => r.json())
      .then(rows => setStaffList(Array.isArray(rows) ? rows.map(r => r.name) : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (session?.isMaster) {
      fetchLog()
      fetchAllStaff()
    } else if (session) {
      fetch(`${SUPABASE_URL}/rest/v1/staff_accounts?id=eq.${session.id}&select=tool_permissions`, { headers: hdrs })
        .then(r => r.json())
        .then(rows => setToolPermissions(rows[0]?.tool_permissions || []))
        .catch(() => {})
    }
  }, [session])

  // Keep the online dots in Manage Staff roughly live while the master is viewing it.
  useEffect(() => {
    if (!session?.isMaster) return
    const t = setInterval(fetchAllStaff, STAFF_LIST_POLL_MS)
    return () => clearInterval(t)
  }, [session])

  async function fetchAllStaff() {
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/staff_accounts?select=id,name,pin,is_master,is_active,tool_permissions,last_seen_at&order=name.asc`,
        { headers: hdrs }
      )
      const rows = await r.json()
      setAllStaff(Array.isArray(rows) ? rows : [])
    } catch {}
  }

  function openEditStaff(staff) {
    setEditingStaff(staff)
    setDraftName(staff.name)
    setDraftPin(staff.pin || '')
    setDraftActive(staff.is_active !== false)
    setDraftTools(staff.tool_permissions || [])
    setEditError('')
  }

  function closeEditStaff() {
    setEditingStaff(null)
  }

  function toggleDraftTool(toolId) {
    setDraftTools(prev => (prev.includes(toolId) ? prev.filter(t => t !== toolId) : [...prev, toolId]))
  }

  function handleSaveEditStaff() {
    const trimmed = draftName.trim()
    if (!trimmed) { setEditError('Enter a name.'); return }
    if (allStaff.some(s => s.id !== editingStaff.id && s.name.toLowerCase() === trimmed.toLowerCase())) {
      setEditError('Another staff member already has that name.'); return
    }
    if (draftPin.length < 4) { setEditError('Staff code must be at least 4 digits.'); return }
    if (allStaff.some(s => s.id !== editingStaff.id && s.pin === draftPin)) {
      setEditError('Another staff member already has that code.'); return
    }
    if (!draftActive && editingStaff.is_master) {
      const otherActiveMasters = allStaff.filter(s => s.is_master && s.id !== editingStaff.id && s.is_active !== false)
      if (otherActiveMasters.length === 0) { setEditError("Can't pause the last active Master account."); return }
    }

    const payload = { name: trimmed, pin: draftPin, is_active: draftActive, tool_permissions: draftTools }

    setAllStaff(prev => prev.map(s => (s.id === editingStaff.id ? { ...s, ...payload } : s)))
    setStaffList(prev => [...prev.filter(n => n !== editingStaff.name), trimmed].sort())
    fetch(`${SUPABASE_URL}/rest/v1/staff_accounts?id=eq.${editingStaff.id}`, {
      method: 'PATCH',
      headers: { ...hdrs, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(payload),
    }).catch(() => {})
    setEditingStaff(null)
  }

  function handleRemoveEditingStaff() {
    if (!editingStaff) return
    if (editingStaff.is_master) {
      const otherMasters = allStaff.filter(s => s.is_master && s.id !== editingStaff.id)
      if (otherMasters.length === 0) { setEditError("Can't remove the last Master account."); return }
    }
    if (!window.confirm(`Remove ${editingStaff.name}? This cannot be undone.`)) return
    setAllStaff(prev => prev.filter(s => s.id !== editingStaff.id))
    setStaffList(prev => prev.filter(n => n !== editingStaff.name))
    fetch(`${SUPABASE_URL}/rest/v1/staff_accounts?id=eq.${editingStaff.id}`, {
      method: 'DELETE',
      headers: hdrs,
    }).catch(() => {})
    setEditingStaff(null)
  }

  async function handleAddStaff() {
    const name = newStaffName.trim()
    if (!name) { setAddStaffError('Enter a name.'); return }
    if (newStaffPin.length < 4) { setAddStaffError('Staff code must be at least 4 digits.'); return }
    if (allStaff.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      setAddStaffError('An account with that name already exists.'); return
    }
    if (allStaff.some(s => s.pin === newStaffPin)) {
      setAddStaffError('That staff code is already in use. Choose a different one.'); return
    }
    setAddStaffError('')
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/staff_accounts`, {
        method: 'POST',
        headers: { ...hdrs, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ name, pin: newStaffPin, is_master: false, is_active: true, tool_permissions: [] }),
      })
      const rows = await r.json()
      if (!r.ok || !Array.isArray(rows) || !rows.length) { setAddStaffError(rows?.message || 'Could not add staff member.'); return }
      setAllStaff(prev => [...prev, rows[0]].sort((a, b) => a.name.localeCompare(b.name)))
      setStaffList(prev => [...prev, name].sort())
      setNewStaffName('')
      setNewStaffPin('')
    } catch {
      setAddStaffError('Connection error. Try again.')
    }
  }

  async function fetchLog() {
    setLogLoading(true)
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/staff_activity_log?select=staff_name,tool_name,logged_at&order=logged_at.desc&limit=100`,
        { headers: hdrs }
      )
      const rows = await r.json()
      setActivityLog(Array.isArray(rows) ? rows : [])
    } catch {}
    setLogLoading(false)
  }

  async function handleLogin() {
    if (pin.length < 4) { setError('Enter your staff code.'); return }
    setLoggingIn(true)
    setError('')
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/staff_accounts?pin=eq.${pin}&select=id,name,is_master,is_active`,
        { headers: hdrs }
      )
      const rows = await r.json()
      if (!Array.isArray(rows)) { setError('Connection error. Try again.'); setLoggingIn(false); return }
      if (!rows.length) { setError('Code not recognized. Try again.'); setLoggingIn(false); return }
      if (rows[0].is_active === false) { setError('This account is paused. Contact Matthew.'); setLoggingIn(false); return }
      const s = { id: rows[0].id, name: rows[0].name, isMaster: rows[0].is_master, loginAt: Date.now() }
      saveSession(s)
      setSession(s)
    } catch {
      setError('Connection error. Try again.')
    }
    setLoggingIn(false)
  }

  function logToolAccess(label) {
    if (!session) return
    fetch(`${SUPABASE_URL}/rest/v1/staff_activity_log`, {
      method: 'POST',
      headers: { ...hdrs, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ staff_id: session.id, staff_name: session.name, tool_name: label }),
    }).catch(() => {})
  }

  function openTool(tool) {
    logToolAccess(tool.label)
    if (tool.tabId) {
      onSelect?.(tool.tabId)
    } else {
      window.open(base + tool.path, '_blank', 'noopener,noreferrer')
    }
  }

  function copyLoginLink() {
    navigator.clipboard.writeText(`${window.location.origin}${base}staff-portal.html`).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }).catch(() => {})
  }

  function signOut() {
    clearSession()
    setSession(null)
    setMode('choice')
    setPin('')
    setError('')
    setActivityLog([])
  }

  if (!session && mode === 'choice') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setMode('login')}
            className="bg-[#111] hover:bg-[#1a1a1a] border border-[#222] hover:border-orange-600/40 rounded-2xl p-8 flex flex-col items-center gap-2 text-center transition-all cursor-pointer"
          >
            <span className="text-3xl">🛠️</span>
            <span className="text-lg font-bold text-white">Staff Login</span>
            <span className="text-gray-500 text-sm">Staff &amp; tool access</span>
          </button>
          <button
            type="button"
            onClick={() => { window.location.href = base + 'players-portal.html' }}
            className="bg-[#111] hover:bg-[#1a1a1a] border border-[#222] hover:border-orange-600/40 rounded-2xl p-8 flex flex-col items-center gap-2 text-center transition-all cursor-pointer"
          >
            <span className="text-3xl">🎯</span>
            <span className="text-lg font-bold text-white">Players Dashboard</span>
            <span className="text-gray-500 text-sm">Sign in to your event schedule &amp; alerts</span>
          </button>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm bg-[#111] border border-[#222] rounded-2xl p-8 flex flex-col gap-5">
          <div className="text-center">
            <div className="text-3xl mb-2">🛠️</div>
            <h2 className="text-xl font-bold text-white tracking-wide">Staff Login</h2>
            <p className="text-gray-500 text-sm mt-1">AADS War Room</p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Staff Code</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Enter your staff code"
              autoFocus
              className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm text-center tracking-[0.5em] focus:outline-none focus:border-orange-500 placeholder:tracking-normal placeholder:text-gray-600"
            />
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="button"
            onClick={handleLogin}
            disabled={loggingIn}
            className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold rounded-lg py-2.5 text-sm transition-colors"
          >
            {loggingIn ? 'Verifying…' : 'Sign In'}
          </button>

          <button
            type="button"
            onClick={() => setMode('choice')}
            className="text-gray-500 hover:text-gray-300 text-xs text-center transition-colors"
          >
            ← Back
          </button>

          {staffList.length === 0 && (
            <p className="text-yellow-600 text-xs text-center">
              No staff accounts found. Run the Supabase setup SQL first.
            </p>
          )}
        </div>
      </div>
    )
  }

  const isMaster = session.isMaster
  const tools = isMaster ? ALL_TOOLS : ALL_TOOLS.filter(t => toolPermissions.includes(t.id))

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">

      {/* Header — distinct for master */}
      {isMaster ? (
        <div className="mb-8 rounded-2xl bg-linear-to-r from-orange-950/60 to-[#111] border border-orange-800/40 px-6 py-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-widest text-orange-400 bg-orange-950 border border-orange-800/60 px-2 py-0.5 rounded-full">Master Admin</span>
            </div>
            <h2 className="text-2xl font-bold text-white">{session.name}</h2>
            <p className="text-orange-400/70 text-xs mt-0.5">Full access · AADS War Room</p>
          </div>
          <button type="button" onClick={signOut} className="text-gray-400 hover:text-white border border-[#333] hover:border-[#555] rounded-lg px-4 py-2 text-sm transition-colors">
            Sign Out
          </button>
        </div>
      ) : (
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Staff Dashboard</h2>
            <p className="text-orange-500 text-sm font-medium mt-0.5">Signed in as {session.name}</p>
          </div>
          <button type="button" onClick={signOut} className="text-gray-400 hover:text-white border border-[#333] hover:border-[#555] rounded-lg px-4 py-2 text-sm transition-colors">
            Sign Out
          </button>
        </div>
      )}

      {/* Tool grid */}
      {tools.length === 0 ? (
        <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-2xl p-8 text-center mb-10">
          <p className="text-gray-500 text-sm">No tools assigned yet — ask Matthew to set up your access.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-10">
          {tools.map(tool => (
            <button
              key={tool.id}
              type="button"
              onClick={() => openTool(tool)}
              className="bg-[#111] hover:bg-[#1a1a1a] border border-[#222] hover:border-orange-600/40 rounded-xl p-5 flex flex-col items-center gap-3 text-center transition-all group cursor-pointer"
            >
              <span className="text-3xl group-hover:scale-110 transition-transform">{tool.icon}</span>
              <span className="text-xs font-semibold text-gray-300 group-hover:text-white leading-tight">{tool.label}</span>
            </button>
          ))}
          {isMaster && (
            <button
              type="button"
              onClick={() => setShowManageStaff(s => !s)}
              className={`bg-[#111] hover:bg-[#1a1a1a] border rounded-xl p-5 flex flex-col items-center gap-3 text-center transition-all group cursor-pointer ${showManageStaff ? 'border-orange-500' : 'border-[#222] hover:border-orange-600/40'}`}
            >
              <span className="text-3xl group-hover:scale-110 transition-transform">👥</span>
              <span className="text-xs font-semibold text-gray-300 group-hover:text-white leading-tight">Manage Staff</span>
            </button>
          )}
        </div>
      )}

      {/* Master-only admin panel */}
      {isMaster && (
        <div className="flex flex-col gap-6">

          {showManageStaff && (
            <>
              {/* Create staff account */}
              <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-2xl p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-white">Add Staff Member</p>
                  <p className="text-xs text-gray-500 mt-0.5">Send the registration link to a new staff member so they can create their own account and PIN.</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={copyLoginLink}
                    className="bg-[#1a1a1a] hover:bg-[#222] border border-[#333] text-white text-xs font-bold rounded-lg px-4 py-2.5 transition-colors whitespace-nowrap"
                  >
                    {linkCopied ? 'Copied!' : 'Copy Login Link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(base + 'staff-register.html', '_blank', 'noopener,noreferrer')}
                    className="bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-lg px-4 py-2.5 transition-colors whitespace-nowrap"
                  >
                    Open Registration Page
                  </button>
                </div>
              </div>

              {/* Manage staff */}
              <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Manage Staff</h3>
                <p className="text-xs text-gray-500 mb-4">Select a staff member to edit their name, PIN, status, and tool access.</p>

                <div className="flex items-end gap-2 mb-4 flex-wrap">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</label>
                    <input
                      type="text"
                      value={newStaffName}
                      onChange={e => { setNewStaffName(e.target.value); setAddStaffError('') }}
                      placeholder="New staff name"
                      className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-sm w-40 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Staff Code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={newStaffPin}
                      onChange={e => { setNewStaffPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setAddStaffError('') }}
                      placeholder="4-6 digits"
                      className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-sm w-28 text-center tracking-widest focus:outline-none focus:border-orange-500 placeholder:tracking-normal placeholder:text-gray-600"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddStaff}
                    className="bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-lg px-4 py-2.5 transition-colors whitespace-nowrap"
                  >
                    + Add Staff
                  </button>
                </div>
                {addStaffError && <p className="text-red-400 text-xs mb-4">{addStaffError}</p>}

                {allStaff.length === 0 ? (
                  <p className="text-gray-600 text-sm text-center py-6">No staff accounts found.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {allStaff.map(staff => (
                      <button
                        key={staff.id}
                        type="button"
                        onClick={() => openEditStaff(staff)}
                        className={`flex items-center justify-between gap-3 border border-[#1e1e1e] hover:border-orange-600/40 bg-[#0a0a0a] hover:bg-[#141414] rounded-xl px-4 py-3 text-left transition-colors ${staff.is_active === false ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          {isOnline(staff) && (
                            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="Online now" />
                          )}
                          <span className="text-sm font-semibold text-white">{staff.name}</span>
                          {staff.is_master && (
                            <span className="text-xs font-bold uppercase tracking-widest text-orange-400 bg-orange-950 border border-orange-800/60 px-2 py-0.5 rounded-full">
                              Master
                            </span>
                          )}
                          {staff.is_active === false && (
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-400 bg-[#1a1a1a] border border-[#333] px-2 py-0.5 rounded-full">
                              Paused
                            </span>
                          )}
                          {!staff.is_master && (
                            <span className="text-xs text-gray-500">
                              {(staff.tool_permissions || []).length} tool{(staff.tool_permissions || []).length === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                        <span className="text-gray-500 text-sm">&rsaquo;</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Activity log */}
          <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setLogOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#111] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className={`text-gray-500 text-xs transition-transform ${logOpen ? 'rotate-90' : ''}`}>&rsaquo;</span>
                <span className="text-xs font-bold text-white uppercase tracking-wider">Staff Activity Log</span>
                {activityLog.length > 0 && (
                  <span className="text-[10px] font-semibold text-gray-500 bg-[#1a1a1a] border border-[#2a2a2a] px-1.5 py-0.5 rounded-full">
                    {activityLog.length}
                  </span>
                )}
              </div>
              <span
                onClick={e => { e.stopPropagation(); fetchLog() }}
                className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
              >
                Refresh
              </span>
            </button>

            {logOpen && (
              <div className="border-t border-[#1e1e1e]">
                {logLoading ? (
                  <p className="text-gray-500 text-xs text-center py-6">Loading…</p>
                ) : activityLog.length === 0 ? (
                  <p className="text-gray-600 text-xs text-center py-6">No activity recorded yet.</p>
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    {activityLog.map((row, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 px-4 py-2 border-b border-[#141414] last:border-b-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-semibold text-white truncate">{row.staff_name}</span>
                          <span className="text-xs text-gray-500 truncate">{row.tool_name}</span>
                        </div>
                        <span className="text-[10px] text-gray-600 shrink-0">{formatRelativeTime(row.logged_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      )}

      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-bold text-lg">Edit Staff</h3>
              <button type="button" onClick={closeEditStaff} className="text-gray-500 hover:text-gray-300 text-sm">✕</button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</label>
                <input
                  type="text"
                  value={draftName}
                  onChange={e => setDraftName(e.target.value)}
                  className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Staff Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={draftPin}
                  onChange={e => setDraftPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm tracking-widest focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Account Status</span>
                <button
                  type="button"
                  onClick={() => setDraftActive(a => !a)}
                  className={
                    draftActive
                      ? 'text-xs font-bold uppercase tracking-wider bg-green-950 border border-green-800/60 text-green-400 px-3 py-1.5 rounded-full'
                      : 'text-xs font-bold uppercase tracking-wider bg-[#1a1a1a] border border-[#333] text-gray-400 px-3 py-1.5 rounded-full'
                  }
                >
                  {draftActive ? 'Active' : 'Paused'}
                </button>
              </div>

              {editingStaff.is_master ? (
                <p className="text-xs text-orange-400/70">Master accounts always have access to every tool.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tools</span>
                  <div className="flex flex-wrap gap-2">
                    {ALL_TOOLS.map(tool => {
                      const granted = draftTools.includes(tool.id)
                      return (
                        <button
                          key={tool.id}
                          type="button"
                          onClick={() => toggleDraftTool(tool.id)}
                          className={
                            granted
                              ? 'flex items-center gap-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors'
                              : 'flex items-center gap-1.5 bg-[#1a1a1a] hover:bg-[#222] text-gray-400 hover:text-gray-200 border border-[#333] text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors'
                          }
                        >
                          <span>{tool.icon}</span>
                          <span>{tool.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {editError && <p className="text-red-400 text-xs">{editError}</p>}

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleRemoveEditingStaff}
                  className="text-xs font-semibold border border-red-900/60 hover:border-red-600 rounded-lg px-3 py-2 text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove Account
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeEditStaff}
                    className="text-xs font-semibold border border-[#333] hover:border-[#555] rounded-lg px-4 py-2 text-gray-300 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditStaff}
                    className="bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-lg px-4 py-2 transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
