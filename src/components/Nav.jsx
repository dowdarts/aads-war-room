import { getBaseUrl } from '../utils/baseUrl.js'

const TABS = [
  { id: 'provinces', label: 'Province Standings' },
  { id: 'prov-weighted', label: 'Province Score' },
  { id: 'players', label: 'Player Wiki' },
  { id: 'standings', label: 'Player Standings' },
  { id: 'h2h', label: 'H2H Match-Up' },
  { id: 'links', label: '🔗 Quick Links' },
  { id: 'policy', label: 'Policy Docs' },
  { id: 'ack', label: '📋 Acknowledgements' },
  { id: 'form', label: '📝 Competition Form' },
  { id: 'data', label: 'Data Manager' },
]

export default function Nav({ active, onSelect }) {
  return (
    <nav className="sticky top-0 z-50 bg-[#0a0a0a] border-b border-[#1a1a1a]">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1a1a1a]">
        <img
          src={getBaseUrl() + 'logo-wiki.png'}
          alt="AADS Wiki"
          className="h-20 w-auto object-contain"
        />
      </div>

      {/* Tab row */}
      <div className="flex overflow-x-auto scrollbar-hide border-b border-gray-800 bg-black/90 backdrop-blur-md">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`
              group relative shrink-0 px-5 py-3 text-xs font-bold uppercase tracking-wider
              min-w-25 h-10.5 flex items-center justify-center whitespace-nowrap
              transition-all duration-200
              ${active === tab.id
                ? 'text-orange border-b-[3px] border-orange shadow-[0_3px_12px_rgba(255,102,0,0.25)] bg-linear-to-b from-black/60 to-black/90'
                : 'text-gray-400 border-b-2 border-transparent hover:text-gray-200 hover:border-orange/20 transition-colors duration-150'
              }
            `}
          >
            <span className="relative z-10">{tab.label}</span>
            {active === tab.id && (
              <span className="absolute inset-0 opacity-0 group-hover:opacity-30 bg-linear-to-r from-transparent via-orange/20 to-transparent pointer-events-none transition-opacity duration-300" />
            )}
          </button>
        ))}
      </div>
    </nav>
  )
}
