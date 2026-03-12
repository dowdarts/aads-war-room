import { useState, useRef, useEffect } from 'react'
import { useStats } from '../context/StatsContext.jsx'
import { answerQuery, getSuggestions } from '../utils/chatEngine.js'

const SUGGESTIONS = [
  'Top 5 by 3-dart average',
  'Who won each event?',
  'NS players',
  'Series standings',
]

/** Render bot text: newlines → line breaks, **bold** → <strong> */
function BotText({ text }) {
  return (
    <div className="text-sm leading-relaxed">
      {text.split('\n').map((line, i) => {
        if (line === '') return <div key={i} className="h-1.5" />
        const parts = line.split(/\*\*/)
        return (
          <div key={i}>
            {parts.map((part, j) =>
              j % 2 === 1
                ? <strong key={j} className="text-white">{part}</strong>
                : <span key={j} className="text-gray-300">{part}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function LocalChat() {
  const { aggregatedStats, players, events, h2hIndex } = useStats()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: `Hi! I'm the **AADS Local Assistant** — fully offline, no API needed.\n\nI have access to all player stats, match records, H2H results, and event outcomes. Type **"help"** to see what I can answer.`,
    },
  ])
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [messages, open])

  function send(text) {
    const trimmed = (text ?? input).trim()
    if (!trimmed) return
    setInput('')
    const userMsg = { role: 'user', text: trimmed }
    const result = answerQuery(trimmed, { aggregatedStats, players, events, h2hIndex })
    setMessages(prev => [...prev, userMsg, { role: 'bot', text: result.text }])
  }

  const typingSuggestions = getSuggestions(input, players)
  const ghostText = (() => {
    if (!input || !typingSuggestions.length) return ''
    const top = typingSuggestions[0]
    return top.toLowerCase().startsWith(input.toLowerCase()) ? top.slice(input.length) : ''
  })()

  function handleKey(e) {
    if (e.key === 'Tab' && ghostText) { e.preventDefault(); setInput(typingSuggestions[0]); return }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <>
      {/* ── Floating toggle button ─────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full bg-orange shadow-lg
                   flex items-center justify-center text-black text-xl font-black
                   hover:scale-105 active:scale-95 transition-transform"
        title="AADS Local Assistant"
      >
        {open ? '✕' : '💬'}
      </button>

      {/* ── Chat panel ────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed bottom-20 right-5 z-50 flex flex-col
                     bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl shadow-2xl overflow-hidden
                     w-80 sm:w-96"
          style={{ height: '530px' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#1a1a1a] bg-[#0f0f0f] shrink-0">
            <div className="w-7 h-7 rounded-full bg-orange flex items-center justify-center text-black text-xs font-black shrink-0">
              A
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-white">AADS Local Assistant</div>
              <div className="text-[10px] text-green-500 font-medium tracking-wide">● OFFLINE · No API</div>
            </div>
            <button
              onClick={() => setMessages([{ role: 'bot', text: 'Chat cleared. Ask me anything!' }])}
              className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
            >
              Clear
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[88%] px-3 py-2 rounded-xl
                    ${m.role === 'user'
                      ? 'bg-orange text-black text-sm font-medium rounded-br-sm'
                      : 'bg-[#1a1a1a] rounded-bl-sm'
                    }`}
                >
                  {m.role === 'bot' ? <BotText text={m.text} /> : m.text}
                </div>
              </div>
            ))}

            {/* Suggestion chips — only before first user message */}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-[#2a2a2a]
                               text-gray-400 hover:border-orange hover:text-orange transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="px-3 pb-3 pt-2 border-t border-[#1a1a1a] shrink-0">
            {/* Typing suggestion chips */}
            {typingSuggestions.length > 0 && input.length >= 2 && (
              <div className="flex flex-wrap gap-1 mb-2 items-center">
                {typingSuggestions.map(s => (
                  <button
                    key={s}
                    onMouseDown={e => { e.preventDefault(); send(s) }}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-orange/30
                               text-orange/80 hover:border-orange hover:text-orange transition-colors bg-orange/5"
                  >
                    {s}
                  </button>
                ))}
                {ghostText && (
                  <span className="text-[10px] text-gray-600 ml-1">Tab ↹</span>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <div className="relative flex-1">
                {/* Ghost text layer — visible through transparent input */}
                <div className="absolute inset-0 flex items-center px-3 pointer-events-none overflow-hidden rounded-xl bg-[#141414]">
                  <span className="text-sm text-transparent whitespace-pre select-none">{input}</span>
                  <span className="text-sm text-gray-600 whitespace-pre select-none">{ghostText}</span>
                </div>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask about players, stats, H2H…"
                  className="relative w-full bg-transparent border border-[#2a2a2a] rounded-xl px-3 py-2
                             text-sm text-white placeholder-gray-600 outline-none
                             focus:border-orange/50 transition-colors"
                />
              </div>
              <button
                onClick={() => send()}
                disabled={!input.trim()}
                className="w-9 h-9 rounded-xl bg-orange text-black font-bold text-base
                           disabled:opacity-30 hover:bg-orange/90 transition-opacity
                           flex items-center justify-center shrink-0"
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
