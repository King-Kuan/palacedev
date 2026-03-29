'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { createTask, getTasks, updateTask } from '@/lib/db'
import type { Task } from '@/lib/db'
import { Timestamp } from 'firebase/firestore'

const STATUS_COLORS: Record<string, string> = {
  pending: '#f5c542',
  running: '#0094ff',
  done: '#00e5b0',
  failed: '#ff4d6d',
}

const STATUS_ICONS: Record<string, string> = {
  pending: '⏳',
  running: '⚡',
  done: '✓',
  failed: '✗',
}

function timeAgo(ts: any) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [idea, setIdea] = useState('')
  const [type, setType] = useState<'generate' | 'fix'>('generate')
  const [agentMode, setAgentMode] = useState(false)
  const [maxIterations, setMaxIterations] = useState(5)
  const [scheduledAt, setScheduledAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    load()
    // Poll every 8s for running tasks
    pollRef.current = setInterval(load, 8000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  async function load() {
    const data = await getTasks()
    setTasks(data)
    setLoading(false)
  }

  async function submitTask() {
    if (!idea.trim()) return
    setSubmitting(true)
    try {
      const taskData: Omit<Task, 'id' | 'createdAt'> = {
        idea,
        type,
        status: 'pending',
        agentMode,
        maxIterations,
        logs: [],
        scheduledAt: scheduledAt ? Timestamp.fromDate(new Date(scheduledAt)) : null,
      }
      const taskId = await createTask(taskData)

      // If no schedule, trigger immediately via API
      if (!scheduledAt) {
        fetch('/api/process-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId, idea, type, agentMode, maxIterations }),
        }).catch(() => {})
      }

      setIdea('')
      setScheduledAt('')
      await load()
    } catch (e: any) {
      alert('Failed to create task: ' + e.message)
    }
    setSubmitting(false)
  }

  async function retryTask(task: Task) {
    if (!task.id) return
    await updateTask(task.id, { status: 'pending', error: undefined, logs: ['[Retry] Task requeued'] })
    fetch('/api/process-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: task.id, idea: task.idea, type: task.type, agentMode: task.agentMode, maxIterations: task.maxIterations }),
    }).catch(() => {})
    await load()
  }

  const running = tasks.filter(t => t.status === 'running')
  const pending = tasks.filter(t => t.status === 'pending')
  const done = tasks.filter(t => t.status === 'done')
  const failed = tasks.filter(t => t.status === 'failed')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px', width: '100%' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 800, letterSpacing: '-1px', marginBottom: 4 }}>
            Task Queue
          </h1>
          <p style={{ color: 'var(--dim)', fontSize: 14 }}>
            Add tasks and PalaceDev AI works on them — even when you're away.
          </p>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
          {[
            { label: 'Running', count: running.length, color: '#0094ff' },
            { label: 'Pending', count: pending.length, color: '#f5c542' },
            { label: 'Done', count: done.length, color: '#00e5b0' },
            { label: 'Failed', count: failed.length, color: '#ff4d6d' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, color: s.color }}>{s.count}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>{s.label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
          {/* Task list */}
          <div>
            {loading ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
                <div style={{ width: 20, height: 20, border: '2px solid #00e5b022', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
                Loading tasks…
              </div>
            ) : tasks.length === 0 ? (
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 48, textAlign: 'center', color: 'var(--muted)',
              }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--dim)', marginBottom: 6 }}>No tasks yet</div>
                <div style={{ fontSize: 13 }}>Add your first task using the form →</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    selected={selectedTask?.id === task.id}
                    onSelect={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
                    onRetry={() => retryTask(task)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Add task form */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 20, position: 'sticky', top: 16,
          }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 14 }}>
              Add Task
            </div>

            <textarea
              value={idea}
              onChange={e => setIdea(e.target.value)}
              placeholder="Describe the project to build…"
              rows={4}
              style={{
                width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 7, padding: 10, color: 'var(--text)', fontSize: 13,
                lineHeight: 1.6, resize: 'none', outline: 'none',
                fontFamily: 'DM Sans, sans-serif', marginBottom: 10,
              }}
            />

            {/* Type */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Task Type</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['generate', 'fix'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    style={{
                      flex: 1, padding: '6px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${type === t ? 'var(--accent)' : 'var(--border)'}`,
                      background: type === t ? 'var(--accent)18' : 'var(--bg)',
                      color: type === t ? 'var(--accent)' : 'var(--dim)',
                      cursor: 'pointer',
                    }}
                  >
                    {t === 'generate' ? '⚡ Generate' : '🔧 Fix'}
                  </button>
                ))}
              </div>
            </div>

            {/* Agent Mode */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '10px', background: 'var(--bg)', borderRadius: 7, border: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>🤖 Agent Mode</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>AI iterates until done</div>
              </div>
              <button
                onClick={() => setAgentMode(!agentMode)}
                style={{
                  width: 40, height: 22, borderRadius: 11,
                  background: agentMode ? 'var(--accent)' : 'var(--border)',
                  border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, left: agentMode ? 20 : 3,
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s',
                }} />
              </button>
            </div>

            {/* Max iterations */}
            {agentMode && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Max Iterations: {maxIterations}</div>
                <input
                  type="range" min={1} max={10} value={maxIterations}
                  onChange={e => setMaxIterations(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
              </div>
            )}

            {/* Schedule */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>⏰ Schedule (optional)</div>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                style={{
                  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 7, padding: '8px 10px', color: 'var(--text)', fontSize: 12,
                  outline: 'none', fontFamily: 'DM Mono, monospace',
                  colorScheme: 'dark',
                }}
              />
              {scheduledAt && (
                <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>
                  Will run at {new Date(scheduledAt).toLocaleString()}
                </div>
              )}
            </div>

            <button
              onClick={submitTask}
              disabled={submitting || !idea.trim()}
              style={{
                width: '100%', padding: '9px',
                background: submitting ? '#00e5b022' : 'linear-gradient(135deg, var(--accent), #00a884)',
                color: submitting ? 'var(--accent)' : '#000',
                borderRadius: 7, fontSize: 13, fontWeight: 700,
                border: 'none', cursor: 'pointer',
                opacity: !idea.trim() ? 0.5 : 1,
              }}
            >
              {submitting ? 'Adding…' : scheduledAt ? '⏰ Schedule Task' : '📋 Add to Queue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TaskCard({ task, selected, onSelect, onRetry }: { task: Task; selected: boolean; onSelect: () => void; onRetry: () => void }) {
  return (
    <div
      style={{
        background: 'var(--surface)', border: `1px solid ${selected ? 'var(--accent)55' : 'var(--border)'}`,
        borderRadius: 10, padding: 16, cursor: 'pointer',
        transition: 'border-color 0.2s',
      }}
      onClick={onSelect}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Status badge */}
        <div style={{
          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
          background: STATUS_COLORS[task.status] + '22',
          border: `1px solid ${STATUS_COLORS[task.status]}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13,
        }}>
          {task.status === 'running'
            ? <span style={{ width: 12, height: 12, border: '2px solid #0094ff44', borderTopColor: '#0094ff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
            : STATUS_ICONS[task.status]
          }
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.idea}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              fontSize: 10, fontFamily: 'DM Mono, monospace',
              padding: '1px 7px', borderRadius: 4,
              background: STATUS_COLORS[task.status] + '18',
              color: STATUS_COLORS[task.status],
              border: `1px solid ${STATUS_COLORS[task.status]}33`,
            }}>{task.status}</span>
            {task.agentMode && (
              <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: '#c455fa', background: '#c455fa18', padding: '1px 7px', borderRadius: 4, border: '1px solid #c455fa33' }}>
                🤖 agent
              </span>
            )}
            {task.scheduledAt && (
              <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: 'var(--gold)', background: 'var(--gold)18', padding: '1px 7px', borderRadius: 4 }}>
                ⏰ scheduled
              </span>
            )}
            <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
              {timeAgo(task.createdAt)}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {task.status === 'done' && task.projectId && (
            <Link
              href={`/projects/${task.projectId}`}
              onClick={e => e.stopPropagation()}
              style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: 'var(--accent)18', color: 'var(--accent)',
                border: '1px solid var(--accent)33', textDecoration: 'none',
              }}
            >View →</Link>
          )}
          {task.status === 'failed' && (
            <button
              onClick={e => { e.stopPropagation(); onRetry() }}
              style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: '#ff4d6d18', color: '#ff4d6d',
                border: '1px solid #ff4d6d33', cursor: 'pointer',
              }}
            >Retry</button>
          )}
        </div>
      </div>

      {/* Expanded logs */}
      {selected && task.logs && task.logs.length > 0 && (
        <div style={{
          marginTop: 12, padding: 10, background: 'var(--bg)',
          borderRadius: 6, border: '1px solid var(--border)',
          maxHeight: 150, overflow: 'auto',
        }}>
          {task.logs.map((l, i) => (
            <div key={i} style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: 'var(--dim)', marginBottom: 2 }}>{l}</div>
          ))}
        </div>
      )}

      {selected && task.error && (
        <div style={{ marginTop: 10, padding: 10, background: '#ff4d6d10', borderRadius: 6, border: '1px solid #ff4d6d33' }}>
          <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#ff4d6d' }}>{task.error}</div>
        </div>
      )}
    </div>
  )
}
