import { useState, useMemo } from 'react'
import { useStats } from '../context/StatsContext.jsx'
import { getH2H } from '../utils/eventAggregator.js'

function MatchRecord({ match, playerA, playerB }) {
  const isA1 = match.player1.toLowerCase() === playerA.toLowerCase()
  const p1 = isA1 ? match.player1 : match.player2
  const p2 = isA1 ? match.player2 : match.player1
  const p1legs = isA1 ? match.player1_legs : match.player2_legs
  const p2legs = isA1 ? match.player2_legs : match.player1_legs
  const p1det = isA1 ? match.player1_details : match.player2_details
  const p2det = isA1 ? match.player2_details : match.player1_details

  const aWon = p1legs > p2legs
  const bWon = p2legs > p1legs

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg overflow-hidden mb-3">
      {/* Match header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#111] border-b border-[#1a1a1a]">
        <span className="text-[10px] text-gray-500 uppercase tracking-widest">
          Event {match.eventId} — {match.stage}
        </span>
      </div>

      {/* Score row */}
      <div className="flex items-center px-4 py-3">
        <div className={`flex-1 text-sm font-semibold ${aWon ? 'text-orange' : 'text-gray-400'}`}>
          {p1}
        </div>
        <div className="px-4 text-center">
          <div className={`text-2xl font-black tracking-tight ${aWon ? 'text-orange' : bWon ? 'text-white' : 'text-gray-300'}`}>
            {p1legs} – {p2legs}
          </div>
          <div className="text-[10px] text-gray-600 uppercase">
            {aWon ? `${p1.split(' ')[0]} wins` : bWon ? `${p2.split(' ')[0]} wins` : 'Draw'}
          </div>
        </div>
        <div className={`flex-1 text-sm font-semibold text-right ${bWon ? 'text-orange' : 'text-gray-400'}`}>
          {p2}
        </div>
      </div>

      {/* Stat comparison */}
      {(p1det || p2det) && (
        <div className="border-t border-[#1a1a1a]">
          {[
            ['3-Dart Avg', p1det?.three_dart_avg?.toFixed(1), p2det?.three_dart_avg?.toFixed(1)],
            ['Checkout %', p1det?.co_pct ? `${p1det.co_pct}%` : null, p2det?.co_pct ? `${p2det.co_pct}%` : null],
            ['180s', p1det?.scores_180, p2det?.scores_180],
            ['High Finish', p1det?.high_finish || '—', p2det?.high_finish || '—'],
          ].map(([label, v1, v2]) => (
            <div key={label} className="flex items-center px-4 py-1.5 border-b border-[#111] last:border-0">
              <span className={`flex-1 text-xs font-semibold ${aWon ? 'text-orange/80' : 'text-gray-500'}`}>
                {v1 ?? '—'}
              </span>
              <span className="text-[10px] text-gray-600 uppercase tracking-wider w-28 text-center">
                {label}
              </span>
              <span className={`flex-1 text-xs font-semibold text-right ${bWon ? 'text-orange/80' : 'text-gray-500'}`}>
                {v2 ?? '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function H2HComparison() {
  const { players, h2hIndex, csvNames } = useStats()
  const [playerA, setPlayerA] = useState('')
  const [playerB, setPlayerB] = useState('')

  const sortedNames = useMemo(
    () => [...csvNames].sort(),
    [csvNames]
  )

  const matches = useMemo(() => {
    if (!playerA || !playerB || playerA === playerB) return []
    return getH2H(h2hIndex, playerA, playerB)
  }, [h2hIndex, playerA, playerB])

  // Compute aggregate for selected players
  const summary = useMemo(() => {
    if (!matches.length || !playerA || !playerB) return null
    let aWins = 0, bWins = 0
    let a3daSum = 0, b3daSum = 0, count = 0
    for (const m of matches) {
      const aIsP1 = m.player1.toLowerCase() === playerA.toLowerCase()
      const aLegs = aIsP1 ? m.player1_legs : m.player2_legs
      const bLegs = aIsP1 ? m.player2_legs : m.player1_legs
      if (aLegs > bLegs) aWins++
      else if (bLegs > aLegs) bWins++
      const adet = aIsP1 ? m.player1_details : m.player2_details
      const bdet = aIsP1 ? m.player2_details : m.player1_details
      if (adet?.three_dart_avg) { a3daSum += adet.three_dart_avg; count++ }
      if (bdet?.three_dart_avg) b3daSum += bdet.three_dart_avg
    }
    return {
      aWins, bWins, draws: matches.length - aWins - bWins,
      a3da: count ? (a3daSum / count).toFixed(1) : '—',
      b3da: count ? (b3daSum / count).toFixed(1) : '—',
    }
  }, [matches, playerA, playerB])

  return (
    <div className="p-4 max-w-3xl mx-auto">
      {/* Selectors */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1">
          <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Player A</label>
          <select
            value={playerA}
            onChange={e => setPlayerA(e.target.value)}
            className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-3 py-2
                       text-white text-sm focus:outline-none focus:border-orange"
          >
            <option value="">Select player…</option>
            {sortedNames.filter(n => n !== playerB).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end pb-2 text-gray-600 font-black text-xl">VS</div>
        <div className="flex-1">
          <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Player B</label>
          <select
            value={playerB}
            onChange={e => setPlayerB(e.target.value)}
            className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-3 py-2
                       text-white text-sm focus:outline-none focus:border-orange"
          >
            <option value="">Select player…</option>
            {sortedNames.filter(n => n !== playerA).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary banner */}
      {summary && (
        <div className="bg-[#0f0f0f] border border-[#222] rounded-xl px-6 py-4 mb-6
                        flex items-center gap-6 border-l-4 border-l-orange">
          <div className="flex-1 text-center">
            <div className="text-orange font-black text-4xl">{summary.aWins}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mt-0.5">
              {playerA.split(' ')[0]} wins
            </div>
            <div className="text-gray-400 text-sm mt-1">Avg 3DA: {summary.a3da}</div>
          </div>
          <div className="text-center">
            <div className="text-gray-600 text-sm">{matches.length} meeting{matches.length !== 1 ? 's' : ''}</div>
            {summary.draws > 0 && (
              <div className="text-gray-500 text-xs mt-1">{summary.draws} draw{summary.draws !== 1 ? 's' : ''}</div>
            )}
          </div>
          <div className="flex-1 text-center">
            <div className="text-white font-black text-4xl">{summary.bWins}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mt-0.5">
              {playerB.split(' ')[0]} wins
            </div>
            <div className="text-gray-400 text-sm mt-1">Avg 3DA: {summary.b3da}</div>
          </div>
        </div>
      )}

      {/* Match-by-match */}
      {matches.map((m, i) => (
        <MatchRecord key={i} match={m} playerA={playerA} playerB={playerB} />
      ))}

      {playerA && playerB && !matches.length && (
        <div className="text-center text-gray-600 py-12">
          No recorded matches between {playerA} and {playerB}.
        </div>
      )}

      {(!playerA || !playerB) && (
        <div className="text-center text-gray-700 py-12">
          Select two players to view their head-to-head record.
        </div>
      )}
    </div>
  )
}
