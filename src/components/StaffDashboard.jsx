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
]

const hdrs = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
}
function saveSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)) }
function clearSession() { localStorage.removeItem(SESSION_KEY) }

export default function StaffDashboard({ onSelect }) {
  const [session, setSession] = useState(() => loadSession())
  const [staffList, setStaffList] = useState([])
  const [selectedName, setSelectedName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [activityLog, setActivityLog] = useState([])
  const [logLoading, setLogLoading] = useState(false)
  const [toolPermissions, setToolPermissions] = useState([])
  const [allStaff, setAllStaff] = useState([])
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffPin, setNewStaffPin] = useState('')
  const [addStaffError, setAddStaffError] = useState('')
  const base = getBaseUrl()

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/staff_accounts?select=name&is_active=eq.true&order=name.asc`, { headers: hdrs })
      .then(r => r.json())
      .then(rows => setStaffList(rows.map(r => r.name)))
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

  async function fetchAllStaff() {
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/staff_accounts?select=id,name,is_master,is_active,tool_permissions&order=name.asc`,
        { headers: hdrs }
      )
      setAllStaff(await r.json())
    } catch {}
  }

  function toggleStaffTool(staffId, toolId) {
    const staff = allStaff.find(s => s.id === staffId)
    if (!staff) return
    const current = staff.tool_permissions || []
    const next = current.includes(toolId) ? current.filter(t => t !== toolId) : [...current, toolId]
    setAllStaff(prev => prev.map(s => (s.id === staffId ? { ...s, tool_permissions: next } : s)))
    fetch(`${SUPABASE_URL}/rest/v1/staff_accounts?id=eq.${staffId}`, {
      method: 'PATCH',
      headers: { ...hdrs, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ tool_permissions: next }),
    }).catch(() => {})
  }

  async function handleAddStaff() {
    const name = newStaffName.trim()
    if (!name) { setAddStaffError('Enter a name.'); return }
    if (newStaffPin.length < 4) { setAddStaffError('PIN must be at least 4 digits.'); return }
    if (allStaff.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      setAddStaffError('An account with that name already exists.'); return
    }
    setAddStaffError('')
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/staff_accounts`, {
        method: 'POST',
        headers: { ...hdrs, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ name, pin: newStaffPin, is_master: false, is_active: true, tool_permissions: [] }),
      })
      const rows = await r.json()
      if (!r.ok) { setAddStaffError(rows?.message || 'Could not add staff member.'); return }
      setAllStaff(prev => [...prev, rows[0]].sort((a, b) => a.name.localeCompare(b.name)))
      setStaffList(prev => [...prev, name].sort())
      setNewStaffName('')
      setNewStaffPin('')
    } catch {
      setAddStaffError('Connection error. Try again.')
    }
  }

  function handleRenameStaff(staffId, newName) {
    const trimmed = newName.trim()
    const staff = allStaff.find(s => s.id === staffId)
    if (!staff || !trimmed || trimmed === staff.name) return
    if (allStaff.some(s => s.id !== staffId && s.name.toLowerCase() === trimmed.toLowerCase())) {
      alert('Another staff member already has that name.')
      return
    }
    setAllStaff(prev => prev.map(s => (s.id === staffId ? { ...s, name: trimmed } : s)))
    fetch(`${SUPABASE_URL}/rest/v1/staff_accounts?id=eq.${staffId}`, {
      method: 'PATCH',
      headers: { ...hdrs, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ name: trimmed }),
    }).catch(() => {})
  }

  function handleResetPin(staffId, newPin) {
    if (!newPin) return
    if (newPin.length < 4) { alert('PIN must be at least 4 digits.'); return }
    fetch(`${SUPABASE_URL}/rest/v1/staff_accounts?id=eq.${staffId}`, {
      method: 'PATCH',
      headers: { ...hdrs, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ pin: newPin }),
    }).catch(() => {})
  }

  function handleTogglePause(staff) {
    const nextActive = staff.is_active === false
    if (!nextActive && staff.is_master) {
      const otherActiveMasters = allStaff.filter(s => s.is_master && s.id !== staff.id && s.is_active !== false)
      if (otherActiveMasters.length === 0) { alert("Can't pause the last active Master account."); return }
    }
    setAllStaff(prev => prev.map(s => (s.id === staff.id ? { ...s, is_active: nextActive } : s)))
    fetch(`${SUPABASE_URL}/rest/v1/staff_accounts?id=eq.${staff.id}`, {
      method: 'PATCH',
      headers: { ...hdrs, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ is_active: nextActive }),
    }).catch(() => {})
  }

  function handleRemoveStaff(staff) {
    if (staff.is_master) {
      const otherMasters = allStaff.filter(s => s.is_master && s.id !== staff.id)
      if (otherMasters.length === 0) { alert("Can't remove the last Master account."); return }
    }
    if (!window.confirm(`Remove ${staff.name}? This cannot be undone.`)) return
    setAllStaff(prev => prev.filter(s => s.id !== staff.id))
    setStaffList(prev => prev.filter(n => n !== staff.name))
    fetch(`${SUPABASE_URL}/rest/v1/staff_accounts?id=eq.${staff.id}`, {
      method: 'DELETE',
      headers: hdrs,
    }).catch(() => {})
  }

  async function fetchLog() {
    setLogLoading(true)
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/staff_activity_log?select=staff_name,tool_name,logged_at&order=logged_at.desc&limit=100`,
        { headers: hdrs }
      )
      setActivityLog(await r.json())
    } catch {}
    setLogLoading(false)
  }

  async function handleLogin() {
    if (!selectedName) { setError('Select your name.'); return }
    if (pin.length < 4) { setError('PIN must be at least 4 digits.'); return }
    setLoggingIn(true)
    setError('')
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/staff_accounts?name=eq.${encodeURIComponent(selectedName)}&pin=eq.${pin}&select=id,name,is_master,is_active`,
        { headers: hdrs }
      )
      const rows = await r.json()
      if (!rows.length) { setError('Incorrect PIN. Try again.'); setLoggingIn(false); return }
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

  function signOut() {
    clearSession()
    setSession(null)
    setPin('')
    setError('')
    setActivityLog([])
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
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</label>
            <select
              value={selectedName}
              onChange={e => { setSelectedName(e.target.value); setError('') }}
              className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500"
            >
              <option value="">— Select your name —</option>
              {staffList.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">4-Digit PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="••••"
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
        </div>
      )}

      {/* Master-only admin panel */}
      {isMaster && (
        <div className="flex flex-col gap-6">

          {/* Create staff account */}
          <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-white">Add Staff Member</p>
              <p className="text-xs text-gray-500 mt-0.5">Send the registration link to a new staff member so they can create their own account and PIN.</p>
            </div>
            <button
              type="button"
              onClick={() => window.open(base + 'staff-register.html', '_blank', 'noopener,noreferrer')}
              className="shrink-0 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-lg px-4 py-2.5 transition-colors whitespace-nowrap"
            >
              Open Registration Page
            </button>
          </div>

          {/* Manage staff */}
          <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Manage Staff</h3>
            <p className="text-xs text-gray-500 mb-4">Rename accounts, reset PINs, pause or remove staff, and choose which tools each one sees.</p>

            <div className="flex items-end gap-2 mb-2 flex-wrap">
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
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">PIN</label>
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
              <div className="flex flex-col gap-4 mt-4">
                {allStaff.map(staff => (
                  <div key={staff.id} className={`border border-[#1e1e1e] rounded-xl p-4 ${staff.is_active === false ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="text"
                          defaultValue={staff.name}
                          onBlur={e => handleRenameStaff(staff.id, e.target.value)}
                          className="bg-[#1a1a1a] border border-[#333] rounded-lg px-2.5 py-1.5 text-white text-sm font-semibold w-40 focus:outline-none focus:border-orange-500"
                        />
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
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="text"
                          inputMode="numeric"
                          defaultValue=""
                          placeholder="Reset PIN"
                          onBlur={e => { handleResetPin(staff.id, e.target.value); e.target.value = '' }}
                          className="bg-[#1a1a1a] border border-[#333] rounded-lg px-2.5 py-1.5 text-white text-xs w-24 text-center tracking-widest focus:outline-none focus:border-orange-500 placeholder:tracking-normal placeholder:text-gray-600"
                        />
                        <button
                          type="button"
                          onClick={() => handleTogglePause(staff)}
                          className="text-xs font-semibold border border-[#333] hover:border-orange-600/40 rounded-lg px-3 py-1.5 text-gray-300 hover:text-white transition-colors"
                        >
                          {staff.is_active === false ? 'Resume' : 'Pause'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveStaff(staff)}
                          className="text-xs font-semibold border border-red-900/60 hover:border-red-600 rounded-lg px-3 py-1.5 text-red-400 hover:text-red-300 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    {!staff.is_master && (
                      <div className="flex flex-wrap gap-2">
                        {ALL_TOOLS.map(tool => {
                          const granted = (staff.tool_permissions || []).includes(tool.id)
                          return (
                            <button
                              key={tool.id}
                              type="button"
                              onClick={() => toggleStaffTool(staff.id, tool.id)}
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
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity log */}
          <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e1e]">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Staff Activity Log</h3>
              <button type="button" onClick={fetchLog} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                Refresh
              </button>
            </div>
            {logLoading ? (
              <p className="text-gray-500 text-sm text-center py-8">Loading…</p>
            ) : activityLog.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-8">No activity recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e1e1e]">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Staff</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tool</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityLog.map((row, i) => (
                      <tr key={i} className="border-b border-[#111] hover:bg-[#111]">
                        <td className="px-5 py-3 text-white font-medium">{row.staff_name}</td>
                        <td className="px-5 py-3 text-gray-400">{row.tool_name}</td>
                        <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(row.logged_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
