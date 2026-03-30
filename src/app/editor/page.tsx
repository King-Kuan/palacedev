'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Navbar from '@/components/Navbar'
import { saveProject, updateProject, saveVersion, getProject } from '@/lib/db'
import type { Project, ProjectFile } from '@/lib/db'
import JSZip from 'jszip'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

const LANG_COLORS: Record<string, string> = {
  html: '#e34c26', css: '#1572b6', javascript: '#f7df1e',
  typescript: '#3178c6', json: '#8bc34a', default: '#7a96b5',
}

const SUGGESTIONS = [
  'Todo app with local storage and dark mode',
  'Weather dashboard with animated cards',
  'SaaS landing page with pricing section',
  'Calculator with history panel',
  'Markdown editor with live preview',
  'Admin dashboard with charts',
  'E-commerce product card grid',
  'Login & signup form with validation',
]

function Spinner({ label = 'Generating...' }: { label?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        width: 14, height: 14,
        border: '2px solid #00e5b022',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        display: 'inline-block',
        animation: 'spin 0.7s linear infinite',
      }} />
      <span style={{ color: 'var(--accent)', fontSize: 13 }}>{label}</span>
    </span>
  )
}

export default function EditorPage() {
  const [idea, setIdea] = useState('')
  const [project, setProject] = useState<Project | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [activeFile, setActiveFile] = useState(0)
  const [loading, setLoading] = useState(false)
  const [fixLoading, setFixLoading] = useState(false)
  const [error, setError] = useState('')
  const [previewMode, setPreviewMode] = useState(false)
  const [fixRequest, setFixRequest] = useState('')
  const [history, setHistory] = useState<{ label: string; project: Project }[]>([])
  const [logs, setLogs] = useState<{ msg: string; type: string }[]>([])
  const [saving, setSaving] = useState(false)
  const previewHtml = useRef('')

  const log = (msg: string, type = 'info') =>
    setLogs(p => [...p.slice(-80), { msg, type }])

  const callAPI = async (endpoint: string, body: any) => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  const generate = async () => {
    if (!idea.trim()) return
    setLoading(true); setError(''); setPreviewMode(false)
    log(`Generating: "${idea}"`)
    try {
      const result = await callAPI('/api/generate', { idea })
      const p: Project = {
        name: result.projectName,
        description: result.description,
        notes: result.notes,
        runFile: result.runFile,
        files: result.files,
        tags: [],
        pinned: false,
      }
      setProject(p)
      setActiveFile(0)
      setHistory(h => [...h, { label: idea, project: p }])
      log(`✓ Generated ${p.files.length} files for "${p.name}"`, 'success')
      // Auto-save
      const id = await saveProject(p)
      setProjectId(id)
      log(`✓ Saved to Firebase (${id})`, 'success')
    } catch (e: any) {
      setError(e.message); log('✗ ' + e.message, 'error')
    }
    setLoading(false)
  }

  const fix = async () => {
    if (!fixRequest.trim() || !project) return
    setFixLoading(true)
    log(`Fixing: "${fixRequest}"`)
    try {
      const result = await callAPI('/api/fix', { project, request: fixRequest })
      const p: Project = {
        name: result.projectName,
        description: result.description,
        notes: result.notes,
        runFile: result.runFile,
        files: result.files,
        tags: project.tags || [],
        pinned: project.pinned || false,
      }
      // Save version before replacing
      if (projectId && project.files) {
        await saveVersion(projectId, project.files, `Before: ${fixRequest}`)
      }
      setProject(p)
      setHistory(h => [...h, { label: fixRequest, project: p }])
      log(`✓ Applied fix`, 'success')
      setFixRequest('')
      if (projectId) {
        await updateProject(projectId, p)
        log(`✓ Saved to Firebase`, 'success')
      }
    } catch (e: any) {
      log('✗ Fix failed: ' + e.message, 'error')
    }
    setFixLoading(false)
  }

  const buildPreview = useCallback(() => {
    if (!project) return ''
    const runFile = project.files.find(f => f.name === project.runFile) || project.files[0]
    if (!runFile) return ''
    let html = runFile.content
    project.files.filter(f => f.language === 'css').forEach(css => {
      html = html.replace(
        new RegExp(`<link[^>]*href=["']${css.name}["'][^>]*>`, 'gi'),
        `<style>${css.content}</style>`
      )
    })
    project.files.filter(f => f.language === 'javascript').forEach(js => {
      html = html.replace(
        new RegExp(`<script[^>]*src=["']${js.name}["'][^>]*></script>`, 'gi'),
        `<script>${js.content}</script>`
      )
    })
    return html
  }, [project])

  const runPreview = () => {
    previewHtml.current = buildPreview()
    setPreviewMode(true)
    log('▶ Running preview')
  }

  const exportZip = async () => {
    if (!project) return
    const zip = new JSZip()
    project.files.forEach(f => zip.file(f.name, f.content))
    const blob = await zip.generateAsync({ type: 'blob' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${project.name || 'project'}.zip`
    a.click()
    log('⬇ Exported as ZIP', 'success')
  }

  const updateFile = (content: string) => {
    if (!project) return
    const files = [...project.files]
    files[activeFile] = { ...files[activeFile], content }
    setProject({ ...project, files })
  }

  const currentFile = project?.files[activeFile]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Navbar />

      {/* Toolbar */}
      {project && (
        <div style={{
          height: 44,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          padding: '0 16px', gap: 8, flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, color: 'var(--dim)', fontFamily: 'DM Mono, monospace', marginRight: 8 }}>
            {project.name}
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={runPreview} style={{
            padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: '#2ed57322', color: '#2ed573', fontSize: 12, fontWeight: 600,
          }}>▶ Run</button>
          <button onClick={exportZip} style={{
            padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: '#0094ff22', color: '#0094ff', fontSize: 12, fontWeight: 600,
          }}>⬇ Export ZIP</button>
          {saving && <span style={{ fontSize: 12, color: 'var(--accent)' }}>Saving…</span>}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* LEFT PANEL */}
        <div style={{
          width: 280, flexShrink: 0,
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', background: 'var(--surface)',
        }}>
          {/* Generate */}
          <div style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>
              New Project
            </div>
            <textarea
              value={idea}
              onChange={e => setIdea(e.target.value)}
              placeholder="Describe your project idea…"
              rows={4}
              onKeyDown={e => e.key === 'Enter' && e.metaKey && generate()}
              style={{
                width: '100%', background: 'var(--bg)',
                border: '1px solid var(--border)', borderRadius: 7,
                padding: 10, color: 'var(--text)', fontSize: 13,
                lineHeight: 1.6, resize: 'none', outline: 'none',
                fontFamily: 'DM Sans, sans-serif',
              }}
            />
            <button
              onClick={generate}
              disabled={loading || !idea.trim()}
              style={{
                width: '100%', marginTop: 8, padding: '8px',
                background: loading ? '#00e5b022' : 'linear-gradient(135deg, #00e5b0, #00a884)',
                color: loading ? 'var(--accent)' : '#000',
                borderRadius: 7, fontSize: 13, fontWeight: 700,
                border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                opacity: !idea.trim() ? 0.5 : 1,
              }}
            >
              {loading ? <Spinner /> : '⚡ Generate'}
            </button>
            {error && <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 6 }}>{error}</div>}
          </div>

          {/* Fix */}
          {project && (
            <div style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>
                Fix / Improve
              </div>
              <textarea
                value={fixRequest}
                onChange={e => setFixRequest(e.target.value)}
                placeholder="e.g. Add dark mode, fix mobile layout…"
                rows={3}
                style={{
                  width: '100%', background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 7,
                  padding: 10, color: 'var(--text)', fontSize: 13,
                  lineHeight: 1.6, resize: 'none', outline: 'none',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              />
              <button
                onClick={fix}
                disabled={fixLoading || !fixRequest.trim()}
                style={{
                  width: '100%', marginTop: 8, padding: '8px',
                  background: fixLoading ? '#c455fa22' : '#c455fa',
                  color: fixLoading ? '#c455fa' : '#fff',
                  borderRadius: 7, fontSize: 13, fontWeight: 700,
                  border: 'none', cursor: fixLoading ? 'not-allowed' : 'pointer',
                  opacity: !fixRequest.trim() ? 0.5 : 1,
                }}
              >
                {fixLoading ? <Spinner label="Fixing…" /> : '🔧 Apply Fix'}
              </button>
            </div>
          )}

          {/* Suggestions */}
          {!project && (
            <div style={{ padding: 14, overflow: 'auto', flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 10 }}>
                Quick Start
              </div>
              {SUGGESTIONS.map(s => (
                <div
                  key={s}
                  onClick={() => setIdea(s)}
                  style={{
                    padding: '7px 10px', marginBottom: 5, borderRadius: 6,
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    cursor: 'pointer', fontSize: 12, color: 'var(--dim)', lineHeight: 1.5,
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#00e5b044')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  {s}
                </div>
              ))}
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div style={{ padding: 14, overflow: 'auto', flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 10 }}>
                Session History
              </div>
              {history.map((h, i) => (
                <div
                  key={i}
                  onClick={() => { setProject(h.project); setActiveFile(0); setPreviewMode(false) }}
                  style={{
                    padding: '7px 10px', marginBottom: 5, borderRadius: 6,
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    cursor: 'pointer', fontSize: 12, color: 'var(--dim)',
                  }}
                >
                  <span style={{ color: 'var(--accent)', fontSize: 10, fontFamily: 'DM Mono, monospace' }}>v{i + 1} </span>
                  {h.label.length > 55 ? h.label.slice(0, 55) + '…' : h.label}
                </div>
              ))}
            </div>
          )}

          {/* Console */}
          <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px', maxHeight: 110, overflow: 'auto' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 4 }}>Console</div>
            {logs.length === 0
              ? <div style={{ fontSize: 11, color: 'var(--muted)' }}>Ready.</div>
              : logs.map((l, i) => (
                <div key={i} style={{
                  fontSize: 11, fontFamily: 'DM Mono, monospace', marginBottom: 1,
                  color: l.type === 'error' ? 'var(--error)' : l.type === 'success' ? 'var(--success)' : 'var(--muted)',
                }}>{l.msg}</div>
              ))
            }
          </div>
        </div>

        {/* CENTER — Editor / Preview */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {!project ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 16,
              color: 'var(--muted)',
            }}>
              <div style={{
                width: 64, height: 64,
                background: 'linear-gradient(135deg, #00e5b018, #0094ff18)',
                border: '1px solid #00e5b033',
                borderRadius: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
              }}>⚡</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--text)', marginBottom: 8 }}>
                  PalaceDev AI IDE
                </div>
                <div style={{ fontSize: 14, color: 'var(--dim)', maxWidth: 360, lineHeight: 1.7 }}>
                  Pick a suggestion on the left or describe your project idea to generate a full codebase instantly.
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* File tabs */}
              <div style={{
                display: 'flex', borderBottom: '1px solid var(--border)',
                background: 'var(--surface)', overflowX: 'auto', flexShrink: 0,
              }}>
                {project.files.map((f, i) => (
                  <div
                    key={f.name}
                    onClick={() => { setActiveFile(i); setPreviewMode(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', cursor: 'pointer', whiteSpace: 'nowrap',
                      borderBottom: !previewMode && activeFile === i ? '2px solid var(--accent)' : '2px solid transparent',
                      background: !previewMode && activeFile === i ? '#00e5b010' : 'transparent',
                      color: !previewMode && activeFile === i ? 'var(--accent)' : 'var(--muted)',
                      fontSize: 12, fontFamily: 'DM Mono, monospace',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: LANG_COLORS[f.language] || LANG_COLORS.default, flexShrink: 0 }} />
                    {f.name}
                  </div>
                ))}
                <div
                  onClick={runPreview}
                  style={{
                    padding: '7px 14px', cursor: 'pointer', whiteSpace: 'nowrap',
                    borderBottom: previewMode ? '2px solid #2ed573' : '2px solid transparent',
                    background: previewMode ? '#2ed57310' : 'transparent',
                    color: previewMode ? '#2ed573' : 'var(--muted)',
                    fontSize: 12, fontFamily: 'DM Mono, monospace',
                  }}
                >
                  ▶ Preview
                </div>
              </div>

              {/* Editor or Preview */}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {previewMode ? (
                  <iframe
                    srcDoc={previewHtml.current}
                    style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                    sandbox="allow-scripts allow-same-origin allow-forms"
                    title="live-preview"
                  />
                ) : currentFile ? (
                  <MonacoEditor
                    height="100%"
                    language={currentFile.language === 'javascript' ? 'javascript' : currentFile.language}
                    value={currentFile.content}
                    onChange={v => updateFile(v || '')}
                    theme="vs-dark"
                    options={{
                      fontSize: 13,
                      lineHeight: 22,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      padding: { top: 16 },
                      fontFamily: "'DM Mono', 'Fira Code', monospace",
                      fontLigatures: true,
                    }}
                  />
                ) : null}
              </div>
            </>
          )}
        </div>

        {/* RIGHT PANEL — Info */}
        {project && (
          <div style={{
            width: 200, flexShrink: 0,
            borderLeft: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column',
            overflow: 'auto', padding: 14, gap: 16,
            background: 'var(--surface)',
          }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>Project</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 5 }}>{project.name}</div>
              <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.6 }}>{project.description}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>
                Files ({project.files.length})
              </div>
              {project.files.map((f, i) => (
                <div
                  key={f.name}
                  onClick={() => { setActiveFile(i); setPreviewMode(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 7px', borderRadius: 5, marginBottom: 2,
                    cursor: 'pointer',
                    background: activeFile === i && !previewMode ? '#00e5b010' : 'transparent',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: LANG_COLORS[f.language] || LANG_COLORS.default, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--dim)', fontFamily: 'DM Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                </div>
              ))}
            </div>
            {project.notes && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 6 }}>Notes</div>
                <div style={{ fontSize: 11, color: 'var(--dim)', lineHeight: 1.7, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}>{project.notes}</div>
              </div>
            )}
            <div style={{ marginTop: 'auto', fontSize: 10, color: 'var(--muted)', textAlign: 'center', fontFamily: 'DM Mono, monospace' }}>
              The Palace, Inc.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
