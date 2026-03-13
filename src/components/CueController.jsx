import { useState } from 'react'
import { useStats } from '../context/StatsContext.jsx'

/**
 * CueController Component
 * Commentary Booth interface to control the stage cue light
 *
 * Features:
 * - Three large buttons (GO, STANDBY, OFF)
 * - Visual feedback of current cue status
 * - Real-time sync with Supabase
 */
export default function CueController() {
  const { cueStatus, updateCue } = useStats()
  const [isLoading, setIsLoading] = useState(false)

  const handleCueChange = async (newStatus) => {
    setIsLoading(true)
    try {
      await updateCue(newStatus)
    } finally {
      setIsLoading(false)
    }
  }

  const isActive = (status) => cueStatus === status

  return (
    <div className="min-h-screen bg-linear-to-b from-[#0a0a0a] to-[#050505] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-bold mb-2">Commentary Booth</h1>
          <p className="text-gray-400 text-lg">Virtual Stage Cue Light Controller</p>
        </div>

        {/* Current Status Display */}
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-6 mb-12 text-center">
          <div className="text-gray-400 text-sm uppercase tracking-wider mb-3">Current Cue Status</div>
          <div className={`text-4xl font-bold ${
            cueStatus === 'GO' ? 'text-green-400' :
            cueStatus === 'STANDBY' ? 'text-red-400' :
            'text-gray-500'
          }`}>
            {cueStatus}
          </div>
        </div>

        {/* Control Buttons */}
        <div className="space-y-4">
          {/* GO Button */}
          <button
            onClick={() => handleCueChange('GO')}
            disabled={isLoading}
            className={`w-full py-8 px-6 rounded-lg font-bold text-2xl uppercase tracking-wider transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border-2 ${
              isActive('GO')
                ? 'bg-green-500/20 border-green-500 text-green-300 shadow-lg shadow-green-500/50'
                : 'bg-green-500/10 border-green-600 text-green-400 hover:bg-green-500/15'
            }`}
          >
            🟢 GO
          </button>

          {/* STANDBY Button */}
          <button
            onClick={() => handleCueChange('STANDBY')}
            disabled={isLoading}
            className={`w-full py-8 px-6 rounded-lg font-bold text-2xl uppercase tracking-wider transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border-2 ${
              isActive('STANDBY')
                ? 'bg-red-500/20 border-red-500 text-red-300 shadow-lg shadow-red-500/50 animate-pulse'
                : 'bg-red-500/10 border-red-600 text-red-400 hover:bg-red-500/15'
            }`}
          >
            🔴 STAND BY
          </button>

          {/* OFF Button */}
          <button
            onClick={() => handleCueChange('OFF')}
            disabled={isLoading}
            className={`w-full py-8 px-6 rounded-lg font-bold text-2xl uppercase tracking-wider transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border-2 ${
              isActive('OFF')
                ? 'bg-gray-600/40 border-gray-400 text-gray-200 shadow-lg shadow-gray-500/30'
                : 'bg-gray-700/20 border-gray-600 text-gray-400 hover:bg-gray-700/30'
            }`}
          >
            ⚫ OFF
          </button>
        </div>

        {/* Status Indicator */}
        <div className="mt-12 pt-8 border-t border-[#1a1a1a] text-center">
          <div className="text-gray-500 text-sm">
            {isLoading ? (
              <span className="text-gray-400">Updating... 🔄</span>
            ) : (
              <span>✓ Ready to control</span>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-6 text-sm text-gray-400">
          <p className="font-semibold text-gray-300 mb-3">How to Use:</p>
          <ul className="space-y-2 text-xs">
            <li>• <strong className="text-green-400">GO:</strong> Signal stage to illuminate green light</li>
            <li>• <strong className="text-red-400">STAND BY:</strong> Alert stage with pulsing red light</li>
            <li>• <strong className="text-gray-400">OFF:</strong> Dim the stage light</li>
          </ul>
          <p className="mt-4 text-xs text-gray-500">
            The stage display will update in real-time. Open the stage view in another browser window to see the cue light.
          </p>
        </div>
      </div>
    </div>
  )
}
