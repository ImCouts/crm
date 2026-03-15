'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase, type Lead, type LeadStatus, type CallLog, type Task } from '@/lib/supabase'

type LeadRow = Lead & { lead_status: LeadStatus | null }

const STATUS_OPTIONS = ['lead', 'discovery_call', 'interested', 'booked', 'lost']
const STATUS_LABELS: Record<string, string> = {
  lead: 'Lead',
  discovery_call: 'Discovery Call',
  interested: 'Interested',
  booked: 'Booked',
  lost: 'Lost',
}

type Tab = 'overview' | 'calls' | 'tasks'

export default function LeadDrawer({
  lead,
  onClose,
  onUpdate,
}: {
  lead: LeadRow
  onClose: () => void
  onUpdate: () => void
}) {
  const [tab, setTab] = useState<Tab>('overview')
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editFields, setEditFields] = useState<Partial<Lead>>({})
  const [saving, setSaving] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', description: '', due_at: '' })
  const [addingTask, setAddingTask] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  const phone = lead.business_phone

  useEffect(() => {
    fetchCallLogs()
    fetchTasks()
  }, [phone])

  async function fetchCallLogs() {
    const { data } = await supabase
      .from('call_log')
      .select('*')
      .eq('business_phone', phone)
      .order('called_at', { ascending: false })
    setCallLogs(data ?? [])
  }

  async function fetchTasks() {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('business_phone', phone)
      .order('due_at', { ascending: true })
    setTasks(data ?? [])
  }

  async function logCall() {
    if (!note.trim()) return
    setSubmitting(true)
    const now = new Date().toISOString()

    await supabase.from('call_log').insert({
      business_phone: phone,
      called_at: now,
      note: note.trim(),
    })

    // Upsert lead_status: increment call_count, update last_called_at
    const current = lead.lead_status
    await supabase.from('lead_status').upsert({
      business_phone: phone,
      status: current?.status ?? 'lead',
      call_count: (current?.call_count ?? 0) + 1,
      last_called_at: now,
    }, { onConflict: 'business_phone' })

    setNote('')
    setSubmitting(false)
    fetchCallLogs()
    onUpdate()
  }

  async function saveLeadFields() {
    if (Object.keys(editFields).length === 0) return
    setSaving(true)
    await supabase.from('leads').update(editFields).eq('business_phone', phone)
    setSaving(false)
    setEditFields({})
    onUpdate()
  }

  async function updateStatus(status: string) {
    await supabase.from('lead_status').upsert({
      business_phone: phone,
      status,
      call_count: lead.lead_status?.call_count ?? 0,
    }, { onConflict: 'business_phone' })
    onUpdate()
  }

  async function addTask() {
    if (!newTask.title.trim() || !newTask.due_at) return
    setAddingTask(true)
    await supabase.from('tasks').insert({
      business_phone: phone,
      title: newTask.title.trim(),
      description: newTask.description.trim() || null,
      due_at: new Date(newTask.due_at).toISOString(),
      completed: false,
    })
    setNewTask({ title: '', description: '', due_at: '' })
    setAddingTask(false)
    fetchTasks()
  }

  async function toggleTask(task: Task) {
    await supabase.from('tasks').update({ completed: !task.completed }).eq('id', task.id)
    fetchTasks()
  }

  const fieldVal = (key: keyof Lead) => (editFields[key] !== undefined ? editFields[key] : lead[key]) as string | number | null

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 40,
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 600,
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
              {lead.company_name}
            </h2>
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{phone}</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
          {(['overview', 'calls', 'tasks'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                color: tab === t ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: tab === t ? 600 : 400,
                padding: '12px 16px',
                marginBottom: -1,
                transition: 'color 0.15s',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

          {/* OVERVIEW TAB */}
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Status */}
              <div>
                <Label>Status</Label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                  {STATUS_OPTIONS.map(s => {
                    const active = (lead.lead_status?.status ?? 'lead') === s
                    return (
                      <button
                        key={s}
                        onClick={() => updateStatus(s)}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 4,
                          border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          background: active ? 'var(--accent-dim)' : 'transparent',
                          color: active ? 'var(--accent)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: active ? 600 : 400,
                          transition: 'all 0.1s',
                        }}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <EditField label="Owner Name" value={fieldVal('owner_name') as string | null} onChange={v => setEditFields(p => ({ ...p, owner_name: v }))} />
                <EditField label="Owner Phone" value={fieldVal('owner_phone') as string | null} onChange={v => setEditFields(p => ({ ...p, owner_phone: v }))} />
                <EditField label="Website" value={fieldVal('website') as string | null} onChange={v => setEditFields(p => ({ ...p, website: v }))} />
                <EditField label="RBQ" value={fieldVal('rbq') as string | null} onChange={v => setEditFields(p => ({ ...p, rbq: v }))} />
                <EditField label="Approx Revenue" value={fieldVal('approx_rev') as string | null} onChange={v => setEditFields(p => ({ ...p, approx_rev: v ? Number(v) : null }))} type="number" />
                <EditField label="Employee Count" value={fieldVal('employee_count') as string | null} onChange={v => setEditFields(p => ({ ...p, employee_count: v ? Number(v) : null }))} type="number" />
              </div>

              {Object.keys(editFields).length > 0 && (
                <button
                  onClick={saveLeadFields}
                  disabled={saving}
                  style={{
                    alignSelf: 'flex-start',
                    background: 'var(--accent)',
                    color: '#000',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 20px',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              )}

              {/* Meta */}
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 6, padding: 16, fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 24 }}>
                <span>Calls: <strong style={{ color: 'var(--text-secondary)' }}>{lead.lead_status?.call_count ?? 0}</strong></span>
                <span>Last Called: <strong style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  {lead.lead_status?.last_called_at ? new Date(lead.lead_status.last_called_at).toLocaleDateString() : '—'}
                </strong></span>
                <span>Created: <strong style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  {new Date(lead.created_at).toLocaleDateString()}
                </strong></span>
              </div>
            </div>
          )}

          {/* CALLS TAB */}
          {tab === 'calls' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Log call form */}
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: 16 }}>
                <Label>Log a Call</Label>
                <textarea
                  placeholder="Call notes..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '10px 12px',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    resize: 'vertical',
                    outline: 'none',
                    marginTop: 8,
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={logCall}
                  disabled={submitting || !note.trim()}
                  style={{
                    marginTop: 10,
                    background: 'var(--accent)',
                    color: '#000',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 20px',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: submitting || !note.trim() ? 'not-allowed' : 'pointer',
                    opacity: submitting || !note.trim() ? 0.5 : 1,
                  }}
                >
                  {submitting ? 'Logging...' : 'Log Call'}
                </button>
              </div>

              {/* Call history */}
              <div>
                <Label>Call History</Label>
                {callLogs.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>No calls logged yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    {callLogs.map(c => (
                      <div key={c.id} style={{ background: 'var(--bg-elevated)', borderRadius: 6, padding: '12px 14px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 4 }}>
                          {new Date(c.called_at).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{c.note ?? <em>No note</em>}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TASKS TAB */}
          {tab === 'tasks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Add task */}
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: 16 }}>
                <Label>Add Task</Label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  <input
                    placeholder="Task title"
                    value={newTask.title}
                    onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                    style={inputStyle}
                  />
                  <input
                    placeholder="Description (optional)"
                    value={newTask.description}
                    onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                    style={inputStyle}
                  />
                  <input
                    type="datetime-local"
                    value={newTask.due_at}
                    onChange={e => setNewTask(p => ({ ...p, due_at: e.target.value }))}
                    style={inputStyle}
                  />
                  <button
                    onClick={addTask}
                    disabled={addingTask || !newTask.title.trim() || !newTask.due_at}
                    style={{
                      alignSelf: 'flex-start',
                      background: 'var(--accent)',
                      color: '#000',
                      border: 'none',
                      borderRadius: 6,
                      padding: '8px 20px',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: addingTask || !newTask.title.trim() || !newTask.due_at ? 'not-allowed' : 'pointer',
                      opacity: addingTask || !newTask.title.trim() || !newTask.due_at ? 0.5 : 1,
                    }}
                  >
                    Add Task
                  </button>
                </div>
              </div>

              {/* Task list */}
              <div>
                <Label>Tasks</Label>
                {tasks.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>No tasks for this lead.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {tasks.map(task => {
                      const overdue = !task.completed && new Date(task.due_at) < new Date()
                      return (
                        <div
                          key={task.id}
                          style={{
                            background: 'var(--bg-elevated)',
                            borderRadius: 6,
                            padding: '10px 14px',
                            border: `1px solid ${overdue ? 'var(--danger)' : 'var(--border-subtle)'}`,
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => toggleTask(task)}
                            style={{ marginTop: 2, accentColor: 'var(--accent)', cursor: 'pointer' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: 13,
                              color: task.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                              textDecoration: task.completed ? 'line-through' : 'none',
                            }}>
                              {task.title}
                            </div>
                            {task.description && (
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{task.description}</div>
                            )}
                            <div style={{ fontSize: 11, fontFamily: 'monospace', color: overdue ? 'var(--danger)' : 'var(--text-muted)', marginTop: 4 }}>
                              Due: {new Date(task.due_at).toLocaleString()}
                              {overdue && ' — OVERDUE'}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {children}
    </div>
  )
}

function EditField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string | number | null
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        style={{ ...inputStyle, marginTop: 4 }}
      />
    </div>
  )
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
