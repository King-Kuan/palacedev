'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Home() {
  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'DM Sans, sans-serif',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute',
        top: '-200px', left: '50%', transform: 'translateX(-50%)',
        width: '800px', height: '600px',
        background: 'radial-gradient(ellipse, #00e5b015 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', textAlign: 'center', maxWidth: 600 }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#00e5b018', border: '1px solid #00e5b044',
          borderRadius: 50, padding: '7px 18px', marginBottom: 32,
          fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--accent)', letterSpacing: 1,
        }}>
          <span style={{ width: 7, height: 7, background: 'var(--accent)', borderRadius: '50%', animation: 'pulse 2s ease infinite' }} />
          THE PALACE, INC. · AI CODING STUDIO
        </div>

        <h1 style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: 'clamp(48px, 8vw, 80px)',
          fontWeight: 800,
          lineHeight: 1.05,
          letterSpacing: '-3px',
          marginBottom: 20,
        }}>
          Palace<span style={{ color: 'var(--accent)' }}>Dev</span>
        </h1>

        <p style={{ fontSize: 18, color: 'var(--dim)', marginBottom: 48, lineHeight: 1.8, fontWeight: 300 }}>
          Describe any project. AI generates the full codebase,<br />
          runs it live, saves it — even works when you're away.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/editor" style={{
            padding: '13px 32px',
            background: 'linear-gradient(135deg, var(--accent), #00a884)',
            color: '#000',
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 15,
            textDecoration: 'none',
            fontFamily: 'Syne, sans-serif',
            letterSpacing: '-0.3px',
          }}>
            ⚡ Open IDE
          </Link>
          <Link href="/dashboard" style={{
            padding: '13px 32px',
            background: 'var(--surface)',
            color: 'var(--text)',
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 15,
            textDecoration: 'none',
            border: '1px solid var(--border)',
          }}>
            📁 My Projects
          </Link>
          <Link href="/tasks" style={{
            padding: '13px 32px',
            background: 'var(--surface)',
            color: 'var(--text)',
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 15,
            textDecoration: 'none',
            border: '1px solid var(--border)',
          }}>
            📋 Task Queue
          </Link>
        </div>

        <div style={{
          marginTop: 64,
          display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap',
        }}>
          {[
            { icon: '⚡', label: 'AI Generation' },
            { icon: '▶', label: 'Live Preview' },
            { icon: '🤖', label: 'Background Agent' },
            { icon: '⏰', label: 'Scheduled Tasks' },
            { icon: '🔧', label: 'Fix & Improve' },
            { icon: '📦', label: 'ZIP Export' },
          ].map(f => (
            <div key={f.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{f.icon}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>{f.label}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 64, color: 'var(--muted)', fontSize: 12, fontFamily: 'DM Mono, monospace' }}>
          The Palace, Inc. · palacedev-1 · Firebase + Vercel + Claude AI
        </div>
      </div>
    </main>
  )
}
