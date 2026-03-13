import { useState, useEffect, useRef } from 'react'

// Simple PIN gate — client-side deterrent for casual users.
// PIN is checked as a SHA-256 digest so the plain value isn't in the bundle.
const PIN_HASH = 'eff2d85c112021cdf3540104a4096e8eace5f0c6d005dd2663268fdad57c2da4'

async function hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function PinGate({ onUnlock, onCancel }) {
  const [digits, setDigits] = useState(['', '', '', '', ''])
  const [error, setError] = useState(false)
  const [shaking, setShaking] = useState(false)
  const inputs = useRef([])

  useEffect(() => {
    inputs.current[0]?.focus()
  }, [])

  const handleChange = (i, val) => {
    if (!/^\d?$/.test(val)) return
    const next = [...digits]
    next[i] = val
    setDigits(next)
    setError(false)
    if (val && i < 4) inputs.current[i + 1]?.focus()
    if (next.every(d => d !== '')) {
      check(next.join(''))
    }
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus()
    }
  }

  const check = async (pin) => {
    const h = await hashPin(pin)
    if (h === PIN_HASH) {
      onUnlock()
    } else {
      setShaking(true)
      setError(true)
      setDigits(['', '', '', '', ''])
      setTimeout(() => {
        setShaking(false)
        inputs.current[0]?.focus()
      }, 500)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-8 w-80 text-center shadow-2xl">
        <div className="text-3xl mb-2">🔒</div>
        <h2 className="text-white font-bold text-lg mb-1">Restricted Access</h2>
        <p className="text-gray-400 text-sm mb-6">Enter the PIN to continue</p>

        <div className={`flex justify-center gap-3 mb-4 ${shaking ? 'animate-[shake_0.4s_ease]' : ''}`}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => inputs.current[i] = el}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className={`w-11 h-12 text-center text-xl font-bold rounded-lg border bg-[#1a1a1a] text-white outline-none transition-colors
                ${error ? 'border-red-500 text-red-400' : d ? 'border-orange' : 'border-[#333] focus:border-orange/60'}`}
            />
          ))}
        </div>

        {error && <p className="text-red-400 text-xs mb-3">Incorrect PIN. Try again.</p>}

        <button
          onClick={onCancel}
          className="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
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
