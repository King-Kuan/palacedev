'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/editor', label: '⚡ IDE' },
  { href: '/dashboard', label: '📁 Projects' },
  { href: '/tasks', label: '📋 Tasks' },
]

export default function Navbar() {
  const path = usePathname()
  return (
    <nav style={{
      height: 52,
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 4,
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <Link href="/" style={{
        display: 'flex', alignItems: 'center', gap: 8,
        textDecoration: 'none', marginRight: 16,
      }}>
        <div style={{
          width: 28, height: 28,
          background: 'linear-gradient(135deg, var(--accent), #0094ff)',
          borderRadius: 7,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 800, color: '#000',
        }}>P</div>
        <span style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px', color: 'var(--text)',
        }}>
          Palace<span style={{ color: 'var(--accent)' }}>Dev</span>
        </span>
      </Link>

      {/* Nav links */}
      {links.map(l => (
        <Link key={l.href} href={l.href} style={{
          padding: '5px 12px',
          borderRadius: 6,
          textDecoration: 'none',
          fontSize: 13,
          fontWeight: 500,
          color: path.startsWith(l.href) ? 'var(--accent)' : 'var(--dim)',
          background: path.startsWith(l.href) ? 'var(--accent)15' : 'transparent',
          transition: 'all 0.15s',
        }}>
          {l.label}
        </Link>
      ))}

      <div style={{ flex: 1 }} />

      <div style={{
        fontSize: 11,
        fontFamily: 'DM Mono, monospace',
        color: 'var(--muted)',
      }}>
        The Palace, Inc.
      </div>
    </nav>
  )
}
