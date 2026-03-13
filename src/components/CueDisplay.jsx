import { useEffect, useRef } from 'react'
import { useStats } from '../context/StatsContext.jsx'

/**
 * CueDisplay Component
 * Full-screen or large container circular light for the stage
 *
 * Features:
 * - GO: Solid bright green with outer glow
 * - STANDBY: Bright red with pulsing animation
 * - OFF: Dimmed grey/black
 * - Real-time sync with Supabase
 */
export default function CueDisplay() {
  const { cueStatus } = useStats()
  const wakeLockRef = useRef(null)

  useEffect(() => {
    if (!('wakeLock' in navigator)) return

    const acquire = async () => {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      } catch (_) {
        // Silently ignore — device may not support it or page isn't visible
      }
    }

    acquire()

    // Re-acquire after tab becomes visible again (wake lock is released on hide)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      wakeLockRef.current?.release()
    }
  }, [])

  const getStatusConfig = () => {
    switch (cueStatus) {
      case 'GO':
        return {
          bg: '#00FF00',
          glow: 'rgba(0, 255, 0, 0.5)',
          label: 'GO',
          animate: '',
        }
      case 'STANDBY':
        return {
          bg: '#FF0000',
          glow: 'rgba(255, 0, 0, 0.5)',
          label: 'STAND BY',
          animate: 'animate-pulse',
        }
      case 'OFF':
        return {
          bg: '#222222',
          glow: 'rgba(255, 255, 255, 0.1)',
          label: 'OFF',
          animate: '',
        }
      default:
        return {
          bg: '#222222',
          glow: 'rgba(255, 255, 255, 0.1)',
          label: 'OFF',
          animate: '',
        }
    }
  }

  const config = getStatusConfig()

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <style>{`
        @keyframes pulse {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
          100% {
            opacity: 1;
          }
        }

        .cue-light {
          width: 400px;
          height: 400px;
          border-radius: 50%;
          background-color: ${config.bg};
          box-shadow: 0 0 60px ${config.glow}, 0 0 100px ${config.glow};
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cue-light.pulsing {
          animation: pulse 0.5s infinite;
        }

        @media (max-width: 768px) {
          .cue-light {
            width: 300px;
            height: 300px;
          }
        }

        @media (max-width: 480px) {
          .cue-light {
            width: 200px;
            height: 200px;
          }
        }
      `}</style>

      <div className="text-center">
        {/* Main Cue Light */}
        <div
          className={`cue-light ${cueStatus === 'STANDBY' ? 'pulsing' : ''}`}
        >
          <div className="text-center">
            <div className="text-2xl font-bold text-[#050505] opacity-70">
              {config.label}
            </div>
          </div>
        </div>

        {/* Status Text Below Light */}
        <div className="mt-12 text-center">
          <p className="text-gray-400 text-lg">Cue Light Status</p>
          <p className={`text-3xl font-bold mt-2 ${
            cueStatus === 'GO' ? 'text-green-400' :
            cueStatus === 'STANDBY' ? 'text-red-400' :
            'text-gray-500'
          }`}>
            {cueStatus}
          </p>
        </div>

        {/* Debug Info (optional - remove in production) */}
        <div className="mt-12 text-center text-xs text-gray-600">
          <p>Status: {cueStatus}</p>
          <p>Keep this window visible on your stage display</p>
        </div>
      </div>
    </div>
  )
}
