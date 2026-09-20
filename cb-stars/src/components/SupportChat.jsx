import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import './SupportChat.css'

function getSessionId() {
  let id = localStorage.getItem('hjz_chat_session')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('hjz_chat_session', id)
  }
  return id
}

export default function SupportChat() {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const sessionId = useRef(getSessionId())
  const bottomRef = useRef(null)
  const panelRef = useRef(null)
  const fabRef = useRef(null)

  const loadMessages = async () => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId.current)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
  }

  useEffect(() => {
    if (!open) return
    loadMessages()

    const channel = supabase
      .channel(`chat-${sessionId.current}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${sessionId.current}`,
        },
        (payload) => setMessages((prev) => [...prev, payload.new])
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Close the panel when clicking/tapping anywhere outside it.
  useEffect(() => {
    if (!open) return

    const handleOutside = (e) => {
      if (panelRef.current?.contains(e.target)) return
      if (fabRef.current?.contains(e.target)) return
      setOpen(false)
    }

    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [open])

  const send = async (e) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setDraft('')
    await supabase.from('chat_messages').insert({
      session_id: sessionId.current,
      sender: 'client',
      message: text,
    })
    setSending(false)
  }

  return (
    <>
      <button
        ref={fabRef}
        className={`support-fab ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t('support.close') : t('support.open')}
      >
        <svg className="support-fab__icon support-fab__icon--chat" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 5.5C4 4.67 4.67 4 5.5 4h13c.83 0 1.5.67 1.5 1.5v10c0 .83-.67 1.5-1.5 1.5H9l-4 3.5v-3.5H5.5C4.67 17 4 16.33 4 15.5v-10Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
        <svg className="support-fab__icon support-fab__icon--close" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      <div ref={panelRef} className={`support-panel ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <div className="support-panel__header">
          <h4>{t('support.title')}</h4>
          <p>{t('support.subtitle')}</p>
          <span className="support-panel__status">
            <span className="support-panel__dot" />
            {t('support.online')}
          </span>
        </div>

        <div className="support-panel__messages">
          {messages.map((m) => (
            <div key={m.id} className={`support-msg support-msg--${m.sender}`}>
              {m.message}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form className="support-panel__form" onSubmit={send}>
          <input
            type="text"
            placeholder={t('support.placeholder')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className="btn btn-solid" disabled={sending || !draft.trim()}>
            {t('support.send')}
          </button>
        </form>
      </div>
    </>
  )
}
