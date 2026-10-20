// E-mail fronty upomínek (milníky 1, 8, 15, 22, 30). Jen česky: texty jsou součástí smluvních podmínek v češtině,
// proto se jazyk klienta (sk, de, pl) zatím nezohledňuje. Vzhled (rámec, platební box s QR, podpis) sdílí
// lib/reminder-email.ts. Všechny částky a lhůty se berou z efektivních hodnot podmínek (readEffectiveTerms).
import { wrapReminderHtml, buildPaymentBoxHtml } from '../reminder-email'
import { formatDate } from '../utils'
import { daysBetween } from './schedule'
import type { EffectiveTerms } from '../terms/effective'
import type { ReminderPlan } from './plan'

export interface EmailInvoice {
  number: string
  due_date: string
  currency: string | null
  amount_czk: number | null
  total_with_vat: number | null
  variable_symbol: string | null
  paid_amount: number | null
}

/** Vyúčtování poplatku přiložené k upomínce (z applyFeeDocuments + QR adresa). */
export interface FeeEmailDoc {
  number: string
  title: string
  amount: number
  /** 'YYYY-MM-DD' */
  dueDate: string | null
  variableSymbol: string | null
  qrUrl: string | null
}

export interface BuiltReminderEmail {
  subject: string
  bodyText: string
  bodyHtml: string
}

const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const fmtKc = (n: number): string =>
  `${new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n)} Kč`
const fmtPercent = (n: number): string =>
  `${new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 3 }).format(n)} %`
const fmtMoney = (n: number, currency: string): string =>
  new Intl.NumberFormat('cs-CZ', { style: 'currency', currency }).format(n)

function subjectFor(milestone: number, number: string, days: number): string {
  if (milestone === 1) return `Faktura č. ${number} po splatnosti – drobné upozornění`
  if (milestone === 8) return `Upomínka – faktura č. ${number} je po splatnosti`
  if (milestone === 15) return `Druhá upomínka – faktura č. ${number} je ${days} dní po splatnosti`
  if (milestone === 22) return `Poslední upomínka – faktura č. ${number}`
  return `Faktura č. ${number} – předání právnímu zástupci`
}

/** Odstavce těla e-mailu jako prostý text. */
function paragraphsFor(args: {
  milestone: number
  number: string
  days: number
  eligible: boolean
  orderNumber: string | null
  effective: EffectiveTerms
}): string[] {
  const { milestone, number, days, eligible, orderNumber, effective: e } = args
  const [, d8, d15, d22, dHand] = e.reminderDays
  const d1 = e.reminderDays[0]
  const fee1 = fmtKc(e.fee1)
  const feesSum = e.fee1 + e.fee2
  const order = orderNumber ? ` v objednávce č. ${orderNumber}` : ''
  const greeting = milestone === 30 ? 'Vážený zákazníku,' : 'Dobrý den,'
  const out: string[] = [greeting]

  if (milestone === 1) {
    out.push(`možná se vloudila chybička: naše faktura č. ${number} je ${days} dní po splatnosti a zatím jsme neobdrželi platbu.`)
    out.push('Platební údaje najdete níže. Pokud jste již zaplatili, tuto zprávu prosím ignorujte; platby se někdy zpozdí.')
    if (eligible) {
      out.push(`Pokud nebude faktura uhrazena do ${d8 - d1} dnů od tohoto upozornění, bude podle podmínek spolupráce naúčtována smluvní pokuta ${fee1}.`)
    }
  } else if (milestone === 8) {
    out.push(`faktura č. ${number} je již ${days} dní po splatnosti a dosud jsme neobdrželi platbu. Žádáme Vás o její neprodlenou úhradu.`)
    if (eligible) {
      out.push(`Podle čl. 6.2 podmínek spolupráce potvrzených${order} Vám oznamujeme smluvní pokutu ${fee1}. Nebude-li faktura uhrazena v dalších ${d15 - d8} dnech, pokuta se navýší o ${fmtKc(e.fee2)}.`)
    }
    out.push('Pokud platba již proběhla, zašlete nám prosím potvrzení o platbě, abychom mohli fakturu uzavřít.')
  } else if (milestone === 15) {
    out.push(`faktura č. ${number} je ${days} dní po splatnosti a ani po předchozí upomínce nebyla uhrazena. Jde o druhou upomínku.`)
    if (eligible) {
      out.push(`Smluvní pokuta se tímto navyšuje na ${fmtKc(feesSum)}. Nebude-li dlužná částka uhrazena do dalších ${d22 - d15} dnů, bude nárokována zákonná paušální náhrada ${fmtKc(e.statutoryFee)} a budou pozastaveny probíhající práce.`)
    }
    out.push('Žádáme o okamžitou úhradu. V případě nejasností nás prosím kontaktujte.')
  } else if (milestone === 22) {
    out.push(`faktura č. ${number} je ${days} dní po splatnosti. Toto je poslední upomínka.`)
    if (eligible) {
      out.push(
        `Smluvní pokuty činí ${fmtKc(feesSum)}, zákonná paušální náhrada ${fmtKc(e.statutoryFee)} (celkem ${fmtKc(feesSum + e.statutoryFee)}). ` +
          `Probíhající práce jsou pozastaveny a běží denní smluvní pokuta ${fmtPercent(e.dailyPenaltyPercent)} z dlužné částky faktury.`,
      )
      out.push(`Jde o poslední pokus o mimosoudní řešení; není-li dlužná částka včetně uvedených částek připsána nejpozději do ${dHand}. dne po splatnosti, věc se předá právnímu zástupci.`)
    } else {
      out.push(`Jde o poslední pokus o mimosoudní řešení; není-li dlužná částka připsána nejpozději do ${dHand}. dne po splatnosti, předáme věc k vymáhání.`)
    }
  } else {
    out.push(`faktura č. ${number} je ${days} dní po splatnosti a nebyla uhrazena ani po opakovaných upomínkách.`)
    if (eligible) {
      out.push('Pohledávku jsme proto předali právnímu zástupci k předžalobní výzvě a vymáhání. Náklady zastoupení a soudní poplatky hradí dlužník.')
    } else {
      out.push('Pohledávku jsme proto předali k dalšímu řešení a vymáhání.')
    }
    out.push('Pokud jde o nedorozumění nebo jste platbu již provedli, kontaktujte nás prosím neprodleně.')
  }
  return out
}

/** Tabulka "Přehled dlužných částek": zbývající částka faktury, každé vyúčtování a celkem. */
function buildFeeOverviewHtml(invoiceNumber: string, amountDue: number, feeDocs: FeeEmailDoc[], total: number, currency: string): string {
  const row = (label: string, value: string, strong = false) => `
    <tr>
      <td style="padding:6px 16px 6px 0;font-size:13px;color:${strong ? '#111111' : '#374151'};${strong ? 'font-weight:700;border-top:1px solid #e5e7eb;' : ''}">${label}</td>
      <td style="padding:6px 0;font-size:13px;text-align:right;white-space:nowrap;color:#111111;font-weight:${strong ? 700 : 600};${strong ? 'border-top:1px solid #e5e7eb;' : ''}">${value}</td>
    </tr>`
  return `
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0 0;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;">
  <tr>
    <td style="padding:20px 24px;">
      <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Přehled dlužných částek</p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        ${row(`Faktura č. ${esc(invoiceNumber)} (zbývá k úhradě)`, esc(fmtMoney(amountDue, currency)))}
        ${feeDocs.map((d) => row(`${esc(d.title)} č. ${esc(d.number)}`, esc(fmtMoney(d.amount, 'CZK')))).join('')}
        ${row('Celkem k úhradě', esc(fmtMoney(total, currency)), true)}
      </table>
    </td>
  </tr>
</table>`
}

export function buildReminderEmail(args: {
  milestone: number
  invoice: EmailInvoice
  client: { name: string } | null
  plan: ReminderPlan
  effective: EffectiveTerms
  qrUrl: string | null
  today: string
  /** číslo potvrzené objednávky (do textu o smluvních pokutách) */
  orderNumber?: string | null
  bankAccount?: string | null
  iban?: string | null
  /** neuhrazená vyúčtování poplatků; je-li seznam neprázdný, e-mail má přehled dlužných částek a platební box ke každému dokladu */
  feeDocs?: FeeEmailDoc[]
}): BuiltReminderEmail {
  const { milestone, invoice, plan, effective, qrUrl, today } = args
  const days = Math.max(0, daysBetween(invoice.due_date, today))
  const paragraphs = paragraphsFor({
    milestone,
    number: invoice.number,
    days,
    eligible: plan.eligibleForFees,
    orderNumber: args.orderNumber ?? null,
    effective,
  })
  const subject = subjectFor(milestone, invoice.number, days)

  const currency = invoice.currency ?? 'CZK'
  const fullAmount = invoice.amount_czk ?? invoice.total_with_vat ?? 0
  const bankAccount = args.bankAccount ?? null
  const iban = args.iban ?? null

  const feeDocs = args.feeDocs ?? []
  const hasFees = feeDocs.length > 0
  const feeTotal = feeDocs.reduce((sum, d) => sum + d.amount, 0)
  const grandTotal = Math.round((plan.amountDue + feeTotal) * 100) / 100

  const paymentLines = [
    `Faktura č.: ${invoice.number}`,
    `Částka k úhradě: ${fmtMoney(plan.amountDue, currency)}`,
    `Datum splatnosti: ${formatDate(invoice.due_date)}`,
    bankAccount ? `Číslo účtu: ${bankAccount}` : null,
    iban ? `IBAN: ${iban}` : null,
    invoice.variable_symbol ? `Variabilní symbol: ${invoice.variable_symbol}` : null,
  ].filter(Boolean).join('\n')
  const feeText = hasFees
    ? '\n\n' +
      [
        'Přehled dlužných částek',
        `Faktura č. ${invoice.number} (zbývá k úhradě): ${fmtMoney(plan.amountDue, currency)}`,
        ...feeDocs.map((d) => `${d.title} č. ${d.number}: ${fmtMoney(d.amount, 'CZK')}`),
        `Celkem k úhradě: ${fmtMoney(grandTotal, currency)}`,
        ...feeDocs.map((d) =>
          [
            '',
            `${d.title} č. ${d.number}`,
            `Částka k úhradě: ${fmtMoney(d.amount, 'CZK')}`,
            d.dueDate ? `Datum splatnosti: ${formatDate(d.dueDate)}` : null,
            bankAccount ? `Číslo účtu: ${bankAccount}` : null,
            iban ? `IBAN: ${iban}` : null,
            d.variableSymbol ? `Variabilní symbol: ${d.variableSymbol}` : null,
          ].filter((l) => l !== null).join('\n'),
        ),
      ].join('\n')
    : ''
  const bodyText = `${paragraphs.join('\n\n')}\n\n${paymentLines}${feeText}\n\nS pozdravem\nRudolf von Zahlung\nvhs.\ninfo@v-h-s.cz`

  const numberEsc = esc(invoice.number)
  const bodyHtml = paragraphs
    .map((p) => `<p>${esc(p).split(numberEsc).join(`<strong>${numberEsc}</strong>`)}</p>`)
    .join('\n      ')
  const overviewHtml = hasFees ? buildFeeOverviewHtml(invoice.number, plan.amountDue, feeDocs, grandTotal, currency) : ''
  const feeBoxesHtml = feeDocs
    .map((d) =>
      buildPaymentBoxHtml(
        {
          number: esc(d.number),
          daysOverdue: days,
          amount: d.amount,
          dueDate: d.dueDate,
          currency: 'CZK',
          amountEur: null,
          bankAccount: bankAccount ? esc(bankAccount) : null,
          iban: iban ? esc(iban) : null,
          variableSymbol: d.variableSymbol ? esc(d.variableSymbol) : null,
          qrCodeUrl: d.qrUrl ? esc(d.qrUrl) : null,
          paidAmount: null,
          documentLabel: 'Doklad č.',
          boxHeader: esc(d.title),
        },
        'cs',
      ),
    )
    .join('\n')
  const bodyHtmlFull = wrapReminderHtml(
    `${bodyHtml}${overviewHtml}`,
    {
      // platební box vkládá hodnoty do HTML bez úprav, proto je ošetříme tady
      number: esc(invoice.number),
      daysOverdue: days,
      amount: fullAmount,
      dueDate: invoice.due_date,
      currency,
      amountEur: currency === 'EUR' ? (invoice.total_with_vat ?? null) : null,
      bankAccount: bankAccount ? esc(bankAccount) : null,
      iban: iban ? esc(iban) : null,
      variableSymbol: invoice.variable_symbol ? esc(invoice.variable_symbol) : null,
      qrCodeUrl: qrUrl ? esc(qrUrl) : null,
      paidAmount: invoice.paid_amount,
      ...(hasFees ? { boxHeader: 'Platební údaje – faktura' } : {}),
    },
    'cs',
    feeBoxesHtml,
  )
  return { subject, bodyText, bodyHtml: bodyHtmlFull }
}
