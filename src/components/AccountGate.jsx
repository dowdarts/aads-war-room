import { useState } from 'react'
import { getBaseUrl } from '../utils/baseUrl.js'

const SUPABASE_URL = 'https://gygwhznblajojwveikhg.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5Z3doem5ibGFqb2p3dmVpa2hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjU5NzgsImV4cCI6MjA4ODk0MTk3OH0.BI9KlRsCxAvNnFHCGq6hjXfdsaNgo7afY4Xa5uxwjak'
const hdrs = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }

const PLAYER_SESSION_KEY = 'aads_player_session'
const SCOREKEEPER_SESSION_KEY = 'aads_scorekeeper_session'

function saveLocalSession(key, session) {
  localStorage.setItem(key, JSON.stringify(session))
}

export default function AccountGate({ onStaffSession }) {
  const [mode, setMode] = useState('choice')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [results, setResults] = useState(null) // { staffSession: {...}|null, player: bool, scorekeeper: bool, notes: {role: msg} }
  const base = getBaseUrl()

  function resetForm() {
    setFirstName('')
    setLastName('')
    setPin('')
    setPinConfirm('')
    setFormError('')
  }

  function fullName() {
    return `${firstName.trim()} ${lastName.trim()}`.trim()
  }

  // One account now works everywhere — a row in any one of the three
  // tables (staff_accounts / player_portal_accounts /
  // scorekeeper_portal_accounts) gets a matching row auto-created in the
  // other two by a DB trigger (same name+pin), so this just needs to look
  // up whichever of the three exist and build a session for each.
  async function resolveSessions(name, pinValue) {
    const [staffRows, playerRows, scorekeeperRows] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/staff_accounts?name=ilike.${encodeURIComponent(name)}&pin=eq.${pinValue}&select=id,name,is_master,is_active`, { headers: hdrs }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/player_portal_accounts?display_name=ilike.${encodeURIComponent(name)}&pin=eq.${pinValue}&select=id,notify_all`, { headers: hdrs }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/scorekeeper_portal_accounts?display_name=ilike.${encodeURIComponent(name)}&pin=eq.${pinValue}&select=id,notify_all`, { headers: hdrs }).then(r => r.json()),
    ])

    const notes = {}
    let staffSession = null
    let playerOk = false
    let scorekeeperOk = false

    if (Array.isArray(staffRows) && staffRows.length) {
      const row = staffRows[0]
      if (row.is_active === false) {
        notes.staff = 'This staff account is paused. Contact Matthew.'
      } else {
        staffSession = { id: row.id, name: row.name, isMaster: row.is_master, loginAt: Date.now() }
      }
    }
    if (Array.isArray(playerRows) && playerRows.length) {
      const row = playerRows[0]
      saveLocalSession(PLAYER_SESSION_KEY, { id: row.id, displayName: name, notifyAll: !!row.notify_all, loginAt: Date.now() })
      playerOk = true
    }
    if (Array.isArray(scorekeeperRows) && scorekeeperRows.length) {
      const row = scorekeeperRows[0]
      saveLocalSession(SCOREKEEPER_SESSION_KEY, { id: row.id, displayName: name, notifyAll: !!row.notify_all, loginAt: Date.now() })
      scorekeeperOk = true
    }

    return { staffSession, player: playerOk, scorekeeper: scorekeeperOk, notes }
  }

  async function handleSignIn() {
    const name = fullName()
    if (!firstName.trim() || !lastName.trim()) { setFormError('Enter your first and last name.'); return }
    if (!/^\d{4}$/.test(pin)) { setFormError('Code must be exactly 4 digits.'); return }
    setBusy(true)
    setFormError('')
    try {
      const resolved = await resolveSessions(name, pin)
      if (!resolved.staffSession && !resolved.player && !resolved.scorekeeper && !resolved.notes.staff) {
        setFormError('No account found with that name and code.')
        setBusy(false)
        return
      }
      setResults(resolved)
      setMode('result')
    } catch {
      setFormError('Connection error. Try again.')
    }
    setBusy(false)
  }

  async function handleCreate() {
    const name = fullName()
    if (!firstName.trim() || !lastName.trim()) { setFormError('Enter your first and last name.'); return }
    if (!/^\d{4}$/.test(pin)) { setFormError('Code must be exactly 4 digits.'); return }
    if (pin !== pinConfirm) { setFormError('Codes do not match.'); return }
    setBusy(true)
    setFormError('')
    try {
      const dupRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_accounts?name=ilike.${encodeURIComponent(name)}&select=id`, { headers: hdrs })
      const dupRows = await dupRes.json()
      if (Array.isArray(dupRows) && dupRows.length) {
        setFormError('An account with that name already exists. Sign in instead.')
        setBusy(false)
        return
      }
      const res = await fetch(`${SUPABASE_URL}/rest/v1/staff_accounts`, {
        method: 'POST',
        headers: { ...hdrs, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ name, pin, is_master: false, is_active: true, tool_permissions: [] }),
      })
      if (!res.ok) {
        setFormError('Could not create account. Try again.')
        setBusy(false)
        return
      }
      // The DB trigger has already created matching player/scorekeeper rows
      // by the time this POST resolves — same lookup as sign-in finds all three.
      const resolved = await resolveSessions(name, pin)
      setResults(resolved)
      setMode('result')
    } catch {
      setFormError('Connection error. Try again.')
    }
    setBusy(false)
  }

  if (mode === 'choice') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md flex flex-col gap-4">
          <div className="text-center mb-2">
            <h2 className="text-xl font-bold text-white tracking-wide">AADS Sign-In</h2>
            <p className="text-gray-500 text-sm mt-1">Staff, Players &amp; Score Keepers</p>
          </div>
          <button
            type="button"
            onClick={() => { resetForm(); setMode('signin') }}
            className="bg-[#111] hover:bg-[#1a1a1a] border border-[#222] hover:border-orange-600/40 rounded-2xl p-8 flex flex-col items-center gap-2 text-center transition-all cursor-pointer"
          >
            <span className="text-3xl">🔑</span>
            <span className="text-lg font-bold text-white">Sign In</span>
            <span className="text-gray-500 text-sm">Already have an account</span>
          </button>
          <button
            type="button"
            onClick={() => { resetForm(); setMode('create') }}
            className="bg-[#111] hover:bg-[#1a1a1a] border border-[#222] hover:border-orange-600/40 rounded-2xl p-8 flex flex-col items-center gap-2 text-center transition-all cursor-pointer"
          >
            <span className="text-3xl">✨</span>
            <span className="text-lg font-bold text-white">Create Account</span>
            <span className="text-gray-500 text-sm">One account works everywhere</span>
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'signin' || mode === 'create') {
    const isCreate = mode === 'create'
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm bg-[#111] border border-[#222] rounded-2xl p-8 flex flex-col gap-5">
          <div className="text-center">
            <div className="text-3xl mb-2">{isCreate ? '✨' : '🔑'}</div>
            <h2 className="text-xl font-bold text-white tracking-wide">{isCreate ? 'Create Account' : 'Sign In'}</h2>
            <p className="text-gray-500 text-sm mt-1">
              {isCreate ? 'One account — works as Staff, Player & Score Keeper.' : 'AADS War Room'}
            </p>
          </div>

          <div className="flex gap-2">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={e => { setFirstName(e.target.value); setFormError('') }}
                autoFocus
                className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={e => { setLastName(e.target.value); setFormError('') }}
                className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{isCreate ? 'Choose a 4-Digit Code' : 'Your 4-Digit Code'}</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setFormError('') }}
              onKeyDown={e => e.key === 'Enter' && !isCreate && handleSignIn()}
              placeholder="0000"
              className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm text-center tracking-[0.5em] focus:outline-none focus:border-orange-500 placeholder:tracking-normal placeholder:text-gray-600"
            />
          </div>

          {isCreate && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Confirm Code</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pinConfirm}
                onChange={e => { setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4)); setFormError('') }}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="0000"
                className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm text-center tracking-[0.5em] focus:outline-none focus:border-orange-500 placeholder:tracking-normal placeholder:text-gray-600"
              />
            </div>
          )}

          {formError && <p className="text-red-400 text-sm text-center">{formError}</p>}

          <button
            type="button"
            onClick={isCreate ? handleCreate : handleSignIn}
            disabled={busy}
            className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold rounded-lg py-2.5 text-sm transition-colors"
          >
            {busy ? 'Working…' : (isCreate ? 'Create Account' : 'Sign In')}
          </button>

          <button
            type="button"
            onClick={() => setMode('choice')}
            className="text-gray-500 hover:text-gray-300 text-xs text-center transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>
    )
  }

  // mode === 'result'
  const { staffSession, player, scorekeeper, notes } = results

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md flex flex-col gap-4">
        <div className="text-center mb-2">
          <h2 className="text-xl font-bold text-white tracking-wide">Continue as…</h2>
        </div>

        {staffSession && (
          <button
            type="button"
            onClick={() => onStaffSession(staffSession)}
            className="bg-[#111] hover:bg-[#1a1a1a] border border-[#222] hover:border-orange-600/40 rounded-2xl p-8 flex flex-col items-center gap-2 text-center transition-all cursor-pointer"
          >
            <span className="text-3xl">🛠️</span>
            <span className="text-lg font-bold text-white">Staff</span>
            <span className="text-gray-500 text-sm">Signed in as {staffSession.name}</span>
          </button>
        )}
        {player && (
          <button
            type="button"
            onClick={() => { window.location.href = base + 'players-portal.html' }}
            className="bg-[#111] hover:bg-[#1a1a1a] border border-[#222] hover:border-orange-600/40 rounded-2xl p-8 flex flex-col items-center gap-2 text-center transition-all cursor-pointer"
          >
            <span className="text-3xl">🎯</span>
            <span className="text-lg font-bold text-white">Players Dashboard</span>
            <span className="text-gray-500 text-sm">Your event schedule &amp; alerts</span>
          </button>
        )}
        {scorekeeper && (
          <button
            type="button"
            onClick={() => { window.location.href = base + 'score-keepers-portal.html' }}
            className="bg-[#111] hover:bg-[#1a1a1a] border border-[#222] hover:border-orange-600/40 rounded-2xl p-8 flex flex-col items-center gap-2 text-center transition-all cursor-pointer"
          >
            <span className="text-3xl">🗒️</span>
            <span className="text-lg font-bold text-white">Score Keepers Portal</span>
            <span className="text-gray-500 text-sm">Your shift schedule &amp; alerts</span>
          </button>
        )}

        {Object.entries(notes).length > 0 && (
          <div className="text-center text-xs text-gray-500 flex flex-col gap-1">
            {Object.entries(notes).map(([role, msg]) => <p key={role}>{msg}</p>)}
          </div>
        )}

        <button
          type="button"
          onClick={() => { resetForm(); setResults(null); setMode('choice') }}
          className="text-gray-500 hover:text-gray-300 text-xs text-center transition-colors"
        >
          ← Back to start
        </button>
      </div>
    </div>
  )
}
