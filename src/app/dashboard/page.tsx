'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { getProjects, deleteProject, togglePin } from '@/lib/db'
import type { Project } from '@/lib/db'

function timeAgo(ts: any) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const data = await getProjects()
    setProjects(data)
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this project?')) return
    setDeleting(id)
    await deleteProject(id)
    setProjects(p => p.filter(x => x.id !== id))
    setDeleting(null)
  }

  async function handlePin(id: string, pinned: boolean) {
    await togglePin(id, !pinned)
    setProjects(p => p.map(x => x.id === id ? { ...x, pinned: !pinned } : x))
  }

  const filtered = projects.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  )

  const pinned = filtered.filter(p => p.pinned)
  const rest = filtered.filter(p => !p.pinned)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px', width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 800, letterSpacing: '-1px', marginBottom: 4 }}>
              My Projects
            </h1>
            <p style={{ color: 'var(--dim)', fontSize: 14 }}>
              {projects.length} project{projects.length !== 1 ? 's' : ''} saved to Firebase
            </p>
          </div>
          <div style={{ flex: 1 }} />
          <Link href="/editor" style={{
            padding: '9px 20px', borderRadius: 8,
            background: 'linear-gradient(135deg, var(--accent), #00a884)',
            color: '#000', fontWeight: 700, fontSize: 13,
            textDecoration: 'none', fontFamily: 'Syne, sans-serif',
          }}>
            ⚡ New Project
          </Link>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 28 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects…"
            style={{
              width: '100%', maxWidth: 400,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '9px 14px',
              color: 'var(--text)', fontSize: 14, outline: 'none',
              fontFamily: 'DM Sans, sans-serif',
            }}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 80 }}>
            <div style={{ width: 24, height: 24, border: '2px solid #00e5b022', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
            Loading projects…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 80 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--dim)', marginBottom: 8 }}>
              {search ? 'No results found' : 'No projects yet'}
            </div>
            <div style={{ fontSize: 14, marginBottom: 24 }}>
              {search ? 'Try a different search term' : 'Generate your first project in the IDE'}
            </div>
            {!search && (
              <Link href="/editor" style={{
                padding: '8px 20px', borderRadius: 8,
                background: 'var(--accent)', color: '#000',
                fontWeight: 700, fontSize: 13, textDecoration: 'none',
              }}>Open IDE</Link>
            )}
          </div>
        ) : (
          <>
            {/* Pinned */}
            {pinned.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 12 }}>
                  📌 Pinned
                </div>
                <ProjectGrid projects={pinned} onDelete={handleDelete} onPin={handlePin} deleting={deleting} />
              </div>
            )}

            {/* All */}
            <div>
              {pinned.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 12 }}>
                  All Projects
                </div>
              )}
              <ProjectGrid projects={rest} onDelete={handleDelete} onPin={handlePin} deleting={deleting} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ProjectGrid({ projects, onDelete, onPin, deleting }: any) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
      {projects.map((p: Project) => (
        <ProjectCard key={p.id} project={p} onDelete={onDelete} onPin={onPin} deleting={deleting} />
      ))}
    </div>
  )
}

function ProjectCard({ project: p, onDelete, onPin, deleting }: any) {
  const fileCount = p.files?.length || 0
  const langs = [...new Set((p.files || []).map((f: any) => f.language))].slice(0, 3)

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 18,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      transition: 'border-color 0.2s, transform 0.2s',
      position: 'relative',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = '#00e5b044'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Pin indicator */}
      {p.pinned && (
        <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 12 }}>📌</div>
      )}

      <div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 4, paddingRight: 20 }}>
          {p.name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {p.description}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: 'var(--muted)', background: 'var(--bg)', padding: '2px 7px', borderRadius: 4, border: '1px solid var(--border)' }}>
          {fileCount} file{fileCount !== 1 ? 's' : ''}
        </span>
        {langs.map((l: any) => (
          <span key={l} style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: 'var(--dim)', background: 'var(--bg)', padding: '2px 7px', borderRadius: 4, border: '1px solid var(--border)' }}>
            {l}
          </span>
        ))}
      </div>

      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
        {timeAgo(p.createdAt)}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <Link
          href={`/projects/${p.id}`}
          style={{
            flex: 1, padding: '6px 0', textAlign: 'center',
            background: 'var(--accent)18', color: 'var(--accent)',
            borderRadius: 6, fontSize: 12, fontWeight: 600,
            textDecoration: 'none', border: '1px solid var(--accent)33',
          }}
        >
          Open
        </Link>
        <button
          onClick={() => onPin(p.id, p.pinned)}
          title={p.pinned ? 'Unpin' : 'Pin'}
          style={{
            padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
            background: 'var(--bg)', color: 'var(--dim)', fontSize: 12, cursor: 'pointer',
          }}
        >
          {p.pinned ? '📌' : '📍'}
        </button>
        <button
          onClick={() => onDelete(p.id)}
          disabled={deleting === p.id}
          title="Delete"
          style={{
            padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
            background: 'var(--bg)', color: 'var(--error)', fontSize: 12, cursor: 'pointer',
            opacity: deleting === p.id ? 0.5 : 1,
          }}
        >
          🗑
        </button>
      </div>
    </div>
  )
}
