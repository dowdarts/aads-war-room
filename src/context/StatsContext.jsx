import { createContext, useContext, useReducer, useMemo, useEffect } from 'react'
import { parsePlayerCSV } from '../utils/csvParser.js'
import { aggregatePlayerStats, buildH2HIndex } from '../utils/eventAggregator.js'
import playersWithImagesRaw from '../data/players-with-images.csv?raw'
import playersLegacyRaw from '../data/players.csv?raw'
import event4Data from '../data/events/Final_Series1_Event4.json'

// ─── Static data loaded at build-time ──────────────────────────────────────
const EVENT_MODULES = import.meta.glob('../data/events/*.json', { eager: true })
const staticEvents = [
  ...Object.values(EVENT_MODULES)
    .map(m => m.default)
    .filter(e => e.metadata.event_id !== 4),
  event4Data
].sort((a, b) => a.metadata.event_id - b.metadata.event_id)

// Merge both CSVs: legacy has all players, images CSV has richer data for 8 players.
// Players in the images CSV take precedence; legacy players fill in the rest.
const playersWithImages = parsePlayerCSV(playersWithImagesRaw)
const playersLegacy = parsePlayerCSV(playersLegacyRaw)
const imagesByName = new Map(playersWithImages.map(p => [p.displayName.toLowerCase(), p]))
const staticPlayers = [
  ...playersWithImages,
  ...playersLegacy.filter(p => !imagesByName.has(p.displayName.toLowerCase())),
]

// ─── Reducer ───────────────────────────────────────────────────────────────
const initialState = {
  // static (from files)
  staticEvents,
  staticPlayers,
  // runtime overrides (from localStorage)
  runtimeEvents: [],
  runtimePlayers: null,
  provinceOverrides: {},
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
  try {
    const stored = localStorage.getItem('aads_province_overrides')
    if (stored) state = { ...state, provinceOverrides: JSON.parse(stored) }
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
    case 'ADD_NEW_PLAYER': {
      const currentPlayers = state.runtimePlayers || state.staticPlayers
      const newPlayers = [...currentPlayers, action.payload]
      localStorage.setItem('aads_runtime_players', JSON.stringify(newPlayers))
      return { ...state, runtimePlayers: newPlayers }
    }
    case 'CLEAR_RUNTIME_PLAYERS': {
      localStorage.removeItem('aads_runtime_players')
      return { ...state, runtimePlayers: null }
    }
    case 'UPDATE_PLAYER': {
      // Edits a single player by displayName; promotes staticPlayers to runtime if needed
      const currentPlayers = state.runtimePlayers || state.staticPlayers
      const next = currentPlayers.map(p =>
        p.displayName.toLowerCase() === action.payload.displayName.toLowerCase()
          ? { ...p, ...action.payload.updates }
          : p
      )
      localStorage.setItem('aads_runtime_players', JSON.stringify(next))
      return { ...state, runtimePlayers: next }
    }
    case 'SET_PROVINCE_OVERRIDES': {
      localStorage.setItem('aads_province_overrides', JSON.stringify(action.payload))
      return { ...state, provinceOverrides: action.payload }
    }
    case 'CLEAR_PROVINCE_OVERRIDES': {
      localStorage.removeItem('aads_province_overrides')
      return { ...state, provinceOverrides: {} }
    }
    default:
      return state
  }
}

// ─── Context ───────────────────────────────────────────────────────────────
const StatsContext = createContext(null)

export function StatsProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState, init)

  // Merged data: runtime players override matching static players by name,
  // but static players always fill in any that are missing from the runtime list.
  const players = useMemo(() => {
    const overrides = state.provinceOverrides || {}

    const applyOverride = p => {
      const key = p.displayName.toLowerCase()
      const override = overrides[key]
      if (override) {
        return { ...p, province: override }
      }
      return p
    }

    if (!state.runtimePlayers) {
      return state.staticPlayers.map(applyOverride)
    }

    const runtimeByName = new Map(state.runtimePlayers.map(p => [p.displayName.toLowerCase(), p]))
    // Start with static list; swap in runtime version where available
    const merged = state.staticPlayers.map(p =>
      applyOverride(runtimeByName.get(p.displayName.toLowerCase()) ?? p)
    )
    // Add any runtime players not already in static list
    for (const rp of state.runtimePlayers) {
      if (!state.staticPlayers.some(sp => sp.displayName.toLowerCase() === rp.displayName.toLowerCase())) {
        merged.push(applyOverride(rp))
      }
    }
    return merged
  }, [state.runtimePlayers, state.staticPlayers, state.provinceOverrides])
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
    provinceOverrides: state.provinceOverrides,
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
