import { NextRequest, NextResponse } from 'next/server'
import { fixProject } from '@/lib/claude'

export async function POST(req: NextRequest) {
  try {
    const { project, request } = await req.json()
    if (!project || !request?.trim()) return NextResponse.json({ error: 'Missing project or request' }, { status: 400 })
    const result = await fixProject(project, request)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
