import { useMemo, useState } from 'react'
import { useStats } from '../context/StatsContext.jsx'

const PROVINCES = [
  { id: 'NB', name: 'New Brunswick', abbr: 'NB', color: '#FFD700' },
  { id: 'NS', name: 'Nova Scotia', abbr: 'NS', color: '#003087' },
  { id: 'PE', name: 'Prince Edward Island', abbr: 'PE', color: '#EF3340' },
  { id: 'ON', name: 'Ontario', abbr: 'ON', color: '#009A44' },
  { id: 'NL', name: 'Newfoundland & Labrador', abbr: 'NL', color: '#00843D' },
]

function StatPill({ label, value }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-orange font-bold text-base">{value}</span>
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
    </div>
  )
}

function ProvinceCard({ province, players, onSelectPlayer }) {
  const [expanded, setExpanded] = useState(false)

  const sorted = useMemo(
    () => [...players].sort((a, b) =>
      (b.stats?.totals.avg3da ?? 0) - (a.stats?.totals.avg3da ?? 0)
    ),
    [players]
  )

  const totals = useMemo(() => {
    const matches = players.reduce((s, p) => s + (p.stats?.totals.matches ?? 0), 0)
    const wins = players.reduce((s, p) => s + (p.stats?.totals.wins ?? 0), 0)
    const avg3da = players.length
      ? players.reduce((s, p) => s + (p.stats?.totals.avg3da ?? 0), 0) / players.length
      : 0
    const s180 = players.reduce((s, p) => s + (p.stats?.totals.scores180 ?? 0), 0)
    return { matches, wins, winRate: matches ? Math.round((wins / matches) * 100) : 0, avg3da: avg3da.toFixed(1), s180 }
  }, [players])

  if (!players.length) return null

  return (
    <div
      className="bg-[#0f0f0f] border border-[#222] rounded-lg overflow-hidden
                 hover:border-orange/40 transition-colors"
    >
      {/* Province header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        style={{ borderLeft: `4px solid ${province.color}` }}
        onClick={() => setExpanded(e => !e)}
      >
        <div
          className="w-10 h-10 rounded font-black text-sm flex items-center justify-center shrink-0"
          style={{ background: province.color, color: '#000' }}
        >
          {province.abbr}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-sm">{province.name}</div>
          <div className="text-gray-500 text-xs">{players.length} player{players.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="grid grid-cols-4 gap-4 text-center mr-2">
          <StatPill label="Avg 3DA" value={totals.avg3da} />
          <StatPill label="Win %" value={`${totals.winRate}%`} />
          <StatPill label="Matches" value={totals.matches} />
          <StatPill label="180s" value={totals.s180} />
        </div>
        <span className="text-gray-600 text-sm ml-2">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Player rows */}
      {expanded && (
        <div className="border-t border-[#1a1a1a]">
          {sorted.map((player, i) => {
            const t = player.stats?.totals
            return (
              <div
                key={player.displayName}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-[#151515]
                           last:border-0 hover:bg-[#141414] transition-colors"
              >
                <span className="text-gray-600 text-xs w-5 text-right shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => onSelectPlayer?.(player.displayName)}
                    className="text-white text-sm font-medium truncate hover:text-orange
                               transition-colors text-left w-full"
                  >
                    {player.displayName}
                    {player.nickname && (
                      <span className="text-gray-500 text-xs ml-1.5">
                        "{player.nickname}"
                      </span>
                    )}
                  </button>
                  <div className="text-gray-500 text-xs truncate">{player.hometown}</div>
                </div>
                {t ? (
                  <div className="grid grid-cols-5 gap-3 text-center shrink-0">
                    <StatPill label="3DA" value={t.avg3da.toFixed(1)} />
                    <StatPill label="W" value={t.wins} />
                    <StatPill label="L" value={t.losses} />
                    <StatPill label="Win%" value={`${t.winRate}%`} />
                    <StatPill label="HF" value={t.highFinish} />
                  </div>
                ) : (
                  <span className="text-gray-600 text-xs">No stats yet</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function ProvinceLeaderboards({ onSelectPlayer }) {
  const { players, events } = useStats()

  const byProvince = useMemo(() => {
    const map = {}
    for (const p of PROVINCES) map[p.id] = []
    for (const player of players) {
      if (map[player.province]) map[player.province].push(player)
    }
    return map
  }, [players])

  const champions = useMemo(() =>
    events.map(e => ({
      id: e.metadata.event_id,
      name: e.metadata.event_name,
      champion: e.metadata.champion,
      date: e.metadata.date || e.metadata.event_date,
    })),
    [events]
  )

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      {/* Event champions banner */}
      {champions.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {champions.map(c => (
            <div
              key={c.id}
              className="shrink-0 bg-[#0f0f0f] border border-[#222] rounded-lg px-4 py-3
                         border-l-4 border-l-orange"
            >
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">
                {c.name}
              </div>
              <div className="text-orange font-bold text-sm">
                🏆 {c.champion ? c.champion.replace(',', '').split(' ').reverse().join(' ') : '—'}
              </div>
              {c.date && (
                <div className="text-gray-600 text-xs mt-0.5">{c.date}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Province cards */}
      <div className="space-y-3">
        {PROVINCES.map(province => (
          <ProvinceCard
            key={province.id}
            province={province}
            players={byProvince[province.id] || []}
            onSelectPlayer={onSelectPlayer}
          />
        ))}
      </div>
    </div>
  )
}
