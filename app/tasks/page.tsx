'use client'

import { useEffect, useState } from 'react'
import { supabase, type Task, type Lead } from '@/lib/supabase'

type TaskRow = Task & { leads: Pick<Lead, 'company_name'> | null }
type Filter = 'all' | 'overdue' | 'completed'

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [newTask, setNewTask] = useState({ title: '', description: '', due_at: '' })
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)

  async function fetchTasks() {
    const { data } = await supabase
      .from('tasks')
      .select('*, leads(company_name)')
      .order('due_at', { ascending: true })
    setTasks((data as TaskRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchTasks() }, [])

  const now = new Date()
  const filtered = tasks.filter(t => {
    if (filter === 'overdue') return !t.completed && new Date(t.due_at) < now
    if (filter === 'completed') return t.completed
    return !t.completed
  })

  async function toggleTask(task: TaskRow) {
    await supabase.from('tasks').update({ completed: !task.completed }).eq('id', task.id)
    fetchTasks()
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id)
    fetchTasks()
  }

  async function addTask() {
    if (!newTask.title.trim() || !newTask.due_at) return
    setAdding(true)
    await supabase.from('tasks').insert({
      title: newTask.title.trim(),
      description: newTask.description.trim() || null,
      due_at: new Date(newTask.due_at).toISOString(),
      completed: false,
      business_phone: null,
    })
    setNewTask({ title: '', description: '', due_at: '' })
    setAdding(false)
    setShowForm(false)
    fetchTasks()
  }

  const FILTERS: Filter[] = ['all', 'overdue', 'completed']

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Tasks</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>{tasks.length} total</p>
        </div>
        <button
          onClick={() => setShowForm(p => !p)}
          style={{
            background: 'var(--accent)',
            color: '#000',
            border: 'none',
            borderRadius: 6,
            padding: '8px 18px',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          + New Task
        </button>
      </div>

      {/* New task form */}
      {showForm && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              placeholder="Task title *"
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
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={addTask}
                disabled={adding || !newTask.title.trim() || !newTask.due_at}
                style={{
                  background: 'var(--accent)',
                  color: '#000',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 18px',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: adding || !newTask.title.trim() || !newTask.due_at ? 'not-allowed' : 'pointer',
                  opacity: adding || !newTask.title.trim() || !newTask.due_at ? 0.5 : 1,
                }}
              >
                {adding ? 'Adding...' : 'Add Task'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 18px', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: 4, width: 'fit-content' }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              border: 'none',
              background: filter === f ? 'var(--bg-elevated)' : 'transparent',
              color: filter === f ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: filter === f ? 600 : 400,
              textTransform: 'capitalize',
              transition: 'all 0.1s',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>Loading...</div>
      ) : (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={thStyle}>Done</th>
                <th style={thStyle}>Task</th>
                <th style={thStyle}>Company</th>
                <th style={thStyle}>Due</th>
                <th style={{ ...thStyle, width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No tasks found.
                  </td>
                </tr>
              ) : filtered.map((task, i) => {
                const overdue = !task.completed && new Date(task.due_at) < now
                return (
                  <tr
                    key={task.id}
                    style={{
                      borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      background: overdue ? 'var(--danger-dim)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '10px 16px', width: 48 }}>
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => toggleTask(task)}
                        style={{ accentColor: 'var(--accent)', cursor: 'pointer', width: 15, height: 15 }}
                      />
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ fontWeight: 500, color: task.completed ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: task.completed ? 'line-through' : 'none' }}>
                        {task.title}
                      </div>
                      {task.description && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{task.description}</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontSize: 13 }}>
                      {task.leads?.company_name ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, color: overdue ? 'var(--danger)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(task.due_at).toLocaleString()}
                      {overdue && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700 }}>OVERDUE</span>}
                    </td>
                    <td style={{ padding: '10px 8px', width: 40 }}>
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
                          transition: 'color 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '8px 10px',
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
}
