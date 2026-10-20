import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const ctx = await getWorkspaceContext(supabase)
    if (!ctx) return json({ error: 'Unauthorized' }, 401)
    if (ctx.role !== 'admin') return json({ error: 'Forbidden — tato akce vyžaduje roli administrátora' }, 403)

    const { eventId, reason } = (await req.json()) as { eventId?: string; reason?: string }
    if (!eventId) return json({ error: 'Chybí eventId' }, 400)
    const skipReason = (reason ?? '').trim().slice(0, 200) || 'manual'

    const { data, error } = await supabase
      .from('reminder_events')
      .update({ status: 'skipped', skip_reason: skipReason, updated_at: new Date().toISOString() })
      .eq('id', eventId)
      .eq('workspace_id', ctx.workspaceId)
      .in('status', ['pending', 'failed'])
      .select('id')
    if (error) return json({ error: 'Přeskočení se nezdařilo' }, 500)
    if (!data?.length) return json({ error: 'Přeskočit lze jen čekající nebo neúspěšnou událost' }, 409)
    return json({ ok: true })
  } catch {
    return json({ error: 'Přeskočení se nezdařilo' }, 500)
  }
}
