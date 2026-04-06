'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, type Lead, type LeadStatus } from '@/lib/supabase'
import LeadDrawer from '@/components/LeadDrawer'

type LeadRow = Lead & { lead_status: LeadStatus | null }

const STATUS_OPTIONS = ['all', 'lead', 'no_answer', 'discovery_call', 'interested', 'booked', 'pending', 'lost']
const STATUS_LABELS: Record<string, string> = {
  all: 'All',
  lead: 'Lead',
  no_answer: 'No Answer',
  discovery_call: 'Discovery Call',
  interested: 'Interested',
  booked: 'Booked',
  pending: 'Pending',
  lost: 'Lost',
}
const STATUS_COLORS: Record<string, string> = {
  lead: '#7D5638',
  no_answer: '#807e7c',
  discovery_call: '#60a5fa',
  interested: '#fbbf24',
  booked: '#3ecf8e',
  pending: '#a78bfa',
  lost: '#f87171',
}

function formatPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') digits = digits.slice(1)
  digits = digits.slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

const emptyForm = {
  business_phone: '',
  company_name: '',
  owner_name: '',
  owner_phone: '',
  email: '',
  website: '',
  rbq: '',
  approx_rev: '',
  employee_count: '',
  industry: '',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '8px 10px',
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState(emptyForm)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const fetchLeads = useCallback(async () => {
    const { data } = await supabase
      .from('leads')
      .select('*, lead_status(*)')
      .order('created_at', { ascending: false })
    setLeads((data as LeadRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  async function createLead() {
    if (!createForm.business_phone.trim() || !createForm.company_name.trim()) return
    setCreating(true)
    setCreateError('')
    const stripNonDigits = (v: string) => v.replace(/\D/g, '')
    const { error } = await supabase.from('leads').insert({
      business_phone: stripNonDigits(createForm.business_phone),
      company_name: createForm.company_name.trim(),
      owner_name: createForm.owner_name.trim() || null,
      owner_phone: createForm.owner_phone.trim() || null,
      email: createForm.email.trim() || null,
      website: createForm.website.trim() || null,
      rbq: stripNonDigits(createForm.rbq) || null,
      approx_rev: createForm.approx_rev ? Number(createForm.approx_rev) : null,
      employee_count: createForm.employee_count ? Number(createForm.employee_count) : null,
      industry: createForm.industry.trim() || null,
    })
    if (error) {
      setCreateError(error.code === '23505' ? 'A lead with this phone number already exists.' : error.message)
      setCreating(false)
      return
    }
    // Create lead_status row so aging starts immediately
    await supabase.from('lead_status').insert({
      business_phone: stripNonDigits(createForm.business_phone),
      status: 'lead',
      call_count: 0,
      status_changed_at: new Date().toISOString(),
    })
    setCreating(false)
    setCreateForm(emptyForm)
    setShowCreateModal(false)
    fetchLeads()
  }

  const filtered = leads.filter(lead => {
    const q = search.toLowerCase()
    const matchSearch =
      !search ||
      lead.company_name?.toLowerCase().includes(q) ||
      lead.business_phone?.includes(search) ||
      lead.industry?.toLowerCase().includes(q)
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

      {/* Filters + Create button */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search by company, phone, or industry..."
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
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            background: 'var(--accent)',
            color: '#000',
            border: 'none',
            borderRadius: 6,
            padding: '8px 20px',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          + Create Lead
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>Loading...</div>
      ) : (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Company', 'Owner', 'Phone', 'Revenue', 'Industry', 'Employees', 'Status', 'Last Called', 'Calls'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
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
                    <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontSize: 12 }}>{lead.industry ?? '—'}</td>
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
          onUpdate={async () => {
            const { data } = await supabase
              .from('leads')
              .select('*, lead_status(*)')
              .order('created_at', { ascending: false })
            const fresh = (data as LeadRow[]) ?? []
            setLeads(fresh)
            setSelectedLead(prev => prev ? fresh.find(l => l.business_phone === prev.business_phone) ?? null : null)
          }}
          onDelete={() => {
            setSelectedLead(null)
            fetchLeads()
          }}
        />
      )}

      {/* Create Lead Modal */}
      {showCreateModal && (
        <>
          <div
            onClick={() => { setShowCreateModal(false); setCreateError('') }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }}
          />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 480,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            zIndex: 50,
            padding: 28,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>Create Lead</h2>
              <button
                onClick={() => { setShowCreateModal(false); setCreateError('') }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}
              >×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Business Phone *
                </label>
                <input
                  value={createForm.business_phone}
                  onChange={e => setCreateForm(p => ({ ...p, business_phone: e.target.value }))}
                  placeholder="e.g. 514-555-1234"
                  style={{ ...inputStyle, marginTop: 4 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Company Name *
                </label>
                <input
                  value={createForm.company_name}
                  onChange={e => setCreateForm(p => ({ ...p, company_name: e.target.value }))}
                  placeholder="Company name"
                  style={{ ...inputStyle, marginTop: 4 }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Owner Name
                  </label>
                  <input
                    value={createForm.owner_name}
                    onChange={e => setCreateForm(p => ({ ...p, owner_name: e.target.value }))}
                    style={{ ...inputStyle, marginTop: 4 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Owner Phone
                  </label>
                  <input
                    value={createForm.owner_phone}
                    onChange={e => setCreateForm(p => ({ ...p, owner_phone: formatPhone(e.target.value) }))}
                    placeholder="(xxx) xxx-xxxx"
                    style={{ ...inputStyle, marginTop: 4, fontFamily: 'monospace' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="owner@company.com"
                  style={{ ...inputStyle, marginTop: 4 }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Website
                  </label>
                  <input
                    value={createForm.website}
                    onChange={e => setCreateForm(p => ({ ...p, website: e.target.value }))}
                    style={{ ...inputStyle, marginTop: 4 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    RBQ
                  </label>
                  <input
                    value={createForm.rbq}
                    onChange={e => setCreateForm(p => ({ ...p, rbq: e.target.value }))}
                    style={{ ...inputStyle, marginTop: 4 }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Approx Revenue
                  </label>
                  <input
                    type="number"
                    value={createForm.approx_rev}
                    onChange={e => setCreateForm(p => ({ ...p, approx_rev: e.target.value }))}
                    style={{ ...inputStyle, marginTop: 4 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Employee Count
                  </label>
                  <input
                    type="number"
                    value={createForm.employee_count}
                    onChange={e => setCreateForm(p => ({ ...p, employee_count: e.target.value }))}
                    style={{ ...inputStyle, marginTop: 4 }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Industry
                </label>
                <input
                  value={createForm.industry}
                  onChange={e => setCreateForm(p => ({ ...p, industry: e.target.value }))}
                  placeholder="e.g. Construction, Plumbing..."
                  style={{ ...inputStyle, marginTop: 4 }}
                />
              </div>

              {createError && (
                <div style={{ color: 'var(--danger)', fontSize: 13 }}>{createError}</div>
              )}

              <button
                onClick={createLead}
                disabled={creating || !createForm.business_phone.trim() || !createForm.company_name.trim()}
                style={{
                  marginTop: 4,
                  background: 'var(--accent)',
                  color: '#000',
                  border: 'none',
                  borderRadius: 6,
                  padding: '10px 20px',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: creating || !createForm.business_phone.trim() || !createForm.company_name.trim() ? 'not-allowed' : 'pointer',
                  opacity: creating || !createForm.business_phone.trim() || !createForm.company_name.trim() ? 0.5 : 1,
                }}
              >
                {creating ? 'Creating...' : 'Create Lead'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
