import { useMemo, useRef, useState } from 'react'
import { useStats } from '../context/StatsContext.jsx'
import { parsePlayerCSV } from '../utils/csvParser.js'

export default function DataManager() {
  const {
    dispatch,
    events,
    hasRuntimeEvents,
    hasRuntimePlayers,
    players,
  } = useStats()
  const [provinceOverrideText, setProvinceOverrideText] = useState('')
  const [provinceOverrideMessage, setProvinceOverrideMessage] = useState('')

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

      {/* Info box */}
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 text-xs text-gray-500 space-y-1">
        <div className="text-gray-400 font-semibold mb-1.5">Permanent data management</div>
        <p>To permanently add events, drop JSON files into <code className="text-orange">src/data/events/</code> and rebuild.</p>
        <p>To permanently update player profiles, replace <code className="text-orange">src/data/players.csv</code> and rebuild.</p>
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
