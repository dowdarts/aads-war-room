import { useState } from 'react'
import { useStats } from '../context/StatsContext.jsx'

const COLUMNS = [
  { key: 'rank',          label: '#',         title: 'Rank',               numeric: true,  sortKey: 'avg3da',        defaultDesc: true },
  { key: 'displayName',   label: 'Player',     title: 'Player Name',        numeric: false, sortKey: 'displayName',   defaultDesc: false },
  { key: 'province',      label: 'Prov',       title: 'Province',           numeric: false, sortKey: 'province',      defaultDesc: false },
  { key: 'eventsPlayed',  label: 'Evts',       title: 'Events Played',      numeric: true,  sortKey: 'eventsPlayed',  defaultDesc: true },
  { key: 'matches',       label: 'MP',         title: 'Matches Played',     numeric: true,  sortKey: 'matches',       defaultDesc: true },
  { key: 'wins',          label: 'W',          title: 'Wins',               numeric: true,  sortKey: 'wins',          defaultDesc: true },
  { key: 'losses',        label: 'L',          title: 'Losses',             numeric: true,  sortKey: 'losses',        defaultDesc: false },
  { key: 'winRate',       label: 'W%',         title: 'Win Rate %',         numeric: true,  sortKey: 'winRate',       defaultDesc: true },
  { key: 'avg3da',        label: '3DA',        title: '3-Dart Average',     numeric: true,  sortKey: 'avg3da',        defaultDesc: true },
  { key: 'best3da',       label: 'Best 3DA',   title: 'Best Single-Event 3DA', numeric: true, sortKey: 'best3da',    defaultDesc: true },
  { key: 'coPct',         label: 'CO%',        title: 'Checkout %',         numeric: true,  sortKey: 'coPct',         defaultDesc: true },
  { key: 'scores180',     label: '180s',       title: '180s Hit',           numeric: true,  sortKey: 'scores180',     defaultDesc: true },
  { key: 'scores140plus', label: '140+',       title: '140+ Scores',        numeric: true,  sortKey: 'scores140plus', defaultDesc: true },
  { key: 'scores100plus', label: '100+',       title: '100+ Scores',        numeric: true,  sortKey: 'scores100plus', defaultDesc: true },
  { key: 'highFinish',    label: 'Hi Fin',     title: 'Highest Finish',     numeric: true,  sortKey: 'highFinish',    defaultDesc: true },
]

const PROVINCE_COLORS = { NS: '#3b82f6', NB: '#22c55e', PE: '#f59e0b', NL: '#ec4899', ON: '#a855f7' }

function SortIcon({ dir }) {
  if (!dir) return <span className="text-gray-600 ml-0.5">⇅</span>
  return <span className="text-orange ml-0.5">{dir === 'desc' ? '↓' : '↑'}</span>
}

export default function PlayerStandings() {
  const { aggregatedStats, players } = useStats()
  const [sortKey, setSortKey] = useState('avg3da')
  const [sortDir, setSortDir] = useState('desc')
  const [filterProv, setFilterProv] = useState('ALL')
  const [search, setSearch] = useState('')

  const provMap = Object.fromEntries(players.map(p => [p.displayName, p.province]))
  const provinces = ['ALL', ...['NS', 'NB', 'PE', 'NL', 'ON'].filter(pr => players.some(p => p.province === pr))]

  // Base rows
  const rows = aggregatedStats.map(s => ({
    displayName:   s.displayName,
    province:      provMap[s.displayName] ?? '—',
    eventsPlayed:  s.totals.eventsPlayed,
    matches:       s.totals.matches,
    wins:          s.totals.wins,
    losses:        s.totals.losses,
    winRate:       s.totals.winRate,
    avg3da:        s.totals.avg3da,
    best3da:       s.totals.best3da,
    coPct:         s.totals.coPct,
    scores180:     s.totals.scores180,
    scores140plus: s.totals.scores140plus,
    scores100plus: s.totals.scores100plus,
    highFinish:    s.totals.highFinish,
  }))

  // Filter
  const filtered = rows.filter(r => {
    if (filterProv !== 'ALL' && r.province !== filterProv) return false
    if (search && !r.displayName.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey]; const bv = b[sortKey]
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortDir === 'desc' ? bv - av : av - bv
    }
    return sortDir === 'desc'
      ? String(bv).localeCompare(String(av))
      : String(av).localeCompare(String(bv))
  })

  function handleSort(col) {
    if (col.key === 'rank') return
    if (sortKey === col.sortKey) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(col.sortKey)
      setSortDir(col.defaultDesc ? 'desc' : 'asc')
    }
  }

  // Rank by 3DA for the # column (always global rank ignoring filter)
  const rankMap = Object.fromEntries(
    [...aggregatedStats].map((s, i) => [s.displayName, i + 1])
  )

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-black text-white tracking-tight">Player Standings</h1>
        <p className="text-gray-400 text-sm mt-1">All players ranked by 3-Dart Average across the series</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search player…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-[#111] border border-[#2a2a2a] rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange w-48"
        />
        <div className="flex gap-1">
          {provinces.map(pr => (
            <button
              key={pr}
              onClick={() => setFilterProv(pr)}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                filterProv === pr
                  ? 'bg-orange text-black'
                  : 'bg-[#1a1a1a] text-gray-400 hover:text-white hover:bg-[#222]'
              }`}
            >
              {pr}
            </button>
          ))}
        </div>
        <div className="ml-auto text-xs text-gray-500 self-center">{sorted.length} player{sorted.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-[#1a1a1a]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#0d0d0d] border-b border-[#1a1a1a]">
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  title={col.title}
                  onClick={() => handleSort(col)}
                  className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider select-none whitespace-nowrap
                    ${col.key === 'rank' ? 'text-gray-600 w-10 cursor-default' : 'text-gray-400 hover:text-white cursor-pointer'}
                    ${sortKey === col.sortKey && col.key !== 'rank' ? 'text-orange' : ''}
                  `}
                >
                  {col.label}
                  {col.key !== 'rank' && (
                    <SortIcon dir={sortKey === col.sortKey ? sortDir : null} />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="text-center py-10 text-gray-600">No players found</td>
              </tr>
            )}
            {sorted.map((row, i) => {
              const provColor = PROVINCE_COLORS[row.province] ?? '#6b7280'
              const isEven = i % 2 === 0
              return (
                <tr
                  key={row.displayName}
                  className={`border-b border-[#141414] transition-colors hover:bg-[#141414] ${isEven ? 'bg-[#0a0a0a]' : 'bg-[#080808]'}`}
                >
                  {/* Rank */}
                  <td className="px-3 py-2 text-gray-500 text-xs font-mono">{rankMap[row.displayName] ?? '—'}</td>
                  {/* Player */}
                  <td className="px-3 py-2 font-semibold text-white whitespace-nowrap">{row.displayName}</td>
                  {/* Province badge */}
                  <td className="px-3 py-2">
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                      style={{ background: provColor + '22', color: provColor, border: `1px solid ${provColor}44` }}
                    >
                      {row.province}
                    </span>
                  </td>
                  {/* Numeric stats */}
                  <td className="px-3 py-2 text-gray-300 text-center font-mono text-xs">{row.eventsPlayed}</td>
                  <td className="px-3 py-2 text-gray-300 text-center font-mono text-xs">{row.matches}</td>
                  <td className="px-3 py-2 text-green-400 text-center font-mono text-xs font-bold">{row.wins}</td>
                  <td className="px-3 py-2 text-red-400 text-center font-mono text-xs">{row.losses}</td>
                  <td className="px-3 py-2 text-center font-mono text-xs">
                    <span className={row.winRate >= 60 ? 'text-green-400 font-bold' : row.winRate >= 40 ? 'text-yellow-400' : 'text-red-400'}>
                      {row.winRate}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center font-mono text-xs">
                    <span className={`font-bold ${row.avg3da >= 70 ? 'text-orange' : row.avg3da >= 55 ? 'text-yellow-300' : 'text-gray-300'}`}>
                      {row.avg3da?.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-400 text-center font-mono text-xs">{row.best3da?.toFixed(2)}</td>
                  <td className="px-3 py-2 text-center font-mono text-xs">
                    <span className={row.coPct >= 50 ? 'text-green-400' : 'text-gray-400'}>
                      {row.coPct}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center font-mono text-xs">
                    <span className={row.scores180 > 0 ? 'text-orange font-bold' : 'text-gray-500'}>
                      {row.scores180}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-purple-400 text-center font-mono text-xs">{row.scores140plus}</td>
                  <td className="px-3 py-2 text-blue-400 text-center font-mono text-xs">{row.scores100plus}</td>
                  <td className="px-3 py-2 text-yellow-400 text-center font-mono text-xs font-bold">{row.highFinish || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-gray-600">
        <span><span className="text-orange font-bold">3DA ≥ 70</span> elite</span>
        <span><span className="text-yellow-300 font-bold">3DA ≥ 55</span> solid</span>
        <span><span className="text-green-400 font-bold">W%</span> win rate</span>
        <span><span className="text-orange font-bold">180s</span> max score</span>
        <span>Click column headers to sort</span>
      </div>
    </div>
  )
}
