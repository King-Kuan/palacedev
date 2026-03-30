export interface GeneratedProject {
  projectName: string
  description: string
  files: { name: string; language: string; content: string }[]
  runFile: string
  notes: string
}

const SYSTEM_PROMPT = `You are PalaceDev AI — an elite software engineer created by The Palace, Inc. You generate complete, production-ready codebases from natural language ideas.

Respond ONLY with a valid JSON object (no markdown, no backticks, no text outside JSON):
{
  "projectName": "string",
  "description": "string",
  "files": [
    { "name": "filename.ext", "language": "html|css|javascript|json|etc", "content": "full file content" }
  ],
  "runFile": "index.html",
  "notes": "brief developer notes"
}

Rules:
- Include ALL necessary files (HTML, CSS, JS, etc.)
- Write COMPLETE working code — no placeholders, no TODOs
- Use modern best practices
- Make UIs beautiful, responsive, and professional
- Always make index.html the entry point for web projects
- CSS must use variables and be fully responsive
- JS must be clean, modular, and well-commented`

const FIX_PROMPT = `You are PalaceDev AI. You are given an existing codebase and a fix/improvement request.

Respond ONLY with valid JSON (no markdown, no backticks):
{
  "projectName": "string",
  "description": "string",
  "files": [...all files including modified ones...],
  "runFile": "main file",
  "notes": "what was changed"
}

Keep unchanged files as-is. Only modify what needs changing.`

const AGENT_REVIEW_PROMPT = `You are PalaceDev AI acting as a code reviewer. 
Review the provided code and identify any bugs, missing features, or improvements.
Respond ONLY with JSON:
{
  "issues": ["issue 1", "issue 2"],
  "done": true/false,
  "fixRequest": "what to fix in this iteration (empty string if done)"
}`

async function callClaude(messages: any[], system: string): Promise<any> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set in environment variables')
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system,
      messages,
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg = body?.error?.message || `HTTP ${res.status}`
    throw new Error(`Claude API: ${msg}`)
  }
  const data = await res.json()
  const raw = data.content.map((b: any) => b.text || '').join('')
  const clean = raw.replace(/^```[a-z]*\n?/gm, '').replace(/^```$/gm, '').trim()
  return JSON.parse(clean)
}

export async function generateProject(idea: string): Promise<GeneratedProject> {
  return callClaude(
    [{ role: 'user', content: `Build this project: ${idea}` }],
    SYSTEM_PROMPT
  )
}

export async function fixProject(project: GeneratedProject, request: string): Promise<GeneratedProject> {
  const filesContext = project.files.map(f => `=== ${f.name} ===\n${f.content}`).join('\n\n')
  return callClaude(
    [{
      role: 'user',
      content: `Existing project "${project.projectName}":\n\n${filesContext}\n\nRequest: ${request}`,
    }],
    FIX_PROMPT
  )
}

export async function agentReview(project: GeneratedProject): Promise<{
  issues: string[]
  done: boolean
  fixRequest: string
}> {
  const filesContext = project.files.map(f => `=== ${f.name} ===\n${f.content}`).join('\n\n')
  return callClaude(
    [{
      role: 'user',
      content: `Review this project "${project.projectName}" for bugs and missing features:\n\n${filesContext}`,
    }],
    AGENT_REVIEW_PROMPT
  )
}

export async function runAgentLoop(
  idea: string,
  maxIterations: number = 5,
  onLog: (log: string) => void = () => {}
): Promise<GeneratedProject> {
  onLog(`[Agent] Starting: "${idea}"`)
  let project = await generateProject(idea)
  onLog(`[Agent] Generated ${project.files.length} files`)

  for (let i = 0; i < maxIterations; i++) {
    onLog(`[Agent] Review iteration ${i + 1}/${maxIterations}`)
    const review = await agentReview(project)

    if (review.issues.length > 0) {
      onLog(`[Agent] Issues found: ${review.issues.join(', ')}`)
    }

    if (review.done || !review.fixRequest) {
      onLog(`[Agent] ✓ Project complete after ${i + 1} iteration(s)`)
      break
    }

    onLog(`[Agent] Fixing: ${review.fixRequest}`)
    project = await fixProject(project, review.fixRequest)
    onLog(`[Agent] Fix applied`)
  }

  return project
}
