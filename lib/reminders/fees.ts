// Plán vyúčtování poplatků k jednomu milníku upomínky. Čistá logika bez závislostí a bez databáze:
// z efektivních hodnot podmínek a stávajících dokladů faktury rozhodne, co vytvořit, nahradit nebo znovu použít.
import type { EffectiveTerms } from '../terms/effective'

export type FeeKind = 'pokuta' | 'pokuta_navyseni' | 'pausal' | 'denni'
export type FeeDocStatus = 'issued' | 'sent' | 'paid' | 'cancelled'

export interface ExistingFeeDoc {
  id: string
  fee_kind: FeeKind
  amount: number
  status: FeeDocStatus
  /** odpuštěno adminem (doklad je stornovaný a systém ho už nevystaví) */
  waived: boolean
  /** stornováno, protože ho nahradil nový doklad */
  superseded: boolean
}

export interface FeeAction {
  kind: FeeKind
  action: 'create' | 'replace' | 'reuse' | 'skip'
  amount: number
  /** replace: doklad, který se nahrazuje (první z `supersede`) */
  replaces?: string
  /** doklady, které se při replace nebo create navýšení stornují jako superseded */
  supersede?: string[]
  /** reuse: stávající doklad, který zůstává platný (u pokuty první z aktivních) */
  existingId?: string
  daysCovered?: number
  base?: number
  reason?: string
}

const round2 = (n: number) => Math.round(n * 100) / 100
const isPokuta = (d: ExistingFeeDoc) => d.fee_kind === 'pokuta' || d.fee_kind === 'pokuta_navyseni'
const isActive = (d: ExistingFeeDoc) => d.status !== 'cancelled'
const isWaived = (d: ExistingFeeDoc) => d.status === 'cancelled' && d.waived
const isUnpaid = (d: ExistingFeeDoc) => d.status === 'issued' || d.status === 'sent'

/** Cílová částka smluvní pokuty v daném milníku: 8. den fee1, od 15. dne fee1 + fee2. */
export function targetPenalty(milestone: number, e: EffectiveTerms): number {
  if (milestone < 8) return 0
  return milestone === 8 ? e.fee1 : e.fee1 + e.fee2
}

export function planFeeDocuments(args: {
  milestone: number
  effective: EffectiveTerms
  existing: ExistingFeeDoc[]
  invoiceRemaining: number
}): FeeAction[] {
  const { milestone, effective: e, existing, invoiceRemaining } = args
  const actions: FeeAction[] = []
  if (milestone < 8) return actions

  // ── POKUTA (čl. 6.2) ──
  const penalties = existing.filter(isPokuta)
  const target = targetPenalty(milestone, e)
  const active = penalties.filter(isActive)
  const activeSum = round2(active.reduce((s, d) => s + d.amount, 0))
  if (penalties.some(isWaived)) {
    actions.push({ kind: 'pokuta', action: 'skip', amount: 0, reason: 'waived' })
  } else if (target <= 0) {
    actions.push({ kind: 'pokuta', action: 'skip', amount: 0, reason: 'zero' })
  } else if (activeSum >= target) {
    actions.push({ kind: 'pokuta', action: 'reuse', amount: activeSum, existingId: active[0]?.id })
  } else if (active.every(isUnpaid)) {
    if (active.length === 0) {
      actions.push({ kind: 'pokuta', action: 'create', amount: target })
    } else {
      actions.push({
        kind: 'pokuta',
        action: 'replace',
        amount: target,
        replaces: active[0].id,
        supersede: active.map((d) => d.id),
      })
    }
  } else {
    const paidSum = round2(active.filter((d) => d.status === 'paid').reduce((s, d) => s + d.amount, 0))
    actions.push({
      kind: 'pokuta_navyseni',
      action: 'create',
      amount: round2(target - paidSum),
      supersede: active.filter(isUnpaid).map((d) => d.id),
    })
  }

  // ── PAUSAL (čl. 6.3, od 22. dne) ──
  if (milestone >= 22) {
    const pausals = existing.filter((d) => d.fee_kind === 'pausal')
    const activePausal = pausals.find(isActive)
    if (pausals.some(isWaived)) actions.push({ kind: 'pausal', action: 'skip', amount: 0, reason: 'waived' })
    else if (activePausal) actions.push({ kind: 'pausal', action: 'reuse', amount: activePausal.amount, existingId: activePausal.id })
    else if (e.statutoryFee <= 0) actions.push({ kind: 'pausal', action: 'skip', amount: 0, reason: 'zero' })
    else actions.push({ kind: 'pausal', action: 'create', amount: e.statutoryFee })
  }

  // ── DENNI (čl. 6.4, jednorázově v milníku 30) ──
  if (milestone === 30) {
    const dailies = existing.filter((d) => d.fee_kind === 'denni')
    const activeDaily = dailies.find(isActive)
    const days = e.reminderDays[4] - e.reminderDays[3] + 1
    const amount = round2((invoiceRemaining * e.dailyPenaltyPercent / 100) * days)
    if (dailies.some(isWaived)) actions.push({ kind: 'denni', action: 'skip', amount: 0, reason: 'waived' })
    else if (activeDaily) actions.push({ kind: 'denni', action: 'reuse', amount: activeDaily.amount, existingId: activeDaily.id })
    else if (!(amount > 0)) actions.push({ kind: 'denni', action: 'skip', amount: 0, reason: 'zero' })
    else actions.push({ kind: 'denni', action: 'create', amount, daysCovered: days, base: invoiceRemaining })
  }

  return actions
}

/** Název dokladu (nadpis PDF, předmět dokladu, přehled v e-mailu). */
export const FEE_TITLES: Record<FeeKind, string> = {
  pokuta: 'Vyúčtování smluvní pokuty',
  pokuta_navyseni: 'Navýšení smluvní pokuty',
  pausal: 'Vyúčtování zákonné paušální náhrady nákladů',
  denni: 'Vyúčtování denní smluvní pokuty',
}

/** Článek podmínek spolupráce, ze kterého nárok plyne. */
export const FEE_PARAGRAPHS: Record<FeeKind, '6.2' | '6.3' | '6.4'> = {
  pokuta: '6.2',
  pokuta_navyseni: '6.2',
  pausal: '6.3',
  denni: '6.4',
}

export const isFeeKind = (v: unknown): v is FeeKind =>
  v === 'pokuta' || v === 'pokuta_navyseni' || v === 'pausal' || v === 'denni'

/** Zpráva pro příjemce v QR platbě (bez diakritiky: SPD 1.0 počítá s ASCII). */
export const feeQrMessage = (number: string): string => `Vyuctovani ${number}`
