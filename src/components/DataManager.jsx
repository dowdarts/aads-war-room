import { useEffect, useMemo, useRef, useState } from 'react'
import { useStats } from '../context/StatsContext.jsx'
import { parsePlayerCSV } from '../utils/csvParser.js'
import { getBaseUrl } from '../utils/baseUrl.js'
import {
  approveDonation,
  fetchDonations,
  fetchPaymentAccessControl,
  fetchPaymentDonations,
  fetchPaymentScanCount,
  getSupabaseClient,
  initSupabaseClient,
  insertDonation,
  rejectDonation,
  setPaymentDonationExcluded,
  updatePaymentAccessControl,
} from '../utils/supabaseClient.js'

export default function DataManager() {
  const {
    dispatch,
    events,
    hasRuntimeEvents,
    hasRuntimePlayers,
    players,
  } = useStats()
  const [paymentControl, setPaymentControl] = useState(null)
  const [controlLoading, setControlLoading] = useState(true)
  const [controlError, setControlError] = useState('')
  const [controlSaving, setControlSaving] = useState(false)
  const [controlMessage, setControlMessage] = useState('')
  const [scanCount, setScanCount] = useState(null)
  const [provinceOverrideText, setProvinceOverrideText] = useState('')
  const [provinceOverrideMessage, setProvinceOverrideMessage] = useState('')
  const [donations, setDonations] = useState([])
  const [donationsLoading, setDonationsLoading] = useState(false)
  const [donationsError, setDonationsError] = useState('')
  const [donationForm, setDonationForm] = useState({ donorName: '', amount: '', message: '', transferRef: '' })
  const [addingDonation, setAddingDonation] = useState(false)
  const [addDonationMsg, setAddDonationMsg] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [paymentDonations, setPaymentDonations] = useState([])
  const [paymentDonationsLoading, setPaymentDonationsLoading] = useState(false)
  const [paymentDonationsError, setPaymentDonationsError] = useState('')
  const [showPaymentDonations, setShowPaymentDonations] = useState(false)
  const [confirmIncludeId, setConfirmIncludeId] = useState(null)

  // ── Player profile editor ───────────────────────────────────────────────
  const [editSearch, setEditSearch]     = useState('')
  const [editPlayer, setEditPlayer]     = useState(null)
  const [editForm, setEditForm]         = useState({})
  const [editSaved, setEditSaved]       = useState(false)
  const [editExpanded, setEditExpanded] = useState(false)
  const saveTimerRef = useRef(null)

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [players]
  )
  const filteredPlayers = useMemo(() => {
    const s = editSearch.trim().toLowerCase()
    return s ? sortedPlayers.filter(p => p.displayName.toLowerCase().includes(s)) : sortedPlayers
  }, [sortedPlayers, editSearch])

  function selectEditPlayer(player) {
    setEditPlayer(player)
    setEditForm({
      nickname:         player.nickname         || '',
      province:         player.province         || 'NB',
      hometown:         player.hometown         || '',
      age:              player.age              || '',
      yearsPlaying:     player.yearsPlaying     || '',
      dartSetup:        player.dartSetup        || '',
      dartConnectEmail: player.dartConnectEmail || '',
      hobbies:          player.hobbies          || '',
      achievements:     player.achievements     || '',
      preMatchRituals:  player.preMatchRituals  || '',
      aadsMeaning:      player.aadsMeaning      || '',
    })
    setEditSaved(false)
  }

  function saveEditPlayer() {
    if (!editPlayer) return
    dispatch({ type: 'UPDATE_PLAYER', payload: { displayName: editPlayer.displayName, updates: editForm } })
    setEditSaved(true)
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => setEditSaved(false), 3000)
  }

  function ef(field) {
    return (e) => setEditForm(f => ({ ...f, [field]: e.target.value }))
  }
  const paymentUrl = useMemo(() => {
    const origin = window.location.origin
    return `${origin}${getBaseUrl()}payment.html`
  }, [])

  useEffect(() => {
    let alive = true

    async function loadPaymentControl() {
      setControlLoading(true)
      setControlError('')

      let client = getSupabaseClient()
      if (!client) client = await initSupabaseClient()
      if (!client) {
        if (!alive) return
        setControlError('Supabase not connected. Payment control is unavailable.')
        setControlLoading(false)
        return
      }

      const [{ data, error }, { count }] = await Promise.all([
        fetchPaymentAccessControl(),
        fetchPaymentScanCount(),
      ])
      if (!alive) return

      if (error) {
        setControlError('Could not read payment control row. Ensure table payment_access exists with id=1.')
      }
      if (count !== null) setScanCount(count)

      setPaymentControl({
        enabled: data?.enabled !== false,
        requireKey: data?.require_key !== false,
        accessKey: (data?.access_key || '').trim(),
        expiresAt: data?.expires_at || null,
        eventStart: data?.event_start || null,
        goalEnabled: data?.goal_enabled || false,
        goalLabel: data?.goal_label || '',
        goalAmount: data?.goal_amount ?? 500,
        donationMode: data?.donation_mode || 'auto',
      })
      setControlLoading(false)
    }

    loadPaymentControl()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    async function load() {
      if (!alive) return
      setDonationsLoading(true)
      const { data, error } = await fetchDonations()
      if (!alive) return
      if (error) setDonationsError('Could not load donations. Ensure the donations table exists.')
      else setDonationsError('')
      setDonations(data)
      setDonationsLoading(false)
    }
    load()
    const timer = setInterval(load, 15000)
    return () => { alive = false; clearInterval(timer) }
  }, [])

  async function refreshDonations() {
    setDonationsLoading(true)
    const { data, error } = await fetchDonations()
    if (error) setDonationsError('Could not load donations.')
    else { setDonationsError(''); setDonations(data) }
    setDonationsLoading(false)
  }

  async function handleAddDonation() {
    const amount = parseFloat(donationForm.amount)
    if (!amount || amount <= 0) { setAddDonationMsg('Enter a valid amount.'); return }
    if (!paymentControl) return
    setAddingDonation(true)
    setAddDonationMsg('')
    const status = paymentControl.donationMode === 'auto' ? 'approved' : 'pending'
    const { error } = await insertDonation({ ...donationForm, amount, status })
    if (error) {
      setAddDonationMsg(`Failed: ${error.message || error}`)
    } else {
      setDonationForm({ donorName: '', amount: '', message: '', transferRef: '' })
      setAddDonationMsg(status === 'approved' ? 'Donation recorded and approved.' : 'Donation added to queue.')
      setShowAddForm(false)
      await refreshDonations()
    }
    setAddingDonation(false)
  }

  async function handleApproveDonation(id) {
    const { error } = await approveDonation(id)
    if (!error) setDonations(prev => prev.map(d => d.id === id ? { ...d, status: 'approved', approved_at: new Date().toISOString() } : d))
  }

  async function handleRejectDonation(id) {
    const { error } = await rejectDonation(id)
    if (!error) setDonations(prev => prev.map(d => d.id === id ? { ...d, status: 'rejected' } : d))
  }

  const EXCLUDED_KEY = 'aads_excluded_payment_donations'

  function getLocalExcluded() {
    try { return new Set(JSON.parse(localStorage.getItem(EXCLUDED_KEY) || '[]')) } catch { return new Set() }
  }

  function saveLocalExcluded(set) {
    localStorage.setItem(EXCLUDED_KEY, JSON.stringify([...set]))
  }

  async function loadPaymentDonations() {
    setPaymentDonationsLoading(true)
    setPaymentDonationsError('')
    const eventStart = paymentControl?.eventStart || null
    const { data, error } = await fetchPaymentDonations(eventStart)
    setPaymentDonationsLoading(false)
    if (error) { setPaymentDonationsError('Could not load payment donations. Ensure the excluded column exists — see info box below.'); return }
    // Merge DB excluded flag with local override so refreshes never un-exclude a row
    const localExcluded = getLocalExcluded()
    setPaymentDonations(data.map(d => ({ ...d, excluded: d.excluded || localExcluded.has(d.id) })))
  }

  async function handleToggleExclude(id, currentExcluded) {
    if (currentExcluded) {
      setConfirmIncludeId(id)
      return
    }
    // Add to local set immediately so it survives future refreshes
    const set = getLocalExcluded()
    set.add(id)
    saveLocalExcluded(set)
    setPaymentDonations(prev => prev.map(d => d.id === id ? { ...d, excluded: true } : d))
    // Best-effort DB update
    await setPaymentDonationExcluded(id, true)
  }

  async function handleConfirmInclude(id) {
    // Remove from local set
    const set = getLocalExcluded()
    set.delete(id)
    saveLocalExcluded(set)
    setPaymentDonations(prev => prev.map(d => d.id === id ? { ...d, excluded: false } : d))
    setConfirmIncludeId(null)
    // Best-effort DB update
    await setPaymentDonationExcluded(id, false)
  }

  function handleEventUpload(e) {
    const files = Array.from(e.target.files)
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result)
          if (!data.metadata || !data.player_event_stats) {
            alert(`${file.name}: Invalid event JSON — missing metadata or player_event_stats.`)
            return
          }
          dispatch({ type: 'ADD_RUNTIME_EVENT', payload: data })
        } catch {
          alert(`${file.name}: Could not parse JSON.`)
        }
      }
      reader.readAsText(file)
    })
    e.target.value = ''
  }

  function handlePlayersUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const parsed = parsePlayerCSV(ev.target.result)
      if (!parsed.length) {
        alert('No players found in the uploaded CSV.')
        return
      }
      dispatch({ type: 'SET_RUNTIME_PLAYERS', payload: parsed })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleExportPlayersCSV() {
    const headers = [
      'fullName', 'nickname', 'hometown', 'age', 'yearsPlaying', 'province', 'profileImage',
      'hobbies', 'dartSetup', 'practiceRoutine', 'strengths', 'improvements', 'checkouts',
      'currentForm', 'recentResults', 'achievements', 'pressureManagement', 'mentalApproach',
      'stagePresence', 'preMatchRituals', 'aadsMeaning', 'dartConnectEmail'
    ]
    
    const rows = [headers]
    players.forEach(player => {
      const row = headers.map(header => {
        let value = player[header] || ''
        // Escape quotes and wrap in quotes if value contains comma, quote, or newline
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = '"' + value.replace(/"/g, '""') + '"'
        }
        return value
      })
      rows.push(row)
    })
    
    const csvContent = rows.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `aads-players-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function normalizeProvince(code) {
    if (!code) return null
    const normalized = `${code}`.trim().toUpperCase()
    if (['NB', 'NS', 'PE', 'NL', 'ON'].includes(normalized)) return normalized
    return null
  }

  function applyProvinceOverrides() {
    const lines = provinceOverrideText.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) {
      setProvinceOverrideMessage('Enter one mapping per line: Name, Province code.')
      return
    }
    const overrides = {}
    for (const [idx, line] of lines.entries()) {
      const parts = line.split(',')
      if (parts.length < 2) {
        setProvinceOverrideMessage(`Invalid format on line ${idx + 1}. Use Name, Province.`)
        return
      }
      const name = parts[0].trim()
      const province = normalizeProvince(parts[1])
      if (!name || !province) {
        setProvinceOverrideMessage(`Invalid province on line ${idx + 1}. Use NB, NS, PE, NL, ON.`)
        return
      }
      overrides[name.toLowerCase()] = province
    }
    dispatch({ type: 'SET_PROVINCE_OVERRIDES', payload: overrides })
    setProvinceOverrideMessage(`Province overrides applied for ${Object.keys(overrides).length} player(s).`)
  }

  function clearProvinceOverrides() {
    dispatch({ type: 'CLEAR_PROVINCE_OVERRIDES' })
    setProvinceOverrideText('')
    setProvinceOverrideMessage('Province overrides cleared.')
  }

  async function savePaymentControl(next) {
    setControlSaving(true)
    setControlError('')
    setControlMessage('')

    const { error } = await updatePaymentAccessControl(next)
    if (error) {
      setControlError(`Save failed: ${error.message || String(error)}`)
      setControlSaving(false)
      return
    }

    setPaymentControl(next)
    setControlMessage('Payment access updated. QR link behavior changed instantly.')
    setControlSaving(false)
  }

  async function togglePaymentEnabled() {
    if (!paymentControl || controlSaving) return
    await savePaymentControl({ ...paymentControl, enabled: !paymentControl.enabled, requireKey: false })
    const { count } = await fetchPaymentScanCount()
    if (count !== null) setScanCount(count)
  }

  async function refreshScanCount() {
    const { count } = await fetchPaymentScanCount()
    if (count !== null) setScanCount(count)
  }

  const staticEventCount = events.filter(e => !e._runtime).length
  // Note: runtime events don't carry a _runtime flag; we track via dispatch

  const approvedTotal = donations
    .filter(d => d.status === 'approved')
    .reduce((sum, d) => sum + Number(d.amount), 0)
  const pendingDonations = donations.filter(d => d.status === 'pending')

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      {/* Status */}
      <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-4">
        <div className="text-[10px] text-orange uppercase tracking-widest mb-3">Data Status</div>
        <div className="space-y-2">
          <StatusRow
            label="Event files loaded"
            value={events.length}
            detail={events.map(e => e.metadata.event_name).join(', ')}
            active
          />
          <StatusRow
            label="Players loaded"
            value={players.length}
            detail={hasRuntimePlayers ? 'Using runtime upload' : 'Using bundled CSV'}
            active
          />
          <StatusRow
            label="Runtime event overrides"
            value={hasRuntimeEvents ? 'Active' : 'None'}
            active={hasRuntimeEvents}
          />
          <StatusRow
            label="Runtime player override"
            value={hasRuntimePlayers ? 'Active' : 'None'}
            active={hasRuntimePlayers}
          />
        </div>
      </div>

      {/* Event upload */}
      <UploadCard
        title="Upload Live Event JSON"
        description="Drop in a new event result JSON file. It will be merged with the bundled event data for the current session and persisted in localStorage. File must contain metadata and player_event_stats fields."
        accept=".json"
        multiple
        onUpload={handleEventUpload}
        onClear={hasRuntimeEvents ? () => dispatch({ type: 'CLEAR_RUNTIME_EVENTS' }) : null}
        clearLabel="Clear runtime events"
      />

      {/* Player CSV upload */}
      <UploadCard
        title="Upload Player CSV Override"
        description="Override the bundled player questionnaire data with a fresh CSV export from Google Forms. The new file completely replaces the bundled player data for this session."
        accept=".csv"
        onUpload={handlePlayersUpload}
        onClear={hasRuntimePlayers ? () => dispatch({ type: 'CLEAR_RUNTIME_PLAYERS' }) : null}
        clearLabel="Restore bundled CSV"
      />

      {/* Player CSV export */}
      <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-4">
        <div className="text-[10px] text-orange uppercase tracking-widest mb-2">Export Player Data</div>
        <p className="text-gray-500 text-xs mb-3 leading-relaxed">
          Export current player data (including any new players added) as a CSV file with profile images.
          This file can be imported back to preserve your player database.
        </p>
        <button
          onClick={handleExportPlayersCSV}
          className="bg-green-600 hover:bg-green-500 text-white font-bold text-sm px-4 py-2 rounded-lg
                     transition-colors"
        >
          📥 Export Players CSV
        </button>
      </div>

      {/* Player Profile Editor */}
      <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-4">
        <div className="text-[10px] text-orange uppercase tracking-widest mb-2">Player Profile Editor</div>
        <p className="text-gray-500 text-xs mb-3 leading-relaxed">
          Edit a player&apos;s personal information and province. Game stats are loaded automatically from event JSON files.
        </p>

        {/* Search input */}
        <input
          type="text"
          placeholder="Search player name…"
          value={editSearch}
          onChange={e => { setEditSearch(e.target.value); setEditPlayer(null); setEditForm({}) }}
          className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 mb-2"
        />

        {/* Dropdown results */}
        {editSearch && !editPlayer && (
          <div className="mb-3 max-h-48 overflow-y-auto rounded-lg border border-[#2a2a2a] bg-[#0a0a0a]">
            {filteredPlayers.length === 0 && (
              <p className="text-xs text-gray-600 italic p-3">No players found.</p>
            )}
            {filteredPlayers.map(p => (
              <button
                key={p.displayName}
                onClick={() => { selectEditPlayer(p); setEditSearch(p.displayName) }}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#1a1a1a] hover:text-white transition-colors border-b border-[#1a1a1a] last:border-0"
              >
                {p.displayName}
                {p.province && <span className="ml-2 text-[10px] text-orange">{p.province}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Edit form */}
        {editPlayer && (
          <div className="space-y-3">
            <div className="text-sm font-bold text-white border-b border-[#1e1e1e] pb-2">
              Editing: <span className="text-orange">{editPlayer.displayName}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Nickname</label>
                <input type="text" value={editForm.nickname} onChange={ef('nickname')}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Province</label>
                <select value={editForm.province} onChange={ef('province')}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500">
                  {['NB','NS','PE','NL','ON'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Hometown</label>
                <input type="text" value={editForm.hometown} onChange={ef('hometown')}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Age</label>
                <input type="text" value={editForm.age} onChange={ef('age')}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Years Playing</label>
                <input type="text" value={editForm.yearsPlaying} onChange={ef('yearsPlaying')}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">DartConnect Email</label>
                <input type="text" value={editForm.dartConnectEmail} onChange={ef('dartConnectEmail')}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500" />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Dart Setup</label>
              <input type="text" value={editForm.dartSetup} onChange={ef('dartSetup')}
                className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500" />
            </div>

            {[['hobbies','Hobbies'],['achievements','Achievements'],['preMatchRituals','Pre-Match Rituals'],['aadsMeaning','What AADS Means']].map(([key, label]) => (
              <div key={key}>
                <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">{label}</label>
                <textarea value={editForm[key]} onChange={ef(key)} rows={2}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500 resize-y" />
              </div>
            ))}

            <div className="flex items-center gap-3 pt-1">
              <button onClick={saveEditPlayer}
                className="bg-orange hover:bg-orange/90 text-black font-bold text-sm px-5 py-2 rounded-lg transition-colors">
                Save Changes
              </button>
              <button onClick={() => { setEditPlayer(null); setEditSearch(''); setEditForm({}) }}
                className="text-xs text-gray-500 hover:text-white transition-colors">
                Cancel
              </button>
              {editSaved && <span className="text-xs text-green-400 font-semibold">✓ Saved!</span>}
            </div>
          </div>
        )}
      </div>

      {/* Province override lock */}
      <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-4">
        <div className="text-[10px] text-orange uppercase tracking-widest mb-2">Province Lock Overrides</div>
        <p className="text-gray-500 text-xs mb-3 leading-relaxed">
          Enter one mapping per line in the format <code>Name, Province</code> (e.g. <code>Tom Holden, NS</code>).
          Supported codes: NB, NS, PE, NL, ON. This applies immediately and persists in localStorage.
        </p>
        <textarea
          value={provinceOverrideText}
          onChange={e => setProvinceOverrideText(e.target.value)}
          placeholder="Tom Holden, NS\nRicky Perkins, NB"
          className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-xs text-white focus:outline-none"
          rows={4}
        />
        <div className="mt-3 flex gap-2 flex-wrap">
          <button
            onClick={applyProvinceOverrides}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            Apply overrides
          </button>
          <button
            onClick={clearProvinceOverrides}
            className="bg-gray-700 hover:bg-gray-600 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            Clear overrides
          </button>
        </div>
        {provinceOverrideMessage && (
          <p className="mt-2 text-xs text-green-400">{provinceOverrideMessage}</p>
        )}
      </div>

      {/* Payment Access Control */}
      <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-4">
        <div className="text-[10px] text-orange uppercase tracking-widest mb-2">Payment QR Access Control</div>
        <p className="text-gray-500 text-xs mb-3 leading-relaxed">
          Locked-tab kill switch for the payment page QR link. ON now means blocked.
          OFF means access is live.
        </p>

        {controlLoading && <p className="text-xs text-gray-400">Loading payment access state...</p>}

        {!controlLoading && paymentControl && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={togglePaymentEnabled}
                disabled={controlSaving}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                  paymentControl.enabled
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-red-700 hover:bg-red-600 text-white'
                } disabled:opacity-60`}
              >
                {controlSaving ? 'Saving...' : paymentControl.enabled ? 'OFF - Click to Turn ON' : 'ON - Click to Turn OFF'}
              </button>
              <span className="text-xs text-gray-400">
                Current status: {paymentControl.enabled ? 'OFF (Access live)' : 'ON (Access blocked)'}
              </span>
              {scanCount !== null && (
                <span className="ml-auto flex items-center gap-1.5 text-xs font-bold text-orange-400 tabular-nums">
                  {scanCount} scan{scanCount !== 1 ? 's' : ''}
                  <button
                    onClick={refreshScanCount}
                    title="Refresh scan count"
                    className="text-gray-500 hover:text-orange-400 transition-colors leading-none"
                  >↺</button>
                </span>
              )}
            </div>

            <div className="text-xs text-gray-500 break-all">
              Controlled URL: <span className="text-orange">{paymentUrl}</span>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase tracking-widest block">Event Start (donations filter)</label>
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={paymentControl.eventStart ? paymentControl.eventStart.slice(0, 16) : ''}
                  onChange={async e => {
                    const val = e.target.value
                    const next = { ...paymentControl, eventStart: val ? new Date(val).toISOString() : null }
                    await savePaymentControl(next)
                  }}
                  className="bg-[#0d0d0d] border border-[#303030] rounded-lg px-3 py-1.5 text-xs text-white"
                />
                {paymentControl.eventStart && (
                  <button
                    onClick={() => savePaymentControl({ ...paymentControl, eventStart: null })}
                    className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                    title="Clear event start"
                  >✕ Clear</button>
                )}
              </div>
              <p className="text-[10px] text-gray-600">Only donations received on or after this date appear on the stats page.</p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <a
                href={`${window.location.origin}${getBaseUrl()}QR_Donation_stats.html`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 rounded-lg font-bold text-sm border border-[#303030] bg-[#171717] text-white hover:border-orange-500 hover:text-orange-300 transition-colors"
              >
                View QR Stats Page ↗
              </a>
              <a
                href={`${window.location.origin}${getBaseUrl()}donation-overlay.html`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 rounded-lg font-bold text-sm border border-[#303030] bg-[#171717] text-white hover:border-orange-500 hover:text-orange-300 transition-colors"
              >
                Preview OBS Overlay ↗
              </a>
            </div>

            {controlMessage && <div className="text-xs text-green-400">{controlMessage}</div>}
          </div>
        )}

        {controlError && <div className="text-xs text-red-400 mt-2">{controlError}</div>}
      </div>

      {/* Fundraiser Goal */}
      <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-4">
        <div className="text-[10px] text-orange uppercase tracking-widest mb-2">Fundraiser Goal (OBS Overlay)</div>
        <p className="text-gray-500 text-xs mb-3 leading-relaxed">
          Show a live progress bar on the OBS overlay. Set the objective text viewers will see and the target dollar amount.
        </p>

        {controlLoading && <p className="text-xs text-gray-400">Loading…</p>}

        {!controlLoading && paymentControl && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => savePaymentControl({ ...paymentControl, goalEnabled: !paymentControl.goalEnabled })}
                disabled={controlSaving}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                  paymentControl.goalEnabled
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-[#1f1f1f] border border-[#333] text-gray-400 hover:text-white'
                } disabled:opacity-60`}
              >
                {paymentControl.goalEnabled ? '✓ Goal Visible' : 'Show Goal on Overlay'}
              </button>
              <span className="text-xs text-gray-500">{paymentControl.goalEnabled ? 'Progress bar is live on stream' : 'Progress bar hidden'}</span>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase tracking-widest block">Objective Text</label>
              <input
                type="text"
                placeholder="e.g. Raise $500 — Matthew gets a haircut live!"
                value={paymentControl.goalLabel}
                onChange={e => setPaymentControl({ ...paymentControl, goalLabel: e.target.value })}
                onBlur={e => savePaymentControl({ ...paymentControl, goalLabel: e.target.value })}
                className="w-full bg-[#0d0d0d] border border-[#303030] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase tracking-widest block">Target Amount ($)</label>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="500"
                value={paymentControl.goalAmount ?? ''}
                onChange={e => setPaymentControl({ ...paymentControl, goalAmount: e.target.value })}
                onBlur={e => savePaymentControl({ ...paymentControl, goalAmount: Number(e.target.value) || 500 })}
                className="w-40 bg-[#0d0d0d] border border-[#303030] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Donation Queue */}
      <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] text-orange uppercase tracking-widest">Donation Queue</div>
          {pendingDonations.length > 0 && (
            <span className="text-[10px] font-bold bg-orange text-black rounded-full px-2 py-0.5">
              {pendingDonations.length} pending
            </span>
          )}
        </div>
        <p className="text-gray-500 text-xs mb-3 leading-relaxed">
          Track incoming bank transfers. In <strong className="text-gray-300">Auto</strong> mode every recorded donation is instantly approved and counted. In{' '}
          <strong className="text-gray-300">Manual</strong> mode donations sit in a queue until you approve them.
        </p>

        {/* Mode toggle */}
        {!controlLoading && paymentControl && (
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => savePaymentControl({ ...paymentControl, donationMode: paymentControl.donationMode === 'auto' ? 'manual' : 'auto' })}
              disabled={controlSaving}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors disabled:opacity-60 ${
                paymentControl.donationMode === 'auto'
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-orange hover:bg-orange/90 text-black'
              }`}
            >
              {paymentControl.donationMode === 'auto' ? '⚡ Auto-Accept' : '✋ Manual Approval'}
            </button>
            <span className="text-xs text-gray-500">
              {paymentControl.donationMode === 'auto'
                ? 'Transfers are instantly approved'
                : 'Transfers wait for your approval'}
            </span>
          </div>
        )}

        {/* Totals bar */}
        <div className="flex items-center gap-4 mb-4 p-3 bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg">
          <div className="text-center">
            <div className="text-[10px] text-gray-500 uppercase tracking-widest">Total Approved</div>
            <div className="text-xl font-bold text-green-400">${approvedTotal.toFixed(2)}</div>
          </div>
          <div className="w-px h-8 bg-[#222]" />
          <div className="text-center">
            <div className="text-[10px] text-gray-500 uppercase tracking-widest">Pending</div>
            <div className={`text-xl font-bold ${pendingDonations.length > 0 ? 'text-orange' : 'text-gray-600'}`}>
              {pendingDonations.length}
            </div>
          </div>
          <div className="w-px h-8 bg-[#222]" />
          <div className="text-center">
            <div className="text-[10px] text-gray-500 uppercase tracking-widest">Total Recorded</div>
            <div className="text-xl font-bold text-gray-300">{donations.length}</div>
          </div>
          <button
            onClick={refreshDonations}
            disabled={donationsLoading}
            title="Refresh donations"
            className="ml-auto text-sm text-gray-500 hover:text-orange transition-colors disabled:opacity-40"
          >
            {donationsLoading ? '…' : '↺'}
          </button>
        </div>

        {/* Add donation form toggle */}
        <div className="mb-3">
          <button
            onClick={() => { setShowAddForm(v => !v); setAddDonationMsg('') }}
            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-gray-400 hover:text-white hover:border-orange transition-colors"
          >
            {showAddForm ? '✕ Cancel' : '+ Record Transfer'}
          </button>
          {!showAddForm && addDonationMsg && (
            <span className="ml-3 text-xs text-green-400">{addDonationMsg}</span>
          )}
        </div>

        {showAddForm && (
          <div className="mb-4 p-3 bg-[#0a0a0a] border border-[#242424] rounded-lg space-y-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Record Incoming Transfer</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-600 block mb-0.5">Donor Name</label>
                <input
                  type="text"
                  placeholder="Jane Smith"
                  value={donationForm.donorName}
                  onChange={e => setDonationForm(f => ({ ...f, donorName: e.target.value }))}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-600 block mb-0.5">Amount ($) *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="25.00"
                  value={donationForm.amount}
                  onChange={e => setDonationForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-600 block mb-0.5">Message</label>
                <input
                  type="text"
                  placeholder="Optional note"
                  value={donationForm.message}
                  onChange={e => setDonationForm(f => ({ ...f, message: e.target.value }))}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-600 block mb-0.5">Transfer Ref</label>
                <input
                  type="text"
                  placeholder="e-transfer ref / ID"
                  value={donationForm.transferRef}
                  onChange={e => setDonationForm(f => ({ ...f, transferRef: e.target.value }))}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleAddDonation}
                disabled={addingDonation || !donationForm.amount}
                className="bg-orange hover:bg-orange/90 text-black font-bold text-xs px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {addingDonation ? 'Saving…' : paymentControl?.donationMode === 'auto' ? 'Record & Approve' : 'Add to Queue'}
              </button>
              {addDonationMsg && <span className="text-xs text-green-400">{addDonationMsg}</span>}
            </div>
          </div>
        )}

        {/* Donation list */}
        {donationsError && <p className="text-xs text-red-400 mb-2">{donationsError}</p>}
        {!donationsError && donations.length === 0 && !donationsLoading && (
          <p className="text-xs text-gray-600 italic">No donations recorded yet.</p>
        )}
        {donations.length > 0 && (
          <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
            {donations.map(d => (
              <div
                key={d.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                  d.status === 'pending'
                    ? 'border-orange/30 bg-orange/5'
                    : d.status === 'approved'
                    ? 'border-green-800/40 bg-green-900/10'
                    : 'border-[#1e1e1e] bg-[#0a0a0a] opacity-50'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  d.status === 'pending' ? 'bg-orange' : d.status === 'approved' ? 'bg-green-500' : 'bg-gray-700'
                }`} />
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-white">{d.donor_name || 'Anonymous'}</span>
                  {d.message && <span className="text-gray-500 ml-1.5">"{d.message}"</span>}
                  {d.transfer_ref && <span className="text-gray-600 ml-1.5">#{d.transfer_ref}</span>}
                </div>
                <div className="font-bold text-green-300 tabular-nums shrink-0">${Number(d.amount).toFixed(2)}</div>
                <div className="text-gray-600 shrink-0 hidden sm:block">
                  {new Date(d.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className={`text-[10px] font-bold uppercase tracking-wide shrink-0 w-16 text-center ${
                  d.status === 'pending' ? 'text-orange' : d.status === 'approved' ? 'text-green-400' : 'text-gray-600'
                }`}>
                  {d.status}
                </div>
                {d.status === 'pending' && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleApproveDonation(d.id)}
                      className="bg-green-700 hover:bg-green-600 text-white font-bold text-[10px] px-2 py-1 rounded transition-colors"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => handleRejectDonation(d.id)}
                      className="bg-red-900 hover:bg-red-800 text-white font-bold text-[10px] px-2 py-1 rounded transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Donations Filter */}
      <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] text-orange uppercase tracking-widest">Payment Donations Filter</div>
        </div>
        <p className="text-gray-500 text-xs mb-3 leading-relaxed">
          View all entries in the <code className="text-orange">payment_donations</code> table and exclude any that shouldn't count toward the total on the overlay or stats page.
        </p>
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => {
              if (!showPaymentDonations) loadPaymentDonations()
              setShowPaymentDonations(v => !v)
            }}
            disabled={paymentDonationsLoading}
            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-gray-400 hover:text-white hover:border-orange transition-colors disabled:opacity-50"
          >
            {paymentDonationsLoading ? 'Loading…' : showPaymentDonations ? '▲ Hide' : '▼ Show entries'}
          </button>
          {showPaymentDonations && (
            <button
              onClick={loadPaymentDonations}
              disabled={paymentDonationsLoading}
              className="text-xs text-gray-500 hover:text-orange transition-colors"
            >↺ Refresh</button>
          )}
        </div>
        {paymentDonationsError && (
          <p className="text-xs text-red-400 mb-2">{paymentDonationsError}</p>
        )}
        {showPaymentDonations && !paymentDonationsLoading && !paymentDonationsError && (
          <>
            {paymentDonations.length === 0 && (
              <p className="text-xs text-gray-600 italic">No entries found.</p>
            )}
            {paymentDonations.length > 0 && (
              <>
                <div className="text-[10px] text-gray-600 mb-2">
                  {paymentDonations.filter(d => !d.excluded).length} active · {paymentDonations.filter(d => d.excluded).length} excluded
                  {' '}· Active total: <span className="text-green-400 font-bold">
                    ${paymentDonations.filter(d => !d.excluded).reduce((s, d) => s + Number(d.amount), 0).toFixed(2)}
                  </span>
                </div>
                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {paymentDonations.map(d => (
                    <div
                      key={d.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                        d.excluded
                          ? 'border-[#1e1e1e] bg-[#0a0a0a] opacity-40'
                          : 'border-green-800/30 bg-green-900/5'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.excluded ? 'bg-gray-700' : 'bg-green-500'}`} />
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-white">{d.donor_name || 'Anonymous'}</span>
                        <span className="text-gray-600 ml-2 hidden sm:inline">
                          {new Date(d.received_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="font-bold text-green-300 tabular-nums shrink-0">${Number(d.amount).toFixed(2)}</div>
                      {d.excluded ? (
                        confirmIncludeId === d.id ? (
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handleConfirmInclude(d.id)}
                              className="text-[10px] font-bold px-2 py-1 rounded bg-green-700 hover:bg-green-600 text-white transition-colors"
                            >Yes, include</button>
                            <button
                              onClick={() => setConfirmIncludeId(null)}
                              className="text-[10px] font-bold px-2 py-1 rounded bg-[#222] hover:bg-[#333] text-gray-400 transition-colors"
                            >Cancel</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmIncludeId(d.id)}
                            className="text-[10px] font-bold px-2 py-1 rounded bg-green-800 hover:bg-green-700 text-green-300 transition-colors shrink-0"
                          >+ Include</button>
                        )
                      ) : (
                        <button
                          onClick={() => handleToggleExclude(d.id, d.excluded)}
                          className="text-[10px] font-bold px-2 py-1 rounded bg-red-900 hover:bg-red-800 text-red-300 transition-colors shrink-0"
                        >✕ Exclude</button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Info box */}
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 text-xs text-gray-500 space-y-1">
        <div className="text-gray-400 font-semibold mb-1.5">Permanent data management</div>
        <p>To permanently add events, drop JSON files into <code className="text-orange">src/data/events/</code> and rebuild.</p>
        <p>To permanently update player profiles, replace <code className="text-orange">src/data/players.csv</code> and rebuild.</p>
        <p>Payment ON/OFF control uses Supabase table <code className="text-orange">payment_access</code> (row id=1).</p>
        <p>Runtime uploads are stored in localStorage and persist across page refreshes until cleared.</p>
      </div>
    </div>
  )
}

function StatusRow({ label, value, detail, active }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-green-500' : 'bg-gray-700'}`} />
      <div className="flex-1 text-sm text-gray-300">{label}</div>
      <div className="text-orange font-semibold text-sm">{value}</div>
      {detail && <div className="text-gray-600 text-xs hidden sm:block">{detail}</div>}
    </div>
  )
}

function UploadCard({ title, description, accept, multiple, onUpload, onClear, clearLabel }) {
  return (
    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-4">
      <div className="text-[10px] text-orange uppercase tracking-widest mb-2">{title}</div>
      <p className="text-gray-500 text-xs mb-3 leading-relaxed">{description}</p>
      <div className="flex gap-2">
        <label className="cursor-pointer flex-1">
          <div className="bg-orange text-black font-bold text-sm px-4 py-2 rounded-lg text-center
                          hover:bg-orange/90 transition-colors">
            Choose file{multiple ? 's' : ''}…
          </div>
          <input
            type="file"
            accept={accept}
            multiple={multiple}
            className="hidden"
            onChange={onUpload}
          />
        </label>
        {onClear && (
          <button
            onClick={onClear}
            className="px-4 py-2 rounded-lg border border-[#333] text-gray-400 text-sm
                       hover:border-red-800 hover:text-red-400 transition-colors"
          >
            {clearLabel}
          </button>
        )}
      </div>
    </div>
  )
}
