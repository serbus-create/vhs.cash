// Sestavení plánu a e-mailu jedné události upomínky. Sdílí cron (náhled) a odeslání (přepočet).
import { readEffectiveTerms } from '../terms/effective'
import { buildReminderPlan, type PlanInvoice, type PlanOrder, type ReminderPlan } from './plan'
import { buildReminderEmail, type BuiltReminderEmail, type EmailInvoice, type FeeEmailDoc } from './email'
import { feeQrMessage } from './fees'
import type { FeeDocSummary } from './fees-apply'
import { buildReminderQrUrl, type QrProfile } from './qr-url'

export interface ComposeInvoice extends PlanInvoice, EmailInvoice {}

export interface ComposeProfile extends QrProfile {
  bank_account: string | null
}

export function composeReminder(args: {
  milestone: number
  invoice: ComposeInvoice
  client: { name: string; email: string | null } | null
  order: (PlanOrder & { number: string }) | null
  profile: ComposeProfile | null
  today: string
  baseUrl: string
  /** neuhrazená vyúčtování poplatků k přiložení (jen u způsobilé faktury); bez nich e-mail jako dosud */
  feeDocs?: FeeDocSummary[]
}): { plan: ReminderPlan; email: BuiltReminderEmail } {
  const { milestone, invoice, client, order, profile, today, baseUrl } = args
  const feeDocs = args.feeDocs ?? []
  const effective = readEffectiveTerms(order?.terms_values)
  const plan = buildReminderPlan({ invoice, client, order, effective, milestone, today })
  const qrUrl = buildReminderQrUrl({
    baseUrl,
    profile,
    amount: plan.amountDue,
    currency: plan.currency,
    number: invoice.number,
    variableSymbol: invoice.variable_symbol,
  })
  const email = buildReminderEmail({
    milestone,
    invoice,
    client: client ? { name: client.name } : null,
    plan,
    effective,
    qrUrl,
    today,
    orderNumber: plan.eligibleForFees ? order?.number ?? null : null,
    bankAccount: profile?.bank_account ?? null,
    iban: profile?.iban ?? null,
    feeDocs: plan.eligibleForFees ? feeDocs.map((d): FeeEmailDoc => toFeeEmailDoc(d, baseUrl, profile)) : [],
  })
  return { plan, email }
}

function toFeeEmailDoc(d: FeeDocSummary, baseUrl: string, profile: ComposeProfile | null): FeeEmailDoc {
  return {
    number: d.number,
    title: d.title,
    amount: d.amount,
    dueDate: d.dueDate,
    variableSymbol: d.variableSymbol,
    qrUrl: buildReminderQrUrl({
      baseUrl,
      profile,
      amount: d.amount,
      currency: 'CZK',
      number: feeQrMessage(d.number),
      variableSymbol: d.variableSymbol,
    }),
  }
}
