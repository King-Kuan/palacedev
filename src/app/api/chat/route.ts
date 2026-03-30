import { NextRequest, NextResponse } from 'next/server'
import { chat } from '@/lib/claude'
import type { ChatMessage } from '@/lib/claude'

export async function POST(req: NextRequest) {
  try {
    const { messages }: { messages: ChatMessage[] } = await req.json()
    if (!messages?.length) return NextResponse.json({ error: 'No messages' }, { status: 400 })
    const result = await chat(messages)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
