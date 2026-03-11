import { useStats } from '../context/StatsContext.jsx'

/**
 * Build the Gemini system instruction from live player + event data.
 * Gives the AI full context for grounded commentary.
 */
export function buildSystemInstruction(players, events) {
  const playerSections = players.map(p => {
    const t = p.stats?.totals
    const statsLine = t
      ? `Career stats: ${t.eventsPlayed} events, ${t.wins}W/${t.losses}L (${t.winRate}% win rate), avg 3-dart avg ${t.avg3da.toFixed(2)}, best event 3DA ${t.best3da.toFixed(2)}, ${t.scores180} maximums (180s), high finish ${t.highFinish}, checkout rate ${t.coPct}%.`
      : 'No recorded event stats yet.'

    const lines = [
      `## ${p.displayName}${p.nickname ? ` ("${p.nickname}")` : ''}`,
      `Province: ${p.province} | Hometown: ${p.hometown || 'N/A'} | Age: ${p.age || 'N/A'} | Playing ${p.yearsPlaying || 'N/A'}`,
      statsLine,
    ]
    if (p.achievements) lines.push(`Achievements: ${p.achievements}`)
    if (p.strengths) lines.push(`Strengths: ${p.strengths}`)
    if (p.checkouts) lines.push(`Checkout routes: ${p.checkouts}`)
    if (p.currentForm) lines.push(`Current form: ${p.currentForm}`)
    if (p.recentResults) lines.push(`Recent results: ${p.recentResults}`)
    if (p.mentalApproach) lines.push(`Mental approach: ${p.mentalApproach}`)
    if (p.pressureManagement) lines.push(`Under pressure: ${p.pressureManagement}`)
    if (p.stagePresence) lines.push(`Stage presence: ${p.stagePresence}`)
    if (p.preMatchRituals) lines.push(`Pre-match rituals: ${p.preMatchRituals}`)
    if (p.dartSetup) lines.push(`Dart setup: ${p.dartSetup}`)
    if (p.aadsMeaning) lines.push(`What AADS means: ${p.aadsMeaning}`)

    // Per-event breakdown
    if (p.stats?.events) {
      const evLines = Object.entries(p.stats.events).map(([id, ev]) =>
        `  Event ${id}: ${ev.total_matches} matches, ${ev.wins}W/${ev.losses}L, 3DA ${ev.final_event_3da?.toFixed(1)}, ${ev.scores_180} 180s, HF ${ev.high_finish}`
      )
      if (evLines.length) lines.push('Per-event: ' + evLines.join('; '))
    }

    return lines.join('\n')
  }).join('\n\n')

  const eventSummary = events.map(e =>
    `Event ${e.metadata.event_id} (${e.metadata.event_name}, ${e.metadata.date || e.metadata.event_date}): Champion — ${e.metadata.champion}`
  ).join('\n')

  return `You are the AADS (Atlantic Amateur Darts Series) AI Commentary Analyst — an expert darts commentator with deep knowledge of every player competing in the Atlantic Amateur Darts Series.

Your role is to provide insightful, engaging, and accurate commentary, player analysis, match previews, post-match breakdowns, and strategic insights. You speak with authority and enthusiasm, the way a top-tier darts broadcaster would. Use real statistics, player backstory, and personality traits in your analysis.

Use metric/stat language naturally: "three-dart average", "checkout percentage", "maximums (180s)", "high finish".

SERIES RECORD:
${eventSummary}

PLAYER PROFILES & STATISTICS:
${playerSections}

When asked about a player, draw on ALL available information above. When asked to compare players, reference their head-to-head stats if known, and contrast their styles. Be concise but vivid — use darts-specific language. Never invent statistics.`
}
