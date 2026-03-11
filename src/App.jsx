import { useState } from 'react'
import { StatsProvider } from './context/StatsContext.jsx'
import Nav from './components/Nav.jsx'
import ProvinceLeaderboards from './components/ProvinceLeaderboards.jsx'
import PlayerWiki from './components/PlayerWiki.jsx'
import H2HComparison from './components/H2HComparison.jsx'
import AIAnalyst from './components/AIAnalyst.jsx'
import PolicyDocs from './components/PolicyDocs.jsx'
import DataManager from './components/DataManager.jsx'

function AppShell() {
  const [tab, setTab] = useState('provinces')
  const [uploadedPolicies, setUploadedPolicies] = useState([])

  const addPolicy = (doc) => setUploadedPolicies(p => [...p, doc])

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Nav active={tab} onSelect={setTab} />
      <main>
        {tab === 'provinces' && <ProvinceLeaderboards />}
        {tab === 'players' && <PlayerWiki />}
        {tab === 'h2h' && <H2HComparison />}
        {tab === 'ai' && <AIAnalyst />}
        {tab === 'policy' && <PolicyDocs uploadedPolicies={uploadedPolicies} onUpload={addPolicy} />}
        {tab === 'data' && <DataManager />}
      </main>
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
