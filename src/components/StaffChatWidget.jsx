import { useState, useEffect, useRef } from 'react'

const SUPABASE_URL = 'https://gygwhznblajojwveikhg.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5Z3doem5ibGFqb2p3dmVpa2hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjU5NzgsImV4cCI6MjA4ODk0MTk3OH0.BI9KlRsCxAvNnFHCGq6hjXfdsaNgo7afY4Xa5uxwjak'
const hdrs = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
const SESSION_KEY = 'aads_staff_session'
const LASTREAD_PREFIX = 'aads_chat_lastread_'
const MESSAGE_POLL_MS = 2000
const ELIGIBILITY_POLL_MS = 4000
const HEARTBEAT_MS = 30000
const CONTACTS_POLL_MS = 15000
const ONLINE_THRESHOLD_MS = 90000
const IMAGE_BUCKET = 'staff-chat-images'
const IMAGE_MAX_DIM = 1600
const IMAGE_QUALITY = 0.8

function isOnline(c) {
  if (!c.last_seen_at) return false
  return Date.now() - new Date(c.last_seen_at).getTime() < ONLINE_THRESHOLD_MS
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onload = () => {
      img.onload = () => {
        let { width, height } = img
        if (width > IMAGE_MAX_DIM || height > IMAGE_MAX_DIM) {
          if (width > height) { height = Math.round(height * IMAGE_MAX_DIM / width); width = IMAGE_MAX_DIM }
          else { width = Math.round(width * IMAGE_MAX_DIM / height); height = IMAGE_MAX_DIM }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('compress failed'))), 'image/jpeg', IMAGE_QUALITY)
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
}

function formatTime(iso) {
  try { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) } catch { return '' }
}

export default function StaffChatWidget() {
  const [session, setSession] = useState(() => loadSession())
  const [eligible, setEligible] = useState(false)
  const [open, setOpen] = useState(false)
  const [contacts, setContacts] = useState([])
  const [messages, setMessages] = useState([])
  const [activeContactId, setActiveContactId] = useState(null)
  const [input, setInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)

  // Re-check session + tool permission periodically — covers sign in/out and
  // permission changes Matthew makes while this tab stays open.
  useEffect(() => {
    function checkEligibility() {
      const s = loadSession()
      setSession(s)
      if (!s) { setEligible(false); return }
      if (s.isMaster) { setEligible(true); return }
      fetch(`${SUPABASE_URL}/rest/v1/staff_accounts?id=eq.${s.id}&select=tool_permissions`, { headers: hdrs })
        .then(r => r.json())
        .then(rows => setEligible(Array.isArray(rows) && !!rows[0]?.tool_permissions?.includes('staff-chat')))
        .catch(() => setEligible(false))
    }
    checkEligibility()
    const t = setInterval(checkEligibility, ELIGIBILITY_POLL_MS)
    return () => clearInterval(t)
  }, [])

  // "Online now" heartbeat for the Manage Staff list — runs for every signed-in
  // staff member regardless of chat eligibility, since this widget is the one
  // component mounted across the whole app no matter which tab is active.
  useEffect(() => {
    if (!session?.id) return
    function heartbeat() {
      fetch(`${SUPABASE_URL}/rest/v1/staff_accounts?id=eq.${session.id}`, {
        method: 'PATCH',
        headers: { ...hdrs, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ last_seen_at: new Date().toISOString() }),
      }).catch(() => {})
    }
    heartbeat()
    const t = setInterval(heartbeat, HEARTBEAT_MS)
    return () => clearInterval(t)
  }, [session?.id])

  useEffect(() => {
    if (!eligible || !session) { setContacts([]); return }
    function loadContacts() {
      fetch(`${SUPABASE_URL}/rest/v1/staff_accounts?select=id,name,last_seen_at&is_active=eq.true&order=name.asc`, { headers: hdrs })
        .then(r => r.json())
        .then(rows => setContacts(Array.isArray(rows) ? rows.filter(c => c.id !== session.id) : []))
        .catch(() => {})
    }
    loadContacts()
    const t = setInterval(loadContacts, CONTACTS_POLL_MS)
    return () => clearInterval(t)
  }, [eligible, session])

  useEffect(() => {
    if (!eligible || !session) { setMessages([]); return }
    let lastJSON = ''
    function poll() {
      fetch(`${SUPABASE_URL}/rest/v1/staff_messages?or=(sender_id.eq.${session.id},recipient_id.eq.${session.id})&order=created_at.asc`, { headers: hdrs })
        .then(r => r.json())
        .then(rows => {
          if (!Array.isArray(rows)) return
          const json = JSON.stringify(rows)
          if (json !== lastJSON) { lastJSON = json; setMessages(rows) }
        })
        .catch(() => {})
    }
    poll()
    const t = setInterval(poll, MESSAGE_POLL_MS)
    return () => clearInterval(t)
  }, [eligible, session])

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [messages, activeContactId, open])

  function conversationWith(otherId) {
    if (!session) return []
    return messages.filter(m =>
      (m.sender_id === otherId && m.recipient_id === session.id) ||
      (m.sender_id === session.id && m.recipient_id === otherId)
    )
  }

  function isUnread(otherId) {
    const conv = conversationWith(otherId)
    if (!conv.length) return false
    const last = conv[conv.length - 1]
    if (last.sender_id === session.id) return false
    const lastRead = localStorage.getItem(LASTREAD_PREFIX + otherId)
    if (!lastRead) return true
    return new Date(last.created_at) > new Date(lastRead)
  }

  function markRead(otherId) {
    const conv = conversationWith(otherId)
    const lastTime = conv.length ? conv[conv.length - 1].created_at : new Date().toISOString()
    localStorage.setItem(LASTREAD_PREFIX + otherId, lastTime)
  }

  const hasUnread = contacts.some(c => isUnread(c.id))

  function openContact(id) {
    setActiveContactId(id)
    markRead(id)
  }

  function backToContacts() {
    setActiveContactId(null)
  }

  function send() {
    const body = input.trim()
    if (!body || !activeContactId || !session) return
    const contact = contacts.find(c => c.id === activeContactId)
    if (!contact) return
    setInput('')
    const optimistic = {
      id: `temp_${Date.now()}`,
      sender_id: session.id, sender_name: session.name,
      recipient_id: contact.id, recipient_name: contact.name,
      body, created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
    fetch(`${SUPABASE_URL}/rest/v1/staff_messages`, {
      method: 'POST',
      headers: { ...hdrs, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        sender_id: session.id, sender_name: session.name,
        recipient_id: contact.id, recipient_name: contact.name,
        body,
      }),
    }).catch(() => {})
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function pickImage() {
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !activeContactId || !session) return
    const contact = contacts.find(c => c.id === activeContactId)
    if (!contact) return
    setUploading(true)
    const tempId = `temp_${Date.now()}`
    try {
      const blob = await compressImage(file)
      const filename = `${session.id}_${Date.now()}.jpg`
      const localUrl = URL.createObjectURL(blob)
      const optimistic = {
        id: tempId,
        sender_id: session.id, sender_name: session.name,
        recipient_id: contact.id, recipient_name: contact.name,
        body: '', image_url: localUrl, created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, optimistic])

      const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${IMAGE_BUCKET}/${filename}`, {
        method: 'POST',
        headers: { ...hdrs, 'Content-Type': 'image/jpeg' },
        body: blob,
      })
      if (!uploadRes.ok) throw new Error('upload failed')
      const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${filename}`

      await fetch(`${SUPABASE_URL}/rest/v1/staff_messages`, {
        method: 'POST',
        headers: { ...hdrs, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          sender_id: session.id, sender_name: session.name,
          recipient_id: contact.id, recipient_name: contact.name,
          body: '', image_url: imageUrl,
        }),
      })
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      window.alert('Could not send image. Try again.')
    }
    setUploading(false)
  }

  function deleteMessage(id) {
    if (typeof id !== 'string' || id.startsWith('temp_')) return
    setMessages(prev => prev.filter(m => m.id !== id))
    fetch(`${SUPABASE_URL}/rest/v1/staff_messages?id=eq.${id}`, {
      method: 'DELETE',
      headers: hdrs,
    }).catch(() => {})
  }

  function deleteConversation(otherId) {
    if (!session) return
    const contact = contacts.find(c => c.id === otherId)
    if (!window.confirm(`Delete this entire conversation with ${contact ? contact.name : 'this person'}? This can't be undone.`)) return
    setMessages(prev => prev.filter(m => !(
      (m.sender_id === otherId && m.recipient_id === session.id) ||
      (m.sender_id === session.id && m.recipient_id === otherId)
    )))
    if (activeContactId === otherId) setActiveContactId(null)
    const filterExpr = `or=(and(sender_id.eq.${session.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${session.id}))`
    fetch(`${SUPABASE_URL}/rest/v1/staff_messages?${filterExpr}`, {
      method: 'DELETE',
      headers: hdrs,
    }).catch(() => {})
  }

  if (!eligible) return null

  const activeContact = contacts.find(c => c.id === activeContactId)
  const thread = activeContactId ? conversationWith(activeContactId) : []

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full bg-orange shadow-lg
                   flex items-center justify-center text-black text-xl font-black
                   hover:scale-105 active:scale-95 transition-transform"
        title="Staff Chat"
      >
        {open ? '✕' : '🧑'}
        {!open && hasUnread && (
          <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-red-500 border-2 border-black" />
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0a]
                     sm:inset-auto sm:bottom-20 sm:right-5 sm:w-96 sm:h-132.5
                     sm:border sm:border-[#1f1f1f] sm:rounded-2xl sm:shadow-2xl sm:overflow-hidden"
        >
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#1a1a1a] bg-[#0f0f0f] shrink-0">
            {activeContactId && (
              <button onClick={backToContacts} className="text-gray-400 hover:text-white text-lg px-1 -ml-1">
                ←
              </button>
            )}
            <div className="w-7 h-7 rounded-full bg-orange flex items-center justify-center text-black text-xs font-black shrink-0">
              💬
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                {activeContact ? activeContact.name : 'Staff Chat'}
                {activeContact && isOnline(activeContact) && (
                  <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="Online now" />
                )}
              </div>
              <div className="text-[10px] text-gray-500 font-medium tracking-wide truncate">
                Signed in as {session?.name}
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white text-lg px-1">
              ✕
            </button>
          </div>

          {!activeContactId ? (
            <div className="flex-1 overflow-y-auto min-h-0">
              {contacts.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-8 px-4">No other staff yet.</p>
              ) : (
                contacts.map(c => {
                  const conv = conversationWith(c.id)
                  const lastMsg = conv.length ? conv[conv.length - 1] : null
                  const preview = lastMsg ? (lastMsg.image_url ? '📷 Photo' : lastMsg.body) : 'No messages yet'
                  const unread = isUnread(c.id)
                  return (
                    <div
                      key={c.id}
                      onClick={() => openContact(c.id)}
                      className="flex items-center gap-2 w-full text-left px-4 py-3 border-b border-[#141414] hover:bg-[#141414] transition-colors cursor-pointer"
                    >
                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex items-center gap-1.5">
                          {isOnline(c) && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="Online now" />}
                          <span className="text-sm font-bold text-white">{c.name}</span>
                          {unread && <span className="w-2 h-2 rounded-full bg-orange shrink-0" />}
                        </div>
                        <span className="text-xs text-gray-500 truncate">{preview}</span>
                      </div>
                      {conv.length > 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); deleteConversation(c.id) }}
                          className="text-gray-600 hover:text-red-400 text-sm px-1 shrink-0"
                          title={`Delete conversation with ${c.name}`}
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
                {thread.length === 0 ? (
                  <p className="text-gray-600 text-sm text-center py-8">Say hello — no messages yet.</p>
                ) : (
                  thread.map((m, i) => (
                    <div key={m.id || i} className={`flex flex-col ${m.sender_id === session.id ? 'items-end' : 'items-start'}`}>
                      {m.image_url ? (
                        <a href={m.image_url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={m.image_url}
                            alt="Shared"
                            className="max-w-[180px] max-h-[180px] rounded-xl object-cover border border-[#2a2a2a]"
                          />
                        </a>
                      ) : (
                        <div
                          className={`max-w-[88%] px-3 py-2 rounded-xl text-sm
                            ${m.sender_id === session.id
                              ? 'bg-orange text-black font-medium rounded-br-sm'
                              : 'bg-[#1a1a1a] text-gray-200 rounded-bl-sm'
                            }`}
                        >
                          {m.body}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-600">{formatTime(m.created_at)}</span>
                        <button
                          onClick={() => deleteMessage(m.id)}
                          className="text-[10px] text-gray-700 hover:text-red-400"
                          title="Delete message"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              <div className="px-3 pb-3 pt-2 border-t border-[#1a1a1a] shrink-0 flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelected}
                  className="hidden"
                />
                <button
                  onClick={pickImage}
                  disabled={uploading}
                  title="Send a photo"
                  className="w-10 h-10 rounded-xl bg-[#262626] border border-[#444] text-white
                             disabled:opacity-40 hover:border-orange/50 transition-colors
                             flex items-center justify-center shrink-0 text-xl"
                >
                  {uploading ? '…' : '📷'}
                </button>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Type a message…"
                  className="flex-1 bg-[#141414] border border-[#2a2a2a] rounded-xl px-3 py-2
                             text-sm text-white placeholder-gray-600 outline-none
                             focus:border-orange/50 transition-colors"
                />
                <button
                  onClick={send}
                  disabled={!input.trim()}
                  className="w-9 h-9 rounded-xl bg-orange text-black font-bold text-base
                             disabled:opacity-30 hover:bg-orange/90 transition-opacity
                             flex items-center justify-center shrink-0"
                >
                  ↑
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
