import { useState, useMemo } from 'react'
import { useStats } from '../context/StatsContext.jsx'
import { jsonNameToDisplay } from '../utils/nameNormalizer.js'
import { getBaseUrl } from '../utils/baseUrl.js'

const PROVINCE_LABELS = {
  NB: 'New Brunswick', NS: 'Nova Scotia', PE: 'Prince Edward Island',
  ON: 'Ontario', NL: 'Newfoundland & Labrador',
}

const COMMENTARY_FIELDS = [
  ['achievements',       'Career Achievements'],
  ['strengths',          'Strengths as a Player'],
  ['improvements',       'Areas for Improvement'],
  ['dartSetup',          'Dart Setup'],
  ['practiceRoutine',    'Practice Routine'],
  ['checkouts',          'Favourite Checkout Routes'],
  ['currentForm',        'Current Form'],
  ['recentResults',      'Recent Results'],
  ['mentalApproach',     'Mental Approach'],
  ['pressureManagement', 'How They Handle Pressure'],
  ['stagePresence',      'Stage Presence'],
  ['preMatchRituals',    'Pre-Match Rituals'],
  ['hobbies',            'Life Outside Darts'],
  ['aadsMeaning',        'What AADS Means to Them'],
]

// ─── Small helpers ──────────────────────────────────────────────────────────

function StatBox({ label, value, accent }) {
  return (
    <div className={`bg-[#0a0a0a] border rounded-lg px-3 py-2 text-center
      ${accent ? 'border-orange/40' : 'border-[#1a1a1a]'}`}>
      <div className={`font-bold text-sm ${accent ? 'text-orange' : 'text-white'}`}>{value ?? '—'}</div>
      <div className="text-gray-500 text-[9px] uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  )
}

function BackButton({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-gray-500 hover:text-orange text-xs
                 uppercase tracking-widest font-semibold mb-5 transition-colors"
    >
      ← {label}
    </button>
  )
}

function StatusBadge({ event }) {
  const isUpcoming = event.metadata.status === 'upcoming' ||
    (event.metadata.champion === null && event.player_event_stats?.length === 0)
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider
      ${isUpcoming
        ? 'bg-orange/15 text-orange border border-orange/30'
        : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
      {isUpcoming ? 'Upcoming' : 'Completed'}
    </span>
  )
}

// ─── View 1: Events List ────────────────────────────────────────────────────

function EventsList({ allEvents, onSelect }) {
  const menEvents = allEvents.filter(e => (e.metadata.series_id ?? 1) === 1)
  const womenEvents = allEvents.filter(e => e.metadata.series_id === 2)

  const EventCard = ({ event }) => {
    const isUpcoming = event.metadata.status === 'upcoming' || !event.metadata.champion
    const playerCount = event.player_event_stats?.length ?? event.players_invited?.length ?? 0
    return (
      <button
        onClick={() => onSelect(event)}
        className="w-full text-left bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-5
                   hover:border-orange/40 transition-all duration-150 group"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="text-white font-bold text-base group-hover:text-orange transition-colors">
            {event.metadata.event_name}
          </div>
          <StatusBadge event={event} />
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>📅 {event.metadata.date}</span>
          <span>👤 {playerCount} player{playerCount !== 1 ? 's' : ''}</span>
          {event.metadata.champion && (
            <span className="text-orange font-semibold">🏆 {jsonNameToDisplay(event.metadata.champion)}</span>
          )}
        </div>
      </button>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="text-[10px] text-orange uppercase tracking-widest font-bold mb-1">Commentator Panel</div>
        <h1 className="text-3xl font-black text-white tracking-tight">Event Directory</h1>
        <p className="text-gray-500 text-sm mt-1">Select an event to view the full commentator brief</p>
      </div>

      {menEvents.length > 0 && (
        <div className="mb-8">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-3 flex items-center gap-2">
            <span className="h-px flex-1 bg-[#1a1a1a]" />
            Series 1 — Men's
            <span className="h-px flex-1 bg-[#1a1a1a]" />
          </div>
          <div className="grid gap-3">
            {menEvents.map(ev => <EventCard key={`${ev.metadata.series_id}-${ev.metadata.event_id}`} event={ev} />)}
          </div>
        </div>
      )}

      {womenEvents.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-3 flex items-center gap-2">
            <span className="h-px flex-1 bg-[#1a1a1a]" />
            Women's Invitational
            <span className="h-px flex-1 bg-[#1a1a1a]" />
          </div>
          <div className="grid gap-3">
            {womenEvents.map(ev => <EventCard key={`${ev.metadata.series_id}-${ev.metadata.event_id}`} event={ev} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── View 2: Event Detail ───────────────────────────────────────────────────

function EventDetail({ event, players, onBack, onSelectPlayer }) {
  const isUpcoming = event.metadata.status === 'upcoming' || !event.metadata.champion
  const [activeSection, setActiveSection] = useState('players')

  // Build sorted match schedule from all round-robin groups
  const allMatches = useMemo(() => {
    if (!event.round_robin?.matches) return []
    const groups = event.round_robin.matches
    const combined = [
      ...(groups.groupA || []).map(m => ({ ...m, group: 'A' })),
      ...(groups.groupB || []).map(m => ({ ...m, group: 'B' })),
    ]
    return combined.sort((a, b) => {
      if (!a.start_time) return 1
      if (!b.start_time) return -1
      return a.start_time.localeCompare(b.start_time)
    })
  }, [event])

  const knockoutStages = useMemo(() => {
    if (!event.knockout) return []
    const stages = []
    if (event.knockout.quarterFinals?.length) stages.push({ label: 'Quarter Finals', matches: event.knockout.quarterFinals })
    if (event.knockout.semiFinals?.length) stages.push({ label: 'Semi Finals', matches: event.knockout.semiFinals })
    if (event.knockout.final) stages.push({ label: 'Final', matches: [event.knockout.final] })
    return stages
  }, [event])

  const SECTIONS = [
    { id: 'players', label: 'Players' },
    ...(!isUpcoming ? [
      { id: 'standings', label: 'Standings' },
      { id: 'schedule', label: 'Schedule' },
      { id: 'knockout', label: 'Knockout' },
    ] : []),
  ]

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <BackButton label="All Events" onClick={onBack} />

      {/* Event header */}
      <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-2xl overflow-hidden mb-5">
        <div className="border-l-4 border-orange px-6 py-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">
                {event.metadata.series_id === 2 ? "Women's Invitational" : `Series ${event.metadata.series_id ?? 1}`}
              </div>
              <h1 className="text-2xl font-black text-white">{event.metadata.event_name}</h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-gray-400 text-sm">📅 {event.metadata.date}</span>
                <StatusBadge event={event} />
                {event.metadata.champion && (
                  <span className="text-orange font-bold text-sm">
                    🏆 Champion: {jsonNameToDisplay(event.metadata.champion)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 mb-5 overflow-x-auto scrollbar-hide">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`shrink-0 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors
              ${activeSection === s.id
                ? 'bg-orange text-black'
                : 'bg-[#1a1a1a] text-gray-400 hover:text-white'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Players section */}
      {activeSection === 'players' && (
        <PlayersSection
          event={event}
          players={players}
          isUpcoming={isUpcoming}
          onSelectPlayer={onSelectPlayer}
        />
      )}

      {/* Standings section */}
      {activeSection === 'standings' && event.round_robin?.standings && (
        <StandingsSection standings={event.round_robin.standings} />
      )}

      {/* Schedule section */}
      {activeSection === 'schedule' && (
        <ScheduleSection matches={allMatches} />
      )}

      {/* Knockout section */}
      {activeSection === 'knockout' && (
        <KnockoutSection stages={knockoutStages} />
      )}
    </div>
  )
}

function PlayersSection({ event, players, isUpcoming, onSelectPlayer }) {
  const playersByName = useMemo(() => {
    const map = new Map(players.map(p => [p.displayName.toLowerCase(), p]))
    return map
  }, [players])

  if (isUpcoming) {
    const invited = event.players_invited ?? []
    return (
      <div>
        <div className="text-[10px] text-orange uppercase tracking-widest font-bold mb-3">
          {invited.length} Players Invited
        </div>
        <div className="grid gap-2">
          {invited.map(name => {
            const profile = playersByName.get(name.toLowerCase())
            return (
              <div key={name}
                className={`flex items-center justify-between gap-3 bg-[#0f0f0f] border rounded-xl px-5 py-3
                  ${profile ? 'border-[#1f1f1f] hover:border-orange/40 cursor-pointer transition-colors' : 'border-[#151515] opacity-60'}`}
                onClick={() => profile && onSelectPlayer(name, null)}
              >
                <div className="flex items-center gap-3">
                  {profile ? (
                    <img
                      src={getBaseUrl() + profile.profileImage?.replace(/^\//, '')}
                      alt={name}
                      className="w-9 h-9 rounded-full object-cover border border-[#2a2a2a]"
                      onError={e => { e.target.src = getBaseUrl() + 'images/players/placeholder.svg' }}
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-gray-600 text-xs">?</div>
                  )}
                  <div>
                    <div className="text-white text-sm font-semibold">{name}</div>
                    {profile?.nickname && <div className="text-orange text-xs">"{profile.nickname}"</div>}
                    {profile && <div className="text-gray-500 text-xs">{profile.hometown} · {PROVINCE_LABELS[profile.province] ?? profile.province}</div>}
                  </div>
                </div>
                {profile
                  ? <span className="text-green-400 text-[10px] font-bold uppercase tracking-wider shrink-0">Profile ✓</span>
                  : <span className="text-gray-600 text-[10px] uppercase tracking-wider shrink-0">Awaiting Profile</span>
                }
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Completed event — players from player_event_stats
  const stats = event.player_event_stats ?? []
  return (
    <div>
      <div className="text-[10px] text-orange uppercase tracking-widest font-bold mb-3">
        {stats.length} Players
      </div>
      <div className="grid gap-2">
        {[...stats].sort((a, b) => (b.final_event_3da ?? 0) - (a.final_event_3da ?? 0)).map((s, i) => {
          const displayName = jsonNameToDisplay(s.name)
          const profile = playersByName.get(displayName.toLowerCase())
          return (
            <button
              key={s.name}
              onClick={() => onSelectPlayer(displayName, s)}
              className="flex items-center gap-3 bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl px-5 py-3
                         hover:border-orange/40 transition-colors text-left w-full"
            >
              <span className="text-gray-600 text-xs w-4 shrink-0">{i + 1}</span>
              {profile ? (
                <img
                  src={getBaseUrl() + profile.profileImage?.replace(/^\//, '')}
                  alt={displayName}
                  className="w-9 h-9 rounded-full object-cover border border-[#2a2a2a] shrink-0"
                  onError={e => { e.target.src = getBaseUrl() + 'images/players/placeholder.svg' }}
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-semibold">{displayName}</div>
                {profile?.nickname && <div className="text-orange text-xs">"{profile.nickname}"</div>}
              </div>
              <div className="text-right shrink-0">
                <div className="text-orange font-bold text-sm">{s.final_event_3da?.toFixed(2)}</div>
                <div className="text-gray-500 text-[10px] uppercase">3DA</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-white text-sm font-semibold">{s.wins}–{s.losses}</div>
                <div className="text-gray-500 text-[10px] uppercase">W–L</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StandingsSection({ standings }) {
  const groups = Object.entries(standings)
  return (
    <div className="grid md:grid-cols-2 gap-5">
      {groups.map(([groupKey, rows]) => (
        <div key={groupKey} className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#1a1a1a] text-[10px] text-orange uppercase tracking-widest font-bold">
            Group {groupKey.replace('group', '').toUpperCase()}
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-600 uppercase tracking-wider">
                <th className="text-left px-4 py-2">#</th>
                <th className="text-left px-4 py-2">Player</th>
                <th className="text-center px-2 py-2">MP</th>
                <th className="text-center px-2 py-2">W</th>
                <th className="text-center px-2 py-2">L</th>
                <th className="text-center px-2 py-2">Legs W</th>
                <th className="text-center px-2 py-2">Legs L</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.name} className="border-t border-[#111] hover:bg-[#141414]">
                  <td className="px-4 py-2 text-gray-500">{row.rank}</td>
                  <td className="px-4 py-2 text-white font-medium">{jsonNameToDisplay(row.name)}</td>
                  <td className="text-center px-2 py-2 text-gray-400">{row.matches_played}</td>
                  <td className="text-center px-2 py-2 text-green-400 font-bold">{row.matches_won}</td>
                  <td className="text-center px-2 py-2 text-red-400">{row.matches_lost}</td>
                  <td className="text-center px-2 py-2 text-gray-400">{row.legs_won}</td>
                  <td className="text-center px-2 py-2 text-gray-600">{row.legs_lost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

function ScheduleSection({ matches }) {
  if (!matches.length) return <p className="text-gray-500 text-sm">No match data available.</p>
  return (
    <div className="space-y-2">
      {matches.map((m, i) => {
        const p1Won = m.player1_legs > m.player2_legs
        const p2Won = m.player2_legs > m.player1_legs
        return (
          <div key={i} className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-[#111] border-b border-[#1a1a1a]">
              {m.start_time && <span className="text-orange text-xs font-bold tabular-nums">{m.start_time}</span>}
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Group {m.group}</span>
            </div>
            <div className="flex items-center px-4 py-3 gap-3">
              <div className={`flex-1 text-sm font-semibold ${p1Won ? 'text-orange' : 'text-gray-400'}`}>
                {jsonNameToDisplay(m.player1)}
              </div>
              <div className="text-center px-3">
                <div className="text-white font-black text-xl">{m.player1_legs} – {m.player2_legs}</div>
                {m.player1_details && (
                  <div className="text-[10px] text-gray-600 tabular-nums">
                    {m.player1_details.three_dart_avg?.toFixed(1)} &nbsp;vs&nbsp; {m.player2_details?.three_dart_avg?.toFixed(1)}
                  </div>
                )}
              </div>
              <div className={`flex-1 text-sm font-semibold text-right ${p2Won ? 'text-orange' : 'text-gray-400'}`}>
                {jsonNameToDisplay(m.player2)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function KnockoutSection({ stages }) {
  if (!stages.length) return <p className="text-gray-500 text-sm">No knockout data available.</p>
  return (
    <div className="space-y-6">
      {stages.map(stage => (
        <div key={stage.label}>
          <div className="text-[10px] text-orange uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
            <span className="h-px flex-1 bg-[#1a1a1a]" />
            {stage.label}
            <span className="h-px flex-1 bg-[#1a1a1a]" />
          </div>
          <div className="space-y-2">
            {stage.matches.map((m, i) => {
              const p1Won = (m.player1_legs ?? 0) > (m.player2_legs ?? 0)
              const p2Won = (m.player2_legs ?? 0) > (m.player1_legs ?? 0)
              return (
                <div key={i} className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl overflow-hidden">
                  {m.match_id && (
                    <div className="px-4 py-1.5 bg-[#111] border-b border-[#1a1a1a]">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{m.match_id}</span>
                    </div>
                  )}
                  <div className="flex items-center px-4 py-3 gap-3">
                    <div className={`flex-1 text-sm font-semibold ${p1Won ? 'text-orange' : 'text-gray-400'}`}>
                      {jsonNameToDisplay(m.player1 ?? '—')}
                    </div>
                    <div className="text-center px-3">
                      <div className="text-white font-black text-xl">
                        {m.player1_legs ?? '?'} – {m.player2_legs ?? '?'}
                      </div>
                    </div>
                    <div className={`flex-1 text-sm font-semibold text-right ${p2Won ? 'text-orange' : 'text-gray-400'}`}>
                      {jsonNameToDisplay(m.player2 ?? '—')}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── View 3: Player Cheat Sheet ─────────────────────────────────────────────

function PlayerCheatSheet({ playerName, eventStats, players, event, onBack }) {
  const player = useMemo(
    () => players.find(p => p.displayName.toLowerCase() === playerName.toLowerCase()),
    [players, playerName]
  )
  const t = player?.stats?.totals

  if (!player) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <BackButton label="Back to Event" onClick={onBack} />
        <p className="text-gray-500">No profile found for {playerName}.</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <BackButton label="Back to Event" onClick={onBack} />

      {/* Hero card */}
      <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-2xl overflow-hidden mb-5">
        <div className="border-l-4 border-orange px-6 py-5 flex items-start gap-5">
          <img
            src={getBaseUrl() + (player.profileImage?.replace(/^\//, '') || 'images/players/placeholder.svg')}
            alt={player.displayName}
            className="w-28 h-28 rounded-full object-cover border-2 border-[#2a2a2a] shrink-0"
            onError={e => { e.target.src = getBaseUrl() + 'images/players/placeholder.svg' }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-white text-3xl font-black tracking-tight leading-tight">
              {player.displayName}
            </div>
            {player.nickname && (
              <div className="text-orange text-base font-bold mt-0.5">"{player.nickname}"</div>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className="bg-orange/10 border border-orange/30 text-orange text-xs font-bold px-2.5 py-0.5 rounded-full">
                {player.province}
              </span>
              {player.hometown && <span className="text-gray-500 text-sm">{player.hometown}</span>}
              {player.age && <span className="text-gray-600 text-sm">Age {player.age}</span>}
              {player.yearsPlaying && <span className="text-gray-600 text-sm">{player.yearsPlaying} yrs playing</span>}
            </div>
            <div className="text-gray-500 text-sm mt-1">{PROVINCE_LABELS[player.province] ?? player.province}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Event stats */}
        {eventStats && (
          <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-2xl p-4">
            <div className="text-[10px] text-orange uppercase tracking-widest font-bold mb-3 pb-2 border-b border-[#1a1a1a]">
              {event?.metadata.event_name} — Stats
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatBox label="3DA" value={eventStats.final_event_3da?.toFixed(2)} accent />
              <StatBox label="W–L" value={`${eventStats.wins}–${eventStats.losses}`} />
              <StatBox label="Matches" value={eventStats.total_matches} />
              <StatBox label="180s" value={eventStats.scores_180} accent />
              <StatBox label="140+" value={eventStats.scores_140plus} />
              <StatBox label="100+" value={eventStats.scores_100plus} />
              <StatBox label="CO%" value={eventStats.co_pct != null ? `${eventStats.co_pct}%` : null} accent />
              <StatBox label="CO Hit" value={eventStats.co_completed != null ? `${eventStats.co_completed}/${eventStats.co_opportunities}` : null} />
              <StatBox label="High Fin" value={eventStats.high_finish || null} />
            </div>
          </div>
        )}

        {/* Career stats */}
        {t && (
          <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-2xl p-4">
            <div className="text-[10px] text-orange uppercase tracking-widest font-bold mb-3 pb-2 border-b border-[#1a1a1a]">
              Career Stats
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatBox label="Avg 3DA" value={t.avg3da?.toFixed(2)} accent />
              <StatBox label="Best 3DA" value={t.best3da?.toFixed(2)} />
              <StatBox label="Win Rate" value={`${t.winRate}%`} accent />
              <StatBox label="W–L" value={`${t.wins}–${t.losses}`} />
              <StatBox label="Events" value={t.eventsPlayed} />
              <StatBox label="CO%" value={`${t.coPct}%`} />
              <StatBox label="180s" value={t.scores180} accent />
              <StatBox label="140+" value={t.scores140plus} />
              <StatBox label="High Fin" value={t.highFinish} />
            </div>
          </div>
        )}
      </div>

      {/* Commentary Q&A */}
      <div className="space-y-3">
        <div className="text-[10px] text-orange uppercase tracking-widest font-bold flex items-center gap-2">
          <span className="h-px flex-1 bg-[#1a1a1a]" />
          Commentary Brief
          <span className="h-px flex-1 bg-[#1a1a1a]" />
        </div>
        {COMMENTARY_FIELDS.map(([field, label]) => {
          const val = player[field]
          if (!val) return null
          return (
            <div key={field} className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl px-5 py-4">
              <div className="text-[10px] text-orange uppercase tracking-widest font-bold mb-1.5">{label}</div>
              <div className="text-gray-300 text-sm leading-relaxed">{val}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Root component ──────────────────────────────────────────────────────────

export default function Commentator() {
  const { players, allEvents } = useStats()
  const [view, setView] = useState('events')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [selectedPlayerName, setSelectedPlayerName] = useState(null)
  const [selectedEventStats, setSelectedEventStats] = useState(null)

  function handleSelectEvent(event) {
    setSelectedEvent(event)
    setView('event-detail')
  }

  function handleSelectPlayer(name, stats) {
    setSelectedPlayerName(name)
    setSelectedEventStats(stats)
    setView('player-detail')
  }

  function handleBackToEvents() {
    setSelectedEvent(null)
    setView('events')
  }

  function handleBackToEvent() {
    setSelectedPlayerName(null)
    setSelectedEventStats(null)
    setView('event-detail')
  }

  if (view === 'events') {
    return <EventsList allEvents={allEvents} onSelect={handleSelectEvent} />
  }

  if (view === 'event-detail' && selectedEvent) {
    return (
      <EventDetail
        event={selectedEvent}
        players={players}
        onBack={handleBackToEvents}
        onSelectPlayer={handleSelectPlayer}
      />
    )
  }

  if (view === 'player-detail' && selectedPlayerName) {
    return (
      <PlayerCheatSheet
        playerName={selectedPlayerName}
        eventStats={selectedEventStats}
        players={players}
        event={selectedEvent}
        onBack={handleBackToEvent}
      />
    )
  }

  return null
}
