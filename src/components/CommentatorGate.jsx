import { useState, useRef, useEffect } from 'react'

// Client-side deterrent. Hashes the combined "username:password" string.
const CREDENTIAL_HASH = 'b75285708c2c11db96a37659f3bf2c3c0a2e0587acd75bac46af2372a89eacec'

async function hashCredentials(username, password) {
  const combined = `${username.toLowerCase().trim()}:${password.trim()}`
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(combined))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function CommentatorGate({ onUnlock, onCancel }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [shaking, setShaking] = useState(false)
  const usernameRef = useRef(null)

  useEffect(() => {
    usernameRef.current?.focus()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username || !password) return
    const h = await hashCredentials(username, password)
    if (h === CREDENTIAL_HASH) {
      onUnlock()
    } else {
      setShaking(true)
      setError(true)
      setPassword('')
      setTimeout(() => {
        setShaking(false)
      }, 500)
    }
  }

  const handleChange = () => {
    if (error) setError(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-8 w-80 text-center shadow-2xl">
        <div className="text-3xl mb-2">🎙️</div>
        <h2 className="text-white font-bold text-lg mb-1">Commentator Access</h2>
        <p className="text-gray-400 text-sm mb-6">Admin login required</p>

        <form onSubmit={handleSubmit}>
          <div className={`space-y-3 mb-4 ${shaking ? 'animate-[shake_0.4s_ease]' : ''}`}>
            <input
              ref={usernameRef}
              type="text"
              autoComplete="off"
              placeholder="Username"
              value={username}
              onChange={e => { setUsername(e.target.value); handleChange() }}
              className={`w-full px-4 py-2.5 rounded-lg border bg-[#1a1a1a] text-white text-sm
                          placeholder-gray-600 outline-none transition-colors
                          ${error ? 'border-red-500' : 'border-[#333] focus:border-orange/60'}`}
            />
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={e => { setPassword(e.target.value); handleChange() }}
              className={`w-full px-4 py-2.5 rounded-lg border bg-[#1a1a1a] text-white text-sm
                          placeholder-gray-600 outline-none transition-colors
                          ${error ? 'border-red-500' : 'border-[#333] focus:border-orange/60'}`}
            />
          </div>

          {error && <p className="text-red-400 text-xs mb-3">Incorrect credentials. Try again.</p>}

          <button
            type="submit"
            className="w-full bg-orange/90 hover:bg-orange text-black font-bold text-sm py-2.5
                       rounded-lg transition-colors mb-3"
          >
            Sign In
          </button>
        </form>

        <button
          onClick={onCancel}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  )
}
