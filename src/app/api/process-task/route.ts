import { NextRequest, NextResponse } from 'next/server'
import { chat, fixProject, runAgentLoop } from '@/lib/claude'
import { getProject, saveProject, updateProject, updateTask } from '@/lib/db'
import { Timestamp } from 'firebase/firestore'

export async function POST(req: NextRequest) {
  let taskId = ''
  try {
    const body = await req.json()
    taskId = body.taskId
    const { idea, type, agentMode, maxIterations, projectId } = body

    await updateTask(taskId, {
      status: 'running',
      startedAt: Timestamp.now(),
      logs: ['[Queue] Task started'],
    })

    const taskLogs: string[] = ['[Queue] Task started']
    const addLog = async (msg: string) => {
      taskLogs.push(msg)
      await updateTask(taskId, { logs: taskLogs })
    }

    let result: any

    if (agentMode) {
      await addLog('[Agent] Agent mode enabled')
      result = await runAgentLoop(idea, maxIterations || 5, addLog)
    } else if (type === 'fix' && projectId) {
      await addLog(`[Fix] Fetching project ${projectId}`)
      const existing = await getProject(projectId)
      if (!existing) throw new Error('Project not found')
      result = await fixProject(existing as any, idea)
      await addLog('[Fix] Fix applied')
    } else {
      await addLog('[Generate] Generating project')
      const chatResult = await chat([{
        role: 'user',
        content: `Build this project completely now. JSON only, no questions: ${idea}`,
      }])
      if (chatResult.type !== 'project') throw new Error('AI did not generate a project')
      result = chatResult.project
      await addLog(`[Generate] Generated ${result.files.length} files`)
    }

    const newProjectId = await saveProject({
      name: result.projectName,
      description: result.description,
      notes: result.notes,
      runFile: result.runFile,
      files: result.files,
      tags: [],
      pinned: false,
    })

    await addLog(`[Done] Saved: ${newProjectId}`)
    await updateTask(taskId, {
      status: 'done',
      completedAt: Timestamp.now(),
      projectId: newProjectId,
      logs: taskLogs,
    })

    return NextResponse.json({ success: true, projectId: newProjectId })
  } catch (e: any) {
    if (taskId) {
      await updateTask(taskId, {
        status: 'failed',
        error: e.message,
        completedAt: Timestamp.now(),
      })
    }
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
