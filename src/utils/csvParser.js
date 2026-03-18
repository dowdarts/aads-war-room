/**
 * RFC 4180-compliant CSV parser.
 * Handles quoted fields, embedded commas, embedded newlines, and escaped quotes ("").
 */
export function parseCSV(raw) {
  const rows = []
  let field = ''
  let inQuote = false
  let row = []

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    const next = raw[i + 1]

    if (inQuote) {
      if (ch === '"' && next === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuote = false
      } else {
        field += ch
      }
    } else {
      if (ch === '"') {
        inQuote = true
      } else if (ch === ',') {
        row.push(field)
        field = ''
      } else if (ch === '\n') {
        row.push(field)
        field = ''
        if (row.some(f => f.trim())) rows.push(row)
        row = []
      } else if (ch !== '\r') {
        field += ch
      }
    }
  }
  // flush last row
  row.push(field)
  if (row.some(f => f.trim())) rows.push(row)

  return rows
}

// Province detection from "Hometown / Where you represent" free-text field
function detectProvince(hometown) {
  if (!hometown) return 'NB'
  const t = hometown.toLowerCase()
  if (t.includes('new brunswick') || /\bnb\b/.test(t)) return 'NB'
  if (t.includes('nova scotia') || /\bns\b/.test(t)) return 'NS'
  if (t.includes('prince edward') || /\bpei\b/.test(t) || /\bpe\b/.test(t)) return 'PE'
  if (t.includes('ontario') || /\bon\b/.test(t)) return 'ON'
  if (t.includes('newfoundland') || t.includes('labrador') || /\bnl\b/.test(t)) return 'NL'
  return 'NB' // default fallback
}

// Override provinces for players whose hometown text is ambiguous
const PLAYER_PROVINCE_OVERRIDES = {
  'dana moss':         'NB',
  'colby burke':       'NL',
  'tom holden':        'NS',
  'thomas holden':     'NS',
  'jon casey':         'NS',
  'jonathan casey':    'NS',
  'mark maceachern':   'PE',
  'cory lefort':       'PE',
  'don higgins':       'NB',
  'cory wallace':      'NB',
  'jordan boyd':       'NS',
  'kevin blanchard':   'PE',
}

/**
 * Parse the player questionnaire CSV and return deduplicated player profiles.
 * Column layout (0-indexed):
 *  0  Timestamp
 *  1  Full Name
 *  2  Nickname
 *  3  Hometown / Province
 *  4  Age
 *  5  Years playing
 *  6  Hobbies
 *  7  Dart setup
 *  8  Practice routine
 *  9  Strengths
 * 10  Improvements
 * 11  Checkout routes / favourites
 * 12  Current form
 * 13  Recent results
 * 14  Achievements
 * 15  Pressure management
 * 16  Mental approach
 * 17  Stage presence
 * 18  Pre-match rituals
 * 19  AADS meaning
 * 20  Dart Connect e-mail
 * 21  Dart Connect player card URL
 */
export function parsePlayerCSV(raw) {
  const rows = parseCSV(raw)
  if (rows.length < 2) return []

  const g = (row, i) => (row[i] || '').trim()

  // Strip parenthetical suffixes: "Michel Leger (Mike)" → "Michel Leger"
  const cleanName = (name) => name.replace(/\s*\([^)]*\)\s*/g, '').trim()

  // Map alternate full names (lowercase) to a single canonical display name.
  // Ensures duplicate form submissions under different name spellings become one player.
  const CANONICAL_NAMES = {
    'michel leger': 'Mike Leger',
    'michal leger': 'Mike Leger',
  }

  // Map every data row; later rows for the same player overwrite earlier ones
  const byName = new Map()
  for (const row of rows.slice(1)) {
    const rawName = g(row, 1)
    if (!rawName) continue
    const cleaned = cleanName(rawName)
    const fullName = CANONICAL_NAMES[cleaned.toLowerCase()] ?? cleaned
    byName.set(fullName.toLowerCase(), {
      fullName,
      nickname: g(row, 2),
      hometown: g(row, 3),
      age: g(row, 4),
      yearsPlaying: g(row, 5),
      hobbies: g(row, 6),
      dartSetup: g(row, 7),
      practiceRoutine: g(row, 8),
      strengths: g(row, 9),
      improvements: g(row, 10),
      checkouts: g(row, 11),
      currentForm: g(row, 12),
      recentResults: g(row, 13),
      achievements: g(row, 14),
      pressureManagement: g(row, 15),
      mentalApproach: g(row, 16),
      stagePresence: g(row, 17),
      preMatchRituals: g(row, 18),
      aadsMeaning: g(row, 19),
      dartConnectEmail: g(row, 20),
    })
  }

  return Array.from(byName.values()).map(p => ({
    ...p,
    province:
      PLAYER_PROVINCE_OVERRIDES[p.fullName.toLowerCase()] ||
      detectProvince(p.hometown),
    // Canonical display key: "First Last" → used for all lookups
    displayName: p.fullName,
  }))
}
