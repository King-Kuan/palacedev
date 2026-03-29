import { NextRequest, NextResponse } from 'next/server'
import { getPendingScheduledTasks, getQueuedTasks, updateTask } from '@/lib/db'
import { Timestamp } from 'firebase/firestore'

// Called by Vercel Cron every 5 minutes
// Also processes queue tasks one at a time
export async function GET(req: NextRequest) {
  const results: string[] = []

  try {
    // 1. Check for scheduled tasks whose time has come
    const scheduled = await getPendingScheduledTasks()
    for (const task of scheduled) {
      results.push(`Triggering scheduled task: ${task.id}`)
      // Fire and forget — trigger process-task
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/process-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          idea: task.idea,
          type: task.type,
          agentMode: task.agentMode,
          maxIterations: task.maxIterations,
          projectId: task.projectId,
        }),
      }).catch(e => console.error('Trigger error:', e))
    }

    // 2. Process one queued task (no scheduledAt)
    const queued = await getQueuedTasks()
    if (queued.length > 0) {
      const task = queued[0]
      results.push(`Processing queued task: ${task.id}`)
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/process-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          idea: task.idea,
          type: task.type,
          agentMode: task.agentMode,
          maxIterations: task.maxIterations,
          projectId: task.projectId,
        }),
      }).catch(e => console.error('Queue trigger error:', e))
    }

    return NextResponse.json({
      ok: true,
      processed: results,
      scheduledTriggered: scheduled.length,
      queueProcessed: queued.length > 0 ? 1 : 0,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
