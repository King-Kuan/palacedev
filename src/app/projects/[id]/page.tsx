'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Navbar from '@/components/Navbar'
import { getProject, updateProject, saveVersion, getVersions } from '@/lib/db'
import type { Project } from '@/lib/db'
import JSZip from 'jszip'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

const LANG_COLORS: Record<string, string> = {
  html: '#e34c26', css: '#1572b6', javascript: '#f7df1e',
  typescript: '#3178c6', json: '#8bc34a', default: '#7a96b5',
}

export default function ProjectPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [activeFile, setActiveFile] = useState(0)
  const [loading, setLoading] = useState(true)
  const [previewMode, setPreviewMode] = useState(false)
  const [fixRequest, setFixRequest] = useState('')
  const [fixLoading, setFixLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [versions, setVersions] = useState<any[]>([])
  const [showVersions, setShowVersions] = useState(false)
  const previewHtml = useRef('')

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const p = await getProject(id)
    if (!p) { router.push('/dashboard'); return }
    setProject(p)
    const v = await getVersions(id)
    setVersions(v)
    setLoading(false)
  }

  async function saveChanges() {
    if (!project) return
    setSaving(true)
    await updateProject(id, project)
    setSaving(false)
  }

  async function applyFix() {
    if (!fixRequest.trim() || !project) return
    setFixLoading(true)
    try {
      await saveVersion(id, project.files, `Before: ${fixRequest}`)
      const res = await fetch('/api/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, request: fixRequest }),
      })
      const result = await res.json()
      const updated = {
        ...project,
        files: result.files,
        name: result.projectName,
        description: result.description,
        notes: result.notes,
      }
      setProject(updated)
      await updateProject(id, updated)
      const v = await getVersions(id)
      setVersions(v)
      setFixRequest('')
    } catch (e: any) {
      alert('Fix failed: ' + e.message)
    }
    setFixLoading(false)
  }

  function buildPreview() {
    if (!project) return ''
    const runFile = project.files.find(f => f.name === project.runFile) || project.files[0]
    if (!runFile) return ''
    let html = runFile.content
    project.files.filter(f => f.language === 'css').forEach(css => {
      html = html.replace(new RegExp(`<link[^>]*href=["']${css.name}["'][^>]*>`, 'gi'), `<style>${css.content}</style>`)
    })
    project.files.filter(f => f.language === 'javascript').forEach(js => {
      html = html.replace(new RegExp(`<script[^>]*src=["']${js.name}["'][^>]*></script>`, 'gi'), `<script>${js.content}</script>`)
    })
    return html
  }

  function runPreview() {
    previewHtml.current = buildPreview()
    setPreviewMode(true)
  }

  async function exportZip() {
    if (!project) return
    const zip = new JSZip()
    project.files.forEach(f => zip.file(f.name, f.content))
    const blob = await zip.generateAsync({ type: 'blob' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${project.name}.zip`
    a.click()
  }

  function restoreVersion(v: any) {
    if (!project) return
    if (!confirm('Restore this version? Current files will be overwritten.')) return
    setProject({ ...project, files: v.files })
    setShowVersions(false)
  }

  function updateFile(content: string) {
    if (!project) return
    const files = [...project.files]
    files[activeFile] = { ...files[activeFile], content }
    setProject({ ...project, files })
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #00e5b022', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    </div>
  )

  if (!project) return null
  const currentFile = project.files[activeFile]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Navbar />

      {/* Toolbar */}
      <div style={{
        height: 44, background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8, flexShrink: 0,
      }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13 }}>
          ← Dashboard
        </button>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span style={{ fontSize: 13, color: 'var(--dim)', fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>{project.name}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowVersions(!showVersions)} style={{
          padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
          background: 'var(--bg)', color: 'var(--dim)', fontSize: 12, cursor: 'pointer',
        }}>🕐 Versions ({versions.length})</button>
        <button onClick={saveChanges} style={{
          padding: '4px 12px', borderRadius: 6, border: 'none',
          background: saving ? '#00e5b022' : '#00e5b044', color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>{saving ? 'Saving…' : '💾 Save'}</button>
        <button onClick={runPreview} style={{
          padding: '4px 12px', borderRadius: 6, border: 'none',
          background: '#2ed57322', color: '#2ed573', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>▶ Run</button>
        <button onClick={exportZip} style={{
          padding: '4px 12px', borderRadius: 6, border: 'none',
          background: '#0094ff22', color: '#0094ff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>⬇ ZIP</button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Sidebar */}
        <div style={{
          width: 240, flexShrink: 0, borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: 'var(--surface)',
        }}>
          {/* Fix */}
          <div style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>Fix / Improve</div>
            <textarea
              value={fixRequest}
              onChange={e => setFixRequest(e.target.value)}
              placeholder="Describe what to fix or improve…"
              rows={3}
              style={{
                width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 7, padding: 10, color: 'var(--text)', fontSize: 13,
                lineHeight: 1.6, resize: 'none', outline: 'none', fontFamily: 'DM Sans, sans-serif',
              }}
            />
            <button
              onClick={applyFix}
              disabled={fixLoading || !fixRequest.trim()}
              style={{
                width: '100%', marginTop: 8, padding: '7px',
                background: fixLoading ? '#c455fa22' : '#c455fa',
                color: fixLoading ? '#c455fa' : '#fff',
                borderRadius: 7, fontSize: 13, fontWeight: 700,
                border: 'none', cursor: 'pointer',
                opacity: !fixRequest.trim() ? 0.5 : 1,
              }}
            >
              {fixLoading ? 'Fixing…' : '🔧 Apply Fix'}
            </button>
          </div>

          {/* Files */}
          <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>
              Files ({project.files.length})
            </div>
            {project.files.map((f, i) => (
              <div
                key={f.name}
                onClick={() => { setActiveFile(i); setPreviewMode(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '6px 8px', borderRadius: 6, marginBottom: 3,
                  cursor: 'pointer',
                  background: activeFile === i && !previewMode ? '#00e5b010' : 'transparent',
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: LANG_COLORS[f.language] || LANG_COLORS.default, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: activeFile === i ? 'var(--accent)' : 'var(--dim)', fontFamily: 'DM Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              </div>
            ))}
          </div>

          {/* Versions panel */}
          {showVersions && (
            <div style={{ borderTop: '1px solid var(--border)', padding: 14, maxHeight: 200, overflow: 'auto' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>Version History</div>
              {versions.length === 0
                ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>No versions yet</div>
                : versions.map((v, i) => (
                  <div key={v.id} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 3, fontFamily: 'DM Mono, monospace' }}>v{versions.length - i}: {v.label}</div>
                    <button
                      onClick={() => restoreVersion(v)}
                      style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >Restore →</button>
                  </div>
                ))
              }
            </div>
          )}

          {/* Notes */}
          {project.notes && (
            <div style={{ padding: 14, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 6 }}>Notes</div>
              <div style={{ fontSize: 11, color: 'var(--dim)', lineHeight: 1.7 }}>{project.notes}</div>
            </div>
          )}
        </div>

        {/* Editor / Preview */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)', overflowX: 'auto', flexShrink: 0 }}>
            {project.files.map((f, i) => (
              <div
                key={f.name}
                onClick={() => { setActiveFile(i); setPreviewMode(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', cursor: 'pointer', whiteSpace: 'nowrap',
                  borderBottom: !previewMode && activeFile === i ? '2px solid var(--accent)' : '2px solid transparent',
                  color: !previewMode && activeFile === i ? 'var(--accent)' : 'var(--muted)',
                  fontSize: 12, fontFamily: 'DM Mono, monospace',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: LANG_COLORS[f.language] || LANG_COLORS.default }} />
                {f.name}
              </div>
            ))}
            <div
              onClick={runPreview}
              style={{
                padding: '7px 14px', cursor: 'pointer',
                borderBottom: previewMode ? '2px solid #2ed573' : '2px solid transparent',
                color: previewMode ? '#2ed573' : 'var(--muted)',
                fontSize: 12, fontFamily: 'DM Mono, monospace',
              }}
            >▶ Preview</div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {previewMode ? (
              <iframe
                srcDoc={previewHtml.current}
                style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                sandbox="allow-scripts allow-same-origin allow-forms"
                title="preview"
              />
            ) : currentFile ? (
              <MonacoEditor
                height="100%"
                language={currentFile.language}
                value={currentFile.content}
                onChange={v => updateFile(v || '')}
                theme="vs-dark"
                options={{
                  fontSize: 13, lineHeight: 22,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  padding: { top: 16 },
                  fontFamily: "'DM Mono', monospace",
                  fontLigatures: true,
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
