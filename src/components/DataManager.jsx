import { useEffect, useMemo, useState } from 'react'
import { useStats } from '../context/StatsContext.jsx'
import { parsePlayerCSV } from '../utils/csvParser.js'
import { getBaseUrl } from '../utils/baseUrl.js'
import {
  fetchPaymentAccessControl,
  fetchPaymentScanCount,
  getSupabaseClient,
  initSupabaseClient,
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
      })
      setControlLoading(false)
    }

    loadPaymentControl()
    return () => { alive = false }
  }, [])

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
