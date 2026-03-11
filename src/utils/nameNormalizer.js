/**
 * Name normalisation utilities.
 * Event JSONs use "LastName, FirstName" (or sometimes "LastnameFirstname" without separator).
 * The player CSV uses "FirstName LastName" free text.
 * We need a reliable canonical key for merging these sources.
 */

function levenshtein(a, b) {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

/**
 * Convert JSON-format name to "First Last" display format.
 * Handles:
 *  "Holden, Tom"      → "Tom Holden"
 *  "Chaission,Ricky"  → "Ricky Chaission"
 *  "Maceachern Mark"  → "Mark Maceachern"  (no comma → treat last token as first)
 */
export function jsonNameToDisplay(jsonName) {
  const trimmed = jsonName.trim()
  if (trimmed.includes(',')) {
    const [last, first] = trimmed.split(',').map(s => s.trim())
    return `${first} ${last}`
  }
  // No comma — assume "Last First" (space-separated, last token = first name)
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) {
    const first = parts[parts.length - 1]
    const last = parts.slice(0, parts.length - 1).join(' ')
    return `${first} ${last}`
  }
  return trimmed
}

/**
 * Build a canonical lookup key: lowercase, single spaces, trimmed.
 */
export function nameKey(name) {
  return name.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Resolve a JSON event name to the closest CSV player profile name.
 * Returns the CSV displayName if found, otherwise returns the converted display form.
 *
 * @param {string} jsonName  - name as it appears in the event JSON
 * @param {string[]} csvNames - array of displayName strings from the CSV
 */
export function resolveEventName(jsonName, csvNames) {
  const display = jsonNameToDisplay(jsonName)
  const displayKey = nameKey(display)

  // 1. Exact match
  const exact = csvNames.find(n => nameKey(n) === displayKey)
  if (exact) return exact

  // 2. Surname only match (covers "Michel" vs "Mike" first-name discrepancy)
  const displayParts = displayKey.split(' ')
  const displayLast = displayParts[displayParts.length - 1]
  const surnameMatch = csvNames.find(n => {
    const parts = nameKey(n).split(' ')
    return parts[parts.length - 1] === displayLast
  })
  if (surnameMatch) return surnameMatch

  // 3. Levenshtein fuzzy match (≤ 3 edits covers common misspellings)
  let best = display
  let bestDist = Infinity
  for (const n of csvNames) {
    const d = levenshtein(displayKey, nameKey(n))
    if (d < bestDist) {
      bestDist = d
      best = n
    }
  }
  return bestDist <= 3 ? best : display
}
