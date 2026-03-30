import { NextRequest, NextResponse } from 'next/server'
import { getPendingScheduledTasks, getQueuedTasks } from '@/lib/db'

/**
 * Vercel Cron — runs ONCE daily at 6:00 AM (Hobby plan compatible).
 * This is a BACKUP sweep only. Tasks are primarily triggered immediately
 * when added via the UI (see tasks/page.tsx → submitTask).
 *
 * The daily sweep catches:
 * - Scheduled tasks whose time has passed
 * - Any tasks that failed to trigger immediately (e.g. browser closed mid-submit)
 */
export async function GET(req: NextRequest) {
  const results: string[] = []
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const triggerTask = (taskId: string, payload: object) =>
    fetch(`${appUrl}/api/process-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, ...payload }),
    }).catch(e => console.error('Trigger error:', e))

  try {
    // 1. Scheduled tasks whose time has arrived
    const scheduled = await getPendingScheduledTasks()
    for (const task of scheduled) {
      results.push(`Scheduled: ${task.id}`)
      triggerTask(task.id!, {
        idea: task.idea, type: task.type,
        agentMode: task.agentMode, maxIterations: task.maxIterations,
        projectId: task.projectId,
      })
    }

    // 2. Any stuck pending queue tasks (backup only)
    const queued = await getQueuedTasks()
    for (const task of queued.slice(0, 5)) {
      results.push(`Queued: ${task.id}`)
      triggerTask(task.id!, {
        idea: task.idea, type: task.type,
        agentMode: task.agentMode, maxIterations: task.maxIterations,
      })
    }

    return NextResponse.json({
      ok: true,
      sweep: 'daily',
      scheduledTriggered: scheduled.length,
      queuedTriggered: Math.min(queued.length, 5),
      results,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
