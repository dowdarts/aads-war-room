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
