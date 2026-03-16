'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase, type Lead, type LeadStatus } from '@/lib/supabase'

type LeadCard = Lead & { lead_status: LeadStatus | null }

const COLUMNS: { key: string; label: string; color: string }[] = [
  { key: 'lead', label: 'Lead', color: '#888' },
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

  function handleDragLeave() {
    setOverCol(null)
  }

  async function handleDrop(e: React.DragEvent, colKey: string) {
    e.preventDefault()
    setOverCol(null)
    if (!dragId) return

    const now = new Date().toISOString()

    // Optimistic update
    setLeads(prev =>
      prev.map(l => {
        if (l.business_phone !== dragId) return l
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
    setDragId(null)

    // Sync to DB
    const lead = leads.find(l => l.business_phone === dragId)
    if (!lead) return
    await supabase.from('lead_status').upsert({
      business_phone: dragId,
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

  if (loading) {
    return (
      <div style={{ padding: 40, color: 'var(--text-muted)', fontFamily: 'monospace' }}>Loading...</div>
    )
  }

  return (
    <div style={{ padding: '32px 40px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Pipeline</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>Drag cards to update status</p>
      </div>

      <div style={{ display: 'flex', gap: 16, flex: 1, overflow: 'auto', alignItems: 'flex-start', paddingBottom: 16 }}>
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
            <div
              key={col.key}
              onDragOver={e => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, col.key)}
              style={{
                minWidth: 220,
                width: 220,
                background: isDragOver ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                border: `1px solid ${isDragOver ? col.color + '66' : 'var(--border)'}`,
                borderRadius: 8,
                padding: '14px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'background 0.15s, border-color 0.15s',
                minHeight: 200,
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
                    background: dragId === lead.business_phone ? 'var(--bg-elevated)' : 'var(--bg-elevated)',
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
                    {lead.lead_status?.status_changed_at && (
                      <span style={{
                        fontFamily: 'monospace',
                        fontSize: 10,
                        color: '#666',
                      }}>
                        {Math.floor((Date.now() - new Date(lead.lead_status.status_changed_at).getTime()) / 86400000)}d
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
          )
        })}
      </div>
    </div>
  )
}
