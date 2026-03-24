import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401 })

  const body = await request.json()
  const intent: string | undefined = body.intent
  const intent_note: string | undefined = body.intent_note

  if (!intent || !['adopted', 'partial', 'deferred', 'reversed'].includes(intent)) {
    return NextResponse.json({ ok: false, reason: 'invalid intent' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('decisions')
    .update({
      intent,
      intent_note: intent_note ?? null,
      intent_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
