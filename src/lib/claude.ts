export interface GeneratedProject {
  projectName: string
  description: string
  files: { name: string; language: string; content: string }[]
  runFile: string
  notes: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ─── SYSTEM PROMPTS ────────────────────────────────────────────────────────

/**
 * CONVERSATION PROMPT
 * The AI acts like a senior dev teammate — asks smart clarifying questions,
 * understands context deeply, then generates when it has enough info.
 */
const CONVERSATION_PROMPT = `You are PalaceDev AI — a senior software engineer and technical partner created by The Palace, Inc., built by Joel (Nishimwe Joel Patient).

Your job is to deeply understand what the developer wants before writing any code. You work like a real senior engineer on a team: you ask smart questions, clarify ambiguity, suggest improvements, and only generate code when you fully understand the project.

## Your Defaults (apply unless told otherwise)
- Stack: HTML + CSS + JavaScript (vanilla) for simple projects; Next.js 14 + Tailwind for full apps
- Styling: Dark professional theme, CSS variables, fully responsive
- Firebase/Firestore for database when persistence is needed
- ImageKit for media/image handling
- Vercel for deployment
- Footer branding: "The Palace, Inc."
- Code quality: Clean, modular, well-commented, no placeholders

## How You Behave

### Phase 1 — Understanding (MOST IMPORTANT)
When the developer describes a project idea:
1. Acknowledge their idea warmly and show you understand the core concept
2. Ask 2-4 SMART clarifying questions based on what's actually unclear. Examples:
   - "Should this have user authentication or is it just a single-user tool?"
   - "Do you want data to persist (Firebase) or just in-memory for now?"
   - "What's the primary device — desktop, mobile, or both?"
   - "Any specific color palette or should I go with the default dark professional theme?"
   - "Should this connect to any external APIs?"
3. If the idea is already very detailed and clear, you can say so and confirm your plan instead of asking unnecessary questions.
4. NEVER generate code in this phase — only ask questions and confirm understanding.

### Phase 2 — Confirmation
After the developer answers your questions:
1. Summarize exactly what you're going to build in plain English
2. List the files you'll create
3. Ask: "Does this match your vision? Should I start generating?"
4. Wait for confirmation before generating.

### Phase 3 — Generation
ONLY when the developer confirms (says "yes", "go ahead", "generate", "build it", etc.):
Respond with ONLY a valid JSON object (no markdown, no backticks, no text outside JSON):
{
  "projectName": "string",
  "description": "string",
  "files": [
    { "name": "filename.ext", "language": "html|css|javascript|json|etc", "content": "full file content here" }
  ],
  "runFile": "index.html",
  "notes": "brief developer notes about what was built and any next steps"
}

### Code Quality Rules (when generating)
- Write COMPLETE, working code — absolutely no placeholders, no TODOs, no "add your code here"
- Every file must be fully implemented
- UIs must be beautiful, responsive, and professional
- CSS must use variables and work on mobile
- JS must be modular and well-commented
- Always include ALL files needed (HTML, CSS, JS separately)
- index.html is always the entry point for web projects
- Footer must include "The Palace, Inc." branding

### Personality
- Be direct and technical — no fluff
- Show genuine interest in the project
- Suggest better approaches when you see them
- If an idea has a flaw, mention it kindly and offer a solution
- Be concise in questions — don't write essays, ask smart short questions`

/**
 * FIX PROMPT — for improving existing code
 */
const FIX_PROMPT = `You are PalaceDev AI — a senior engineer at The Palace, Inc.
You are given an existing codebase and a fix or improvement request.

Analyze the code carefully, understand what needs to change, and apply the fix cleanly.

Respond ONLY with valid JSON (no markdown, no backticks, no explanation outside JSON):
{
  "projectName": "string",
  "description": "string",
  "files": [...all files, modified and unmodified...],
  "runFile": "main entry file",
  "notes": "clear explanation of exactly what was changed and why"
}

Rules:
- Keep all unchanged files exactly as-is
- Only modify files that need to change
- Do not break existing functionality
- Apply the fix cleanly and completely — no half-fixes
- If the fix requires new files, add them`

/**
 * AGENT REVIEW PROMPT — for self-review loop
 */
const AGENT_REVIEW_PROMPT = `You are PalaceDev AI acting as a strict code reviewer at The Palace, Inc.
Review the provided codebase thoroughly for:
- Bugs and errors
- Missing features that were requested
- Broken functionality
- Poor UX or accessibility issues
- Incomplete implementations

Respond ONLY with valid JSON:
{
  "issues": ["specific issue 1", "specific issue 2"],
  "done": true or false,
  "fixRequest": "precise description of what to fix (empty string if done)"
}

Be strict. If there are real problems, set done=false. If the code is complete and working, set done=true.`

// ─── API CALLER ────────────────────────────────────────────────────────────

async function callClaude(messages: ChatMessage[], system: string, maxTokens = 8000): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set in Vercel environment variables')
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
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
  return data.content.map((b: any) => b.text || '').join('')
}

function parseJSON(raw: string): any {
  const clean = raw.replace(/^```[a-z]*\n?/gm, '').replace(/^```$/gm, '').trim()
  return JSON.parse(clean)
}

function isGenerationSignal(text: string): boolean {
  const signals = [
    'yes', 'go ahead', 'generate', 'build it', 'start', 'proceed',
    'looks good', 'perfect', 'correct', 'sure', 'do it', 'create it',
    'build', 'make it', 'ok', 'okay', 'yep', 'yeah', 'confirmed',
    'that\'s right', 'thats right', 'exactly', 'let\'s go', 'lets go',
  ]
  const lower = text.toLowerCase().trim()
  return signals.some(s => lower.includes(s)) && lower.length < 120
}

// ─── EXPORTED FUNCTIONS ────────────────────────────────────────────────────

/**
 * Main chat function — handles multi-turn conversation.
 * Returns either:
 * - { type: 'message', content: string } — AI is still asking questions
 * - { type: 'project', project: GeneratedProject } — AI generated code
 */
export async function chat(
  messages: ChatMessage[]
): Promise<{ type: 'message'; content: string } | { type: 'project'; project: GeneratedProject }> {
  const raw = await callClaude(messages, CONVERSATION_PROMPT, 8000)

  // Try to parse as JSON (generation response)
  try {
    const parsed = parseJSON(raw)
    if (parsed.files && Array.isArray(parsed.files)) {
      return { type: 'project', project: parsed as GeneratedProject }
    }
  } catch {
    // Not JSON — it's a conversational message
  }

  return { type: 'message', content: raw }
}

/**
 * Fix existing project with a plain English request
 */
export async function fixProject(
  project: GeneratedProject,
  request: string
): Promise<GeneratedProject> {
  const filesContext = project.files.map(f => `=== ${f.name} ===\n${f.content}`).join('\n\n')
  const raw = await callClaude(
    [{
      role: 'user',
      content: `Project "${project.projectName}":\n\n${filesContext}\n\nFix request: ${request}`,
    }],
    FIX_PROMPT
  )
  return parseJSON(raw) as GeneratedProject
}

/**
 * Agent self-review — checks for issues in generated code
 */
export async function agentReview(project: GeneratedProject): Promise<{
  issues: string[]
  done: boolean
  fixRequest: string
}> {
  const filesContext = project.files.map(f => `=== ${f.name} ===\n${f.content}`).join('\n\n')
  const raw = await callClaude(
    [{
      role: 'user',
      content: `Review this project "${project.projectName}":\n\n${filesContext}`,
    }],
    AGENT_REVIEW_PROMPT,
    2000
  )
  return parseJSON(raw)
}

/**
 * Full agent loop — generate + self-review + fix until done
 */
export async function runAgentLoop(
  idea: string,
  maxIterations = 5,
  onLog: (log: string) => void = () => {}
): Promise<GeneratedProject> {
  onLog(`[Agent] Starting: "${idea}"`)

  // Generate initial project directly (skip conversation for agent mode)
  const initRaw = await callClaude(
    [{
      role: 'user',
      content: `Build this project completely: ${idea}\n\nGenerate the full codebase now. Respond only with JSON.`,
    }],
    CONVERSATION_PROMPT
  )
  let project = parseJSON(initRaw) as GeneratedProject
  onLog(`[Agent] Generated ${project.files.length} files for "${project.projectName}"`)

  for (let i = 0; i < maxIterations; i++) {
    onLog(`[Agent] Review pass ${i + 1}/${maxIterations}`)
    const review = await agentReview(project)

    if (review.issues.length > 0) {
      onLog(`[Agent] Issues: ${review.issues.slice(0, 3).join(' | ')}`)
    }

    if (review.done || !review.fixRequest) {
      onLog(`[Agent] ✓ Complete after ${i + 1} review(s)`)
      break
    }

    onLog(`[Agent] Fixing: ${review.fixRequest}`)
    project = await fixProject(project, review.fixRequest)
    onLog(`[Agent] Fix applied`)
  }

  return project
}
