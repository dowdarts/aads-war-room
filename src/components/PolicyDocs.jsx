import { useState } from 'react'

const PLACEHOLDER_POLICIES = [
  {
    id: 'code-of-conduct',
    title: 'AADS Code of Conduct',
    updated: '2025-01-01',
    content: `All players participating in the Atlantic Amateur Darts Series agree to uphold the highest standards of sportsmanship. 

Key expectations:
• Respect all fellow competitors, officials, and spectators at all times.
• No abusive language, intimidation, or unsportsmanlike conduct.
• Players must be ready at the board when called. A 5-minute grace period applies before a forfeit is issued.
• Mobile phones must be on silent during active play.
• Players must sign in at the registration desk no later than 15 minutes before the scheduled start.

Violations will be reviewed by the Tournament Director, whose decision is final.`,
  },
  {
    id: 'equipment',
    title: 'Equipment & Dart Policy',
    updated: '2025-01-01',
    content: `Darts used in competition must comply with the following specifications:

• Maximum dart weight: 50 grams (barrel + flight + stem + point)
• Minimum dart weight: No minimum
• Points: Standard steel tips only (no electronic points)
• Flights: Any shape or design is permitted
• No modifications that could damage the dartboard are permitted

Players are responsible for having their own darts. The AADS reserves the right to inspect equipment at any time. 
Decisions on equipment legality rest with the Tournament Director.`,
  },
  {
    id: 'format',
    title: 'Competition Format',
    updated: '2025-01-01',
    content: `Series Format:
The AADS Series consists of multiple events. Points are accumulated across all events to determine Series standings.

Round Robin Phase:
• Players are divided into groups of 5
• Each player plays every other player in their group once
• Top 2 from each group advance to the knockout stage
• Legs won is the tiebreaker

Knockout Phase:
• Quarter-Finals: Best of 3 sets (first to 2 sets)
• Semi-Finals: Best of 3 sets
• Final: Best of 5 sets (first to 3 sets)

Scoring: 501 straight-in, double-out for all matches.`,
  },
  {
    id: 'streaming',
    title: 'Streaming & Media Policy',
    updated: '2025-01-01',
    content: `By participating in the AADS, players consent to being filmed and streamed for official AADS media purposes.

• Livestreams may be broadcast on official AADS channels
• Player commentary and interviews may be recorded and published
• Players may opt out of personal interviews but cannot opt out of match coverage
• Footage remains the intellectual property of the AADS
• Third-party filming requires prior written approval from the AADS Director`,
  },
]

export default function PolicyDocs({ uploadedPolicies, onUpload }) {
  const [selected, setSelected] = useState(null)
  const docs = [...PLACEHOLDER_POLICIES, ...(uploadedPolicies || [])]

  function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const doc = {
        id: `upload-${Date.now()}`,
        title: file.name.replace(/\.[^.]+$/, ''),
        updated: new Date().toISOString().split('T')[0],
        content: ev.target.result,
      }
      onUpload?.(doc)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex gap-4">
        {/* Document list */}
        <div className="w-64 shrink-0 space-y-2">
          {docs.map(doc => (
            <button
              key={doc.id}
              onClick={() => setSelected(doc)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors
                ${selected?.id === doc.id
                  ? 'bg-orange/10 border-orange text-orange'
                  : 'bg-[#0f0f0f] border-[#1a1a1a] text-gray-300 hover:border-[#333]'
                }`}
            >
              <div className="text-sm font-medium">{doc.title}</div>
              <div className="text-[10px] text-gray-600 mt-0.5">Updated: {doc.updated}</div>
            </button>
          ))}

          {/* Upload */}
          <label className="block mt-3 cursor-pointer">
            <div className="w-full px-3 py-2.5 rounded-lg border border-dashed border-[#2a2a2a]
                            text-gray-600 text-sm text-center hover:border-orange/50 hover:text-gray-400
                            transition-colors">
              + Upload .txt policy
            </div>
            <input type="file" accept=".txt,.md" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>

        {/* Document viewer */}
        <div className="flex-1 bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl overflow-hidden">
          {selected ? (
            <div>
              <div className="px-5 py-4 border-b border-[#1a1a1a]">
                <div className="text-white font-bold text-base">{selected.title}</div>
                <div className="text-gray-500 text-xs mt-0.5">Last updated: {selected.updated}</div>
              </div>
              <div className="px-5 py-4 text-gray-300 text-sm leading-relaxed whitespace-pre-wrap max-h-[70vh] overflow-y-auto">
                {selected.content}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-700">
              Select a document to view
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
