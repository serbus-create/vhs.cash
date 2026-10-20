// Denní cron: vytváří události upomínek ke schválení. NIC NEODESÍLÁ.
// Autorizace: Authorization: Bearer ${CRON_SECRET} (Vercel Cron ji posílá sám). Middleware /api/* nechrání.
import { createHash, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addDays, dueMilestones, todayPrague } from '@/lib/reminders/schedule'
import { amountDueOf } from '@/lib/reminders/plan'
import { composeReminder, type ComposeInvoice } from '@/lib/reminders/build'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BASE_URL = () => (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vhs-cash.vercel.app').replace(/\/$/, '')

const sha = (s: string) => createHash('sha256').update(s).digest()

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  const header = req.headers.get('authorization')
  if (!secret || !header) return false
  return timingSafeEqual(sha(header), sha(`Bearer ${secret}`))
}

const INVOICE_FIELDS =
  'id, workspace_id, client_id, order_id, company_profile_id, number, status, currency, amount_czk, total_with_vat, exchange_rate, paid_amount, due_date, variable_symbol, clients(name, email)'

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const startDate = process.env.REMINDERS_START_DATE
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return NextResponse.json({ ok: true, enabled: false })
  }

  try {
    const admin = createAdminClient()
    const today = todayPrague()
    const totals = { workspaces: 0, created: 0, superseded: 0, skippedPaid: 0, skippedCancelled: 0, errors: 0 }

    const { data: workspaces } = await admin.from('workspaces').select('id')
    for (const ws of workspaces ?? []) {
      totals.workspaces += 1
      try {
        await processWorkspace(admin, ws.id as string, today, startDate, totals)
      } catch {
        totals.errors += 1
      }
    }
    return NextResponse.json({ ok: true, enabled: true, today, ...totals })
  } catch {
    return NextResponse.json({ error: 'Cron selhal' }, { status: 500 })
  }
}

type Admin = ReturnType<typeof createAdminClient>
type Totals = { created: number; superseded: number; skippedPaid: number; skippedCancelled: number }

async function processWorkspace(admin: Admin, workspaceId: string, today: string, startDate: string, totals: Totals) {
  // 0) pending události faktur bez objednávky nepatří do fronty (řeší se ručně na /reminders/manual)
  const { data: pendingAll } = await admin
    .from('reminder_events')
    .select('invoice_id')
    .eq('workspace_id', workspaceId)
    .eq('status', 'pending')
  const pendingAllIds = Array.from(new Set((pendingAll ?? []).map((e) => e.invoice_id as string)))
  if (pendingAllIds.length) {
    const { data: noOrder } = await admin.from('documents').select('id').in('id', pendingAllIds).is('order_id', null)
    const noOrderIds = (noOrder ?? []).map((d) => d.id as string)
    if (noOrderIds.length) {
      await admin
        .from('reminder_events')
        .update({ status: 'skipped', skip_reason: 'no_order', updated_at: new Date().toISOString() })
        .in('invoice_id', noOrderIds)
        .eq('status', 'pending')
    }
  }

  // 1) pending události faktur, které mezitím byly zaplaceny nebo zrušeny
  const { data: pending } = await admin
    .from('reminder_events')
    .select('id, invoice_id')
    .eq('workspace_id', workspaceId)
    .eq('status', 'pending')
  const pendingInvoiceIds = Array.from(new Set((pending ?? []).map((e) => e.invoice_id as string)))
  if (pendingInvoiceIds.length) {
    const { data: invs } = await admin
      .from('documents')
      .select('id, status, currency, amount_czk, total_with_vat, exchange_rate, paid_amount')
      .in('id', pendingInvoiceIds)
    for (const inv of invs ?? []) {
      let reason: string | null = null
      if (inv.status === 'cancelled') reason = 'cancelled'
      else if (inv.status === 'paid' || amountDueOf(inv) <= 0) reason = 'paid'
      if (!reason) continue
      const { data: upd } = await admin
        .from('reminder_events')
        .update({ status: 'skipped', skip_reason: reason, updated_at: new Date().toISOString() })
        .eq('invoice_id', inv.id)
        .eq('status', 'pending')
        .select('id')
      if (reason === 'cancelled') totals.skippedCancelled += upd?.length ?? 0
      else totals.skippedPaid += upd?.length ?? 0
    }
  }

  // 2) kandidáti: faktury po splatnosti od REMINDERS_START_DATE
  const { data: invoices } = await admin
    .from('documents')
    .select(INVOICE_FIELDS)
    .eq('workspace_id', workspaceId)
    .eq('type', 'faktura')
    .not('status', 'in', '("paid","cancelled","draft")')
    .not('due_date', 'is', null)
    .not('order_id', 'is', null)
    .gte('due_date', startDate)
    .lt('due_date', today)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidates = (invoices ?? []) as any[]
  if (!candidates.length) return

  const orderIds = Array.from(new Set(candidates.map((i) => i.order_id).filter(Boolean))) as string[]
  const profileIds = Array.from(new Set(candidates.map((i) => i.company_profile_id).filter(Boolean))) as string[]
  const [ordersRes, profilesRes, eventsRes] = await Promise.all([
    orderIds.length
      ? admin.from('documents').select('id, workspace_id, client_id, status, number, terms_values').in('id', orderIds)
      : Promise.resolve({ data: [] as never[] }),
    profileIds.length
      ? admin.from('company_profiles').select('id, name, bank_account, iban, swift').in('id', profileIds)
      : Promise.resolve({ data: [] as never[] }),
    admin.from('reminder_events').select('invoice_id, milestone, status').in('invoice_id', candidates.map((i) => i.id)),
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orders = new Map(((ordersRes.data ?? []) as any[]).map((o) => [o.id, o]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profiles = new Map(((profilesRes.data ?? []) as any[]).map((p) => [p.id, p]))
  const existing = new Set(((eventsRes.data ?? []) as { invoice_id: string; milestone: number }[]).map((e) => `${e.invoice_id}:${e.milestone}`))

  for (const inv of candidates) {
    const milestones = dueMilestones(inv.due_date, today)
    if (!milestones.length) continue
    const top = Math.max(...milestones)
    const client = Array.isArray(inv.clients) ? inv.clients[0] ?? null : inv.clients ?? null
    const order = inv.order_id ? orders.get(inv.order_id) ?? null : null
    const profile = inv.company_profile_id ? profiles.get(inv.company_profile_id) ?? null : null

    const { plan, email } = composeReminder({
      milestone: top,
      invoice: inv as ComposeInvoice,
      client,
      order,
      profile,
      today,
      baseUrl: BASE_URL(),
    })
    if (plan.skipReason) continue

    const rows = milestones
      .filter((m) => !existing.has(`${inv.id}:${m}`))
      .map((m) => {
        const isTop = m === top
        return {
          workspace_id: workspaceId,
          invoice_id: inv.id,
          milestone: m,
          due_date: inv.due_date,
          scheduled_for: addDays(inv.due_date, m),
          status: isTop ? 'pending' : 'skipped',
          skip_reason: isTop ? null : 'superseded',
          recipient_email: plan.recipient,
          ...(isTop
            ? { plan, subject: email.subject, body_text: email.bodyText, body_html: email.bodyHtml }
            : {}),
        }
      })
    if (!rows.length) continue

    // ON CONFLICT (invoice_id, milestone) DO NOTHING: opakované spuštění nic nezdvojí
    const { data: inserted } = await admin
      .from('reminder_events')
      .upsert(rows, { onConflict: 'invoice_id,milestone', ignoreDuplicates: true })
      .select('id, milestone, status')
    const createdPending = (inserted ?? []).some((r) => r.milestone === top && r.status === 'pending')
    totals.created += (inserted ?? []).filter((r) => r.status === 'pending').length

    // vyšší milník nahrazuje starší nevyřízené (pending) události téže faktury
    if (createdPending) {
      const { data: sup } = await admin
        .from('reminder_events')
        .update({ status: 'skipped', skip_reason: 'superseded', updated_at: new Date().toISOString() })
        .eq('invoice_id', inv.id)
        .eq('status', 'pending')
        .lt('milestone', top)
        .select('id')
      totals.superseded += sup?.length ?? 0
    }
  }
}
