import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { hashToken, newToken, LINK_VALID_DAYS } from '@/lib/order-link'
import { buildOrderTerms, loadOrderPdfInput } from '@/lib/pdf/generate-order'
import { TERMS_TEMPLATE_VERSION } from '@/lib/terms/template'
import { createHash } from 'crypto'

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
      .select('id, type, status, workspace_id, contact_name, contact_email, terms_values')
      .eq('id', documentId)
      .eq('workspace_id', ctx.workspaceId)
      .single()
    if (!doc || doc.type !== 'objednavka') return json({ error: 'Objednávka nenalezena' }, 404)
    if (!['issued', 'sent', 'expired'].includes(doc.status)) {
      return json({ error: 'Odkaz lze vytvořit jen u vydané, odeslané nebo vypršelé objednávky' }, 400)
    }
    if (!doc.contact_name?.trim() || !doc.contact_email?.trim()) {
      return json({ error: 'Chybí jméno nebo e-mail kontaktní osoby. Doplňte je v objednávce.' }, 400)
    }

    // Podmínky se sestaví z aktuálního stavu (u sent/expired se přebírá nový snapshot)
    const input = await loadOrderPdfInput(supabase, documentId)
    const { result, missing } = buildOrderTerms(input)
    const snapshot = JSON.stringify(result)
    const termsHash = createHash('sha256').update(snapshot).digest('hex')

    const token = newToken()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + LINK_VALID_DAYS * 24 * 60 * 60 * 1000)

    const { error } = await supabase
      .from('documents')
      .update({
        confirm_token_hash: hashToken(token),
        terms_sent_at: now.toISOString(),
        terms_expires_at: expiresAt.toISOString(),
        status: 'sent',
        terms_snapshot: snapshot,
        terms_hash: termsHash,
        terms_values: { ...(doc.terms_values ?? {}), terms_version: TERMS_TEMPLATE_VERSION },
        confirmed_at: null,
        confirmed_by_name: null,
        confirmed_by_role: null,
        confirmed_by_email: null,
        confirmed_by_phone: null,
        confirmed_ip: null,
      })
      .eq('id', documentId)
      .eq('workspace_id', ctx.workspaceId)
    if (error) return json({ error: 'Uložení se nezdařilo' }, 500)

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
      `${req.headers.get('x-forwarded-proto') ?? 'https'}://${req.headers.get('x-forwarded-host') ?? req.headers.get('host')}`

    return json({ token, confirmUrl: `${origin}/potvrzeni/${token}`, expiresAt: expiresAt.toISOString(), missing })
  } catch {
    return json({ error: 'Vytvoření odkazu se nezdařilo' }, 500)
  }
}
