const LINK_GROUPS = [
  {
    category: 'Interview & Commentary',
    color: '#FF6600',
    links: [
      {
        label: 'Denis Interview Assistant',
        description: 'Player interview prompts & commentary tool',
        url: 'https://dowdarts.github.io/darts-interview-assistant/',
        icon: '🎙️',
      },
      {
        label: 'Cue Light Controller',
        description: 'Control the stage cue light for live stream',
        url: 'https://dowdarts.github.io/darts-interview-assistant/cue-light-controller.html',
        icon: '🚦',
      },
    ],
  },
  {
    category: 'Broadcast Displays',
    color: '#3b82f6',
    links: [
      {
        label: 'Live Standings (TV)',
        description: 'Broadcasting live standings overlay',
        url: 'https://dowdarts.github.io/darts-interview-assistant/tv-standings.html',
        icon: '📺',
      },
      {
        label: 'TV Match Display',
        description: 'In-match score display for broadcast',
        url: 'https://dowdarts.github.io/darts-interview-assistant/tv-display.html',
        icon: '🎯',
      },
      {
        label: 'Donation Overlay (OBS)',
        description: 'Transparent live donation tracker — add as Browser Source in OBS',
        url: 'https://wiki.aadsdarts.com/donation-overlay.html',
        icon: '💸',
      },
      {
        label: 'QR Donation Stats',
        description: 'Full donation & QR scan stats dashboard',
        url: 'https://wiki.aadsdarts.com/QR_Donation_stats.html',
        icon: '📈',
      },
    ],
  },
  {
    category: "Jason's Stream",
    color: '#a855f7',
    links: [
      {
        label: "Jason's Live Odds App",
        description: 'Full stream app dashboard',
        url: 'https://dowdarts.github.io/darts-interview-assistant/jasons-stream/',
        icon: '🎲',
      },
      {
        label: 'Live Odds Display',
        description: 'Odds overlay for live stream',
        url: 'https://dowdarts.github.io/darts-interview-assistant/jasons-stream/live-odds.html',
        icon: '📊',
      },
    ],
  },
  {
    category: 'Official Stats',
    color: '#22c55e',
    links: [
      {
        label: 'AADS Official Stats',
        description: 'League-wide stats display',
        url: 'https://dowdarts.github.io/darts-league-stats/display.html',
        icon: '🏆',
      },
    ],
  },
  {
    category: 'DartConnect — Event 4',
    color: '#f59e0b',
    links: [
      {
        label: 'Event 4 Hub Manager',
        description: 'DartConnect event hub — staff access',
        url: 'https://ep.dartconnect.com/',
        icon: '⚙️',
      },
      {
        label: 'Event 4 DCTV',
        description: 'DartConnect live TV feed for Event 4',
        url: 'https://tv.dartconnect.com/event/atlanticamateurdartseries26e04',
        icon: '📡',
      },
    ],
  },
]

function LinkCard({ link, color }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 p-3 rounded-lg border border-[#1a1a1a] bg-[#0d0d0d]
                 hover:border-[#333] hover:bg-[#111] transition-all"
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 mt-0.5"
        style={{ background: color + '18', border: `1px solid ${color}30` }}
      >
        {link.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-white group-hover:text-orange transition-colors leading-tight">
          {link.label}
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">{link.description}</div>
        <div className="text-[10px] text-gray-700 mt-1 truncate font-mono group-hover:text-gray-500 transition-colors">
          {link.url}
        </div>
      </div>
      <div className="text-gray-600 group-hover:text-gray-400 transition-colors shrink-0 text-xs mt-1">↗</div>
    </a>
  )
}

export default function QuickLinks() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white tracking-tight">Quick Links</h1>
        <p className="text-gray-400 text-sm mt-1">AADS broadcast tools, stats displays, and event management links</p>
      </div>

      <div className="space-y-6">
        {LINK_GROUPS.map(group => (
          <div key={group.category}>
            {/* Category header */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 rounded-full" style={{ background: group.color }} />
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: group.color }}>
                {group.category}
              </h2>
              <div className="flex-1 h-px bg-[#1a1a1a]" />
            </div>

            {/* Link cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {group.links.map(link => (
                <LinkCard key={link.url} link={link} color={group.color} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-[10px] text-gray-700 text-center">
        All links open in a new tab · Broadcast tools require appropriate access
      </p>
    </div>
  )
}
