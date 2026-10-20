// Pouze server: provede plán vyúčtování (planFeeDocuments) v databázi. Vystavuje se až při schválení upomínky
// ve frontě (send route), nikdy v cronu. Vyžaduje admin klienta (číslování přes service_role RPC);
// všechny dotazy mají explicitní filtr workspace_id.
import type { SupabaseClient } from '@supabase/supabase-js'
import { nextServerNumber } from '../document-number-server'
import type { EffectiveTerms } from '../terms/effective'
import type { ReminderPlan } from './plan'
import { addDays, todayPrague } from './schedule'
import {
  FEE_PARAGRAPHS,
  FEE_TITLES,
  isFeeKind,
  planFeeDocuments,
  type ExistingFeeDoc,
  type FeeAction,
  type FeeDocStatus,
  type FeeKind,
} from './fees'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>

export interface FeeInvoice {
  id: string
  user_id: string
  client_id: string | null
  company_profile_id: string | null
}

export interface FeeDocSummary {
  id: string
  number: string
  kind: FeeKind
  title: string
  amount: number
  issueDate: string | null
  dueDate: string | null
  variableSymbol: string | null
  status: FeeDocStatus
}

const COLUMNS = 'id, number, fee_kind, status, total_with_vat, issue_date, due_date, variable_symbol, terms_values, created_at'
const DEFAULT_DUE_DAYS = 7

interface Row {
  id: string
  number: string
  fee_kind: string | null
  status: string
  total_with_vat: number | null
  issue_date: string | null
  due_date: string | null
  variable_symbol: string | null
  terms_values: Record<string, string> | null
}

async function loadFeeDocs(admin: Admin, workspaceId: string, invoiceId: string): Promise<Row[]> {
  const { data } = await admin
    .from('documents')
    .select(COLUMNS)
    .eq('workspace_id', workspaceId)
    .eq('type', 'vyuctovani')
    .eq('related_invoice_id', invoiceId)
    .order('created_at', { ascending: true })
  return (data ?? []) as Row[]
}

const toExisting = (r: Row): ExistingFeeDoc | null =>
  isFeeKind(r.fee_kind)
    ? {
        id: r.id,
        fee_kind: r.fee_kind,
        amount: r.total_with_vat ?? 0,
        status: r.status as FeeDocStatus,
        waived: r.terms_values?.waived === '1',
        superseded: r.terms_values?.superseded === '1',
      }
    : null

const toSummary = (r: Row): FeeDocSummary => ({
  id: r.id,
  number: r.number,
  kind: r.fee_kind as FeeKind,
  title: FEE_TITLES[r.fee_kind as FeeKind],
  amount: r.total_with_vat ?? 0,
  issueDate: r.issue_date,
  dueDate: r.due_date,
  variableSymbol: r.variable_symbol,
  status: r.status as FeeDocStatus,
})

/** Variabilní symbol vyúčtování: '9' + rok + pořadí z čísla dokladu (VY-2026-0001 → 920260001). Číslo faktury dává 8 číslic (rok + řada), tedy bez kolize. */
export function feeVariableSymbol(number: string, prefix = '9'): string {
  const m = /^VY-(\d{4})-(\d+)$/.exec(number)
  if (!m) throw new Error('Neočekávaný tvar čísla vyúčtování')
  return `${prefix}${m[1]}${m[2].padStart(4, '0')}`
}

async function pickVariableSymbol(admin: Admin, workspaceId: string, number: string): Promise<string> {
  for (const prefix of ['9', '8']) {
    const vs = feeVariableSymbol(number, prefix)
    const { data } = await admin
      .from('documents')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('variable_symbol', vs)
      .neq('number', number)
      .limit(1)
    if (!data?.length) return vs
  }
  return feeVariableSymbol(number, '7')
}

export async function applyFeeDocuments(args: {
  supabase: Admin
  workspaceId: string
  invoice: FeeInvoice
  orderId: string
  plan: Pick<ReminderPlan, 'amountDue'>
  milestone: number
  effective: EffectiveTerms
}): Promise<FeeDocSummary[]> {
  const { supabase: admin, workspaceId, invoice, orderId, plan, milestone, effective } = args

  const rows = await loadFeeDocs(admin, workspaceId, invoice.id)
  const existing = rows.map(toExisting).filter((d): d is ExistingFeeDoc => d !== null)
  const actions = planFeeDocuments({ milestone, effective, existing, invoiceRemaining: plan.amountDue })

  // 1) nejdřív storno nahrazovaných dokladů (podmíněně podle stavu, ať se nepřepíše mezitím zaplacený)
  const supersede = Array.from(new Set(actions.flatMap((a) => a.supersede ?? [])))
  for (const id of supersede) {
    const row = rows.find((r) => r.id === id)
    await admin
      .from('documents')
      .update({ status: 'cancelled', terms_values: { ...(row?.terms_values ?? {}), superseded: '1' } })
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .in('status', ['issued', 'sent'])
  }

  // 2) pak vytvoření nových
  const today = todayPrague()
  const dueDays = DEFAULT_DUE_DAYS
  for (const action of actions) {
    if (action.action !== 'create' && action.action !== 'replace') continue
    await createFeeDoc({ admin, workspaceId, invoice, orderId, action, effective, milestone, base: plan.amountDue, today, dueDays })
  }

  const final = await loadFeeDocs(admin, workspaceId, invoice.id)
  return final.filter((r) => r.status !== 'cancelled' && isFeeKind(r.fee_kind)).map(toSummary)
}

async function createFeeDoc(args: {
  admin: Admin
  workspaceId: string
  invoice: FeeInvoice
  orderId: string
  action: FeeAction
  effective: EffectiveTerms
  milestone: number
  base: number
  today: string
  dueDays: number
}): Promise<void> {
  const { admin, workspaceId, invoice, orderId, action, effective, milestone, base, today, dueDays } = args
  const kind = action.kind
  const number = await nextServerNumber(admin, workspaceId, 'vyuctovani', 'VY', Number(today.slice(0, 4)))
  const vs = await pickVariableSymbol(admin, workspaceId, number)
  const termsValues: Record<string, string> = {
    vs,
    milestone: String(milestone),
    base: String(action.base ?? base),
    rate: kind === 'denni' ? String(effective.dailyPenaltyPercent) : '',
    days: action.daysCovered ? String(action.daysCovered) : '',
    ...(kind === 'denni' ? { day_from: String(effective.reminderDays[3]), day_to: String(effective.reminderDays[4]) } : {}),
    paragraph: FEE_PARAGRAPHS[kind],
  }
  const { error } = await admin.from('documents').insert({
    type: 'vyuctovani',
    status: 'issued',
    number,
    workspace_id: workspaceId,
    user_id: invoice.user_id,
    company_profile_id: invoice.company_profile_id,
    client_id: invoice.client_id,
    currency: 'CZK',
    related_invoice_id: invoice.id,
    order_id: orderId,
    fee_kind: kind,
    issue_date: today,
    due_date: addDays(today, dueDays),
    variable_symbol: vs,
    subject: FEE_TITLES[kind],
    total_without_vat: action.amount,
    total_with_vat: action.amount,
    amount_czk: action.amount,
    discount_percent: 0,
    terms_values: termsValues,
  })
  // souběh: unikátní index (related_invoice_id, fee_kind) – doklad už vystavil jiný požadavek, použije se ten
  if (error) {
    if (error.code === '23505') {
      const { data: winner } = await admin
        .from('documents')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('type', 'vyuctovani')
        .eq('related_invoice_id', invoice.id)
        .eq('fee_kind', kind)
        .neq('status', 'cancelled')
        .limit(1)
      if (winner?.length) return
    }
    throw new Error('Vyúčtování se nepodařilo vystavit')
  }
}
