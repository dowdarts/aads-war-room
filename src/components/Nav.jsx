const TABS = [
  { id: 'provinces', label: 'Province Standings' },
  { id: 'prov-weighted', label: 'Province Score' },
  { id: 'players', label: 'Player Wiki' },
  { id: 'standings', label: 'Player Standings' },
  { id: 'h2h', label: 'H2H Match-Up' },
  { id: 'links', label: '🔗 Quick Links' },
  { id: 'policy', label: 'Policy Docs' },
  { id: 'data', label: 'Data Manager' },
]

export default function Nav({ active, onSelect }) {
  return (
    <nav className="sticky top-0 z-50 bg-[#0a0a0a] border-b border-[#1a1a1a]">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1a1a1a]">
        <div className="w-8 h-8 rounded bg-orange flex items-center justify-center font-black text-black text-sm">
          A
        </div>
        <div>
          <div className="text-orange font-bold text-sm tracking-widest uppercase">
            AADS
          </div>
          <div className="text-[10px] text-gray-500 leading-none tracking-wider uppercase">
            Sports Intelligence &amp; Commentary War Room
          </div>
        </div>
      </div>

      {/* Tab row */}
      <div className="flex overflow-x-auto scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`
              shrink-0 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider
              border-b-2 transition-colors whitespace-nowrap
              ${active === tab.id
                ? 'border-orange text-orange'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
