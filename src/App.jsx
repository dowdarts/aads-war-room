import { useState } from 'react'
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
import LocalChat from './components/LocalChat.jsx'

function AppShell() {
  const [tab, setTab] = useState('provinces')
  const [uploadedPolicies, setUploadedPolicies] = useState([])
  const [selectedPlayerName, setSelectedPlayerName] = useState(null)

  const addPolicy = (doc) => setUploadedPolicies(p => [...p, doc])

  function openPlayerCard(displayName) {
    setSelectedPlayerName(displayName)
    setTab('players')
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Nav active={tab} onSelect={setTab} />
      <main>
        {tab === 'provinces' && <ProvinceLeaderboards onSelectPlayer={openPlayerCard} />}
        {tab === 'prov-weighted' && <ProvinceWeightedStandings />}
        {tab === 'players' && <PlayerWiki selectedPlayerName={selectedPlayerName} onClearSelectedPlayer={() => setSelectedPlayerName(null)} />}
        {tab === 'standings' && <PlayerStandings />}
        {tab === 'h2h' && <H2HComparison />}
        {tab === 'links' && <QuickLinks />}
        {tab === 'policy' && <PolicyDocs uploadedPolicies={uploadedPolicies} onUpload={addPolicy} />}
        {tab === 'data' && <DataManager />}
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
