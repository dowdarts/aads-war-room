export default function AcknowledgementLauncher() {
  const url = 'https://dowdarts.github.io/aads-war-room/aads-acknowledgement.html'
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white tracking-tight">Acknowledgement App</h1>
        <p className="text-gray-400 text-sm mt-1">Kiosk portal for players, volunteers &amp; spectators to sign their policy acknowledgement on-site</p>
      </div>

      {/* Launch card */}
      <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-8 flex flex-col items-center gap-5 text-center mb-6">
        <img src="/aads-war-room/logo-kiosk.png" alt="AADS Signature Forms App" className="w-48 h-auto object-contain" />
        <div>
          <h2 className="text-xl font-black text-white">AADS Signature Forms App</h2>
          <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto">
            Open on a tablet or phone. Each attendee selects their role, reads their policy document, enters their name and submits. Their signature is saved automatically.
          </p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-8 py-4 bg-orange text-black font-black text-lg rounded-xl hover:opacity-90 transition-opacity"
        >
          Open Kiosk App &#8599;
        </a>
        <p className="text-[11px] text-gray-700 font-mono">{url}</p>
      </div>

      {/* Role preview */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { emoji: '🎯', label: 'Player',             color: '#FF6600', desc: 'Player Policy Booklet' },
          { emoji: '🙋', label: 'Volunteer',           color: '#22c55e', desc: 'Volunteer Policy Booklet' },
          { emoji: '👀', label: 'Spectator / Visitor', color: '#3b82f6', desc: 'Spectator Policy Booklet' },
        ].map(r => (
          <div key={r.label} className="rounded-xl border border-[#1a1a1a] bg-[#080808] p-4 flex flex-col items-center gap-2 text-center">
            <div className="text-3xl">{r.emoji}</div>
            <div className="text-xs font-black" style={{ color: r.color }}>{r.label}</div>
            <div className="text-[10px] text-gray-600 leading-snug">{r.desc}</div>
          </div>
        ))}
      </div>

      <p className="mt-5 text-[10px] text-gray-700 text-center">
        Signed submissions are stored securely and viewable in the Policy Docs tab (staff PIN required)
      </p>
    </div>
  )
}
