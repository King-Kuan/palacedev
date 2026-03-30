import { NextRequest, NextResponse } from 'next/server'
import { chat } from '@/lib/claude'

export async function POST(req: NextRequest) {
  try {
    const { idea } = await req.json()
    if (!idea?.trim()) return NextResponse.json({ error: 'No idea provided' }, { status: 400 })

    // Force direct generation by telling AI to build immediately
    const result = await chat([
      {
        role: 'user',
        content: `Build this project completely now. Respond only with the JSON codebase, no questions: ${idea}`,
      },
    ])

    if (result.type === 'project') return NextResponse.json(result.project)

    // If AI still asked questions, force it
    const forced = await chat([
      { role: 'user', content: `Build this project completely now. Respond only with the JSON codebase, no questions: ${idea}` },
      { role: 'assistant', content: result.content },
      { role: 'user', content: 'Generate the full code now. JSON only.' },
    ])

    if (forced.type === 'project') return NextResponse.json(forced.project)
    return NextResponse.json({ error: 'Could not generate project' }, { status: 500 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
