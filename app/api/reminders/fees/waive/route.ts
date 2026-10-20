// Odpuštění poplatku (jen admin): doklad se stornuje a terms_values.waived = '1', takže ho systém už znovu nevystaví
// (planFeeDocuments). documents nemá sloupec pro důvod ani datum, proto jde vše do terms_values.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { todayPrague } from '@/lib/reminders/schedule'

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

    const { data: doc } = await supabase
      .from('documents')
      .select('id, type, terms_values')
      .eq('id', documentId)
      .eq('workspace_id', ctx.workspaceId)
      .single()
    if (!doc || doc.type !== 'vyuctovani') return json({ error: 'Vyúčtování nenalezeno' }, 404)

    const { data, error } = await supabase
      .from('documents')
      .update({
        status: 'cancelled',
        terms_values: { ...((doc.terms_values as Record<string, string> | null) ?? {}), waived: '1', waived_at: todayPrague() },
      })
      .eq('id', documentId)
      .eq('workspace_id', ctx.workspaceId)
      .eq('type', 'vyuctovani')
      .in('status', ['issued', 'sent'])
      .select('id')
    if (error) return json({ error: 'Uložení se nezdařilo' }, 500)
    if (!data?.length) return json({ error: 'Odpustit lze jen vystavené nebo odeslané vyúčtování' }, 409)
    return json({ ok: true })
  } catch {
    return json({ error: 'Uložení se nezdařilo' }, 500)
  }
}
