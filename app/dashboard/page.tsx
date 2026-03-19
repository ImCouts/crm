'use client'

import { useEffect, useState } from 'react'
import { supabase, type CallLog, type LeadStatus } from '@/lib/supabase'

type Stats = {
  totalLeads: number
  byStatus: Record<string, number>
  totalCalls: number
  pendingPipeline: number
}

type RecentCall = CallLog & { leads: { company_name: string } | null }

const STATUS_LABELS: Record<string, string> = {
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

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [leadsRes, statusRes, callsRes, recentRes, pendingRes] = await Promise.all([
        supabase.from('leads').select('business_phone', { count: 'exact', head: true }),
        supabase.from('lead_status').select('status'),
        supabase.from('call_log').select('id', { count: 'exact', head: true }),
        supabase
          .from('call_log')
          .select('*, leads(company_name)')
          .order('called_at', { ascending: false })
          .limit(10),
        supabase.from('lead_status').select('offer_amount').eq('status', 'pending'),
      ])

      const byStatus: Record<string, number> = { lead: 0, no_answer: 0, discovery_call: 0, interested: 0, booked: 0, pending: 0, lost: 0 }
      if (statusRes.data) {
        for (const row of statusRes.data) {
          const s = row.status ?? 'lead'
          byStatus[s] = (byStatus[s] ?? 0) + 1
        }
        // Count leads with no status row as 'lead'
        const withStatus = statusRes.data.length
        const total = leadsRes.count ?? 0
        byStatus['lead'] = (byStatus['lead'] ?? 0) + (total - withStatus)
      }

      const pendingPipeline = (pendingRes.data ?? []).reduce(
        (sum, row) => sum + (row.offer_amount ?? 0), 0
      )

      setStats({
        totalLeads: leadsRes.count ?? 0,
        byStatus,
        totalCalls: callsRes.count ?? 0,
        pendingPipeline,
      })
      setRecentCalls((recentRes.data as RecentCall[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>Overview of your pipeline</p>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>Loading...</div>
      ) : (
        <>
          {/* Pending Pipeline Capsule */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(62, 207, 142, 0.08), rgba(62, 207, 142, 0.02))',
            border: '1px solid rgba(62, 207, 142, 0.3)',
            borderRadius: 10,
            padding: '20px 28px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Pending Pipeline
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent)' }}>
                ${(stats?.pendingPipeline ?? 0).toLocaleString()}
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Sum of all pending offers
            </div>
          </div>

          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 40 }}>
            <StatCard label="Total Leads" value={stats?.totalLeads ?? 0} accent />
            <StatCard label="Total Calls" value={stats?.totalCalls ?? 0} />
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <StatCard
                key={key}
                label={label}
                value={stats?.byStatus[key] ?? 0}
                color={STATUS_COLORS[key]}
              />
            ))}
          </div>

          {/* Recent Calls */}
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 16px', color: 'var(--text-primary)' }}>
              Recent Calls
            </h2>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Company', 'Called At', 'Note'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentCalls.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No calls logged yet.
                      </td>
                    </tr>
                  ) : (
                    recentCalls.map((call, i) => (
                      <tr
                        key={call.id}
                        style={{
                          borderBottom: i < recentCalls.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        }}
                      >
                        <td style={{ padding: '10px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>
                          {call.leads?.company_name ?? call.business_phone}
                        </td>
                        <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>
                          {new Date(call.called_at).toLocaleString()}
                        </td>
                        <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {call.note ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, accent, color }: { label: string; value: number; accent?: boolean; color?: string }) {
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: `1px solid ${accent ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 8,
        padding: '20px',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'monospace', color: color ?? (accent ? 'var(--accent)' : 'var(--text-primary)') }}>
        {value}
      </div>
    </div>
  )
}
