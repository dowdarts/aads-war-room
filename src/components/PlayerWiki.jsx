import { useState, useMemo, useEffect } from 'react'
import { useStats } from '../context/StatsContext.jsx'
import PlayerForm from './PlayerForm.jsx'

const PROVINCE_LABELS = {
  NB: 'New Brunswick', NS: 'Nova Scotia', PE: 'Prince Edward Island',
  ON: 'Ontario', NL: 'Newfoundland & Labrador',
}

// Commentary form Q&A mapping: [fieldKey, question label]
const COMMENTARY_FIELDS = [
  ['achievements',        'Career Achievements'],
  ['strengths',           'Strengths as a Player'],
  ['improvements',        'Areas for Improvement'],
  ['checkouts',           'Favourite Checkout Routes'],
  ['currentForm',         'Current Form'],
  ['recentResults',       'Recent Results'],
  ['mentalApproach',      'Mental Approach to the Game'],
  ['pressureManagement',  'How Do You Handle Pressure?'],
  ['stagePresence',       'Stage Presence'],
  ['preMatchRituals',     'Pre-Match Rituals'],
  ['dartSetup',           'Dart Setup'],
  ['practiceRoutine',     'Practice Routine'],
  ['hobbies',             'Life Outside Darts'],
  ['aadsMeaning',         'What Does AADS Mean to You?'],
]

function StatBadge({ label, value, accent }) {
  return (
    <div className={`bg-[#0a0a0a] border rounded-lg px-3 py-2.5 text-center
      ${accent ? 'border-orange/40' : 'border-[#1a1a1a]'}`}>
      <div className={`font-bold text-base ${accent ? 'text-orange' : 'text-white'}`}>{value}</div>
      <div className="text-gray-500 text-[9px] uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  )
}

function EventBreakdown({ stats }) {
  if (!stats) return null
  return (
    <div className="space-y-2">
      {Object.entries(stats.events).map(([eventId, ev]) => (
        <div key={eventId} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-4 py-3">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-semibold">
            Event {eventId} · {ev.total_matches} matches
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              ['3DA', ev.final_event_3da?.toFixed(1)],
              ['W/L', `${ev.wins}/${ev.losses}`],
              ['180s', ev.scores_180],
              ['140+', ev.scores_140plus],
              ['100+', ev.scores_100plus],
              ['CO%', ev.co_pct != null ? `${ev.co_pct}%` : '—'],
              ['CO Hit', ev.co_completed != null ? `${ev.co_completed}/${ev.co_opportunities}` : '—'],
              ['High Fin', ev.high_finish],
            ].map(([l, v]) => (
              <div key={l}>
                <div className="text-white text-sm font-semibold">{v ?? '—'}</div>
                <div className="text-gray-600 text-[9px] uppercase">{l}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function PlayerCard({ player, onBack }) {
  const t = player.stats?.totals
  const hasStats = !!t

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-gray-500 hover:text-orange text-xs
                   uppercase tracking-widest font-semibold mb-5 transition-colors"
      >
        ← Back to Players
      </button>

      {/* Card header */}
      <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-2xl overflow-hidden mb-4">
        <div className="border-l-4 border-orange px-6 py-5 flex items-start justify-between gap-6">
          {/* Profile image */}
          <div className="shrink-0">
            <img 
              src={player.profileImage} 
              alt={`${player.displayName} profile`}
              className="w-24 h-24 rounded-full object-cover border-2 border-[#2a2a2a]"
              onError={(e) => {
                e.target.src = '/images/players/placeholder.svg'
              }}
            />
          </div>

          {/* Player info */}
          <div className="flex-1 min-w-0">
            <div className="text-white text-3xl font-black tracking-tight leading-tight">
              {player.displayName}
            </div>
            {player.nickname && (
              <div className="text-orange text-base font-semibold mt-0.5">
                "{player.nickname}"
              </div>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="inline-block bg-orange/10 border border-orange/30 text-orange
                               text-xs font-bold px-2.5 py-0.5 rounded-full tracking-wider">
                {player.province}
              </span>
              {player.hometown && (
                <span className="text-gray-500 text-sm">{player.hometown}</span>
              )}
              {player.age && (
                <span className="text-gray-600 text-sm">Age {player.age}</span>
              )}
              {player.yearsPlaying && (
                <span className="text-gray-600 text-sm">{player.yearsPlaying} yrs playing</span>
              )}
            </div>
          </div>

          {/* Province full name */}
          <div className="text-right shrink-0">
            <div className="text-gray-600 text-xs uppercase tracking-widest">Representing</div>
            <div className="text-gray-400 text-sm font-semibold mt-0.5">
              {PROVINCE_LABELS[player.province] || player.province}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left col — stats */}
        <div className="lg:col-span-1 space-y-4">

          {/* Career stats */}
          <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-2xl p-4">
            <div className="text-[10px] text-orange uppercase tracking-widest font-bold mb-3 pb-2 border-b border-[#1a1a1a]">
              Career Stats
            </div>
            {hasStats ? (
              <div className="grid grid-cols-2 gap-2">
                <StatBadge label="Avg 3DA" value={t.avg3da.toFixed(2)} accent />
                <StatBadge label="Best 3DA" value={t.best3da.toFixed(2)} />
                <StatBadge label="Win Rate" value={`${t.winRate}%`} accent />
                <StatBadge label="W / L" value={`${t.wins} / ${t.losses}`} />
                <StatBadge label="Events" value={t.eventsPlayed} />
                <StatBadge label="Checkout %" value={`${t.coPct}%`} />
                <StatBadge label="High Finish" value={t.highFinish} accent />
                <StatBadge label="180s" value={t.scores180} />
                <StatBadge label="140+" value={t.scores140plus} />
                <StatBadge label="100+" value={t.scores100plus} />
              </div>
            ) : (
              <p className="text-gray-600 text-sm">No event data recorded yet.</p>
            )}
          </div>

          {/* Per-event breakdown */}
          {hasStats && (
            <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-2xl p-4">
              <div className="text-[10px] text-orange uppercase tracking-widest font-bold mb-3 pb-2 border-b border-[#1a1a1a]">
                Event Breakdown
              </div>
              <EventBreakdown stats={player.stats} />
            </div>
          )}
        </div>

        {/* Right col — commentary Q&A */}
        <div className="lg:col-span-2">
          <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-2xl p-4">
            <div className="text-[10px] text-orange uppercase tracking-widest font-bold mb-4 pb-2 border-b border-[#1a1a1a]">
              Player Profile · Commentary Form
            </div>
            <div className="space-y-4">
              {COMMENTARY_FIELDS.map(([field, label]) => {
                const val = player[field]
                if (!val) return null
                return (
                  <div key={field} className="border-b border-[#141414] pb-4 last:border-0 last:pb-0">
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">
                      {label}
                    </div>
                    <div className="text-gray-200 text-sm leading-relaxed">{val}</div>
                  </div>
                )
              })}
              {COMMENTARY_FIELDS.every(([f]) => !player[f]) && (
                <p className="text-gray-600 text-sm">No commentary form responses recorded for this player.</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default function PlayerWiki({ selectedPlayerName, onClearSelectedPlayer }) {
  const { players } = useStats()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [sortBy, setSortBy] = useState('avg3da')
  const [filterProvince, setFilterProvince] = useState('ALL')
  const [showPlayerForm, setShowPlayerForm] = useState(false)

  // When a player name is pushed in from another tab, open their card immediately
  useEffect(() => {
    if (!selectedPlayerName || !players.length) return
    const match = players.find(
      p => p.displayName.toLowerCase() === selectedPlayerName.toLowerCase()
    )
    if (match) setSelected(match)
    onClearSelectedPlayer?.()
  }, [selectedPlayerName, players])

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

  // Full-page player card view
  if (selected) {
    return (
      <div className="p-4 max-w-5xl mx-auto">
        <PlayerCard player={selected} onBack={() => setSelected(null)} />
      </div>
    )
  }

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
        <button
          onClick={() => setShowPlayerForm(true)}
          className="bg-orange hover:bg-orange/80 text-black px-4 py-2 rounded text-sm font-semibold transition-colors"
        >
          + Add Player
        </button>
      </div>

      <div className="text-gray-600 text-xs mb-3">{filtered.length} player{filtered.length !== 1 ? 's' : ''}</div>

      {/* Player grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(player => {
          const t = player.stats?.totals
          const hasForm = COMMENTARY_FIELDS.some(([f]) => !!player[f])
          return (
            <button
              key={player.displayName}
              onClick={() => setSelected(player)}
              className="text-left bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-4
                         hover:border-orange/50 hover:bg-[#141414] transition-all group"
            >
              {/* Profile image */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-lg shrink-0 overflow-hidden border border-[#252525]">
                  <img 
                    src={player.profileImage} 
                    alt={`${player.displayName} profile`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = '/images/players/placeholder.svg'
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-white text-sm font-bold truncate">{player.displayName}</div>
                  {player.nickname && (
                    <div className="text-orange text-xs truncate">"{player.nickname}"</div>
                  )}
                  <div className="text-gray-600 text-[10px] mt-0.5">
                    {player.province} · {player.hometown || '—'}
                  </div>
                </div>
              </div>

              {/* Stats mini-grid */}
              {t ? (
                <div className="grid grid-cols-3 gap-1.5 text-center mb-2">
                  {[
                    ['3DA', t.avg3da.toFixed(1)],
                    ['W/L', `${t.wins}/${t.losses}`],
                    ['HF', t.highFinish],
                  ].map(([l, v]) => (
                    <div key={l} className="bg-[#0a0a0a] rounded-lg py-1.5">
                      <div className="text-orange text-xs font-bold">{v}</div>
                      <div className="text-gray-600 text-[9px] uppercase">{l}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-700 text-xs mb-2">No stats yet</div>
              )}

              {/* Form indicator */}
              <div className="text-[10px] text-gray-600 group-hover:text-gray-500 transition-colors">
                {hasForm ? '📋 Commentary form on file · View card →' : 'View card →'}
              </div>
            </button>
          )
        })}
      </div>

      {/* Player Form Modal */}
      {showPlayerForm && (
        <PlayerForm onClose={() => setShowPlayerForm(false)} />
      )}
    </div>
  )
}
