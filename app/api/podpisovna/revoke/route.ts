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

    const { documentId } = (await req.json()) as { documentId?: string }
    if (!documentId) return json({ error: 'Chybí documentId' }, 400)

    // stav 'sent' ve filtru: potvrzenou ani jinou objednávku nelze zrušit
    const { data, error } = await supabase
      .from('documents')
      .update({
        status: 'issued',
        confirm_token_hash: null,
        terms_sent_at: null,
        terms_expires_at: null,
        terms_snapshot: null,
        terms_hash: null,
      })
      .eq('id', documentId)
      .eq('workspace_id', ctx.workspaceId)
      .eq('type', 'objednavka')
      .eq('status', 'sent')
      .select('id')
    if (error) return json({ error: 'Zrušení se nezdařilo' }, 500)
    if (!data?.length) return json({ error: 'Odeslání lze zrušit jen u objednávky ve stavu Odesláno' }, 400)
    return json({ ok: true })
  } catch {
    return json({ error: 'Zrušení se nezdařilo' }, 500)
  }
}
