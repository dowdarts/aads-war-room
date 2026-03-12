import { useState } from 'react'
import { useStats } from '../context/StatsContext.jsx'

/**
 * Province Weighted Standings
 *
 * Province Score (0–100) composite:
 *   40% — Average 3-Dart Average (normalised to series max)
 *   25% — Average Win Rate %
 *   20% — Average Checkout %
 *   10% — 180s per match played
 *    5% — Highest individual finish rep (normalised)
 */

const PROVINCE_META = {
  NS: { label: 'Nova Scotia',      color: '#3b82f6' },
  NB: { label: 'New Brunswick',    color: '#22c55e' },
  PE: { label: 'Prince Edward Island', color: '#f59e0b' },
  NL: { label: 'Newfoundland & Labrador', color: '#ec4899' },
  ON: { label: 'Ontario',          color: '#a855f7' },
}

const STAT_COLS = [
  { key: 'score',        label: 'Score',       title: 'Weighted Province Score (0–100)' },
  { key: 'playerCount',  label: 'Players',     title: 'Number of players' },
  { key: 'avg3da',       label: 'Avg 3DA',     title: 'Average 3-Dart Average' },
  { key: 'avgWinRate',   label: 'Avg W%',      title: 'Average Win Rate' },
  { key: 'avgCoPct',     label: 'Avg CO%',     title: 'Average Checkout %' },
  { key: 'total180s',    label: '180s',        title: 'Total 180s across all players' },
  { key: '180sPerMatch', label: '180s/MP',     title: '180s per match played' },
  { key: 'totalMatches', label: 'Total MP',    title: 'Total matches played' },
  { key: 'totalWins',    label: 'Total W',     title: 'Total wins' },
  { key: 'bestPlayer',   label: 'Top Player',  title: 'Highest 3DA player in province' },
  { key: 'bestAvg',      label: 'Top 3DA',     title: 'Highest individual 3DA' },
  { key: 'highFinish',   label: 'Hi Fin',      title: 'Highest individual finish' },
]

function ScoreBar({ score, color }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-[#1a1a1a] rounded-full overflow-hidden" style={{ minWidth: 80 }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="font-black text-sm tabular-nums" style={{ color }}>{score.toFixed(1)}</span>
    </div>
  )
}

function ScoreBreakdown({ row }) {
  const components = [
    { label: '3DA component (40%)',    value: row._c3da?.toFixed(1),  color: '#FF6600' },
    { label: 'Win Rate component (25%)', value: row._cWin?.toFixed(1), color: '#22c55e' },
    { label: 'CO% component (20%)',    value: row._cCo?.toFixed(1),   color: '#3b82f6' },
    { label: '180s/MP component (10%)',value: row._c180?.toFixed(1),  color: '#ec4899' },
    { label: 'High Fin component (5%)',value: row._cHF?.toFixed(1),   color: '#f59e0b' },
  ]
  return (
    <div className="text-xs text-gray-400 space-y-1 pt-1">
      {components.map(c => (
        <div key={c.label} className="flex justify-between gap-4">
          <span>{c.label}</span>
          <span className="font-mono font-bold" style={{ color: c.color }}>{c.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function ProvinceWeightedStandings() {
  const { aggregatedStats, players } = useStats()
  const [expandedProv, setExpandedProv] = useState(null)
  const [sortKey, setSortKey] = useState('score')
  const [sortDir, setSortDir] = useState('desc')

  // Build per-province aggregates
  const provData = {}
  for (const s of aggregatedStats) {
    const player = players.find(p => p.displayName === s.displayName)
    const pr = player?.province
    if (!pr || !PROVINCE_META[pr]) continue
    if (!provData[pr]) {
      provData[pr] = {
        province: pr,
        players: [],
        sum3da: 0, sumWinRate: 0, sumCoPct: 0,
        total180s: 0, totalMatches: 0, totalWins: 0, highFinish: 0,
      }
    }
    const d = provData[pr]
    d.players.push({ displayName: s.displayName, avg3da: s.totals.avg3da, winRate: s.totals.winRate })
    if (s.totals.matches > 0) {
      d.sum3da += s.totals.avg3da
      d.sumWinRate += s.totals.winRate
      d.sumCoPct += s.totals.coPct
    }
    d.total180s += s.totals.scores180
    d.totalMatches += s.totals.matches
    d.totalWins += s.totals.wins
    d.highFinish = Math.max(d.highFinish, s.totals.highFinish)
  }

  const rows = Object.values(provData).map(d => {
    const n = d.players.length
    const avg3da = n > 0 ? d.sum3da / n : 0
    const avgWinRate = n > 0 ? Math.round(d.sumWinRate / n * 10) / 10 : 0
    const avgCoPct = n > 0 ? Math.round(d.sumCoPct / n * 10) / 10 : 0
    const per180 = d.totalMatches > 0 ? d.total180s / d.totalMatches : 0
    const bestPlayer = [...d.players].sort((a, b) => b.avg3da - a.avg3da)[0]
    return {
      province: d.province,
      playerCount: n,
      avg3da: Math.round(avg3da * 100) / 100,
      avgWinRate,
      avgCoPct,
      total180s: d.total180s,
      '180sPerMatch': Math.round(per180 * 1000) / 1000,
      totalMatches: d.totalMatches,
      totalWins: d.totalWins,
      highFinish: d.highFinish,
      bestPlayer: bestPlayer?.displayName ?? '—',
      bestAvg: bestPlayer?.avg3da?.toFixed(2) ?? '—',
      players: d.players,
      // raw components for breakdown
      _avg3da: avg3da, _avgWinRate: avgWinRate, _avgCoPct: avgCoPct,
      _per180: per180, _highFinish: d.highFinish,
    }
  })

  // Normalise to compute weighted score
  const max3da = Math.max(...rows.map(r => r._avg3da), 1)
  const maxHF  = Math.max(...rows.map(r => r._highFinish), 1)
  const max180 = Math.max(...rows.map(r => r._per180), 0.0001)
  const scored = rows.map(r => {
    const c3da = (r._avg3da / max3da) * 40
    const cWin = (r._avgWinRate / 100) * 25
    const cCo  = (r._avgCoPct / 100) * 20
    const c180 = (r._per180 / max180) * 10
    const cHF  = (r._highFinish / maxHF) * 5
    return { ...r, score: Math.round((c3da + cWin + cCo + c180 + cHF) * 10) / 10, _c3da: c3da, _cWin: cWin, _cCo: cCo, _c180: c180, _cHF: cHF }
  })

  const sorted = [...scored].sort((a, b) => {
    const av = a[sortKey]; const bv = b[sortKey]
    if (typeof av === 'number' && typeof bv === 'number')
      return sortDir === 'desc' ? bv - av : av - bv
    return sortDir === 'desc'
      ? String(bv).localeCompare(String(av))
      : String(av).localeCompare(String(bv))
  })

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const topScore = Math.max(...scored.map(r => r.score))

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-black text-white tracking-tight">Province Weighted Standings</h1>
        <p className="text-gray-400 text-sm mt-1">
          Composite province score — 3DA (40%) · Win Rate (25%) · Checkout % (20%) · 180s/Match (10%) · High Finish (5%)
        </p>
      </div>

      {/* Province cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {[...scored].sort((a, b) => b.score - a.score).map((r, i) => {
          const meta = PROVINCE_META[r.province]
          const isFirst = i === 0
          return (
            <div
              key={r.province}
              className={`rounded-lg p-3 border cursor-pointer transition-all ${
                expandedProv === r.province
                  ? 'border-orange bg-[#1a1000]'
                  : 'border-[#1a1a1a] bg-[#0d0d0d] hover:border-[#333]'
              }`}
              onClick={() => setExpandedProv(v => v === r.province ? null : r.province)}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: meta.color }}>{r.province}</div>
                  <div className="text-[10px] text-gray-500">{r.playerCount} players</div>
                </div>
                {isFirst && <span className="text-[10px] bg-orange/20 text-orange px-1.5 py-0.5 rounded font-bold">🏆 #1</span>}
                {i > 0 && <span className="text-[10px] text-gray-600 font-mono">#{i + 1}</span>}
              </div>
              <div className="font-black text-2xl tabular-nums" style={{ color: meta.color }}>{r.score.toFixed(1)}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">3DA: {r.avg3da.toFixed(2)} · W%: {r.avgWinRate}%</div>
              <div className="mt-2 h-1 rounded-full overflow-hidden bg-[#1a1a1a]">
                <div className="h-full rounded-full" style={{ width: `${(r.score / topScore) * 100}%`, background: meta.color }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Expanded player breakdown */}
      {expandedProv && (() => {
        const pr = scored.find(r => r.province === expandedProv)
        const meta = PROVINCE_META[expandedProv]
        const provPlayers = [...pr.players].sort((a, b) => b.avg3da - a.avg3da)
        return (
          <div className="mb-6 rounded-lg border p-4" style={{ borderColor: meta.color + '44', background: meta.color + '08' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm" style={{ color: meta.color }}>{meta.label} — Score breakdown</h2>
              <button onClick={() => setExpandedProv(null)} className="text-gray-500 hover:text-white text-xs">✕ close</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ScoreBreakdown row={pr} />
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Players</div>
                {provPlayers.map((p, i) => (
                  <div key={p.displayName} className="flex justify-between text-xs py-0.5">
                    <span className="text-gray-300">{i + 1}. {p.displayName}</span>
                    <span className="font-mono text-gray-400">{p.avg3da?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Detailed comparison table */}
      <div className="overflow-x-auto rounded-lg border border-[#1a1a1a]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#0d0d0d] border-b border-[#1a1a1a]">
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Province</th>
              {STAT_COLS.map(col => (
                <th
                  key={col.key}
                  title={col.title}
                  onClick={() => handleSort(col.key)}
                  className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap text-center
                    ${sortKey === col.key ? 'text-orange' : 'text-gray-400 hover:text-white'}
                  `}
                >
                  {col.label}
                  <span className="ml-0.5">{sortKey === col.key ? (sortDir === 'desc' ? '↓' : '↑') : '⇅'}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const meta = PROVINCE_META[row.province]
              return (
                <tr
                  key={row.province}
                  className={`border-b border-[#141414] transition-colors hover:bg-[#141414] cursor-pointer ${i % 2 === 0 ? 'bg-[#0a0a0a]' : 'bg-[#080808]'}`}
                  onClick={() => setExpandedProv(v => v === row.province ? null : row.province)}
                >
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="w-1 h-6 rounded-full inline-block" style={{ background: meta.color }} />
                      <div>
                        <div className="font-bold text-white text-xs">{row.province}</div>
                        <div className="text-[10px] text-gray-500">{meta.label}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 min-w-[160px]">
                    <ScoreBar score={row.score} color={meta.color} />
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-300 font-mono text-xs">{row.playerCount}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-xs font-bold" style={{ color: meta.color }}>{row.avg3da.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-xs text-green-400">{row.avgWinRate}%</td>
                  <td className="px-3 py-2.5 text-center font-mono text-xs text-blue-400">{row.avgCoPct}%</td>
                  <td className="px-3 py-2.5 text-center font-mono text-xs text-orange font-bold">{row.total180s}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-xs text-purple-400">{row['180sPerMatch'].toFixed(3)}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-xs text-gray-400">{row.totalMatches}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-xs text-green-400 font-bold">{row.totalWins}</td>
                  <td className="px-3 py-2.5 text-gray-200 text-xs whitespace-nowrap">{row.bestPlayer}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-xs" style={{ color: meta.color }}>{row.bestAvg}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-xs text-yellow-400 font-bold">{row.highFinish || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Score formula note */}
      <div className="mt-4 p-3 rounded bg-[#0d0d0d] border border-[#1a1a1a] text-[10px] text-gray-500 leading-relaxed">
        <span className="text-gray-400 font-semibold">Score formula: </span>
        (Avg 3DA / series-max × 40) + (Avg Win% / 100 × 25) + (Avg CO% / 100 × 20) + (180s per match / province-max × 10) + (High Finish / series-max × 5)
        · Click a row or card to expand player details.
      </div>
    </div>
  )
}
