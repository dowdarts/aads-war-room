import { useState, useMemo } from 'react'
import { useStats } from '../context/StatsContext.jsx'

const PROVINCE_LABELS = { NB: 'New Brunswick', NS: 'Nova Scotia', PE: 'Prince Edward Island', ON: 'Ontario', NL: 'Newfoundland & Labrador' }

function Section({ title, children }) {
  return (
    <div className="mb-4">
      <div className="text-[10px] text-orange uppercase tracking-widest font-semibold mb-1.5 border-b border-[#1a1a1a] pb-1">
        {title}
      </div>
      <div className="text-gray-300 text-sm leading-relaxed">{children}</div>
    </div>
  )
}

function StatGrid({ stats }) {
  if (!stats) return <p className="text-gray-600 text-sm">No event data recorded yet.</p>
  const t = stats.totals
  const cells = [
    ['Avg 3-Dart Avg', t.avg3da.toFixed(2)],
    ['Best Event 3DA', t.best3da.toFixed(2)],
    ['Win Rate', `${t.winRate}%`],
    ['Wins / Losses', `${t.wins} / ${t.losses}`],
    ['Events Played', t.eventsPlayed],
    ['180s', t.scores180],
    ['140+', t.scores140plus],
    ['100+', t.scores100plus],
    ['Checkout %', `${t.coPct}%`],
    ['High Finish', t.highFinish],
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {cells.map(([label, value]) => (
        <div key={label} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded px-3 py-2">
          <div className="text-orange font-bold text-sm">{value}</div>
          <div className="text-gray-500 text-[10px] uppercase tracking-wider">{label}</div>
        </div>
      ))}
    </div>
  )
}

function EventBreakdown({ stats }) {
  if (!stats) return null
  return (
    <div className="space-y-2 mt-2">
      {Object.entries(stats.events).map(([eventId, ev]) => (
        <div key={eventId} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded px-3 py-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">
            Event {eventId} — {ev.total_matches} matches
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              ['3DA', ev.final_event_3da?.toFixed(1)],
              ['W/L', `${ev.wins}/${ev.losses}`],
              ['180s', ev.scores_180],
              ['HF', ev.high_finish],
            ].map(([l, v]) => (
              <div key={l}>
                <div className="text-white text-sm font-semibold">{v ?? '—'}</div>
                <div className="text-gray-600 text-[10px] uppercase">{l}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function PlayerDetail({ player, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-end p-4 overflow-y-auto">
      <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#1a1a1a]">
          <div className="flex-1">
            <div className="text-white text-xl font-bold">{player.displayName}</div>
            {player.nickname && (
              <div className="text-orange text-sm">"{player.nickname}"</div>
            )}
            <div className="text-gray-500 text-xs mt-0.5">
              {player.hometown} · {PROVINCE_LABELS[player.province] || player.province}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-2xl leading-none px-2"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[80vh]">
          {/* Quick stats */}
          <div>
            <div className="text-[10px] text-orange uppercase tracking-widest font-semibold mb-2 border-b border-[#1a1a1a] pb-1">
              Career Stats
            </div>
            <StatGrid stats={player.stats} />
            <EventBreakdown stats={player.stats} />
          </div>

          {/* Bio sections */}
          {player.age && <Section title="Profile">Age: {player.age} · Playing for: {player.yearsPlaying}</Section>}
          {player.achievements && <Section title="Achievements">{player.achievements}</Section>}
          {player.strengths && <Section title="Strengths">{player.strengths}</Section>}
          {player.checkouts && <Section title="Checkout Routes">{player.checkouts}</Section>}
          {player.currentForm && <Section title="Current Form">{player.currentForm}</Section>}
          {player.recentResults && <Section title="Recent Results">{player.recentResults}</Section>}
          {player.mentalApproach && <Section title="Mental Approach">{player.mentalApproach}</Section>}
          {player.pressureManagement && <Section title="Under Pressure">{player.pressureManagement}</Section>}
          {player.stagePresence && <Section title="Stage Presence">{player.stagePresence}</Section>}
          {player.preMatchRituals && <Section title="Pre-Match Rituals">{player.preMatchRituals}</Section>}
          {player.dartSetup && <Section title="Dart Setup">{player.dartSetup}</Section>}
          {player.practiceRoutine && <Section title="Practice Routine">{player.practiceRoutine}</Section>}
          {player.hobbies && <Section title="Outside Darts">{player.hobbies}</Section>}
          {player.aadsMeaning && <Section title="AADS Means...">{player.aadsMeaning}</Section>}
        </div>
      </div>
    </div>
  )
}

export default function PlayerWiki() {
  const { players } = useStats()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [sortBy, setSortBy] = useState('avg3da')
  const [filterProvince, setFilterProvince] = useState('ALL')

  const filtered = useMemo(() => {
    let list = players
    if (filterProvince !== 'ALL') list = list.filter(p => p.province === filterProvince)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.displayName.toLowerCase().includes(q) ||
        (p.nickname || '').toLowerCase().includes(q) ||
        (p.hometown || '').toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      if (sortBy === 'avg3da') return (b.stats?.totals.avg3da ?? 0) - (a.stats?.totals.avg3da ?? 0)
      if (sortBy === 'wins') return (b.stats?.totals.wins ?? 0) - (a.stats?.totals.wins ?? 0)
      if (sortBy === 'name') return a.displayName.localeCompare(b.displayName)
      if (sortBy === 'province') return a.province.localeCompare(b.province)
      return 0
    })
  }, [players, search, sortBy, filterProvince])

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Controls */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Search players…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 bg-[#0f0f0f] border border-[#2a2a2a] rounded px-3 py-2
                     text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange"
        />
        <select
          value={filterProvince}
          onChange={e => setFilterProvince(e.target.value)}
          className="bg-[#0f0f0f] border border-[#2a2a2a] rounded px-3 py-2 text-white text-sm
                     focus:outline-none focus:border-orange"
        >
          <option value="ALL">All Provinces</option>
          {['NB', 'NS', 'PE', 'ON', 'NL'].map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="bg-[#0f0f0f] border border-[#2a2a2a] rounded px-3 py-2 text-white text-sm
                     focus:outline-none focus:border-orange"
        >
          <option value="avg3da">Sort: Avg 3DA</option>
          <option value="wins">Sort: Wins</option>
          <option value="name">Sort: Name</option>
          <option value="province">Sort: Province</option>
        </select>
      </div>

      <div className="text-gray-600 text-xs mb-3">{filtered.length} player{filtered.length !== 1 ? 's' : ''}</div>

      {/* Player grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(player => {
          const t = player.stats?.totals
          return (
            <button
              key={player.displayName}
              onClick={() => setSelected(player)}
              className="text-left bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-3
                         hover:border-orange/50 hover:bg-[#141414] transition-all"
            >
              <div className="flex items-start gap-2 mb-2">
                <div
                  className="w-8 h-8 rounded text-[10px] font-black flex items-center
                             justify-center shrink-0 bg-[#1a1a1a] text-orange"
                >
                  {player.displayName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-white text-sm font-semibold truncate">
                    {player.displayName}
                  </div>
                  <div className="text-gray-500 text-xs">
                    {player.province} · {player.hometown || '—'}
                  </div>
                </div>
              </div>
              {t ? (
                <div className="grid grid-cols-3 gap-1 text-center">
                  {[
                    ['3DA', t.avg3da.toFixed(1)],
                    ['W/L', `${t.wins}/${t.losses}`],
                    ['HF', t.highFinish],
                  ].map(([l, v]) => (
                    <div key={l} className="bg-[#0a0a0a] rounded py-1">
                      <div className="text-orange text-xs font-bold">{v}</div>
                      <div className="text-gray-600 text-[9px] uppercase">{l}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-700 text-xs">No stats yet — click for bio</div>
              )}
            </button>
          )
        })}
      </div>

      {selected && (
        <PlayerDetail player={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
