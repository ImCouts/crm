'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, type Lead, type LeadStatus } from '@/lib/supabase'
import LeadDrawer from '@/components/LeadDrawer'

type LeadRow = Lead & { lead_status: LeadStatus | null }

const STATUS_OPTIONS = ['all', 'lead', 'discovery_call', 'interested', 'booked', 'lost']
const STATUS_LABELS: Record<string, string> = {
  all: 'All',
  lead: 'Lead',
  discovery_call: 'Discovery Call',
  interested: 'Interested',
  booked: 'Booked',
  lost: 'Lost',
}
const STATUS_COLORS: Record<string, string> = {
  lead: '#888',
  discovery_call: '#60a5fa',
  interested: '#fbbf24',
  booked: '#3ecf8e',
  lost: '#f87171',
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null)

  const fetchLeads = useCallback(async () => {
    const { data } = await supabase
      .from('leads')
      .select('*, lead_status(*)')
      .order('created_at', { ascending: false })
    setLeads((data as LeadRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const filtered = leads.filter(lead => {
    const matchSearch =
      !search ||
      lead.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      lead.business_phone?.includes(search)
    const effectiveStatus = lead.lead_status?.status ?? 'lead'
    const matchStatus = statusFilter === 'all' || effectiveStatus === statusFilter
    return matchSearch && matchStatus
  })

  function formatRev(v: number | null) {
    if (!v) return '—'
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
    return `$${v}`
  }

  return (
    <div style={{ padding: '32px 40px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Leads</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>{leads.length} total</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search by company or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '8px 12px',
            color: 'var(--text-primary)',
            fontSize: 13,
            width: 280,
            outline: 'none',
          }}
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '8px 12px',
            color: 'var(--text-primary)',
            fontSize: 13,
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>Loading...</div>
      ) : (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Company', 'Owner', 'Phone', 'Revenue', 'Employees', 'Status', 'Last Called', 'Calls'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No leads found.
                  </td>
                </tr>
              ) : filtered.map((lead, i) => {
                const status = lead.lead_status?.status ?? 'lead'
                return (
                  <tr
                    key={lead.business_phone}
                    onClick={() => setSelectedLead(lead)}
                    style={{
                      borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--text-primary)' }}>{lead.company_name}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{lead.owner_name ?? '—'}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>{lead.business_phone}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>{formatRev(lead.approx_rev)}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 12, textAlign: 'center' }}>{lead.employee_count ?? '—'}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        color: STATUS_COLORS[status],
                        background: STATUS_COLORS[status] + '22',
                        whiteSpace: 'nowrap',
                      }}>
                        {STATUS_LABELS[status]}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}>
                      {lead.lead_status?.last_called_at
                        ? new Date(lead.lead_status.last_called_at).toLocaleDateString()
                        : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12, textAlign: 'center' }}>
                      {lead.lead_status?.call_count ?? 0}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={fetchLeads}
        />
      )}
    </div>
  )
}
