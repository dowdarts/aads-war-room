// Exports player bio data (hometown, achievements, etc.) to public/players.json
// so static portal pages (e.g. score-keepers-portal.html) can fetch it — those
// pages aren't part of the Vite/React bundle and have no other way to read
// src/data/*.csv. Re-run automatically via the predev/prebuild npm scripts.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { parsePlayerCSV } from '../src/utils/csvParser.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'src', 'data')
const outFile = path.join(__dirname, '..', 'public', 'players.json')

const read = (name) => readFileSync(path.join(dataDir, name), 'utf8')

// Same merge precedence as src/context/StatsContext.jsx: images CSV wins,
// legacy fills in players missing from it, women appended last.
const playersWithImages = parsePlayerCSV(read('players-with-images.csv'))
const playersLegacy = parsePlayerCSV(read('players.csv'))
const womenPlayers = parsePlayerCSV(read('women-players.csv'))

const imagesByName = new Set(playersWithImages.map(p => p.displayName.toLowerCase()))
const menPlayers = [
  ...playersWithImages,
  ...playersLegacy.filter(p => !imagesByName.has(p.displayName.toLowerCase())),
]
const menNames = new Set(menPlayers.map(p => p.displayName.toLowerCase()))
const allPlayers = [
  ...menPlayers,
  ...womenPlayers.filter(p => !menNames.has(p.displayName.toLowerCase())),
]

// Same field list as the COMMENTARY_FIELDS used in src/components/Commentator.jsx
const ANNOUNCER_FIELDS = [
  'achievements', 'strengths', 'improvements', 'dartSetup', 'practiceRoutine',
  'checkouts', 'currentForm', 'recentResults', 'mentalApproach',
  'pressureManagement', 'stagePresence', 'preMatchRituals', 'hobbies', 'aadsMeaning',
]

const exported = allPlayers.map(p => {
  const out = {
    fullName: p.fullName,
    nickname: p.nickname,
    hometown: p.hometown,
    province: p.province,
    age: p.age,
    yearsPlaying: p.yearsPlaying,
  }
  for (const field of ANNOUNCER_FIELDS) out[field] = p[field]
  return out
})

// MC introduction scripts (e.g. Tournament of Champions player intros) are
// event-specific, full-paragraph announcer scripts — kept separate from the
// general player questionnaire CSVs rather than stuffed into a cell there.
// Attach onto the matching player if one exists; for a finalist with no
// questionnaire record on file (e.g. a late qualifier), add a minimal entry
// so the cheat sheet can still surface their script.
const introScripts = JSON.parse(read('mc-intro-scripts.json'))
const byLowerName = new Map(exported.map(p => [p.fullName.toLowerCase(), p]))
for (const script of introScripts) {
  const existing = byLowerName.get(script.fullName.toLowerCase())
  if (existing) {
    existing.introScript = script.introScript
    existing.eventChampion = script.eventChampion
  } else {
    exported.push({
      fullName: script.fullName,
      nickname: script.nickname || '',
      hometown: '', province: '', age: '', yearsPlaying: '',
      introScript: script.introScript,
      eventChampion: script.eventChampion,
    })
  }
}

writeFileSync(outFile, JSON.stringify(exported, null, 2))
console.log(`Wrote ${exported.length} player profiles to ${path.relative(process.cwd(), outFile)}`)
