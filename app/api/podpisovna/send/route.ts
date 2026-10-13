import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { createOrderLink, rollbackOrderLink, OrderLinkError, requestOrigin } from '@/lib/order-link-create'
import { generateOrderPdf, loadOrderPdfInput } from '@/lib/pdf/generate-order'
import { buildOrderEmail } from '@/lib/order-email'
import { FROM_NAME, FROM_ADDRESS, REPLY_TO, BCC_ON_SEND } from '@/lib/order-mail-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const resend = new Resend(process.env.RESEND_API_KEY)

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const STATUS_LABEL: Record<string, string> = {
  issued: 'Vydáno',
  sent: 'Odesláno',
  expired: 'Vypršelo',
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const ctx = await getWorkspaceContext(supabase)
    if (!ctx) return json({ error: 'Unauthorized' }, 401)
    if (ctx.role !== 'admin') return json({ error: 'Forbidden — tato akce vyžaduje roli administrátora' }, 403)

    const { documentId } = (await req.json()) as { documentId?: string }
    if (!documentId) return json({ error: 'Chybí documentId' }, 400)

    // (a) kontakt
    const { data: doc } = await supabase
      .from('documents')
      .select('id, type, number, contact_name, contact_email')
      .eq('id', documentId)
      .eq('workspace_id', ctx.workspaceId)
      .single()
    if (!doc || doc.type !== 'objednavka') return json({ error: 'Objednávka nenalezena' }, 404)
    const to = (doc.contact_email ?? '').trim()
    if (!doc.contact_name?.trim() || !EMAIL_RE.test(to)) {
      return json({ error: 'Chybí jméno nebo platný e-mail kontaktní osoby. Doplňte je v objednávce.' }, 400)
    }

    // (b) odkaz
    const link = await createOrderLink({
      supabase,
      workspaceId: ctx.workspaceId,
      documentId,
      origin: requestOrigin(req),
    })
    const prevStatus = String(link.previous.status)

    try {
      // (c) PDF
      const { pdf } = await generateOrderPdf(await loadOrderPdfInput(supabase, documentId))
      // (d) e-mail
      const email = buildOrderEmail({ docNumber: doc.number, confirmUrl: link.confirmUrl })
      // (e) odeslání
      const { error: sendError } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_ADDRESS}>`,
        to,
        bcc: BCC_ON_SEND,
        replyTo: REPLY_TO,
        subject: email.subject,
        html: email.html,
        text: email.text,
        attachments: [{ filename: `Objednavka-${doc.number.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`, content: pdf }],
      })
      if (sendError) throw new Error('send')
    } catch {
      await rollbackOrderLink({
        supabase,
        workspaceId: ctx.workspaceId,
        documentId,
        token: link.token,
        previous: link.previous,
      })
      return json(
        { error: `E-mail se nepodařilo odeslat, objednávka zůstává ve stavu ${STATUS_LABEL[prevStatus] ?? prevStatus}.` },
        502,
      )
    }

    // (f) e-mail už odešel, takže případná chyba zápisu se nehlásí jako chyba odeslání
    await supabase
      .from('documents')
      .update({ terms_mail_sent_at: new Date().toISOString(), terms_mail_to: to })
      .eq('id', documentId)
      .eq('workspace_id', ctx.workspaceId)

    return json({ ok: true, to, expiresAt: link.expiresAt })
  } catch (e) {
    if (e instanceof OrderLinkError) return json({ error: e.message }, e.status)
    return json({ error: 'Odeslání se nezdařilo' }, 500)
  }
}
