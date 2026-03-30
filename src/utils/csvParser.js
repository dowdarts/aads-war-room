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
  // Full name overrides (safe — unambiguous)
  'dana moss':         'NB',
  'colby burke':       'NL',
  'tom holden':        'NS',
  'thomas holden':     'NS',
  'jon casey':         'NS',
  'jonathan casey':    'NS',
  'mark maceachern':   'PE',
  'mark mceachern':    'PE',
  'mark maceachern':   'PE',
  'corey lefort':      'NS',
  'cory lefort':       'NB',
  'don higgins':       'NB',
  'cory wallace':      'NB',
  'jordan boyd':       'NS',
  'kevin blanchard':   'PE',
  'darrell cormier':   'NB',
  'kyle gray':         'NB',
  'fernand pellerin':  'NB',
  'corey o\'brien':    'NS',
  'ricky chaisson':    'PE',
  'wayne chapman':     'NB',
  'drake berry':       'NS',
  'zach davis':        'NB',
  'royce milliea':     'NB',
  'gerry johnston':    'NB',
  'colby burke':       'NL',
}

/**
 * Parse the player questionnaire CSV and return deduplicated player profiles.
 * Supports both legacy Google Forms format and new simplified format with images.
 * 
 * Legacy format (0-indexed):
 *  0  Timestamp
 *  1  Full Name
 *  2  Nickname
 *  ...
 * 
 * Simplified format (0-indexed):
 *  0  fullName
 *  1  nickname
 *  2  hometown
 *  3  age
 *  4  yearsPlaying
 *  5  province
 *  6  profileImage
 *  ...
 */
export function parsePlayerCSV(raw) {
  const rows = parseCSV(raw)
  if (rows.length < 2) return []

  const g = (row, i) => (row[i] || '').trim()
  const headers = rows[0].map(h => h.toLowerCase().trim())

  // Detect format: if first column is "fullName", use simplified format
  const isSimplified = headers[0] === 'fullname'

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
    let playerData
    
    if (isSimplified) {
      // Simplified format with images
      const rawName = g(row, 0)
      if (!rawName) continue
      const cleaned = cleanName(rawName)
      const fullName = CANONICAL_NAMES[cleaned.toLowerCase()] ?? cleaned
      
      playerData = {
        fullName,
        nickname: g(row, 1),
        hometown: g(row, 2),
        age: g(row, 3),
        yearsPlaying: g(row, 4),
        province: g(row, 5) || detectProvince(g(row, 2)),
        profileImage: g(row, 6) || '/images/players/placeholder.svg',
        hobbies: g(row, 7),
        dartSetup: g(row, 8),
        practiceRoutine: g(row, 9),
        strengths: g(row, 10),
        improvements: g(row, 11),
        checkouts: g(row, 12),
        currentForm: g(row, 13),
        recentResults: g(row, 14),
        achievements: g(row, 15),
        pressureManagement: g(row, 16),
        mentalApproach: g(row, 17),
        stagePresence: g(row, 18),
        preMatchRituals: g(row, 19),
        aadsMeaning: g(row, 20),
        dartConnectEmail: g(row, 21),
      }
    } else {
      // Legacy Google Forms format
      const rawName = g(row, 1)
      if (!rawName) continue
      const cleaned = cleanName(rawName)
      const fullName = CANONICAL_NAMES[cleaned.toLowerCase()] ?? cleaned
      
      playerData = {
        fullName,
        nickname: g(row, 2),
        hometown: g(row, 3),
        age: g(row, 4),
        yearsPlaying: g(row, 5),
        profileImage: '/images/players/placeholder.svg',
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
      }
    }
    
    byName.set(playerData.fullName.toLowerCase(), playerData)
  }

  return Array.from(byName.values()).map(p => ({
    ...p,
    province: p.province || 
      PLAYER_PROVINCE_OVERRIDES[p.fullName.toLowerCase()] ||
      detectProvince(p.hometown),
    // Canonical display key: "First Last" → used for all lookups
    displayName: p.fullName,
  }))
}
