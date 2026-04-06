'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase, type Lead, type LeadStatus } from '@/lib/supabase'

type LeadCard = Lead & { lead_status: LeadStatus | null }

const COLUMNS: { key: string; label: string; color: string }[] = [
  { key: 'lead', label: 'Lead', color: '#7D5638' },
  { key: 'no_answer', label: 'No Answer', color: '#807e7c' },
  { key: 'discovery_call', label: 'Discovery Call', color: '#60a5fa' },
  { key: 'interested', label: 'Interested', color: '#fbbf24' },
  { key: 'booked', label: 'Booked', color: '#3ecf8e' },
  { key: 'pending', label: 'Pending', color: '#a78bfa' },
  { key: 'lost', label: 'Lost', color: '#f87171' },
]

export default function PipelinePage() {
  const [leads, setLeads] = useState<LeadCard[]>([])
  const [loading, setLoading] = useState(true)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)

  // Log a Call modal
  const [showLogCall, setShowLogCall] = useState(false)
  const [logSearch, setLogSearch] = useState('')
  const [logPhone, setLogPhone] = useState<string | null>(null)
  const [logNote, setLogNote] = useState('')
  const [logDate, setLogDate] = useState('')
  const [logSubmitting, setLogSubmitting] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  function localNow() {
    const d = new Date()
    const offset = d.getTimezoneOffset()
    return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 16)
  }

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('leads')
        .select('*, lead_status(*)')
      setLeads((data as LeadCard[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function getStatus(lead: LeadCard) {
    return lead.lead_status?.status ?? 'lead'
  }

  function handleDragStart(e: React.DragEvent, phone: string) {
    setDragId(phone)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent, colKey: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setOverCol(colKey)
  }

  function handleDragLeave(e: React.DragEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setOverCol(null)
  }

  async function handleDrop(e: React.DragEvent, colKey: string) {
    e.preventDefault()
    setOverCol(null)
    const id = dragId
    if (!id) return

    const lead = leads.find(l => l.business_phone === id)
    setDragId(null)
    if (!lead) return

    // Cancel drop if destination is the same column — no update, no reset
    if (getStatus(lead) === colKey) return

    const now = new Date().toISOString()

    // Optimistic update
    setLeads(prev =>
      prev.map(l => {
        if (l.business_phone !== id) return l
        return {
          ...l,
          lead_status: {
            ...(l.lead_status ?? { business_phone: l.business_phone, call_count: 0, offer_amount: null, last_called_at: null, last_emailed_at: null, status_changed_at: null }),
            status: colKey as LeadStatus['status'],
            status_changed_at: now,
          },
        }
      })
    )

    // Sync to DB
    await supabase.from('lead_status').upsert({
      business_phone: id,
      status: colKey,
      call_count: lead.lead_status?.call_count ?? 0,
      last_called_at: lead.lead_status?.last_called_at ?? null,
      offer_amount: lead.lead_status?.offer_amount ?? null,
      status_changed_at: now,
    }, { onConflict: 'business_phone' })
  }

  function handleDragEnd() {
    setDragId(null)
    setOverCol(null)
  }

  // ── Log a Call modal ──────────────────────────────────────────────

  function openLogCall() {
    setShowLogCall(true)
    setLogSearch('')
    setLogPhone(null)
    setLogNote('')
    setLogDate(localNow())
    setShowDropdown(false)
  }

  function closeLogCall() {
    setShowLogCall(false)
    setLogSearch('')
    setLogPhone(null)
    setLogNote('')
    setLogDate('')
    setShowDropdown(false)
  }

  const filteredLeads = leads
    .filter(l => {
      const q = logSearch.toLowerCase()
      return l.company_name.toLowerCase().includes(q) || l.business_phone.includes(q)
    })
    .slice(0, 8)

  function selectLead(lead: LeadCard) {
    setLogPhone(lead.business_phone)
    setLogSearch(lead.company_name)
    setShowDropdown(false)
  }

  async function handleLogCallSubmit() {
    if (!logPhone || !logNote.trim() || !logDate) return
    setLogSubmitting(true)
    const now = new Date(logDate).toISOString()
    const lead = leads.find(l => l.business_phone === logPhone)

    await supabase.from('call_log').insert({
      business_phone: logPhone,
      called_at: now,
      note: logNote.trim(),
    })

    await supabase.from('lead_status').upsert({
      business_phone: logPhone,
      status: lead?.lead_status?.status ?? 'lead',
      call_count: (lead?.lead_status?.call_count ?? 0) + 1,
      last_called_at: now,
      offer_amount: lead?.lead_status?.offer_amount ?? null,
      status_changed_at: lead?.lead_status?.status_changed_at ?? now,
    }, { onConflict: 'business_phone' })

    // Update local state
    setLeads(prev => prev.map(l => {
      if (l.business_phone !== logPhone) return l
      return {
        ...l,
        lead_status: {
          ...(l.lead_status ?? { business_phone: logPhone, status: 'lead' as LeadStatus['status'], offer_amount: null, last_emailed_at: null, status_changed_at: now }),
          call_count: (l.lead_status?.call_count ?? 0) + 1,
          last_called_at: now,
        },
      }
    }))

    setLogSubmitting(false)
    closeLogCall()
  }

  // ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 40, color: 'var(--text-muted)', fontFamily: 'monospace' }}>Loading...</div>
    )
  }

  return (
    <div style={{ padding: '32px 40px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Pipeline</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>Drag cards to update status</p>
        </div>
        <button
          onClick={openLogCall}
          style={{
            background: '#3ecf8e',
            color: '#0a0a0a',
            border: 'none',
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.02em',
          }}
        >
          + Log a Call
        </button>
      </div>

      <div style={{ display: 'flex', gap: 13, flex: 1, overflow: 'auto', alignItems: 'stretch', paddingBottom: 16 }}>
        {COLUMNS.map(col => {
          const cards = leads
            .filter(l => getStatus(l) === col.key)
            .sort((a, b) => {
              const aTime = a.lead_status?.status_changed_at ?? ''
              const bTime = b.lead_status?.status_changed_at ?? ''
              return aTime.localeCompare(bTime)
            })
          const isDragOver = overCol === col.key

          return (
            /* Outer lane: full-height drop target */
            <div
              key={col.key}
              onDragOver={e => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, col.key)}
              style={{
                minWidth: 220,
                width: 220,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Visible card container — natural height, no stretching */}
              <div
                style={{
                  background: isDragOver ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                  border: `1px solid ${isDragOver ? col.color + '66' : 'var(--border)'}`,
                  borderRadius: 8,
                  padding: '14px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  transition: 'background 0.15s, border-color 0.15s',
                }}
              >
                {/* Column header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: col.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {col.label}
                  </span>
                  <span style={{
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-elevated)',
                    borderRadius: 4,
                    padding: '1px 6px',
                  }}>
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                {cards.map(lead => (
                  <div
                    key={lead.business_phone}
                    draggable
                    onDragStart={e => handleDragStart(e, lead.business_phone)}
                    onDragEnd={handleDragEnd}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '12px',
                      cursor: 'grab',
                      opacity: dragId === lead.business_phone ? 0.4 : 1,
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = col.color + '66')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {lead.company_name}
                    </div>
                    {lead.owner_name && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{lead.owner_name}</div>
                    )}
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: 4 }}>
                      {lead.owner_phone ?? lead.business_phone}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 }}>
                      <div>
                        {getStatus(lead) === 'pending' && lead.lead_status?.offer_amount != null && (
                          <span style={{
                            display: 'inline-block',
                            fontFamily: 'monospace',
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#3ecf8e',
                            background: 'rgba(62, 207, 142, 0.1)',
                            border: '1px solid rgba(62, 207, 142, 0.25)',
                            borderRadius: 4,
                            padding: '2px 8px',
                          }}>
                            ${lead.lead_status.offer_amount.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {(lead.lead_status?.status_changed_at || lead.created_at) && (
                        <span style={{
                          fontFamily: 'monospace',
                          fontSize: 10,
                          color: '#666',
                        }}>
                          {Math.floor((Date.now() - new Date(lead.lead_status?.status_changed_at ?? lead.created_at).getTime()) / 86400000)}d
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {cards.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: '16px 0', fontStyle: 'italic' }}>
                    Drop here
                  </div>
                )}
              </div>

              {/* Invisible spacer — extends the drop zone to fill remaining viewport height */}
              <div style={{ flex: 1 }} />
            </div>
          )
        })}
      </div>

      {/* Log a Call modal */}
      {showLogCall && (
        <div
          onClick={e => { if (e.target === e.currentTarget) closeLogCall() }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '28px 28px 24px',
            width: 420,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Log a Call</h2>
              <button
                onClick={closeLogCall}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 2 }}
              >
                ×
              </button>
            </div>

            {/* Lead selector */}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>
                Lead
              </label>
              <div ref={dropdownRef} style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search company or phone..."
                  value={logSearch}
                  onChange={e => {
                    setLogSearch(e.target.value)
                    setLogPhone(null)
                    setShowDropdown(true)
                  }}
                  onFocus={() => setShowDropdown(true)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {showDropdown && filteredLeads.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    zIndex: 10,
                    overflow: 'hidden',
                    maxHeight: 220,
                    overflowY: 'auto',
                  }}>
                    {filteredLeads.map(l => (
                      <div
                        key={l.business_phone}
                        onMouseDown={() => selectLead(l)}
                        style={{
                          padding: '9px 12px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderBottom: '1px solid var(--border)',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{l.company_name}</span>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{l.business_phone}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Date & Time */}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>
                Date &amp; Time
              </label>
              <input
                type="datetime-local"
                value={logDate}
                onChange={e => setLogDate(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                  colorScheme: 'dark',
                  fontFamily: 'monospace',
                }}
              />
            </div>

            {/* Note */}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>
                Note
              </label>
              <textarea
                placeholder="What happened on this call?"
                value={logNote}
                onChange={e => setLogNote(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={closeLogCall}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '8px 16px',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleLogCallSubmit}
                disabled={!logPhone || !logNote.trim() || !logDate || logSubmitting}
                style={{
                  background: !logPhone || !logNote.trim() || !logDate || logSubmitting ? '#1f4a37' : '#3ecf8e',
                  color: !logPhone || !logNote.trim() || !logDate || logSubmitting ? '#3ecf8e88' : '#0a0a0a',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: !logPhone || !logNote.trim() || !logDate || logSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {logSubmitting ? 'Saving...' : 'Log Call'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
