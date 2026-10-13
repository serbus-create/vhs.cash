import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { createOrderLink, OrderLinkError, requestOrigin } from '@/lib/order-link-create'

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

    const { token, confirmUrl, expiresAt, missing } = await createOrderLink({
      supabase,
      workspaceId: ctx.workspaceId,
      documentId,
      origin: requestOrigin(req),
    })
    return json({ token, confirmUrl, expiresAt, missing })
  } catch (e) {
    if (e instanceof OrderLinkError) return json({ error: e.message }, e.status)
    return json({ error: 'Vytvoření odkazu se nezdařilo' }, 500)
  }
}
