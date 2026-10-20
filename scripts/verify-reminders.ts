// Kontrola logiky fronty upomínek. Spuštění: npx tsc scripts/verify-reminders.ts --outDir /tmp/vr ... && node /tmp/vr/scripts/verify-reminders.js
// Nic nezapisuje do databáze ani nic neodesílá.

import { MILESTONES, addDays, daysBetween, dueMilestones, todayPrague } from '../lib/reminders/schedule'
import { buildReminderPlan, versionAtLeast, amountDueOf, type PlanInvoice, type PlanOrder } from '../lib/reminders/plan'
import { readEffectiveTerms } from '../lib/terms/effective'
import { TERMS_DEFAULTS } from '../lib/terms/defaults'
import { planFeeDocuments, type ExistingFeeDoc, type FeeAction } from '../lib/reminders/fees'
import { feeVariableSymbol } from '../lib/reminders/fees-apply'

let failures = 0
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? 'OK  ' : 'CHYBA'} ${name}${detail ? ' ' + detail : ''}`)
  if (!ok) failures += 1
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// addDays / daysBetween
check('Milníky 1, 8, 15, 22, 30', same(MILESTONES, [1, 8, 15, 22, 30]))
check('Přelom měsíce', addDays('2026-01-31', 1) === '2026-02-01' && addDays('2026-04-30', 1) === '2026-05-01')
check('Přelom roku', addDays('2026-12-31', 1) === '2027-01-01' && addDays('2026-12-25', 30) === '2027-01-24')
check('Přestupný rok', addDays('2028-02-28', 1) === '2028-02-29' && addDays('2028-02-28', 2) === '2028-03-01' && addDays('2027-02-28', 1) === '2027-03-01')
check('Přelom letního času (březen)', addDays('2026-03-28', 2) === '2026-03-30' && daysBetween('2026-03-28', '2026-03-30') === 2)
check('Přelom zimního času (říjen)', addDays('2026-10-24', 2) === '2026-10-26' && daysBetween('2026-10-24', '2026-10-26') === 2)
check('Přes celé období letního času', daysBetween('2026-03-01', '2026-11-01') === 245)
check('daysBetween záporné a nulové', daysBetween('2026-05-02', '2026-05-01') === -1 && daysBetween('2026-05-01', '2026-05-01') === 0)
check('todayPrague má tvar YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(todayPrague()))
check('todayPrague: 23:30 UTC je v Praze už další den', todayPrague(new Date('2026-06-30T22:30:00Z')) === '2026-07-01' && todayPrague(new Date('2026-12-31T23:30:00Z')) === '2027-01-01')

// dueMilestones
const due = '2026-09-01'
const at = (n: number) => dueMilestones(due, addDays(due, n))
check('dueMilestones 0 dní', same(at(0), []))
check('dueMilestones 1 den', same(at(1), [1]))
check('dueMilestones 8 dní', same(at(8), [1, 8]))
check('dueMilestones 14 dní', same(at(14), [1, 8]))
check('dueMilestones 15 dní', same(at(15), [1, 8, 15]))
check('dueMilestones 22 dní', same(at(22), [1, 8, 15, 22]))
check('dueMilestones 29 dní', same(at(29), [1, 8, 15, 22]))
check('dueMilestones 30 dní', same(at(30), [1, 8, 15, 22, 30]))
check('dueMilestones 45 dní', same(at(45), [1, 8, 15, 22, 30]))
check('dueMilestones před splatností', same(dueMilestones(due, addDays(due, -3)), []))

// plán a způsobilost k poplatkům
const effective = readEffectiveTerms({ terms_effective: JSON.stringify({ ...TERMS_DEFAULTS, terms_version: '1.1' }) })
const invoice: PlanInvoice = {
  workspace_id: 'w1', client_id: 'c1', order_id: 'o1', status: 'sent', currency: 'CZK',
  amount_czk: 10000, total_with_vat: 10000, paid_amount: null,
}
const order: PlanOrder = {
  workspace_id: 'w1', client_id: 'c1', status: 'confirmed',
  terms_values: { terms_effective: JSON.stringify({ ...TERMS_DEFAULTS, terms_version: '1.1' }) },
}
const plan = (over: { inv?: Partial<PlanInvoice>; ord?: Partial<PlanOrder> | null; eff?: typeof effective; fees?: boolean; email?: string | null } = {}) =>
  buildReminderPlan({
    invoice: { ...invoice, ...(over.inv ?? {}) },
    client: { email: over.email === undefined ? 'a@b.cz' : over.email },
    order: over.ord === null ? null : { ...order, ...(over.ord ?? {}) },
    effective: over.eff ?? effective,
    milestone: 8,
    today: '2026-10-01',
    feesEnabled: over.fees,
  })
const p0 = plan({ fees: false })
check('Způsobilá faktura (poplatky vypnuty): eligible + blocked', p0.eligibleForFees && p0.feesBlocked && p0.feeReason === null)
const p1 = plan({ fees: true })
check('Způsobilá faktura (poplatky zapnuty): eligible, ne blocked', p1.eligibleForFees && !p1.feesBlocked)
check('Bez objednávky', !plan({ inv: { order_id: null }, ord: null }).eligibleForFees)
check('Objednávka nenalezena', !plan({ ord: null }).eligibleForFees)
check('Objednávka nepotvrzená', !plan({ ord: { status: 'sent' } }).eligibleForFees)
check('Jiný workspace', !plan({ ord: { workspace_id: 'w2' } }).eligibleForFees)
check('Jiný klient', !plan({ ord: { client_id: 'c2' } }).eligibleForFees && plan({ ord: { client_id: 'c2' } }).feeReason === 'Objednávka patří jinému klientovi')
check('Faktura bez klienta', !plan({ inv: { client_id: null } }).eligibleForFees)
check('Staré podmínky (1.0)', !plan({ eff: readEffectiveTerms({ terms_effective: JSON.stringify({ ...TERMS_DEFAULTS, terms_version: '1.0' }) }) }).eligibleForFees)
check('Bez terms_effective', !plan({ ord: { terms_values: { terms_version: '1.1' } }, eff: readEffectiveTerms({ terms_version: '1.1' }) }).eligibleForFees)
check('Jiná měna než CZK', !plan({ inv: { currency: 'EUR' } }).eligibleForFees)
check('Verze 1.2 a 2.0 stačí, 1.0 ne', versionAtLeast('1.2', '1.1') && versionAtLeast('2.0', '1.1') && versionAtLeast('1.1', '1.1') && !versionAtLeast('1.0', '1.1') && !versionAtLeast(null, '1.1'))
check('amountDue: částečná platba', amountDueOf({ ...invoice, paid_amount: 4000 }) === 6000)
check('amountDue: přeplatek = 0', amountDueOf({ ...invoice, paid_amount: 12000 }) === 0)
check('Zaplaceno = skipReason paid', plan({ inv: { paid_amount: 10000 } }).skipReason === 'paid')
check('Zrušeno = skipReason cancelled', plan({ inv: { status: 'cancelled' } }).skipReason === 'cancelled')
check('Příjemce bez e-mailu je null', plan({ email: null }).recipient === null && plan({ email: ' ' }).recipient === null)

// daysBetween: dny po splatnosti (oprava: 14. 10. a dnes 15. 10. musí dát 1, ne 0)
check('daysBetween: splatnost 14. 10. 2026, dnes 15. 10. 2026 = 1', daysBetween('2026-10-14', '2026-10-15') === 1)
check('daysBetween: dnes = splatnost = 0', daysBetween('2026-10-15', '2026-10-15') === 0)
check('daysBetween: přechod na zimní čas (25. a 26. 10. 2026)', daysBetween('2026-10-25', '2026-10-26') === 1 && daysBetween('2026-10-24', '2026-10-26') === 2 && daysBetween('2026-10-26', '2026-10-25') === -1)
check('daysBetween: přechod na letní čas (28. a 29. 3. 2026)', daysBetween('2026-03-28', '2026-03-29') === 1 && daysBetween('2026-03-29', '2026-03-30') === 1 && daysBetween('2026-03-28', '2026-03-30') === 2)

// vyúčtování poplatků
const feeEff = readEffectiveTerms({ terms_effective: JSON.stringify({ ...TERMS_DEFAULTS, terms_version: '1.1' }) })
const fee1 = feeEff.fee1
const fee2 = feeEff.fee2
const doc = (o: Partial<ExistingFeeDoc> & Pick<ExistingFeeDoc, 'id' | 'fee_kind' | 'amount'>): ExistingFeeDoc => ({ status: 'issued', waived: false, superseded: false, ...o })
const planFees = (milestone: number, existing: ExistingFeeDoc[], eff = feeEff, remaining = 10000): FeeAction[] =>
  planFeeDocuments({ milestone, effective: eff, existing, invoiceRemaining: remaining })
const kinds = (a: FeeAction[]) => a.map((x) => `${x.kind}:${x.action}:${x.amount}`).join(',')

check('Výchozí hodnoty: fee1 500, fee2 1000, paušál 1200, den 0,1 %, dny 1/8/15/22/30',
  fee1 === 500 && fee2 === 1000 && feeEff.statutoryFee === 1200 && feeEff.dailyPenaltyPercent === 0.1 && same(feeEff.reminderDays, [1, 8, 15, 22, 30]))
check('Milník 1: žádné poplatky', planFees(1, []).length === 0)
check('Milník 8 bez dokladů: pokuta fee1', kinds(planFees(8, [])) === `pokuta:create:${fee1}`)
const m15unpaid = planFees(15, [doc({ id: 'a', fee_kind: 'pokuta', amount: fee1 })])
check('Milník 15 s neuhrazeným dokladem: replace na fee1 + fee2', kinds(m15unpaid) === `pokuta:replace:${fee1 + fee2}` && m15unpaid[0].replaces === 'a' && same(m15unpaid[0].supersede, ['a']))
const m15paid = planFees(15, [doc({ id: 'a', fee_kind: 'pokuta', amount: fee1, status: 'paid' })])
check('Milník 15 s uhrazeným dokladem: navýšení o fee2', kinds(m15paid) === `pokuta_navyseni:create:${fee2}` && same(m15paid[0].supersede, []))
const m15mixed = planFees(15, [doc({ id: 'a', fee_kind: 'pokuta', amount: fee1, status: 'paid' }), doc({ id: 'b', fee_kind: 'pokuta_navyseni', amount: 100, status: 'sent' })])
check('Milník 15: uhrazený + neuhrazené navýšení → nové navýšení, staré storno', kinds(m15mixed) === `pokuta_navyseni:create:${fee2}` && same(m15mixed[0].supersede, ['b']))
check('Milník 22 bez dokladů: pokuta 1500 a paušál 1200 najednou', kinds(planFees(22, [])) === `pokuta:create:${fee1 + fee2},pausal:create:${feeEff.statutoryFee}`)
check('Odpuštěná pokuta se znovu nevytvoří', kinds(planFees(15, [doc({ id: 'a', fee_kind: 'pokuta', amount: fee1, status: 'cancelled', waived: true })])) === 'pokuta:skip:0'
  && planFees(15, [doc({ id: 'a', fee_kind: 'pokuta', amount: fee1, status: 'cancelled', waived: true })])[0].reason === 'waived')
check('Odpuštěný paušál se znovu nevytvoří', planFees(22, [doc({ id: 'p', fee_kind: 'pausal', amount: 1200, status: 'cancelled', waived: true }), doc({ id: 'a', fee_kind: 'pokuta', amount: 1500 })])[1].action === 'skip')
check('Nahrazená (superseded) pokuta není odpuštění', planFees(15, [doc({ id: 'a', fee_kind: 'pokuta', amount: fee1, status: 'cancelled', superseded: true })])[0].action === 'create')
const m30 = planFees(30, [])
const daily = m30.find((a) => a.kind === 'denni')
check('Milník 30: denní pokuta 9 dnů × 0,1 % z 10 000 = 90', daily?.action === 'create' && daily.amount === 90 && daily.daysCovered === 9 && daily.base === 10000)
check('Milník 30: pořadí pokuta, paušál, denní', same(m30.map((a) => a.kind), ['pokuta', 'pausal', 'denni']))
check('Denní pokuta: zaokrouhlení na haléře', planFees(30, [], feeEff, 3333.33).find((a) => a.kind === 'denni')?.amount === 30)
check('Denní pokuta: nulový základ = skip', planFees(30, [], feeEff, 0).find((a) => a.kind === 'denni')?.action === 'skip')
check('Denní pokuta: odpuštěná = skip', planFees(30, [doc({ id: 'd', fee_kind: 'denni', amount: 90, status: 'cancelled', waived: true })]).find((a) => a.kind === 'denni')?.action === 'skip')
const settled = [
  doc({ id: 'a', fee_kind: 'pokuta', amount: fee1 + fee2 }),
  doc({ id: 'p', fee_kind: 'pausal', amount: 1200 }),
  doc({ id: 'd', fee_kind: 'denni', amount: 90 }),
]
check('Opakované volání bez změn: samé reuse', planFees(30, settled).every((a) => a.action === 'reuse') && planFees(22, settled).every((a) => a.action === 'reuse'))
check('Po navýšení: opakované volání = reuse', planFees(15, [doc({ id: 'a', fee_kind: 'pokuta', amount: fee1, status: 'paid' }), doc({ id: 'n', fee_kind: 'pokuta_navyseni', amount: fee2 })]).every((a) => a.action === 'reuse'))
const eff300 = readEffectiveTerms({ terms_effective: JSON.stringify({ ...TERMS_DEFAULTS, terms_version: '1.1', poplatek_1: '300', poplatek_2: '200', zakonna_nahrada: '1 000', pokuta_prodleni: '0,2' }) })
check('Přepsané hodnoty: poplatek_1 = 300 na 8. den', kinds(planFees(8, [], eff300)) === 'pokuta:create:300')
check('Přepsané hodnoty: 22. den = 500 + paušál 1000', kinds(planFees(22, [], eff300)) === 'pokuta:create:500,pausal:create:1000')
check('Přepsané hodnoty: denní 0,2 % × 9 dnů z 10 000 = 180', planFees(30, [], eff300).find((a) => a.kind === 'denni')?.amount === 180)
const effDays = readEffectiveTerms({ terms_effective: JSON.stringify({ ...TERMS_DEFAULTS, terms_version: '1.1', upominka_4: '20', predani_dny: '25' }) })
check('Počet dnů denní pokuty se bere z efektivních hodnot (20.–25. den = 6)', planFees(30, [], effDays).find((a) => a.kind === 'denni')?.daysCovered === 6)
check('Variabilní symbol vyúčtování', feeVariableSymbol('VY-2026-0001') === '920260001' && feeVariableSymbol('VY-2026-0123') === '920260123' && feeVariableSymbol('VY-2026-0001').length === 9)
check('VS vyúčtování se liší od VS faktury (FA-2026-2001 → 20262001)', feeVariableSymbol('VY-2026-0001') !== '20262001')

if (failures > 0) {
  console.log(`\n${failures} kontrol selhalo.`)
  process.exit(1)
}
console.log('\nVšechny kontroly prošly.')
