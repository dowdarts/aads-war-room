import { createContext, useContext, useReducer, useMemo, useEffect } from 'react'
import { parsePlayerCSV } from '../utils/csvParser.js'
import { aggregatePlayerStats, buildH2HIndex } from '../utils/eventAggregator.js'
import playersCSVRaw from '../data/players.csv?raw'

// ─── Static data loaded at build-time ──────────────────────────────────────
const EVENT_MODULES = import.meta.glob('../data/events/*.json', { eager: true })
const staticEvents = Object.values(EVENT_MODULES)
  .map(m => m.default)
  .sort((a, b) => a.metadata.event_id - b.metadata.event_id)

const staticPlayers = parsePlayerCSV(playersCSVRaw)

// ─── Reducer ───────────────────────────────────────────────────────────────
const initialState = {
  // static (from files)
  staticEvents,
  staticPlayers,
  // runtime overrides (from localStorage)
  runtimeEvents: [],
  runtimePlayers: null,
}

function init(state) {
  try {
    const stored = localStorage.getItem('aads_runtime_events')
    if (stored) state = { ...state, runtimeEvents: JSON.parse(stored) }
  } catch { /* ignore */ }
  try {
    const stored = localStorage.getItem('aads_runtime_players')
    if (stored) state = { ...state, runtimePlayers: JSON.parse(stored) }
  } catch { /* ignore */ }
  return state
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_RUNTIME_EVENT': {
      const next = [...state.runtimeEvents, action.payload]
      localStorage.setItem('aads_runtime_events', JSON.stringify(next))
      return { ...state, runtimeEvents: next }
    }
    case 'CLEAR_RUNTIME_EVENTS': {
      localStorage.removeItem('aads_runtime_events')
      return { ...state, runtimeEvents: [] }
    }
    case 'SET_RUNTIME_PLAYERS': {
      localStorage.setItem('aads_runtime_players', JSON.stringify(action.payload))
      return { ...state, runtimePlayers: action.payload }
    }
    case 'CLEAR_RUNTIME_PLAYERS': {
      localStorage.removeItem('aads_runtime_players')
      return { ...state, runtimePlayers: null }
    }
    default:
      return state
  }
}

// ─── Context ───────────────────────────────────────────────────────────────
const StatsContext = createContext(null)

export function StatsProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState, init)

  // Merged data: runtime overrides static when present
  const players = state.runtimePlayers ?? state.staticPlayers
  const events = [...state.staticEvents, ...state.runtimeEvents].sort(
    (a, b) => a.metadata.event_id - b.metadata.event_id
  )

  const csvNames = useMemo(() => players.map(p => p.displayName), [players])

  const aggregatedStats = useMemo(
    () => aggregatePlayerStats(events, csvNames),
    [events, csvNames]
  )

  const h2hIndex = useMemo(
    () => buildH2HIndex(events, csvNames),
    [events, csvNames]
  )

  // Merge CSV bio data with aggregated stats
  const enrichedPlayers = useMemo(() => {
    const statsMap = new Map(aggregatedStats.map(s => [s.displayName.toLowerCase(), s]))
    return players.map(p => ({
      ...p,
      stats: statsMap.get(p.displayName.toLowerCase()) || null,
    }))
  }, [players, aggregatedStats])

  const value = {
    players: enrichedPlayers,
    events,
    aggregatedStats,
    h2hIndex,
    csvNames,
    dispatch,
    hasRuntimeEvents: state.runtimeEvents.length > 0,
    hasRuntimePlayers: !!state.runtimePlayers,
  }

  return <StatsContext.Provider value={value}>{children}</StatsContext.Provider>
}

export function useStats() {
  const ctx = useContext(StatsContext)
  if (!ctx) throw new Error('useStats must be used inside StatsProvider')
  return ctx
}
