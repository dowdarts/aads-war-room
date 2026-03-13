import { useState, useEffect } from 'react'
import { getSupabaseClient } from '../utils/supabaseClient.js'

const STAFF_PIN = '40783'

const POLICY_CATEGORIES = [
  {
    label: '2027 Expansion Handbook',
    docs: [
      { id: '2027-handbook', title: 'Atlantic Circuit Master Operations Handbook 2027', src: '/policies/AADS_Atlantic_Circuit_Master_Operations_Handbook_2027.pdf' },
    ],
  },
  {
    label: 'Policy Booklets',
    docs: [
      { id: 'player-booklet',    title: 'Player Policy Booklet',    src: '/policies/AADS_Player_Policy_Booklet.pdf' },
      { id: 'volunteer-booklet', title: 'Volunteer Policy Booklet', src: '/policies/AADS_Volunteer_Policy_Booklet.pdf' },
      { id: 'spectator-booklet', title: 'Spectator Policy Booklet', src: '/policies/AADS_Spectator_Policy_Booklet.pdf' },
    ],
  },
  {
    label: 'Core Rules & Policies',
    docs: [
      { id: 'aads-rules',            title: 'AADS Rules',                              src: '/policies/Revised-version-of-AADS-RULES.pdf' },
      { id: 'aads-policy',           title: 'AADS Policy',                             src: '/policies/AADS-policy.pdf' },
      { id: 'registration-waiver',   title: 'Player Registration & Waiver',            src: '/policies/AADS-Player-Registration-and-Waiver.pdf' },
      { id: 'governance-binder',     title: 'Governance Binder',                       src: '/policies/AADS_Governance_Binder_V1.0.pdf' },
    ],
  },
  {
    label: 'Legal & Liability',
    docs: [
      { id: 'lip-01',  title: 'Liability, Indemnification & Arbitration',  src: '/policies/AADS-LIP-01_Liability_Indemnification_Arbitration_Policy_PROFESSIONAL.pdf' },
      { id: 'vsp-01',  title: 'Visitor / Spectator Liability Policy',      src: '/policies/AADS-VSP-01_Visitor_Spectator_Liability_Policy_PROFESSIONAL.pdf' },
      { id: 'vop-01',  title: 'Volunteer Legal Status Policy',             src: '/policies/AADS-VOP-01_Volunteer_Official_Legal_Status_Policy_PROFESSIONAL.pdf' },
      { id: 'srm-01',  title: 'Safety & Risk Management Policy',           src: '/policies/AADS-SRM-01_Safety_Risk_Management_Policy_PROFESSIONAL.pdf' },
      { id: 'bsp-01',  title: 'Broadcast Standards & Conduct Policy',      src: '/policies/AADS-BSP-01_Broadcast_Standards_and_Conduct_Policy.pdf' },
    ],
  },
  {
    label: 'Event Operations',
    docs: [
      { id: 'master-index',     title: 'Master Event Document Index',        src: '/policies/AADS-MASTER_Event_Document_Index.pdf' },
      { id: 'compliance-check', title: 'Event Day Compliance Checklist',     src: '/policies/AADS_Event_Day_Compliance_Checklist_V1.0.pdf' },
      { id: 'srm-checklist',    title: 'Safety & Risk Management Checklist', src: '/policies/AADS-SRM-Checklist_Time_Watermarks_FINAL_CORRECTED.pdf' },
      { id: 'dqg-01',           title: 'Director Enforcement Guide',         src: '/policies/AADS-DQG-01_Director_Quick_Reference_Enforcement_Guide_EXECUTIVE_ONLY.pdf' },
    ],
  },
  {
    label: 'Event 04 Schedules',
    docs: [
      { id: 'e04-master',     title: 'Event 04 Master Schedule',          src: '/policies/AADS_Event04_MASTER_Schedule.pdf' },
      { id: 'e04-board2',     title: 'Event 04 Board 2 Schedule',         src: '/policies/AADS_Event04_Board2_Schedule.pdf' },
      { id: 'e04-livestream', title: 'Event 04 Live Stream Schedule',     src: '/policies/AADS_Event04_Live_Stream_Board_Schedule.pdf' },
      { id: 'e04-players',    title: 'Event 04 Player Schedules',         src: '/policies/AADS_Event04_Player_Schedules_ACK_TOP_SCHEDULE_BOTTOM.pdf' },
      { id: 'e04-reg',        title: 'Event 04 Cash Registration Checkoff', src: '/policies/AADS-REG-01_Event04_Cash_Only_Checkoff.pdf' },
    ],
  },
  {
    label: 'Forms & Score Sheets',
    docs: [
      { id: 'irf-01',    title: 'Incident Report Form',            src: '/policies/AADS-IRF-01_Incident_Report_Form_PRINT_ONE_PAGE.pdf' },
      { id: 'mrs-01',    title: 'Official Match Referee Score Sheet', src: '/policies/AADS-MRS-01_Official_Match_Referee_Score_Sheet_COMPACT.pdf' },
    ],
  },
  {
    label: 'Acknowledgments & Volunteers',
    docs: [
      { id: 'visitor-ack',   title: 'Visitor Acknowledgment Form',        src: '/policies/AADS_Visitor_Acknowledgment_2_per_page.pdf' },
      { id: 'volunteer-ack', title: 'Volunteer Acknowledgment Form',      src: '/policies/AADS_Volunteer_Acknowledgment_2_per_page.pdf' },
      { id: 'vol-02',        title: 'Volunteer Pre-Shift Briefing Sheet', src: '/policies/AADS-VOL-02_Volunteer_PreShift_Briefing_Sheet.pdf' },
    ],
  },
]

// Flat list for selected-lookup and upload appending
const OFFICIAL_POLICIES = POLICY_CATEGORIES.flatMap(cat =>
  cat.docs.map(doc => ({ ...doc, type: 'pdf' }))
)

// Prepend Vite base path for official PDFs (/policies/...) so they work
// on GitHub Pages where the app is served from a sub-path.
const BASE = import.meta.env.BASE_URL  // '/aads-war-room/' in prod, '/' in dev
function resolveSrc(src) {
  if (!src || !src.startsWith('/')) return src  // blob: URLs pass through
  return BASE.slice(0, -1) + src
}

function SignedSubmissions() {
  const [pin, setPin] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pinError, setPinError] = useState(false)

  async function loadRows() {
    setLoading(true)
    setError(null)
    const client = getSupabaseClient()
    if (!client) { setError('Supabase not connected'); setLoading(false); return }
    const { data, error: err } = await client
      .from('acknowledgements')
      .select('id, name, role, submitted_at')
      .order('submitted_at', { ascending: false })
    setLoading(false)
    if (err) { setError(err.message); return }
    setRows(data || [])
  }

  function tryUnlock() {
    if (pin === STAFF_PIN) { setUnlocked(true); setPinError(false); loadRows() }
    else { setPinError(true); setPin('') }
  }

  const ROLE_COLORS = { player: '#FF6600', volunteer: '#22c55e', spectator: '#3b82f6' }

  return (
    <div className="border border-[#1a1a1a] rounded-xl overflow-hidden mb-4">
      <button
        className="w-full px-4 py-3 flex items-center gap-2 bg-[#0d0d0d] hover:bg-[#111] transition-colors text-left"
        onClick={() => !unlocked && setPin('')}
      >
        <span className="text-xs font-black uppercase tracking-widest text-orange">🔒 Signed Submissions</span>
        {unlocked && <span className="ml-auto text-[10px] text-gray-600">{rows.length} record{rows.length !== 1 ? 's' : ''}</span>}
      </button>

      {!unlocked ? (
        <div className="px-4 py-4 bg-[#080808] flex flex-col gap-3">
          <p className="text-xs text-gray-500">Staff PIN required to view signed acknowledgements</p>
          <div className="flex gap-2">
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={e => { setPin(e.target.value); setPinError(false) }}
              onKeyDown={e => e.key === 'Enter' && tryUnlock()}
              placeholder="Enter PIN"
              className={`flex-1 bg-[#0d0d0d] border rounded px-3 py-2 text-sm text-white outline-none transition-colors
                ${pinError ? 'border-red-500' : 'border-[#2a2a2a] focus:border-orange'}`}
            />
            <button
              onClick={tryUnlock}
              className="px-4 py-2 bg-orange text-black text-xs font-black rounded hover:opacity-90 transition-opacity"
            >Unlock</button>
          </div>
          {pinError && <p className="text-xs text-red-500">Incorrect PIN</p>}
        </div>
      ) : (
        <div className="bg-[#080808] px-4 py-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] text-gray-600">{rows.length} submission{rows.length !== 1 ? 's' : ''}</span>
            <button onClick={loadRows} className="text-[10px] text-orange hover:underline">↺ Refresh</button>
          </div>
          {loading && <p className="text-xs text-gray-500 py-2">Loading…</p>}
          {error && <p className="text-xs text-red-500 py-2">{error}</p>}
          {!loading && !error && rows.length === 0 && (
            <p className="text-xs text-gray-600 py-2">No submissions yet</p>
          )}
          {!loading && rows.length > 0 && (
            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {rows.map(r => (
                <div key={r.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#0d0d0d] border border-[#141414]">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{r.name}</div>
                    <div className="text-[10px] text-gray-600">{new Date(r.submitted_at).toLocaleString()}</div>
                  </div>
                  <span
                    className="text-[9px] font-black uppercase px-2 py-0.5 rounded"
                    style={{ background: (ROLE_COLORS[r.role] || '#666') + '22', color: ROLE_COLORS[r.role] || '#666' }}
                  >{r.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PolicyDocs({ uploadedPolicies, onUpload }) {
  const [selected, setSelected] = useState(OFFICIAL_POLICIES[0])
  const uploadedDocs = (uploadedPolicies || [])

  // Revoke blob URLs for uploaded PDFs when component unmounts
  useEffect(() => {
    return () => {
      uploadedDocs.forEach(doc => {
        if (doc.blobUrl) URL.revokeObjectURL(doc.blobUrl)
      })
    }
  }, [uploadedDocs])

  function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return

    if (file.type === 'application/pdf') {
      const blobUrl = URL.createObjectURL(file)
      const doc = {
        id: `upload-${Date.now()}`,
        title: file.name.replace(/\.pdf$/i, ''),
        src: blobUrl,
        blobUrl,
        type: 'pdf',
      }
      onUpload?.(doc)
    } else {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const doc = {
          id: `upload-${Date.now()}`,
          title: file.name.replace(/\.[^.]+$/, ''),
          content: ev.target.result,
          type: 'text',
        }
        onUpload?.(doc)
      }
      reader.readAsText(file)
    }
    e.target.value = ''
  }

  return (
    <div className="p-4 max-w-7xl mx-auto h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex gap-4 flex-1 min-h-0">

        {/* Categorized document list */}
        <div className="w-64 shrink-0 overflow-y-auto space-y-4 pr-1">
          <SignedSubmissions />
          {POLICY_CATEGORIES.map(cat => (
            <div key={cat.label}>
              <div className="text-[10px] uppercase tracking-widest text-gray-600 font-semibold mb-1.5 px-1">
                {cat.label}
              </div>
              <div className="space-y-1">
                {cat.docs.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => setSelected({ ...doc, type: 'pdf' })}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors
                      ${selected?.id === doc.id
                        ? 'bg-orange/10 border-orange text-orange'
                        : 'bg-[#0f0f0f] border-[#1a1a1a] text-gray-300 hover:border-[#333]'
                      }`}
                  >
                    <div className="text-xs font-medium leading-snug">{doc.title}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Uploaded docs */}
          {uploadedDocs.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gray-600 font-semibold mb-1.5 px-1">
                Uploaded
              </div>
              <div className="space-y-1">
                {uploadedDocs.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => setSelected(doc)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors
                      ${selected?.id === doc.id
                        ? 'bg-orange/10 border-orange text-orange'
                        : 'bg-[#0f0f0f] border-[#1a1a1a] text-gray-300 hover:border-[#333]'
                      }`}
                  >
                    <div className="text-xs font-medium leading-snug">{doc.title}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Upload */}
          <label className="block cursor-pointer">
            <div className="w-full px-3 py-2.5 rounded-lg border border-dashed border-[#2a2a2a]
                            text-gray-600 text-xs text-center hover:border-orange/50 hover:text-gray-400
                            transition-colors">
              + Upload PDF / txt
            </div>
            <input type="file" accept=".pdf,.txt,.md" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>

        {/* Document viewer */}
        <div className="flex-1 bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl overflow-hidden flex flex-col min-h-0">
          {selected ? (
            <>
              <div className="px-5 py-3 border-b border-[#1a1a1a] shrink-0 flex items-center justify-between">
                <div>
                  <div className="text-white font-bold text-base">{selected.title}</div>
                  <div className="text-gray-500 text-xs mt-0.5">
                    {selected.blobUrl ? 'User upload' : 'Official AADS document'}
                  </div>
                </div>
                {selected.type === 'pdf' && !selected.blobUrl && (
                  <a
                    href={resolveSrc(selected.src)}
                    download
                    className="text-xs text-orange hover:underline shrink-0 ml-4"
                  >
                    Download PDF
                  </a>
                )}
              </div>

              <div className="flex-1 min-h-0">
                {selected.type === 'pdf' ? (
                  <embed
                    key={selected.id}
                    src={resolveSrc(selected.src)}
                    type="application/pdf"
                    className="w-full h-full"
                  />
                ) : (
                  <div className="px-5 py-4 text-gray-300 text-sm leading-relaxed whitespace-pre-wrap h-full overflow-y-auto">
                    {selected.content}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-700">
              Select a document to view
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
