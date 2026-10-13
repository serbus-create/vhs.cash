import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkspaceContext } from '@/lib/workspace'
import { finalizeConfirmedOrder } from '@/lib/order-confirm-finalize'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

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

    // oprávnění a workspace ověřené přes RLS klienta přihlášeného admina
    const { data: doc } = await supabase
      .from('documents')
      .select('id, status')
      .eq('id', documentId)
      .eq('workspace_id', ctx.workspaceId)
      .eq('type', 'objednavka')
      .single()
    if (!doc) return json({ error: 'Objednávka nenalezena' }, 404)
    if (doc.status !== 'confirmed') return json({ error: 'Dokončit lze jen potvrzenou objednávku' }, 400)

    const r = await finalizeConfirmedOrder(createAdminClient(), documentId)
    const failed = r.failed.length ? r.failed : []
    return json({ archived: r.archived, mailed: r.mailed, failed })
  } catch {
    return json({ error: 'Dokončení se nezdařilo' }, 500)
  }
}
