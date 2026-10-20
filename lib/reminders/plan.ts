// Plán jedné upomínky: způsobilost k poplatkům a dlužná částka. Čistá funkce, nic nezapisuje.
import { FEES_ENABLED } from './config'
import type { EffectiveTerms } from '../terms/effective'

export interface PlanInvoice {
  workspace_id: string
  client_id: string | null
  order_id: string | null
  status: string
  currency: string | null
  amount_czk: number | null
  total_with_vat: number | null
  exchange_rate?: number | null
  paid_amount: number | null
}

export interface PlanOrder {
  workspace_id: string
  client_id: string | null
  status: string
  terms_values: Record<string, string> | null
}

export interface ReminderPlan {
  /** faktura splňuje všechny podmínky pro smluvní pokuty a paušál */
  eligibleForFees: boolean
  /** způsobilá, ale FEES_ENABLED je vypnuto; odeslání se odmítne */
  feesBlocked: boolean
  /** proč faktura není způsobilá (null, je-li způsobilá) */
  feeReason: string | null
  /** dlužná částka v měně faktury */
  amountDue: number
  currency: string
  recipient: string | null
  /** důvod, proč se upomínka vůbec nemá posílat (zaplaceno, zrušeno) */
  skipReason?: string
}

export const MIN_FEES_TERMS_VERSION = '1.1'

export function versionAtLeast(version: string | null | undefined, min: string): boolean {
  if (!version) return false
  const a = version.split('.').map(Number)
  const b = min.split('.').map(Number)
  if (a.some(Number.isNaN)) return false
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y
  }
  return true
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Dlužná částka v měně faktury, minimálně 0. paid_amount je evidováno v CZK. */
export function amountDueOf(invoice: Pick<PlanInvoice, 'currency' | 'amount_czk' | 'total_with_vat' | 'exchange_rate' | 'paid_amount'>): number {
  const paid = invoice.paid_amount ?? 0
  const currency = invoice.currency ?? 'CZK'
  if (currency === 'CZK') {
    return Math.max(0, round2((invoice.amount_czk ?? invoice.total_with_vat ?? 0) - paid))
  }
  const total = invoice.total_with_vat ?? 0
  const paidInCurrency = invoice.exchange_rate ? paid / invoice.exchange_rate : 0
  return Math.max(0, round2(total - paidInCurrency))
}

export function buildReminderPlan(args: {
  invoice: PlanInvoice
  client: { email: string | null } | null
  order: PlanOrder | null
  effective: EffectiveTerms
  milestone: number
  today: string
  /** jen pro testy; jinak FEES_ENABLED */
  feesEnabled?: boolean
}): ReminderPlan {
  const { invoice, client, order, effective } = args
  const feesEnabled = args.feesEnabled ?? FEES_ENABLED
  const currency = invoice.currency ?? 'CZK'
  const amountDue = amountDueOf(invoice)

  let feeReason: string | null = null
  if (!invoice.order_id) feeReason = 'Faktura nemá navázanou objednávku'
  else if (!order) feeReason = 'Objednávka nenalezena'
  else if (order.status !== 'confirmed') feeReason = 'Objednávka není potvrzená'
  else if (order.workspace_id !== invoice.workspace_id) feeReason = 'Objednávka patří do jiného workspace'
  else if (!invoice.client_id || order.client_id !== invoice.client_id) feeReason = 'Objednávka patří jinému klientovi'
  else if (!order.terms_values?.terms_effective || !versionAtLeast(effective.version, MIN_FEES_TERMS_VERSION)) {
    feeReason = `Podmínky starší než v${MIN_FEES_TERMS_VERSION} nebo bez efektivních hodnot`
  } else if (currency !== 'CZK') feeReason = 'Faktura není v CZK'

  const eligibleForFees = feeReason === null

  let skipReason: string | undefined
  if (invoice.status === 'cancelled') skipReason = 'cancelled'
  else if (invoice.status === 'paid' || amountDue <= 0) skipReason = 'paid'

  return {
    eligibleForFees,
    feesBlocked: eligibleForFees && !feesEnabled,
    feeReason,
    amountDue,
    currency,
    recipient: client?.email?.trim() || null,
    ...(skipReason ? { skipReason } : {}),
  }
}
