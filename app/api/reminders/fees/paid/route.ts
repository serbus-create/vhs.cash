// Označení vyúčtování poplatku jako zaplaceného (jen admin). Datum úhrady se ukládá do terms_values.paid_at,
// protože documents nemá sloupec paid_at. Aktualizace je podmíněná stavem (issued/sent), takže ji nelze provést dvakrát.
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

    const { documentId, paidDate } = (await req.json()) as { documentId?: string; paidDate?: string }
    if (!documentId) return json({ error: 'Chybí documentId' }, 400)
    const today = todayPrague()
    const date = paidDate?.trim() || today
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return json({ error: 'Neplatné datum úhrady' }, 400)
    if (date > today) return json({ error: 'Datum úhrady nesmí být v budoucnu' }, 400)

    const { data: doc } = await supabase
      .from('documents')
      .select('id, type, status, total_with_vat, terms_values')
      .eq('id', documentId)
      .eq('workspace_id', ctx.workspaceId)
      .single()
    if (!doc || doc.type !== 'vyuctovani') return json({ error: 'Vyúčtování nenalezeno' }, 404)

    const { data, error } = await supabase
      .from('documents')
      .update({
        status: 'paid',
        paid_amount: doc.total_with_vat,
        terms_values: { ...((doc.terms_values as Record<string, string> | null) ?? {}), paid_at: date },
      })
      .eq('id', documentId)
      .eq('workspace_id', ctx.workspaceId)
      .eq('type', 'vyuctovani')
      .in('status', ['issued', 'sent'])
      .select('id')
    if (error) return json({ error: 'Uložení se nezdařilo' }, 500)
    if (!data?.length) return json({ error: 'Označit lze jen vystavené nebo odeslané vyúčtování' }, 409)
    return json({ ok: true })
  } catch {
    return json({ error: 'Uložení se nezdařilo' }, 500)
  }
}
