import { resolveEventName, jsonNameToDisplay, nameKey } from './nameNormalizer.js'

/**
 * Aggregate player stats across all loaded events.
 * Returns an array of player stat objects keyed by resolved display name.
 *
 * Each entry:
 * {
 *   displayName,
 *   events: { [eventId]: { ...player_event_stats row } },
 *   totals: { matches, wins, losses, events_played,
 *             avg3da, best3da, scores180, scores140plus, scores100plus,
 *             coOpportunities, coCompleted, coPct, highFinish }
 * }
 */
export function aggregatePlayerStats(events, csvNames) {
  const byName = new Map()

  const get = (name) => {
    if (!byName.has(name)) {
      byName.set(name, {
        displayName: name,
        events: {},
        totals: {
          matches: 0, wins: 0, losses: 0, eventsPlayed: 0,
          weighted3daSum: 0, matchesForAvg: 0,
          best3da: 0, scores180: 0, scores140plus: 0, scores100plus: 0,
          coOpportunities: 0, coCompleted: 0, highFinish: 0,
        },
      })
    }
    return byName.get(name)
  }

  for (const event of events) {
    const eventId = event.metadata.event_id
    for (const stat of event.player_event_stats || []) {
      const resolved = resolveEventName(stat.name, csvNames)
      const entry = get(resolved)
      entry.events[eventId] = { ...stat, resolvedName: resolved }

      const t = entry.totals
      t.matches += stat.total_matches || 0
      t.wins += stat.wins || 0
      t.losses += stat.losses || 0
      t.eventsPlayed += 1
      t.weighted3daSum += (stat.final_event_3da || 0) * (stat.total_matches || 1)
      t.matchesForAvg += stat.total_matches || 1
      t.best3da = Math.max(t.best3da, stat.final_event_3da || 0)
      t.scores180 += stat.scores_180 || 0
      t.scores140plus += stat.scores_140plus || 0
      t.scores100plus += stat.scores_100plus || 0
      t.coOpportunities += stat.co_opportunities || 0
      t.coCompleted += stat.co_completed || 0
      t.highFinish = Math.max(t.highFinish, stat.high_finish || 0)
    }
  }

  // Compute weighted average 3DA
  for (const entry of byName.values()) {
    const t = entry.totals
    t.avg3da = t.matchesForAvg > 0
      ? Math.round((t.weighted3daSum / t.matchesForAvg) * 100) / 100
      : 0
    t.winRate = t.matches > 0
      ? Math.round((t.wins / t.matches) * 1000) / 10
      : 0
    t.coPct = t.coOpportunities > 0
      ? Math.round((t.coCompleted / t.coOpportunities) * 1000) / 10
      : 0
  }

  return Array.from(byName.values()).sort((a, b) =>
    b.totals.avg3da - a.totals.avg3da
  )
}

/**
 * Build an H2H match index from all events.
 * Returns a Map keyed by "PlayerA|PlayerB" (names sorted alphabetically).
 * Each value is an array of match records from round_robin and knockout stages.
 */
export function buildH2HIndex(events, csvNames) {
  const index = new Map()

  function addMatch(eventMeta, stage, matchObj) {
    const p1 = resolveEventName(matchObj.player1, csvNames)
    const p2 = resolveEventName(matchObj.player2, csvNames)
    const key = [nameKey(p1), nameKey(p2)].sort().join('|')

    if (!index.has(key)) index.set(key, [])
    index.get(key).push({
      eventId: eventMeta.event_id,
      eventName: eventMeta.event_name,
      stage,
      player1: p1,
      player2: p2,
      player1_legs: matchObj.player1_legs ?? matchObj.player1_sets,
      player2_legs: matchObj.player2_legs ?? matchObj.player2_sets,
      player1_details: matchObj.player1_details || {},
      player2_details: matchObj.player2_details || {},
    })
  }

  for (const event of events) {
    const meta = event.metadata

    // Round robin matches
    const rr = event.round_robin?.matches || {}
    for (const group of Object.values(rr)) {
      for (const match of group) {
        addMatch(meta, 'Group Stage', match)
      }
    }

    // Knockout matches
    const ko = event.knockout || {}
    for (const [round, matches] of Object.entries(ko)) {
      if (!Array.isArray(matches)) continue
      for (const match of matches) {
        const stageName = round === 'quarterFinals' ? 'Quarter-Finals'
          : round === 'semiFinals' ? 'Semi-Finals'
          : round === 'final' ? 'Final'
          : round
        addMatch(meta, stageName, match)
      }
    }
  }

  return index
}

/**
 * Look up H2H record for two players.
 * playerA / playerB are displayName strings.
 */
export function getH2H(h2hIndex, playerA, playerB) {
  const key = [nameKey(playerA), nameKey(playerB)].sort().join('|')
  return h2hIndex.get(key) || []
}
