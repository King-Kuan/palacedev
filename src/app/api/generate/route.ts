import { NextRequest, NextResponse } from 'next/server'
import { generateProject } from '@/lib/claude'

export async function POST(req: NextRequest) {
  try {
    const { idea } = await req.json()
    if (!idea?.trim()) return NextResponse.json({ error: 'No idea provided' }, { status: 400 })
    const result = await generateProject(idea)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
