'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Navbar from '@/components/Navbar'
import { saveProject, updateProject, saveVersion } from '@/lib/db'
import type { Project } from '@/lib/db'
import type { ChatMessage, GeneratedProject } from '@/lib/claude'
import JSZip from 'jszip'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

const LANG_COLORS: Record<string, string> = {
  html: '#e34c26', css: '#1572b6', javascript: '#f7df1e',
  typescript: '#3178c6', json: '#8bc34a', default: '#7a96b5',
}

const STARTERS = [
  'I want to build a todo app',
  'Build me a weather dashboard',
  'I need a SaaS landing page',
  'Create an admin dashboard with charts',
  'Build a markdown editor with preview',
  'I want a portfolio website',
]

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '4px 0', alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--accent)',
          animation: `pulse 1.2s ease ${i * 0.2}s infinite`,
          display: 'inline-block',
        }} />
      ))}
    </div>
  )
}

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 12,
      animation: 'fadeUp 0.25s ease both',
    }}>
      {!isUser && (
        <div style={{
          width: 26, height: 26, borderRadius: 7, flexShrink: 0,
          background: 'linear-gradient(135deg, var(--accent), #0094ff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800, color: '#000',
          marginRight: 8, marginTop: 2,
        }}>P</div>
      )}
      <div style={{
        maxWidth: '85%',
        padding: '10px 13px',
        borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
        background: isUser ? 'var(--accent)' : 'var(--surface2)',
        color: isUser ? '#000' : 'var(--text)',
        fontSize: 13,
        lineHeight: 1.65,
        fontWeight: isUser ? 500 : 400,
        border: isUser ? 'none' : '1px solid var(--border)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {msg.content}
      </div>
    </div>
  )
}

export default function EditorPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [project, setProject] = useState<Project | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [activeFile, setActiveFile] = useState(0)
  const [previewMode, setPreviewMode] = useState(false)
  const [fixRequest, setFixRequest] = useState('')
  const [fixLoading, setFixLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const previewHtml = useRef('')

  useEffect(() => {
    // Welcome message
    setMessages([{
      role: 'assistant',
      content: `Hey! I'm PalaceDev AI — your coding partner at The Palace, Inc. 👋\n\nTell me what you want to build and I'll ask the right questions before generating anything. What's your project idea?`,
    }])
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  async function sendMessage() {
    const text = input.trim()
    if (!text || thinking) return

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setThinking(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const result = await res.json()
      if (result.error) throw new Error(result.error)

      if (result.type === 'project') {
        // AI generated a project!
        const p = result.project as GeneratedProject
        const proj: Project = {
          name: p.projectName,
          description: p.description,
          notes: p.notes,
          runFile: p.runFile,
          files: p.files,
          tags: [],
          pinned: false,
        }
        setProject(proj)
        setActiveFile(0)
        setPreviewMode(false)

        // Save to Firebase
        const id = await saveProject(proj)
        setProjectId(id)

        // Add success message to chat
        setMessages(m => [...m, {
          role: 'assistant',
          content: `✅ Done! I generated **${p.projectName}** with ${p.files.length} files.\n\n${p.notes}\n\nYou can see the code on the right, run the preview, or ask me to fix anything.`,
        }])
      } else {
        // Conversational reply
        setMessages(m => [...m, { role: 'assistant', content: result.content }])
      }
    } catch (e: any) {
      setMessages(m => [...m, {
        role: 'assistant',
        content: `❌ Error: ${e.message}`,
      }])
    }
    setThinking(false)
    inputRef.current?.focus()
  }

  async function applyFix() {
    if (!fixRequest.trim() || !project) return
    setFixLoading(true)

    // Add fix to chat
    const fixMsg = `Fix: ${fixRequest}`
    setMessages(m => [...m, { role: 'user', content: fixMsg }])

    try {
      if (projectId && project.files) {
        await saveVersion(projectId, project.files, `Before: ${fixRequest}`)
      }
      const res = await fetch('/api/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, request: fixRequest }),
      })
      const result = await res.json()
      if (result.error) throw new Error(result.error)

      const updated: Project = {
        ...project,
        files: result.files,
        name: result.projectName,
        description: result.description,
        notes: result.notes,
      }
      setProject(updated)
      if (projectId) await updateProject(projectId, updated)

      setMessages(m => [...m, {
        role: 'assistant',
        content: `✅ Fix applied!\n\n${result.notes}`,
      }])
      setFixRequest('')
    } catch (e: any) {
      setMessages(m => [...m, {
        role: 'assistant',
        content: `❌ Fix failed: ${e.message}`,
      }])
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
    a.download = `${project.name || 'project'}.zip`
    a.click()
  }

  function updateFile(content: string) {
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
          height: 44, background: 'var(--surface)', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8, flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, color: 'var(--dim)', fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>{project.name}</span>
          <div style={{ flex: 1 }} />
          {saving && <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'DM Mono, monospace' }}>saving…</span>}
          <button onClick={runPreview} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#2ed57322', color: '#2ed573', fontSize: 12, fontWeight: 600 }}>▶ Run</button>
          <button onClick={exportZip} style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#0094ff22', color: '#0094ff', fontSize: 12, fontWeight: 600 }}>⬇ ZIP</button>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* LEFT — Chat Panel */}
        <div style={{
          width: 320, flexShrink: 0,
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          background: 'var(--surface)',
        }}>
          {/* Chat header */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: thinking ? '#f5c542' : 'var(--accent)',
              animation: thinking ? 'pulse 1s ease infinite' : 'none',
            }} />
            <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--dim)' }}>
              {thinking ? 'PalaceDev AI is thinking…' : 'PalaceDev AI'}
            </span>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px 14px' }}>
            {/* Starter suggestions — only before first user message */}
            {messages.length === 1 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>Quick Start</div>
                {STARTERS.map(s => (
                  <div
                    key={s}
                    onClick={() => setInput(s)}
                    style={{
                      padding: '6px 10px', marginBottom: 5, borderRadius: 6,
                      background: 'var(--bg)', border: '1px solid var(--border)',
                      cursor: 'pointer', fontSize: 12, color: 'var(--dim)',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#00e5b044')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  >{s}</div>
                ))}
              </div>
            )}

            {messages.map((m, i) => <ChatBubble key={i} msg={m} />)}
            {thinking && (
              <div style={{ display: 'flex', marginBottom: 12 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--accent), #0094ff)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, color: '#000', marginRight: 8, marginTop: 2,
                }}>P</div>
                <div style={{
                  padding: '10px 13px', borderRadius: '12px 12px 12px 4px',
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                }}>
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Fix request — only shown when project exists */}
          {project && (
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 6 }}>
                Quick Fix
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={fixRequest}
                  onChange={e => setFixRequest(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyFix()}
                  placeholder="e.g. Add dark mode toggle"
                  style={{
                    flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 6, padding: '6px 10px', color: 'var(--text)',
                    fontSize: 12, outline: 'none', fontFamily: 'DM Sans, sans-serif',
                  }}
                />
                <button
                  onClick={applyFix}
                  disabled={fixLoading || !fixRequest.trim()}
                  style={{
                    padding: '6px 10px', borderRadius: 6, border: 'none',
                    background: '#c455fa', color: '#fff', fontSize: 12,
                    fontWeight: 600, cursor: 'pointer',
                    opacity: !fixRequest.trim() ? 0.5 : 1,
                  }}
                >{fixLoading ? '…' : '🔧'}</button>
              </div>
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '12px 14px', background: 'var(--surface)' }}>
            <div style={{
              display: 'flex', gap: 8, alignItems: 'flex-end',
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '8px 10px',
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="Type your message… (Enter to send)"
                rows={2}
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: 'var(--text)', fontSize: 13, lineHeight: 1.6,
                  resize: 'none', fontFamily: 'DM Sans, sans-serif',
                  maxHeight: 100, overflowY: 'auto',
                }}
              />
              <button
                onClick={sendMessage}
                disabled={thinking || !input.trim()}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none',
                  background: thinking || !input.trim() ? 'var(--border)' : 'var(--accent)',
                  color: thinking || !input.trim() ? 'var(--muted)' : '#000',
                  cursor: 'pointer', fontSize: 14, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
              >↑</button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 5, textAlign: 'center', fontFamily: 'DM Mono, monospace' }}>
              Enter to send · Shift+Enter for new line
            </div>
          </div>
        </div>

        {/* RIGHT — Editor / Preview */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {!project ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--muted)',
            }}>
              <div style={{
                width: 72, height: 72,
                background: 'linear-gradient(135deg, #00e5b012, #0094ff12)',
                border: '1px solid #00e5b025',
                borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
              }}>💬</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--text)', marginBottom: 8 }}>
                  Chat to build
                </div>
                <div style={{ fontSize: 14, color: 'var(--dim)', maxWidth: 340, lineHeight: 1.7 }}>
                  Describe your project idea in the chat. PalaceDev AI will ask smart questions, then generate the full codebase here.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                {['⚡ AI Generation', '📝 Code Editor', '▶ Live Preview'].map(f => (
                  <span key={f} style={{
                    fontSize: 12, color: 'var(--dim)', background: 'var(--surface)',
                    border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px',
                    fontFamily: 'DM Mono, monospace',
                  }}>{f}</span>
                ))}
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
                      color: !previewMode && activeFile === i ? 'var(--accent)' : 'var(--muted)',
                      fontSize: 12, fontFamily: 'DM Mono, monospace', transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: LANG_COLORS[f.language] || LANG_COLORS.default }} />
                    {f.name}
                  </div>
                ))}
                <div
                  onClick={runPreview}
                  style={{
                    padding: '7px 14px', cursor: 'pointer', whiteSpace: 'nowrap',
                    borderBottom: previewMode ? '2px solid #2ed573' : '2px solid transparent',
                    color: previewMode ? '#2ed573' : 'var(--muted)',
                    fontSize: 12, fontFamily: 'DM Mono, monospace',
                  }}
                >▶ Preview</div>
              </div>

              {/* Editor or Preview */}
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

              {/* File info strip */}
              <div style={{
                height: 28, background: 'var(--surface)', borderTop: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', padding: '0 14px', gap: 12,
              }}>
                {project.files.map((f, i) => (
                  <span
                    key={f.name}
                    onClick={() => { setActiveFile(i); setPreviewMode(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                      fontSize: 11, fontFamily: 'DM Mono, monospace',
                      color: activeFile === i && !previewMode ? 'var(--accent)' : 'var(--muted)',
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: LANG_COLORS[f.language] || LANG_COLORS.default }} />
                    {f.name}
                  </span>
                ))}
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                  The Palace, Inc.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
