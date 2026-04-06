'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: '▦' },
  { href: '/leads', label: 'Leads', icon: '◉' },
  { href: '/pipeline', label: 'Pipeline', icon: '⊟' },
  { href: '/tasks', label: 'Tasks', icon: '✓' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      style={{
        width: 220,
        minWidth: 220,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 0',
        gap: 0,
      }}
    >
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, color: 'var(--accent)', letterSpacing: '-0.5px' }}>
          crm<span style={{ color: 'var(--text-muted)' }}>.app</span>
        </span>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '16px 8px' }}>
        {nav.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 6,
                textDecoration: 'none',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                background: active ? 'var(--accent-dim)' : 'transparent',
                fontWeight: active ? 500 : 400,
                fontSize: 13,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'
                if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
                if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'
              }}
            >
              <span style={{ fontFamily: 'monospace', fontSize: 14, width: 16, textAlign: 'center' }}>{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>

      <div style={{ padding: '8px 20px' }}>
        <div style={{ borderTop: '1px solid var(--border)' }} />
      </div>

      <div style={{ marginTop: 'auto', padding: '16px 20px', borderTop: '1px solid var(--border-subtle)' }}>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>v0.1.0</span>
      </div>
    </aside>
  )
}
