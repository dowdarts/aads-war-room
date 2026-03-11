import { useState, useRef, useEffect } from 'react'
import { useStats } from '../context/StatsContext.jsx'
import { buildSystemInstruction } from '../utils/geminiPrompt.js'

const QUICK_PROMPTS = [
  'Who is the top-ranked player overall?',
  'Who has the highest checkout percentage?',
  'Tell me about the Series 1 Event 1 champion.',
  'Compare the provinces by average 3-dart average.',
  'Who should I watch for big 180s?',
  'Who has the best mental game under pressure?',
]

function Message({ msg }) {
  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed
          ${msg.role === 'user'
            ? 'bg-orange text-black font-medium rounded-br-none'
            : 'bg-[#141414] border border-[#222] text-gray-200 rounded-bl-none'
          }`}
        style={{ whiteSpace: 'pre-wrap' }}
      >
        {msg.content || (msg.streaming ? <span className="opacity-50">…</span> : '')}
      </div>
    </div>
  )
}

export default function AIAnalyst() {
  const { players, events } = useStats()
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Welcome to the AADS Commentary War Room. I'm your AI Analyst, loaded with full player profiles and event statistics. Ask me anything about the players, matchups, province standings, or get a match preview.",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text) {
    const userText = text.trim()
    if (!userText || loading) return
    if (!apiKey || apiKey === 'your_key_here') {
      setError('Add your Gemini API key to .env.local as VITE_GEMINI_API_KEY and restart the dev server.')
      return
    }

    setError('')
    const newMessages = [...messages, { role: 'user', content: userText }]
    setMessages([...newMessages, { role: 'assistant', content: '', streaming: true }])
    setInput('')
    setLoading(true)

    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(apiKey)
      const systemInstruction = buildSystemInstruction(players, events)
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction,
      })

      // Build history for the API (exclude the current streaming placeholder)
      const history = newMessages.slice(0, -1).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }))
      // Keep only the conversation (skip our opening assistant message from history)
      const chat = model.startChat({ history: history.slice(1) })

      const result = await chat.sendMessageStream(userText)

      let full = ''
      for await (const chunk of result.stream) {
        full += chunk.text()
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: full, streaming: true },
        ])
      }
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: full, streaming: false },
      ])
    } catch (err) {
      setMessages(prev => prev.slice(0, -1))
      setError(`Gemini error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] max-w-3xl mx-auto p-4">
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto mb-3 pr-1">
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      {/* Quick-prompt chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {QUICK_PROMPTS.map(p => (
          <button
            key={p}
            onClick={() => send(p)}
            disabled={loading}
            className="text-xs px-2.5 py-1 rounded-full border border-[#2a2a2a] text-gray-400
                       hover:border-orange/50 hover:text-orange transition-colors disabled:opacity-40"
          >
            {p}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-red-400 text-xs bg-red-950/30 border border-red-900 rounded px-3 py-2 mb-2">
          {error}
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask the AI analyst… (Enter to send, Shift+Enter for newline)"
          rows={2}
          disabled={loading}
          className="flex-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2
                     text-white text-sm placeholder-gray-600 resize-none
                     focus:outline-none focus:border-orange disabled:opacity-50"
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          className="px-4 bg-orange text-black font-bold rounded-lg text-sm
                     hover:bg-orange/90 disabled:opacity-40 transition-colors"
        >
          {loading ? '…' : '▶'}
        </button>
      </div>
    </div>
  )
}
