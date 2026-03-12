import { useState, useEffect } from 'react'

const POLICY_CATEGORIES = [
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
