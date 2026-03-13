import { useState, useEffect, useRef } from 'react'
import { StatsProvider } from './context/StatsContext.jsx'
import Nav from './components/Nav.jsx'
import ProvinceLeaderboards from './components/ProvinceLeaderboards.jsx'
import ProvinceWeightedStandings from './components/ProvinceWeightedStandings.jsx'
import PlayerWiki from './components/PlayerWiki.jsx'
import PlayerStandings from './components/PlayerStandings.jsx'
import H2HComparison from './components/H2HComparison.jsx'
import PolicyDocs from './components/PolicyDocs.jsx'
import DataManager from './components/DataManager.jsx'
import QuickLinks from './components/QuickLinks.jsx'
import AcknowledgementLauncher from './components/AcknowledgementLauncher.jsx'
import LocalChat from './components/LocalChat.jsx'

function AppShell() {
  const [tab, setTab] = useState(() => sessionStorage.getItem('activeTab') || 'provinces')
  const [uploadedPolicies, setUploadedPolicies] = useState([])
  const [selectedPlayerName, setSelectedPlayerName] = useState(null)
  const wakeLockRef = useRef(null)

  useEffect(() => {
    if (!('wakeLock' in navigator)) return
    const acquire = async () => {
      try { wakeLockRef.current = await navigator.wakeLock.request('screen') } catch (_) {}
    }
    acquire()
    const onVisibility = () => { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      wakeLockRef.current?.release()
    }
  }, [])

  const addPolicy = (doc) => setUploadedPolicies(p => [...p, doc])

  function handleTabSelect(id) {
    sessionStorage.setItem('activeTab', id)
    setTab(id)
  }

  function openPlayerCard(displayName) {
    setSelectedPlayerName(displayName)
    handleTabSelect('players')
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Nav active={tab} onSelect={handleTabSelect} />
      <main>
        {tab === 'provinces' && <ProvinceLeaderboards onSelectPlayer={openPlayerCard} />}
        {tab === 'prov-weighted' && <ProvinceWeightedStandings />}
        {tab === 'players' && <PlayerWiki selectedPlayerName={selectedPlayerName} onClearSelectedPlayer={() => setSelectedPlayerName(null)} />}
        {tab === 'standings' && <PlayerStandings />}
        {tab === 'h2h' && <H2HComparison />}
        {tab === 'links' && <QuickLinks />}
        {tab === 'policy' && <PolicyDocs uploadedPolicies={uploadedPolicies} onUpload={addPolicy} />}
        {tab === 'data' && <DataManager />}
        {tab === 'ack' && <AcknowledgementLauncher />}
      </main>
      <LocalChat />
    </div>
  )
}

export default function App() {
  return (
    <StatsProvider>
      <AppShell />
    </StatsProvider>
  )
}
