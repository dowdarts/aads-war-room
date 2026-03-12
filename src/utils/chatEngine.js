import { nameKey } from './nameNormalizer.js'

function nk(s) { return s.toLowerCase().replace(/\s+/g, ' ').trim() }

function getLevenshteinDistance(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) matrix[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost)
    }
  }
  return matrix[a.length][b.length]
}

function findFuzzyPlayer(text, players) {
  const q = nk(text)
  let bestMatch = null
  let minDistance = 4
  for (const p of players) {
    const dn = nk(p.displayName)
    // Also check word-by-word: match first or last name with fuzzy
    const words = q.split(' ')
    const pWords = dn.split(' ')
    for (const pw of pWords) {
      if (pw.length < 4) continue
      for (const w of words) {
        if (w.length < 3) continue
        const d = getLevenshteinDistance(w, pw)
        if (d < minDistance) { minDistance = d; bestMatch = p.displayName }
      }
    }
    const d = getLevenshteinDistance(q, dn)
    if (d < minDistance) { minDistance = d; bestMatch = p.displayName }
  }
  return bestMatch
}

function findPlayer(text, players) {
  const q = nk(text)
  for (const p of players) {
    if (q.includes(nk(p.displayName))) return p.displayName
  }
  for (const p of players) {
    const last = p.displayName.toLowerCase().split(' ').pop()
    if (last.length >= 4 && new RegExp(`\\b${last}\\b`, 'i').test(q)) return p.displayName
  }
  for (const p of players) {
    const first = p.displayName.toLowerCase().split(' ')[0]
    if (first.length >= 5 && new RegExp(`\\b${first}\\b`, 'i').test(q)) return p.displayName
  }
  // Fuzzy fallback
  return findFuzzyPlayer(text, players)
}

function findTwoPlayers(text, players) {
  const q = nk(text)
  const found = []
  for (const p of players) {
    if (found.length === 2) break
    if (found.includes(p.displayName)) continue
    const dn = nk(p.displayName)
    const last = dn.split(' ').pop()
    const first = dn.split(' ')[0]
    if (
      q.includes(dn) ||
      (last.length >= 4 && new RegExp(`\\b${last}\\b`, 'i').test(q)) ||
      (first.length >= 5 && new RegExp(`\\b${first}\\b`, 'i').test(q))
    ) found.push(p.displayName)
  }
  return found
}

const STAT_LABELS = {
  avg3da:        '3-Dart Average',
  best3da:       'Best Single-Event 3DA',
  winRate:       'Win Rate',
  wins:          'Total Wins',
  matches:       'Matches Played',
  scores180:     '180s',
  scores140plus: '140+ Scores',
  scores100plus: '100+ Scores',
  coPct:         'Checkout %',
  highFinish:    'High Finish',
  eventsPlayed:  'Events Played',
}

function statLabel(k) { return STAT_LABELS[k] || k }

function fv(key, val) {
  if (val == null) return '—'
  if (key === 'winRate' || key === 'coPct') return `${val}%`
  if (key === 'avg3da' || key === 'best3da') return Number(val).toFixed(2)
  return String(val)
}

function detectStat(q) {
  if (/3.?da|3.dart|three.?dart|\baverage\b|\bavg\b/i.test(q)) return 'avg3da'
  if (/\b180\b/i.test(q)) return 'scores180'
  if (/checkout|co.?pct|double.out/i.test(q)) return 'coPct'
  if (/high.?finish|best.?finish/i.test(q)) return 'highFinish'
  if (/win.rate|win.?%/i.test(q)) return 'winRate'
  if (/most.wins|total.wins|\bwins\b/i.test(q)) return 'wins'
  if (/\bmatches\b|\bplayed\b/i.test(q)) return 'matches'
  if (/\b140\b/i.test(q)) return 'scores140plus'
  if (/\b100\b/i.test(q)) return 'scores100plus'
  if (/best.3da|best.event/i.test(q)) return 'best3da'
  return null
}

function detectProvince(q) {
  if (/\bns\b|nova.?scotia/i.test(q)) return 'NS'
  if (/\bnb\b|new.?brunswick/i.test(q)) return 'NB'
  if (/\bpei?\b|prince.?edward/i.test(q)) return 'PE'
  if (/\bnl\b|newfoundland|labrador/i.test(q)) return 'NL'
  if (/\bon\b|ontario/i.test(q)) return 'ON'
  return null
}

function detectEventNum(q) {
  const m = q.match(/event\s*#?\s*(\d+)|event\s+(one|two|three|four|five)/i)
  if (!m) return null
  if (m[1]) return parseInt(m[1])
  return { one: 1, two: 2, three: 3, four: 4, five: 5 }[m[2].toLowerCase()] ?? null
}

function extractN(q) {
  const m = q.match(/top\s*(\d+)|best\s*(\d+)|bottom\s*(\d+)|worst\s*(\d+)|(\d+)\s*(?:players?|best|worst)/i)
  return m ? parseInt(m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5]) : null
}

export function answerQuery(rawText, { aggregatedStats, players, events, h2hIndex }) {
  const q = rawText.trim()
  const ql = q.toLowerCase()

  // ── Help ──────────────────────────────────────────────────────────────────
  if (/\bhelp\b|what can you|commands|topics/i.test(ql)) {
    return { text: `Here's what I can answer:\n\n**Player Stats**\n• "Who has the highest 3-dart average?"\n• "Top 5 by win rate"\n• "What's Tom Holden's 180s?"\n\n**Comparison**\n• "Compare Tom and Ricky"\n• "Tom stats vs Ricky"\n\n**Filtered Rankings**\n• "Best 3DA with at least 10 matches"\n• "Top 5 win rate minimum 5 matches"\n\n**Current Form**\n• "Who is in form?"\n• "Hot player / trending"\n\n**Head to Head**\n• "Tom vs Ricky"\n\n**Provinces**\n• "Who are the players from NS?"\n• "NB leaderboard"\n\n**Events**\n• "Who won Event 1?"\n• "Show all champions"\n\n**Format & Rules**\n• "What's the entry fee?"\n• "How does the format work?"\n\n**Series Info**\n• "How many players?"\n• "List all events"` }
  }

  // ── Rules / Format / Fees ───────────────────────────────────────────────────
  if (/\brules\b|\bfee\b|\bpayout\b|\bformat\b|entry.*cost|how.*much|prize/i.test(ql)) {
    return { text: `**AADS Official Format:**\n• **Entry Fee:** $30 (100% Payout)\n• **Stage 1:** Round Robin groups\n• **Stage 2:** Knockout Bracket (Set Play)\n• **TOC:** Winners of Events 1-6 qualify automatically\n\nFor full rules and policies, check the **Policy Docs** tab.` }
  }

  // ── Count players ─────────────────────────────────────────────────────────
  if (/how many players|total players|number of players/i.test(ql)) {
    return { text: `There are **${players.length} players** registered in the AADS series.` }
  }

  // ── Count / list events ───────────────────────────────────────────────────
  if (/how many events|list.*event|all events|event.*list/i.test(ql)) {
    const lines = events.map(e => {
      const champ = e.knockout?.champion
      return `• Event ${e.metadata.event_id}: **${e.metadata.event_name}**${champ ? ` — Champion: **${champ}**` : ''}`
    })
    return { text: `**${events.length} events in the series:**\n${lines.join('\n')}` }
  }

  // ── Current Form / Trending / Hot ─────────────────────────────────────────
  if (/\bform\b|trending|\bhot\b|in.form|current.*best|best.*last.*event|latest.*event/i.test(ql)) {
    const lastEvent = events[events.length - 1]
    if (!lastEvent) return { text: `No event data available yet.` }
    const lastEventId = lastEvent.metadata.event_id
    const lastEventName = lastEvent.metadata.event_name
    const inLastEvent = aggregatedStats.filter(s => s.events?.[lastEventId])
    if (!inLastEvent.length) return { text: `No player data found for **${lastEventName}**.` }
    const sorted = [...inLastEvent].sort(
      (a, b) => (b.events[lastEventId].final_event_3da || 0) - (a.events[lastEventId].final_event_3da || 0)
    )
    const top = sorted[0]
    const topAvg = top.events[lastEventId].final_event_3da?.toFixed(2)
    const top180 = top.events[lastEventId].scores_180 ?? 0
    const topWins = top.events[lastEventId].wins ?? 0
    const lines = sorted.slice(0, 5).map((s, i) => {
      const ev = s.events[lastEventId]
      return `${i + 1}. **${s.displayName}** — 3DA: **${ev.final_event_3da?.toFixed(2)}** | W: ${ev.wins ?? 0} | 180s: ${ev.scores_180 ?? 0}`
    })
    return {
      text: `🔥 **${top.displayName}** is the hottest player in **${lastEventName}**!\n3DA: **${topAvg}** | Wins: **${topWins}** | 180s: **${top180}**\n\n**Top 5 in ${lastEventName}:**\n${lines.join('\n')}`
    }
  }

  // ── Player Comparison (side-by-side stats) ──────────────────────────────
  if (/\bcompare\b|stats vs/i.test(ql)) {
    const two = findTwoPlayers(rawText, players)
    if (two.length < 2) return { text: `I need two player names to compare. Try: **"Compare Tom and Ricky"**` }
    const [p1Name, p2Name] = two
    const s1 = aggregatedStats.find(s => s.displayName === p1Name)?.totals
    const s2 = aggregatedStats.find(s => s.displayName === p2Name)?.totals
    if (!s1 || !s2) return { text: `One of those players doesn't have enough stat data yet.` }
    const better = (key, higher = true) => {
      const a = s1[key] ?? 0; const b = s2[key] ?? 0
      if (a === b) return ['—', '—']
      return higher ? (a > b ? ['✓', ' '] : [' ', '✓']) : (a < b ? ['✓', ' '] : [' ', '✓'])
    }
    const rows = [
      ['3-Dart Avg',  s1.avg3da?.toFixed(2),    s2.avg3da?.toFixed(2),    ...better('avg3da')],
      ['Win Rate',    s1.winRate + '%',          s2.winRate + '%',         ...better('winRate')],
      ['Checkout %',  s1.coPct + '%',            s2.coPct + '%',           ...better('coPct')],
      ['180s',        s1.scores180,              s2.scores180,             ...better('scores180')],
      ['140+',        s1.scores140plus,          s2.scores140plus,         ...better('scores140plus')],
      ['100+',        s1.scores100plus,          s2.scores100plus,         ...better('scores100plus')],
      ['High Finish', s1.highFinish,             s2.highFinish,            ...better('highFinish')],
      ['Matches',     s1.matches,                s2.matches,               ...better('matches')],
    ]
    const table = rows.map(r => `• **${r[0]}**: ${r[1]} ${r[3]} | ${r[4]} ${r[2]}`).join('\n')
    return { text: `**Comparison: ${p1Name} vs ${p2Name}**\n_${p1Name} | ${p2Name}_\n\n${table}` }
  }

  // ── Advanced Thresholds ──────────────────────────────────────────────────
  if (/\bat least\b|\bminimum\b/i.test(ql)) {
    const thresholdMatch = ql.match(/at least (\d+)\s*(matches|events|games)|minimum (\d+)/i)
    const minCount = thresholdMatch ? parseInt(thresholdMatch[1] ?? thresholdMatch[3]) : 5
    const statKey = detectStat(ql) || 'avg3da'
    const count = extractN(ql) || 5
    const reversed = /worst|lowest|fewest|least|bottom/i.test(ql)
    const filtered = [...aggregatedStats]
      .filter(s => s.totals.matches >= minCount)
      .sort((a, b) => reversed
        ? (a.totals[statKey] ?? 0) - (b.totals[statKey] ?? 0)
        : (b.totals[statKey] ?? 0) - (a.totals[statKey] ?? 0))
      .slice(0, count)
    if (!filtered.length) return { text: `No players found with at least **${minCount} matches**.` }
    const label = reversed ? `Bottom ${count}` : `Top ${count}`
    const lines = filtered.map((s, i) =>
      `${i + 1}. **${s.displayName}** — ${statLabel(statKey)}: **${fv(statKey, s.totals[statKey])}** (${s.totals.matches} matches)`
    )
    return { text: `**${label} by ${statLabel(statKey)}** (min. ${minCount} matches):\n${lines.join('\n')}` }
  }

  // ── H2H ───────────────────────────────────────────────────────────────────
  if (/\bvs\.?\b|versus|\bagainst\b|\bh2h\b|head.to.head/i.test(ql)) {
    const two = findTwoPlayers(rawText, players)
    if (two.length < 2) return { text: `I need two player names. Try: **"Tom vs Ricky"**` }
    const [a, b] = two
    const key = [nameKey(a), nameKey(b)].sort().join('|')
    const matches = h2hIndex?.get(key) || []
    if (!matches.length) return { text: `No recorded matches between **${a}** and **${b}**.` }
    let aWins = 0, bWins = 0
    const lines = matches.map(m => {
      const isAP1 = nameKey(m.player1) === nameKey(a)
      const aL = isAP1 ? m.player1_legs : m.player2_legs
      const bL = isAP1 ? m.player2_legs : m.player1_legs
      if ((aL ?? 0) > (bL ?? 0)) aWins++; else bWins++
      return `• ${m.eventName} (${m.stage}): **${a}** ${aL ?? '?'}–${bL ?? '?'} **${b}**`
    })
    const series =
      aWins > bWins ? `**${a}** leads **${aWins}–${bWins}**`
      : bWins > aWins ? `**${b}** leads **${bWins}–${aWins}**`
      : `Tied **${aWins}–${bWins}**`
    return { text: `**H2H: ${a} vs ${b}**\n${series}\n\n${lines.join('\n')}` }
  }

  // ── Champion ──────────────────────────────────────────────────────────────
  if (/champion|who won|winner|trophy|first place/i.test(ql)) {
    const en = detectEventNum(ql)
    if (en !== null) {
      const ev = events.find(e => e.metadata.event_id === en)
      if (!ev) return { text: `Event ${en} not found in the data.` }
      const champ = ev.knockout?.champion
      return { text: champ ? `🎯 Champion of **${ev.metadata.event_name}**: **${champ}**` : `No champion recorded for Event ${en} yet.` }
    }
    const lines = events.map(e => `• **${e.metadata.event_name}**: ${e.knockout?.champion || 'TBD'}`)
    return { text: `**AADS Champions:**\n${lines.join('\n')}` }
  }

  // ── Province listing ──────────────────────────────────────────────────────
  const prov = detectProvince(ql)
  if (prov && /player|who|list|from|leaderboard|standing/i.test(ql)) {
    const filtered = players.filter(p => p.province === prov)
    if (!filtered.length) return { text: `No players found from **${prov}**.` }
    const sorted = filtered
      .map(p => ({ p, s: aggregatedStats.find(x => x.displayName === p.displayName) }))
      .sort((a, b) => (b.s?.totals.avg3da ?? 0) - (a.s?.totals.avg3da ?? 0))
    const lines = sorted.map(({ p, s }, i) =>
      `${i + 1}. **${p.displayName}**${s ? ` — 3DA: **${s.totals.avg3da?.toFixed(2)}**, Wins: **${s.totals.wins}**` : ''}`
    )
    return { text: `**Players from ${prov}** (${filtered.length}):\n${lines.join('\n')}` }
  }

  // ── Province breakdown ────────────────────────────────────────────────────
  if (/province.*breakdown|all province|provinces/i.test(ql)) {
    const provs = ['NS', 'NB', 'PE', 'NL', 'ON']
    const lines = provs.map(pr => {
      const count = players.filter(p => p.province === pr).length
      if (!count) return null
      const best = aggregatedStats
        .filter(s => players.find(p => p.displayName === s.displayName && p.province === pr))
        .sort((a, b) => b.totals.avg3da - a.totals.avg3da)[0]
      return `• **${pr}** — ${count} players | Top: **${best?.displayName ?? '—'}** (${best?.totals.avg3da?.toFixed(2) ?? '—'})`
    }).filter(Boolean)
    return { text: `**Province Breakdown:**\n${lines.join('\n')}` }
  }

  // ── Named player profile ──────────────────────────────────────────────────
  const namedPlayer = findPlayer(rawText, players)
  if (namedPlayer) {
    const stat = aggregatedStats.find(s => s.displayName === namedPlayer)
    const profile = players.find(p => p.displayName === namedPlayer)
    if (!stat) return { text: `**${namedPlayer}** is in the roster but has no stat data recorded.` }
    const t = stat.totals
    const specificStat = detectStat(ql)
    if (specificStat) {
      return { text: `**${namedPlayer}** — ${statLabel(specificStat)}: **${fv(specificStat, t[specificStat])}**` }
    }
    if (/province|from|hometown/i.test(ql)) {
      return { text: `**${namedPlayer}** represents **${profile?.province ?? 'Unknown'}** (${profile?.hometown || 'no hometown listed'})` }
    }
    const nick = profile?.nickname ? ` "${profile.nickname}"` : ''
    const pr = profile?.province ? ` | ${profile.province}` : ''
    return {
      text: `**${namedPlayer}**${nick}${pr}\nEvents: **${t.eventsPlayed}** | Matches: **${t.matches}** (${t.wins}W–${t.losses}L)\n3-Dart Avg: **${t.avg3da?.toFixed(2)}** | Win Rate: **${t.winRate}%**\nCheckout %: **${t.coPct}%** | High Finish: **${t.highFinish}**\n180s: **${t.scores180}** | 140+: **${t.scores140plus}** | 100+: **${t.scores100plus}**`,
    }
  }

  // ── Top / bottom N by stat ────────────────────────────────────────────────
  const n = extractN(ql)
  const statKey = detectStat(ql)
  const reversed = /worst|lowest|fewest|least|bottom/i.test(ql)
  if (n || statKey) {
    const count = n || 5
    const sortKey = statKey || 'avg3da'
    const sorted = [...aggregatedStats]
      .filter(s => (s.totals[sortKey] ?? 0) > 0)
      .sort((a, b) => reversed
        ? (a.totals[sortKey] ?? 0) - (b.totals[sortKey] ?? 0)
        : (b.totals[sortKey] ?? 0) - (a.totals[sortKey] ?? 0))
      .slice(0, count)
    const label = reversed ? `Bottom ${count}` : `Top ${count}`
    const lines = sorted.map((s, i) =>
      `${i + 1}. **${s.displayName}** — ${statLabel(sortKey)}: **${fv(sortKey, s.totals[sortKey])}**`
    )
    return { text: `**${label} by ${statLabel(sortKey)}:**\n${lines.join('\n')}` }
  }

  // ── General leaderboard ───────────────────────────────────────────────────
  if (/leaderboard|standings|ranking|top player|best player/i.test(ql)) {
    const lines = [...aggregatedStats].slice(0, 10).map((s, i) =>
      `${i + 1}. **${s.displayName}** — 3DA: ${s.totals.avg3da?.toFixed(2)} | Wins: ${s.totals.wins}`
    )
    return { text: `**Series Standings (by 3DA):**\n${lines.join('\n')}` }
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  return { text: `I didn't catch that. Try a player name, "top 5 by 3DA", "NS players", or "who won Event 2". Type **"help"** for a full list.` }
}

const INTENT_TEMPLATES = [
  { pattern: /top|best|who is the best/i,               suggestions: ['Top 5 by 3DA', 'Best checkout %', 'Top 10 by wins'] },
  { pattern: /compare|stats vs/i,                       suggestions: ['Compare [Player] vs [Player]', 'Compare Tom and Ricky'] },
  { pattern: /\bvs\.?\b|against|\bh2h\b/i,              suggestions: ['Tom vs Ricky', 'H2H series record'] },
  { pattern: /event|who won|winner|champion/i,          suggestions: ['Who won Event 1?', 'List all event champions', 'Show all champions'] },
  { pattern: /\bnb\b|\bns\b|\bpei?\b|\bnl\b|province/i, suggestions: ['NB leaderboard', 'Who is the top player in NS?', 'Province breakdown'] },
  { pattern: /stat|avg|180|checkout|3da/i,              suggestions: ['Who has the most 180s?', 'Highest High Finish', 'Best 3DA in the series'] },
  { pattern: /form|hot|trending/i,                      suggestions: ['Who is in form?', 'Hottest player', 'Best last event'] },
  { pattern: /rule|fee|format|payout/i,                 suggestions: ['Entry fee?', 'How does the format work?', 'What is the payout?'] },
]

export function getSuggestions(input, players) {
  const q = input.toLowerCase().trim()
  if (q.length < 2) return []

  const results = []

  for (const item of INTENT_TEMPLATES) {
    if (item.pattern.test(q)) {
      results.push(...item.suggestions)
    }
  }

  // Dynamic player name matches
  const matchedPlayers = players
    .filter(p => p.displayName.toLowerCase().includes(q))
    .slice(0, 3)

  for (const p of matchedPlayers) {
    results.push(`Stats for ${p.displayName}`, `Compare ${p.displayName} vs...`)
  }

  return [...new Set(results)].slice(0, 5)
}
