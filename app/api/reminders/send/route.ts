// Odeslání jedné události fronty upomínek (po schválení adminem). Vzor: podpisovna/send (rollback) a
// order-confirm-finalize (atomický zámek). Událost způsobilá k poplatkům (plan.eligibleForFees) před odesláním
// vystaví nebo znovu použije vyúčtování (applyFeeDocuments) a přiloží je k e-mailu. Doklady vznikají jen tady, ne v cronu.
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateInvoicePdf } from '@/lib/pdf/generate'
import { generateSettlementPdf } from '@/lib/pdf/generate-settlement'
import { readEffectiveTerms } from '@/lib/terms/effective'
import { applyFeeDocuments, type FeeDocSummary } from '@/lib/reminders/fees-apply'
import { todayPrague } from '@/lib/reminders/schedule'
import { amountDueOf } from '@/lib/reminders/plan'
import { composeReminder, type ComposeInvoice } from '@/lib/reminders/build'
import { REMINDER_FROM, REMINDER_REPLY_TO, REMINDER_BCC, FEES_ENABLED } from '@/lib/reminders/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const resend = new Resend(process.env.RESEND_API_KEY)
const BASE_URL = () => (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vhs-cash.vercel.app').replace(/\/$/, '')
const LOCK_STALE_MS = 10 * 60 * 1000
const LEGACY_LEVEL: Record<number, 1 | 2 | 3> = { 1: 1, 8: 1, 15: 2, 22: 3, 30: 3 }

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const ctx = user ? await getWorkspaceContext(supabase) : null
    if (!user || !ctx) return json({ error: 'Unauthorized' }, 401)
    if (ctx.role !== 'admin') return json({ error: 'Forbidden — tato akce vyžaduje roli administrátora' }, 403)

    const { eventId } = (await req.json()) as { eventId?: string }
    if (!eventId) return json({ error: 'Chybí eventId' }, 400)

    // ── atomický zámek: jen pending/failed, nebo zapomenuté 'sending' starší než 10 minut ──
    const { data: cur } = await supabase
      .from('reminder_events')
      .select('id, attempts')
      .eq('id', eventId)
      .eq('workspace_id', ctx.workspaceId)
      .single()
    if (!cur) return json({ error: 'Událost nenalezena' }, 404)

    const now = new Date()
    const staleBefore = new Date(now.getTime() - LOCK_STALE_MS).toISOString()
    const { data: locked } = await supabase
      .from('reminder_events')
      .update({ status: 'sending', sending_at: now.toISOString(), attempts: (cur.attempts as number) + 1, updated_at: now.toISOString() })
      .eq('id', eventId)
      .eq('workspace_id', ctx.workspaceId)
      .eq('attempts', cur.attempts as number)
      .or(`status.in.(pending,failed),and(status.eq.sending,sending_at.lt.${staleBefore})`)
      .select('*')
    const event = locked?.[0]
    if (!event) return json({ error: 'Událost už se odesílá nebo je vyřízená' }, 409)

    const release = async (patch: Record<string, unknown>) => {
      await supabase
        .from('reminder_events')
        .update({ sending_at: null, updated_at: new Date().toISOString(), ...patch })
        .eq('id', eventId)
        .eq('workspace_id', ctx.workspaceId)
    }
    const skip = async (reason: string, message: string) => {
      await release({ status: 'skipped', skip_reason: reason })
      return json({ error: message }, 409)
    }

    // ── znovu ověřit fakturu ──
    const { data: inv } = await supabase
      .from('documents')
      .select(
        'id, workspace_id, user_id, type, client_id, order_id, company_profile_id, number, status, currency, amount_czk, total_with_vat, exchange_rate, paid_amount, due_date, variable_symbol, clients(name, email)',
      )
      .eq('id', event.invoice_id)
      .single()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invoice = inv as any
    if (!invoice || invoice.workspace_id !== ctx.workspaceId || invoice.type !== 'faktura') {
      return skip('invoice_missing', 'Faktura nenalezena, událost byla přeskočena')
    }
    if (invoice.status === 'cancelled') return skip('cancelled', 'Faktura je zrušená, událost byla přeskočena')
    if (invoice.status === 'paid' || invoice.status === 'draft' || amountDueOf(invoice) <= 0) {
      return skip('paid', 'Faktura je již uhrazená, událost byla přeskočena')
    }
    if (invoice.due_date !== event.due_date) {
      return skip('due_date_changed', 'Splatnost faktury se změnila, událost byla přeskočena')
    }

    const client = Array.isArray(invoice.clients) ? invoice.clients[0] ?? null : invoice.clients ?? null
    const [orderRes, profileRes] = await Promise.all([
      invoice.order_id
        ? supabase.from('documents').select('id, workspace_id, client_id, status, number, terms_values').eq('id', invoice.order_id).single()
        : Promise.resolve({ data: null }),
      invoice.company_profile_id
        ? supabase.from('company_profiles').select('name, bank_account, iban, swift').eq('id', invoice.company_profile_id).single()
        : Promise.resolve({ data: null }),
    ])

    // ── přepočet plánu a textu k dnešnímu dni ──
    const { plan, email } = composeReminder({
      milestone: event.milestone as number,
      invoice: invoice as ComposeInvoice,
      client,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      order: orderRes.data as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      profile: profileRes.data as any,
      today: todayPrague(),
      baseUrl: BASE_URL(),
    })
    await release({
      status: 'sending',
      sending_at: new Date().toISOString(),
      plan,
      subject: email.subject,
      body_text: email.bodyText,
      body_html: email.bodyHtml,
      recipient_email: plan.recipient,
    })

    if (plan.feesBlocked) {
      await release({ status: 'pending' })
      return json({ error: 'Poplatky jsou vypnuté, událost způsobilou k poplatkům nelze odeslat' }, 409)
    }
    if (!plan.recipient) {
      await release({ status: 'pending' })
      return json({ error: 'Klient nemá zadaný e-mail' }, 400)
    }

    // ── vyúčtování poplatků, PDF a odeslání ──
    const useFees = FEES_ENABLED && plan.eligibleForFees && (event.milestone as number) >= 8
    const admin = useFees ? createAdminClient() : null
    try {
      let feeDocs: FeeDocSummary[] = []
      let finalPlan = plan
      let finalEmail = email
      if (admin) {
        const all = await applyFeeDocuments({
          supabase: admin,
          workspaceId: ctx.workspaceId,
          invoice: {
            id: invoice.id as string,
            user_id: invoice.user_id as string,
            client_id: invoice.client_id as string | null,
            company_profile_id: invoice.company_profile_id as string | null,
          },
          orderId: invoice.order_id as string,
          plan,
          milestone: event.milestone as number,
          effective: readEffectiveTerms((orderRes.data as { terms_values: Record<string, string> | null } | null)?.terms_values),
        })
        // do e-mailu a příloh jen neuhrazená platná vyúčtování
        feeDocs = all.filter((d) => d.status === 'issued' || d.status === 'sent')
        if (feeDocs.length > 0) {
          const composed = composeReminder({
            milestone: event.milestone as number,
            invoice: invoice as ComposeInvoice,
            client,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            order: orderRes.data as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            profile: profileRes.data as any,
            today: todayPrague(),
            baseUrl: BASE_URL(),
            feeDocs,
          })
          finalPlan = composed.plan
          finalEmail = composed.email
        }
      }

      const invoicePdf = await generateInvoicePdf(supabase, invoice.id as string)
      const safeNumber = String(invoice.number).replace(/[^a-zA-Z0-9-]/g, '_')
      const attachments = [{ filename: `faktura-${safeNumber}.pdf`, content: invoicePdf }]
      for (const d of feeDocs) {
        attachments.push({
          filename: `Vyuctovani-${d.number.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`,
          content: await generateSettlementPdf(supabase, d.id),
        })
      }
      const { data: sent, error: sendError } = await resend.emails.send({
        from: REMINDER_FROM,
        to: plan.recipient,
        bcc: REMINDER_BCC,
        replyTo: REMINDER_REPLY_TO,
        subject: finalEmail.subject,
        html: finalEmail.bodyHtml,
        text: finalEmail.bodyText,
        attachments,
      })
      if (sendError) throw new Error('send')

      // vyúčtování, která byla součástí e-mailu: issued → sent (podmíněně, zaplacené ani stornované se nepřepíšou)
      const issuedIds = feeDocs.filter((d) => d.status === 'issued').map((d) => d.id)
      if (admin && issuedIds.length > 0) {
        const { error: docMarkError } = await admin
          .from('documents')
          .update({ status: 'sent' })
          .in('id', issuedIds)
          .eq('workspace_id', ctx.workspaceId)
          .eq('type', 'vyuctovani')
          .eq('status', 'issued')
        if (docMarkError) console.error('[reminders/send] zápis stavu vyúčtování selhal')
      }

      const sentAt = new Date().toISOString()
      const { error: markError } = await supabase
        .from('reminder_events')
        .update({
          status: 'sent',
          sent_at: sentAt,
          sent_by: user.id,
          provider_message_id: sent?.id ?? null,
          plan: { ...finalPlan, feeDocuments: feeDocs.map((d) => d.number) },
          subject: finalEmail.subject,
          body_text: finalEmail.bodyText,
          body_html: finalEmail.bodyHtml,
          error: null,
          sending_at: null,
          updated_at: sentAt,
        })
        .eq('id', eventId)
        .eq('workspace_id', ctx.workspaceId)
      if (markError) console.error('[reminders/send] zápis stavu sent selhal')

      // stará tabulka reminders (historie ručních upomínek); selhání odeslání neruší
      // stejné sloupce jako původní /api/reminders (document_id, level, recipient_email) a datum odeslání výslovně
      const { error: legacyError } = await supabase.from('reminders').insert({
        document_id: invoice.id,
        level: LEGACY_LEVEL[event.milestone as number] ?? 1,
        recipient_email: plan.recipient,
        sent_at: sentAt,
      })
      if (legacyError) console.error('[reminders/send] zápis do tabulky reminders selhal')
      return json({ ok: true })
    } catch {
      await release({ status: 'failed', error: 'Odeslání se nezdařilo' })
      return json({ error: 'E-mail se nepodařilo odeslat, událost zůstává ve frontě jako neúspěšná.' }, 502)
    }
  } catch {
    return json({ error: 'Odeslání se nezdařilo' }, 500)
  }
}
