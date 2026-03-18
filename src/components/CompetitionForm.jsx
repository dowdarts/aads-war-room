const FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSfkenUW5-fc8ZCPBWmTXhdmC7yo0TSiWpK2NvsDkmP7HwkfCA/viewform'

export default function CompetitionForm() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
      <div className="max-w-lg w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-10 flex flex-col items-center gap-6 shadow-xl">
        <div className="text-center">
          <h1 className="text-2xl font-black uppercase tracking-widest text-white mb-2">
            Player Competition Form
          </h1>
          <p className="text-sm text-gray-400">
            Use this form to register or submit your competition details.
          </p>
        </div>
        <a
          href={FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 px-8 py-4 bg-orange text-black font-black uppercase tracking-widest
                     text-sm rounded-xl hover:brightness-110 active:scale-95
                     transition-all duration-150 shadow-[0_0_24px_rgba(255,102,0,0.35)]"
        >
          📝 Start the Players Competition Form
        </a>
      </div>
    </div>
  )
}
