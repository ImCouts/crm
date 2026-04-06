'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase, type Lead, type LeadStatus, type CallLog, type Task, type Note, type Contact } from '@/lib/supabase'

type LeadRow = Lead & { lead_status: LeadStatus | null }

function formatPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') digits = digits.slice(1)
  digits = digits.slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

const STATUS_OPTIONS = ['lead', 'no_answer', 'discovery_call', 'interested', 'booked', 'pending', 'lost']
const STATUS_LABELS: Record<string, string> = {
  lead: 'Lead',
  no_answer: 'No Answer',
  discovery_call: 'Discovery Call',
  interested: 'Interested',
  booked: 'Booked',
  pending: 'Pending',
  lost: 'Lost',
}

type Tab = 'overview' | 'contacts' | 'calls' | 'tasks' | 'notes'

function localNow() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export default function LeadDrawer({
  lead,
  onClose,
  onUpdate,
  onDelete,
}: {
  lead: LeadRow
  onClose: () => void
  onUpdate: () => void
  onDelete?: () => void
}) {
  const [tab, setTab] = useState<Tab>('overview')
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [note, setNote] = useState('')
  const [callDate, setCallDate] = useState(localNow())
  const [submitting, setSubmitting] = useState(false)
  const [editFields, setEditFields] = useState<Partial<Lead>>({})
  const [saving, setSaving] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', description: '', due_at: localNow() })
  const [addingTask, setAddingTask] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [noteContent, setNoteContent] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [activeStatus, setActiveStatus] = useState<string>(lead.lead_status?.status ?? 'lead')
  const [offerAmount, setOfferAmount] = useState<string>(lead.lead_status?.offer_amount?.toString() ?? '')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [showAddContact, setShowAddContact] = useState(false)
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', role: '' })
  const [savingContact, setSavingContact] = useState(false)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [editContactFields, setEditContactFields] = useState<{ name: string; phone: string; email: string; role: string }>({ name: '', phone: '', email: '', role: '' })
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneInput, setPhoneInput] = useState(lead.business_phone)
  const overlayRef = useRef<HTMLDivElement>(null)

  const phone = lead.business_phone

  useEffect(() => {
    fetchCallLogs()
    fetchTasks()
    fetchNotes()
    fetchContacts()
  }, [phone])

  async function deleteCall(id: string) {
    await supabase.from('call_log').delete().eq('id', id)
    fetchCallLogs()
    onUpdate()
  }

  async function fetchNotes() {
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('business_phone', phone)
      .order('created_at', { ascending: false })
    setNotes(data ?? [])
  }

  async function addNote() {
    if (!noteContent.trim()) return
    setAddingNote(true)
    await supabase.from('notes').insert({
      business_phone: phone,
      content: noteContent.trim(),
    })
    setNoteContent('')
    setAddingNote(false)
    fetchNotes()
  }

  async function deleteNote(id: string) {
    await supabase.from('notes').delete().eq('id', id)
    fetchNotes()
  }

  async function fetchContacts() {
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('business_phone', phone)
      .order('created_at', { ascending: true })
    setContacts(data ?? [])
  }

  async function addContact() {
    const payload = {
      business_phone: phone,
      name: newContact.name.trim() || null,
      phone: newContact.phone.trim() || null,
      email: newContact.email.trim() || null,
      role: newContact.role.trim() || null,
    }
    setSavingContact(true)
    await supabase.from('contacts').insert(payload)
    setNewContact({ name: '', phone: '', email: '', role: '' })
    setShowAddContact(false)
    setSavingContact(false)
    fetchContacts()
  }

  async function saveEditContact(id: string) {
    await supabase.from('contacts').update({
      name: editContactFields.name.trim() || null,
      phone: editContactFields.phone.trim() || null,
      email: editContactFields.email.trim() || null,
      role: editContactFields.role.trim() || null,
    }).eq('id', id)
    setEditingContactId(null)
    fetchContacts()
  }

  async function deleteContact(id: string) {
    await supabase.from('contacts').delete().eq('id', id)
    fetchContacts()
  }

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
    const calledAt = new Date(callDate).toISOString()

    await supabase.from('call_log').insert({
      business_phone: phone,
      called_at: calledAt,
      note: note.trim(),
    })

    // Upsert lead_status: increment call_count, update last_called_at
    const current = lead.lead_status
    await supabase.from('lead_status').upsert({
      business_phone: phone,
      status: current?.status ?? 'lead',
      call_count: (current?.call_count ?? 0) + 1,
      last_called_at: calledAt,
    }, { onConflict: 'business_phone' })

    setNote('')
    setCallDate(localNow())
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
    setActiveStatus(status)
    await supabase.from('lead_status').upsert({
      business_phone: phone,
      status,
      call_count: lead.lead_status?.call_count ?? 0,
      offer_amount: lead.lead_status?.offer_amount ?? null,
      status_changed_at: new Date().toISOString(),
    }, { onConflict: 'business_phone' })
    onUpdate()
  }

  async function saveOfferAmount() {
    const amount = offerAmount.trim() === '' ? null : Number(offerAmount)
    await supabase.from('lead_status').upsert({
      business_phone: phone,
      status: activeStatus,
      call_count: lead.lead_status?.call_count ?? 0,
      offer_amount: amount,
    }, { onConflict: 'business_phone' })
    onUpdate()
  }

  async function deleteLead() {
    setDeleting(true)
    // Delete related records first, then the lead itself
    await supabase.from('notes').delete().eq('business_phone', phone)
    await supabase.from('tasks').delete().eq('business_phone', phone)
    await supabase.from('call_log').delete().eq('business_phone', phone)
    await supabase.from('lead_status').delete().eq('business_phone', phone)
    await supabase.from('leads').delete().eq('business_phone', phone)
    setDeleting(false)
    onDelete?.()
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
    setNewTask({ title: '', description: '', due_at: localNow() })
    setAddingTask(false)
    fetchTasks()
  }

  async function toggleTask(task: Task) {
    await supabase.from('tasks').update({ completed: !task.completed }).eq('id', task.id)
    fetchTasks()
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id)
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
          {(['overview', 'contacts', 'calls', 'tasks', 'notes'] as Tab[]).map(t => (
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
                    const active = activeStatus === s
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

              {/* Offer Amount */}
              <div>
                <Label>Offer Amount</Label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13 }}>$</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={offerAmount}
                      onChange={e => setOfferAmount(e.target.value)}
                      onBlur={saveOfferAmount}
                      onKeyDown={e => { if (e.key === 'Enter') saveOfferAmount() }}
                      style={{ ...inputStyle, paddingLeft: 22 }}
                    />
                  </div>
                  {offerAmount && (
                    <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                      ${Number(offerAmount).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <EditField label="Company Name" value={fieldVal('company_name') as string | null} onChange={v => setEditFields(p => ({ ...p, company_name: v }))} />
              </div>

              <div>
                <Label>Business Phone</Label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  {editingPhone ? (
                    <input
                      autoFocus
                      type="text"
                      value={phoneInput}
                      onChange={e => setPhoneInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { setEditFields(p => ({ ...p, business_phone: phoneInput.trim() })); setEditingPhone(false) }
                        if (e.key === 'Escape') { setPhoneInput(editFields.business_phone ?? phone); setEditingPhone(false) }
                      }}
                      onBlur={() => { setEditFields(p => ({ ...p, business_phone: phoneInput.trim() })); setEditingPhone(false) }}
                      style={{ ...inputStyle, fontFamily: 'monospace', flex: 1 }}
                    />
                  ) : (
                    <>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>
                        {editFields.business_phone ?? phone}
                      </span>
                      <button
                        onClick={() => { setPhoneInput(editFields.business_phone ?? phone); setEditingPhone(true) }}
                        title="Edit business phone"
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: '2px 4px', lineHeight: 1 }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >✎</button>
                    </>
                  )}
                </div>
              </div>

              <div>
                <EditField label="Industry" value={fieldVal('industry') as string | null} onChange={v => setEditFields(p => ({ ...p, industry: v }))} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <EditField label="Owner Name" value={fieldVal('owner_name') as string | null} onChange={v => setEditFields(p => ({ ...p, owner_name: v }))} />
                <EditField label="Owner Phone" value={fieldVal('owner_phone') as string | null} onChange={v => setEditFields(p => ({ ...p, owner_phone: formatPhone(v) }))} placeholder="(xxx) xxx-xxxx" mono />
              </div>

              <div>
                <EditField label="Email" value={fieldVal('email') as string | null} onChange={v => setEditFields(p => ({ ...p, email: v }))} placeholder="owner@company.com" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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

              {/* Delete */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--danger)',
                      borderRadius: 6,
                      padding: '8px 20px',
                      color: 'var(--danger)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Delete Lead
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, color: 'var(--danger)' }}>Delete this lead and all related data?</span>
                    <button
                      onClick={deleteLead}
                      disabled={deleting}
                      style={{
                        background: 'var(--danger)',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 16px',
                        color: '#000',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: deleting ? 'not-allowed' : 'pointer',
                        opacity: deleting ? 0.7 : 1,
                      }}
                    >
                      {deleting ? 'Deleting...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '6px 16px',
                        color: 'var(--text-secondary)',
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CONTACTS TAB */}
          {tab === 'contacts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Label>Contacts</Label>
                {!showAddContact && (
                  <button
                    onClick={() => setShowAddContact(true)}
                    style={{
                      background: 'var(--accent)',
                      color: '#000',
                      border: 'none',
                      borderRadius: 5,
                      padding: '5px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    + Add Contact
                  </button>
                )}
              </div>

              {/* Add contact form */}
              {showAddContact && (
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: 16, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <input
                      placeholder="Name"
                      value={newContact.name}
                      onChange={e => setNewContact(p => ({ ...p, name: e.target.value }))}
                      style={inputStyle}
                    />
                    <input
                      placeholder="Role"
                      value={newContact.role}
                      onChange={e => setNewContact(p => ({ ...p, role: e.target.value }))}
                      style={inputStyle}
                    />
                    <input
                      placeholder="(xxx) xxx-xxxx"
                      value={newContact.phone}
                      onChange={e => setNewContact(p => ({ ...p, phone: formatPhone(e.target.value) }))}
                      style={{ ...inputStyle, fontFamily: 'monospace' }}
                    />
                    <input
                      placeholder="Email"
                      value={newContact.email}
                      onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={addContact}
                      disabled={savingContact}
                      style={{
                        background: 'var(--accent)',
                        color: '#000',
                        border: 'none',
                        borderRadius: 5,
                        padding: '7px 18px',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: savingContact ? 'not-allowed' : 'pointer',
                        opacity: savingContact ? 0.6 : 1,
                      }}
                    >
                      {savingContact ? 'Saving...' : 'Add'}
                    </button>
                    <button
                      onClick={() => { setShowAddContact(false); setNewContact({ name: '', phone: '', email: '', role: '' }) }}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: 5,
                        padding: '7px 18px',
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Contact list */}
              {contacts.length === 0 && !showAddContact ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>No contacts yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {contacts.map(c => (
                    <div
                      key={c.id}
                      style={{
                        background: 'var(--bg-elevated)',
                        borderRadius: 6,
                        padding: '12px 14px',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {editingContactId === c.id ? (
                        /* Inline edit mode */
                        <div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                            <input
                              placeholder="Name"
                              value={editContactFields.name}
                              onChange={e => setEditContactFields(p => ({ ...p, name: e.target.value }))}
                              style={inputStyle}
                            />
                            <input
                              placeholder="Role"
                              value={editContactFields.role}
                              onChange={e => setEditContactFields(p => ({ ...p, role: e.target.value }))}
                              style={inputStyle}
                            />
                            <input
                              placeholder="(xxx) xxx-xxxx"
                              value={editContactFields.phone}
                              onChange={e => setEditContactFields(p => ({ ...p, phone: formatPhone(e.target.value) }))}
                              style={{ ...inputStyle, fontFamily: 'monospace' }}
                            />
                            <input
                              placeholder="Email"
                              value={editContactFields.email}
                              onChange={e => setEditContactFields(p => ({ ...p, email: e.target.value }))}
                              style={inputStyle}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => saveEditContact(c.id)}
                              style={{
                                background: 'var(--accent)',
                                color: '#000',
                                border: 'none',
                                borderRadius: 5,
                                padding: '5px 14px',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingContactId(null)}
                              style={{
                                background: 'transparent',
                                border: '1px solid var(--border)',
                                borderRadius: 5,
                                padding: '5px 14px',
                                fontSize: 12,
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Display mode */
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              {c.name && (
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</span>
                              )}
                              {c.role && (
                                <span style={{
                                  fontSize: 11,
                                  color: 'var(--text-muted)',
                                  background: 'var(--bg-surface)',
                                  border: '1px solid var(--border-subtle)',
                                  borderRadius: 4,
                                  padding: '1px 7px',
                                  fontFamily: 'monospace',
                                }}>
                                  {c.role}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                              {c.phone && (
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{c.phone}</span>
                              )}
                              {c.email && (
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.email}</span>
                              )}
                              {!c.name && !c.phone && !c.email && !c.role && (
                                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No details</span>
                              )}
                            </div>
                          </div>
                          {/* Action buttons */}
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            <button
                              onClick={() => {
                                setEditingContactId(c.id)
                                setEditContactFields({
                                  name: c.name ?? '',
                                  phone: c.phone ?? '',
                                  email: c.email ?? '',
                                  role: c.role ?? '',
                                })
                              }}
                              title="Edit contact"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: 13,
                                padding: '2px 6px',
                                borderRadius: 4,
                                lineHeight: 1,
                              }}
                              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => deleteContact(c.id)}
                              title="Delete contact"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: 16,
                                padding: '2px 6px',
                                borderRadius: 4,
                                lineHeight: 1,
                              }}
                              onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CALLS TAB */}
          {tab === 'calls' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Log call form */}
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: 16 }}>
                <Label>Log a Call</Label>
                <input
                  type="datetime-local"
                  value={callDate}
                  onChange={e => setCallDate(e.target.value)}
                  style={{ ...inputStyle, marginTop: 8, fontFamily: 'monospace', colorScheme: 'dark' }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Leave empty to use current time
                </div>
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
                      <div key={c.id} style={{ background: 'var(--bg-elevated)', borderRadius: 6, padding: '12px 14px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 4 }}>
                            {new Date(c.called_at).toLocaleString()}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{c.note ?? <em>No note</em>}</div>
                        </div>
                        <button
                          onClick={() => deleteCall(c.id)}
                          title="Delete call"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: 16,
                            lineHeight: 1,
                            padding: '2px 6px',
                            borderRadius: 4,
                            flexShrink: 0,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          ×
                        </button>
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
                    style={{ ...inputStyle, fontFamily: 'monospace', colorScheme: 'dark' }}
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
                          <button
                            onClick={() => deleteTask(task.id)}
                            title="Delete task"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              fontSize: 16,
                              lineHeight: 1,
                              padding: '2px 6px',
                              borderRadius: 4,
                              flexShrink: 0,
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                          >
                            ×
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* NOTES TAB */}
          {tab === 'notes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Add note form */}
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: 16 }}>
                <Label>Add Note</Label>
                <textarea
                  placeholder="Write a note..."
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
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
                  onClick={addNote}
                  disabled={addingNote || !noteContent.trim()}
                  style={{
                    marginTop: 10,
                    background: 'var(--accent)',
                    color: '#000',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 20px',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: addingNote || !noteContent.trim() ? 'not-allowed' : 'pointer',
                    opacity: addingNote || !noteContent.trim() ? 0.5 : 1,
                  }}
                >
                  {addingNote ? 'Saving...' : 'Save Note'}
                </button>
              </div>

              {/* Notes list */}
              <div>
                <Label>Notes</Label>
                {notes.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>No notes yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    {notes.map(n => (
                      <div key={n.id} style={{ background: 'var(--bg-elevated)', borderRadius: 6, padding: '12px 14px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 4 }}>
                            {new Date(n.created_at).toLocaleString()}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{n.content}</div>
                        </div>
                        <button
                          onClick={() => deleteNote(n.id)}
                          title="Delete note"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: 16,
                            lineHeight: 1,
                            padding: '2px 6px',
                            borderRadius: 4,
                            flexShrink: 0,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          ×
                        </button>
                      </div>
                    ))}
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
  placeholder,
  mono,
}: {
  label: string
  value: string | number | null
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  mono?: boolean
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, marginTop: 4, ...(mono ? { fontFamily: 'monospace' } : {}) }}
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
