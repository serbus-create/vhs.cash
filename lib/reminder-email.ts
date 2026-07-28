import { formatCurrency, formatDate } from '@/lib/utils'
import { getLang, type Lang } from '@/components/pdf/invoice-translations'

export type ReminderLevel = 1 | 2 | 3
export { getLang, type Lang }

interface ReminderVars {
  number: string
  daysOverdue: number
  amount: number
  dueDate: string | null
  currency?: string
  amountEur?: number | null
  bankAccount?: string | null
  iban?: string | null
  variableSymbol?: string | null
  qrCodeUrl?: string | null
  paidAmount?: number | null
}

// ─── i18n ────────────────────────────────────────────────────────────────────

interface ReminderI18n {
  subject1: (number: string) => string
  subject2: (number: string, days: number) => string
  subject3: (number: string, days: number) => string
  bodyText1: (number: string, days: number, paymentLines: string) => string
  bodyText2: (number: string, days: number, paymentLines: string) => string
  bodyText3: (number: string, days: number, paymentLines: string) => string
  htmlBody1: (number: string, days: number) => string
  htmlBody2: (number: string, days: number) => string
  htmlBody3: (number: string, days: number) => string
  paymentBoxHeader: string
  labelInvoice: string
  labelAmount: string
  labelAccount: string
  labelVs: string
  labelDueDate: string
  labelQr: string
  labelPaidAmount: string
  labelRemaining: string
  signGreeting: string
  signTitle: string
  signCompanyPrep: string
  aiNote: string
}

export interface ReminderLabels {
  paymentBoxHeader: string
  labelInvoice: string
  labelAmount: string
  labelAccount: string
  labelVs: string
  labelDueDate: string
  labelQr: string
  labelPaidAmount: string
  labelRemaining: string
  signGreeting: string
  signTitle: string
  signCompanyPrep: string
  aiNote: string
}

const i18nCs: ReminderI18n = {
  subject1: (n) => `Faktura č. ${n} po splatnosti — možná jste ji přehlédli`,
  subject2: (n, d) => `Upomínka — faktura č. ${n} je ${d} dní po splatnosti`,
  subject3: (n, d) => `DŮLEŽITÉ — faktura č. ${n} je ${d} dní po splatnosti`,
  bodyText1: (n, d, pl) =>
    `Dobrý den,\n\nmožná jste naši fakturu č. ${n} jen přehlédli — dovolujeme si připomenout, že je po splatnosti (${d} dní).\n\n${pl}\n\nBudeme rádi za úhradu v nejbližších dnech. Pokud jste již zaplatili, omluvte prosím tuto zprávu — platby se občas na cestě zpozdí.\n\nDěkujeme za pochopení a těšíme se na další spolupráci.`,
  bodyText2: (n, d, pl) =>
    `Dobrý den,\n\nfaktura č. ${n} je již ${d} dní po splatnosti a dosud jsme neobdrželi platbu.\n\n${pl}\n\nŽádáme Vás o neprodlenou úhradu. Pokud platba již proběhla, prosíme o zaslání potvrzení nebo dokladu o platbě, abychom mohli fakturu uzavřít.\n\nV případě jakýchkoliv nejasností nás prosím kontaktujte.`,
  bodyText3: (n, d, pl) =>
    `Vážený zákazníku,\n\nfaktura č. ${n} je ${d} dní po splatnosti a dosud nebyla uhrazena.\n\n${pl}\n\nŽádáme o okamžitou úhradu celé dlužné částky. Pokud k úhradě nedojde do 7 dnů od doručení tohoto e-mailu, budu nucen předat celou věc humanoidnímu tvorovi z naší společnosti, který ji následně postoupí právnímu zástupci k vymáhání pohledávky včetně příslušenství.\n\nV případě, že jde o nedorozumění nebo jste platbu již provedli, kontaktujte nás prosím neprodleně.`,
  htmlBody1: (n, d) =>
    `<p>Dobrý den,</p>
      <p>možná jste naši fakturu č. <strong>${n}</strong> jen přehlédli — dovolujeme si připomenout, že je po splatnosti (<strong>${d} dní</strong>).</p>
      <p>Budeme rádi za úhradu v nejbližších dnech. Pokud jste již zaplatili, omluvte prosím tuto zprávu — platby se občas na cestě zpozdí.</p>
      <p>Děkujeme za pochopení a těšíme se na další spolupráci.</p>`,
  htmlBody2: (n, d) =>
    `<p>Dobrý den,</p>
      <p>faktura č. <strong>${n}</strong> je již <strong>${d} dní po splatnosti</strong> a dosud jsme neobdrželi platbu.</p>
      <p>Žádáme Vás o neprodlenou úhradu. Pokud platba již proběhla, prosíme o zaslání potvrzení nebo dokladu o platbě, abychom mohli fakturu uzavřít.</p>
      <p>V případě jakýchkoliv nejasností nás prosím kontaktujte.</p>`,
  htmlBody3: (n, d) =>
    `<p>Vážený zákazníku,</p>
      <p>faktura č. <strong>${n}</strong> je <strong>${d} dní po splatnosti</strong> a dosud nebyla uhrazena.</p>
      <p>Žádáme o okamžitou úhradu celé dlužné částky. Pokud k úhradě nedojde do 7 dnů od doručení tohoto e-mailu, budu nucen předat celou věc humanoidnímu tvorovi z naší společnosti, který ji následně postoupí právnímu zástupci k vymáhání pohledávky včetně příslušenství.</p>
      <p>V případě, že jde o nedorozumění nebo jste platbu již provedli, kontaktujte nás prosím neprodleně.</p>`,
  paymentBoxHeader: 'Platební údaje',
  labelInvoice: 'Faktura č.',
  labelAmount: 'Částka k úhradě',
  labelAccount: 'Číslo účtu',
  labelVs: 'Variabilní symbol',
  labelDueDate: 'Datum splatnosti',
  labelQr: 'Zaplatit QR kódem',
  labelPaidAmount: 'Již uhrazeno',
  labelRemaining: 'Zbývá doplatit',
  signGreeting: 'S pozdravem',
  signTitle: 'Referent z oddělení trpělivosti',
  signCompanyPrep: 've společnosti',
  aiNote: 'Tento e-mail vygeneroval AI systém vhs. — VHSka,<br>který ohlídá každou zbloudilou fakturku.',
}

const i18nDe: ReminderI18n = {
  subject1: (n) => `Rechnung Nr. ${n} überfällig — vielleicht haben Sie sie übersehen`,
  subject2: (n, d) => `Mahnung — Rechnung Nr. ${n} ist seit ${d} Tagen überfällig`,
  subject3: (n, d) => `WICHTIG — Rechnung Nr. ${n} ist seit ${d} Tagen überfällig`,
  bodyText1: (n, d, pl) =>
    `Guten Tag,\n\nvielleicht haben Sie unsere Rechnung Nr. ${n} übersehen — wir möchten Sie freundlich darauf hinweisen, dass sie seit ${d} Tagen überfällig ist.\n\n${pl}\n\nWir würden uns über Ihre Zahlung in den nächsten Tagen freuen. Falls Sie bereits bezahlt haben, bitten wir Sie, diese Nachricht zu entschuldigen — Zahlungen können sich manchmal verzögern.\n\nVielen Dank für Ihr Verständnis und wir freuen uns auf weitere Zusammenarbeit.`,
  bodyText2: (n, d, pl) =>
    `Guten Tag,\n\nRechnung Nr. ${n} ist seit ${d} Tagen überfällig und wir haben bislang keine Zahlung erhalten.\n\n${pl}\n\nWir bitten Sie um umgehende Begleichung der Rechnung. Falls die Zahlung bereits erfolgt ist, bitten wir Sie um Zusendung des Zahlungsbelegs, damit wir die Rechnung schließen können.\n\nBei Rückfragen stehen wir Ihnen gerne zur Verfügung.`,
  bodyText3: (n, d, pl) =>
    `Sehr geehrte Damen und Herren,\n\nRechnung Nr. ${n} ist seit ${d} Tagen überfällig und wurde bislang nicht beglichen.\n\n${pl}\n\nWir fordern Sie auf, den ausstehenden Betrag unverzüglich zu begleichen. Falls die Zahlung nicht innerhalb von 7 Tagen nach Erhalt dieser E-Mail eingeht, sehen wir uns gezwungen, die Angelegenheit an ein humanoïdes Wesen in unserem Unternehmen zu übergeben, das sie einem Rechtsanwalt zur gerichtlichen Beitreibung der Forderung einschließlich Nebenkosten weiterleitet.\n\nFalls es sich um ein Missverständnis handelt oder Sie bereits bezahlt haben, kontaktieren Sie uns bitte umgehend.`,
  htmlBody1: (n, d) =>
    `<p>Guten Tag,</p>
      <p>vielleicht haben Sie unsere Rechnung Nr. <strong>${n}</strong> übersehen — wir möchten Sie freundlich darauf hinweisen, dass sie seit <strong>${d} Tagen</strong> überfällig ist.</p>
      <p>Wir würden uns über Ihre Zahlung in den nächsten Tagen freuen. Falls Sie bereits bezahlt haben, bitten wir Sie, diese Nachricht zu entschuldigen — Zahlungen können sich manchmal verzögern.</p>
      <p>Vielen Dank für Ihr Verständnis und wir freuen uns auf weitere Zusammenarbeit.</p>`,
  htmlBody2: (n, d) =>
    `<p>Guten Tag,</p>
      <p>Rechnung Nr. <strong>${n}</strong> ist seit <strong>${d} Tagen überfällig</strong> und wir haben bislang keine Zahlung erhalten.</p>
      <p>Wir bitten Sie um umgehende Begleichung der Rechnung. Falls die Zahlung bereits erfolgt ist, bitten wir Sie um Zusendung des Zahlungsbelegs, damit wir die Rechnung schließen können.</p>
      <p>Bei Rückfragen stehen wir Ihnen gerne zur Verfügung.</p>`,
  htmlBody3: (n, d) =>
    `<p>Sehr geehrte Damen und Herren,</p>
      <p>Rechnung Nr. <strong>${n}</strong> ist seit <strong>${d} Tagen überfällig</strong> und wurde bislang nicht beglichen.</p>
      <p>Wir fordern Sie auf, den ausstehenden Betrag unverzüglich zu begleichen. Falls die Zahlung nicht innerhalb von 7 Tagen nach Erhalt dieser E-Mail eingeht, sehen wir uns gezwungen, die Angelegenheit an ein humanoïdes Wesen in unserem Unternehmen zu übergeben, das sie einem Rechtsanwalt zur gerichtlichen Beitreibung der Forderung einschließlich Nebenkosten weiterleitet.</p>
      <p>Falls es sich um ein Missverständnis handelt oder Sie bereits bezahlt haben, kontaktieren Sie uns bitte umgehend.</p>`,
  paymentBoxHeader: 'Zahlungsinformationen',
  labelInvoice: 'Rechnungs-Nr.',
  labelAmount: 'Zahlungsbetrag',
  labelAccount: 'Kontonummer',
  labelVs: 'Verwendungszweck',
  labelDueDate: 'Fälligkeitsdatum',
  labelQr: 'Per QR-Code bezahlen',
  labelPaidAmount: 'Bereits bezahlt',
  labelRemaining: 'Restbetrag',
  signGreeting: 'Mit freundlichen Grüßen',
  signTitle: 'Referent für Zahlungsgeduld',
  signCompanyPrep: 'im Auftrag von',
  aiNote: 'Diese E-Mail wurde vom KI-System vhs. — VHSka generiert,<br>das jede verirrte Rechnung im Blick behält.',
}

const i18nPl: ReminderI18n = {
  subject1: (n) => `Faktura nr ${n} po terminie — być może ją Państwo przeoczyli`,
  subject2: (n, d) => `Upomnienie — faktura nr ${n} jest ${d} dni po terminie`,
  subject3: (n, d) => `WAŻNE — faktura nr ${n} jest ${d} dni po terminie`,
  bodyText1: (n, d, pl) =>
    `Dzień dobry,\n\nbyć może przeoczyli Państwo naszą fakturę nr ${n} — pozwalamy sobie przypomnieć, że jest po terminie płatności (${d} dni).\n\n${pl}\n\nBędziemy wdzięczni za uregulowanie płatności w najbliższych dniach. Jeśli już Państwo zapłacili, prosimy o wybaczenie tej wiadomości — płatności niekiedy opóźniają się w drodze.\n\nDziękujemy za zrozumienie i liczymy na dalszą współpracę.`,
  bodyText2: (n, d, pl) =>
    `Dzień dobry,\n\nfaktura nr ${n} jest już ${d} dni po terminie płatności i dotychczas nie otrzymaliśmy zapłaty.\n\n${pl}\n\nProsimy o niezwłoczne uregulowanie należności. Jeśli płatność już została dokonana, prosimy o przesłanie potwierdzenia, abyśmy mogli zamknąć fakturę.\n\nW razie jakichkolwiek pytań prosimy o kontakt.`,
  bodyText3: (n, d, pl) =>
    `Szanowni Państwo,\n\nfaktura nr ${n} jest ${d} dni po terminie płatności i dotychczas nie została uregulowana.\n\n${pl}\n\nWzywamy do natychmiastowego uregulowania całej należnej kwoty. Jeśli zapłata nie nastąpi w ciągu 7 dni od otrzymania tej wiadomości, będziemy zmuszeni przekazać sprawę humanoidalnemu stworzeniu z naszej firmy, które następnie skieruje ją do radcy prawnego w celu dochodzenia wierzytelności wraz z należnościami ubocznymi.\n\nW przypadku nieporozumienia lub jeśli płatność już została dokonana, prosimy o niezwłoczny kontakt.`,
  htmlBody1: (n, d) =>
    `<p>Dzień dobry,</p>
      <p>być może przeoczyli Państwo naszą fakturę nr <strong>${n}</strong> — pozwalamy sobie przypomnieć, że jest po terminie płatności (<strong>${d} dni</strong>).</p>
      <p>Będziemy wdzięczni za uregulowanie płatności w najbliższych dniach. Jeśli już Państwo zapłacili, prosimy o wybaczenie tej wiadomości — płatności niekiedy opóźniają się w drodze.</p>
      <p>Dziękujemy za zrozumienie i liczymy na dalszą współpracę.</p>`,
  htmlBody2: (n, d) =>
    `<p>Dzień dobry,</p>
      <p>faktura nr <strong>${n}</strong> jest już <strong>${d} dni po terminie płatności</strong> i dotychczas nie otrzymaliśmy zapłaty.</p>
      <p>Prosimy o niezwłoczne uregulowanie należności. Jeśli płatność już została dokonana, prosimy o przesłanie potwierdzenia, abyśmy mogli zamknąć fakturę.</p>
      <p>W razie jakichkolwiek pytań prosimy o kontakt.</p>`,
  htmlBody3: (n, d) =>
    `<p>Szanowni Państwo,</p>
      <p>faktura nr <strong>${n}</strong> jest <strong>${d} dni po terminie płatności</strong> i dotychczas nie została uregulowana.</p>
      <p>Wzywamy do natychmiastowego uregulowania całej należnej kwoty. Jeśli zapłata nie nastąpi w ciągu 7 dni od otrzymania tej wiadomości, będziemy zmuszeni przekazać sprawę humanoidalnemu stworzeniu z naszej firmy, które następnie skieruje ją do radcy prawnego w celu dochodzenia wierzytelności wraz z należnościami ubocznymi.</p>
      <p>W przypadku nieporozumienia lub jeśli płatność już została dokonana, prosimy o niezwłoczny kontakt.</p>`,
  paymentBoxHeader: 'Dane płatnicze',
  labelInvoice: 'Faktura nr',
  labelAmount: 'Kwota do zapłaty',
  labelAccount: 'Numer konta',
  labelVs: 'Tytuł przelewu',
  labelDueDate: 'Termin płatności',
  labelQr: 'Zapłać kodem QR',
  labelPaidAmount: 'Już zapłacono',
  labelRemaining: 'Pozostało do zapłaty',
  signGreeting: 'Z poważaniem',
  signTitle: 'Specjalista ds. cierpliwości płatniczej',
  signCompanyPrep: 'w imieniu firmy',
  aiNote: 'Ta wiadomość została wygenerowana przez system AI vhs. — VHSka,<br>który pilnuje każdej zagubionej faktury.',
}

// Slovak clients get Czech emails
const REMINDER_I18N: Record<Lang, ReminderI18n> = { cs: i18nCs, sk: i18nCs, de: i18nDe, pl: i18nPl }

export function getReminderLabels(lang: Lang): ReminderLabels {
  const i = REMINDER_I18N[lang]
  return {
    paymentBoxHeader: i.paymentBoxHeader,
    labelInvoice: i.labelInvoice,
    labelAmount: i.labelAmount,
    labelAccount: i.labelAccount,
    labelVs: i.labelVs,
    labelDueDate: i.labelDueDate,
    labelQr: i.labelQr,
    labelPaidAmount: i.labelPaidAmount,
    labelRemaining: i.labelRemaining,
    signGreeting: i.signGreeting,
    signTitle: i.signTitle,
    signCompanyPrep: i.signCompanyPrep,
    aiNote: i.aiNote,
  }
}

// ---------- exported functions ----------

export function getReminderSubject(level: ReminderLevel, vars: Pick<ReminderVars, 'number' | 'daysOverdue'>, lang: Lang = 'cs'): string {
  const i = REMINDER_I18N[lang]
  if (level === 1) return i.subject1(vars.number)
  if (level === 2) return i.subject2(vars.number, vars.daysOverdue)
  return i.subject3(vars.number, vars.daysOverdue)
}

export function getReminderBodyText(level: ReminderLevel, vars: ReminderVars, lang: Lang = 'cs'): string {
  const i = REMINDER_I18N[lang]
  const { number, daysOverdue, amount, dueDate, iban, bankAccount, variableSymbol, paidAmount } = vars
  const remaining = paidAmount ? amount - paidAmount : amount
  const dateFormatted = formatDate(dueDate)

  const paymentLines = [
    paidAmount
      ? `${i.labelRemaining}: ${formatCurrency(remaining)}`
      : `${i.labelAmount}: ${formatCurrency(amount)}`,
    paidAmount ? `${i.labelPaidAmount}: ${formatCurrency(paidAmount)}` : null,
    `${i.labelDueDate}: ${dateFormatted}`,
    bankAccount ? `${i.labelAccount}: ${bankAccount}` : null,
    iban ? `IBAN: ${iban}` : null,
    variableSymbol ? `${i.labelVs}: ${variableSymbol}` : null,
  ].filter(Boolean).join('\n')

  if (level === 1) return i.bodyText1(number, daysOverdue, paymentLines)
  if (level === 2) return i.bodyText2(number, daysOverdue, paymentLines)
  return i.bodyText3(number, daysOverdue, paymentLines)
}

// ---------- payment box ----------

function buildPaymentBoxHtml(vars: ReminderVars, lang: Lang): string {
  const i = REMINDER_I18N[lang]
  const { number, amount, dueDate, currency, amountEur, bankAccount, iban, variableSymbol, qrCodeUrl, paidAmount } = vars
  const remaining = paidAmount ? amount - paidAmount : amount
  const amountCzkFormatted = formatCurrency(amount)
  const dateFormatted = formatDate(dueDate)

  const amountDisplay = currency === 'EUR' && amountEur != null
    ? `${amountCzkFormatted} <span style="color:#6b7280;font-weight:400;font-size:14px;">(${formatCurrency(amountEur, 'EUR')})</span>`
    : amountCzkFormatted

  const rows: { label: string; value: string }[] = [
    { label: i.labelInvoice, value: number },
    ...(paidAmount
      ? [
          { label: i.labelRemaining, value: formatCurrency(remaining) },
          { label: i.labelPaidAmount, value: formatCurrency(paidAmount) },
        ]
      : [{ label: i.labelAmount, value: amountDisplay }]),
    ...(bankAccount ? [{ label: i.labelAccount, value: bankAccount }] : []),
    ...(iban ? [{ label: 'IBAN', value: iban }] : []),
    ...(variableSymbol ? [{ label: i.labelVs, value: variableSymbol }] : []),
    { label: i.labelDueDate, value: dateFormatted },
  ]

  const detailsHtml = rows.map(({ label, value }) => `
    <tr>
      <td style="padding:5px 16px 5px 0;color:#6b7280;font-size:12px;white-space:nowrap;vertical-align:top;">${label}</td>
      <td style="padding:5px 0;font-size:13px;font-weight:600;color:#111111;vertical-align:top;">${value}</td>
    </tr>`).join('')

  const qrHtml = qrCodeUrl ? `
    <td style="vertical-align:top;padding-left:20px;text-align:center;width:140px;">
      <img src="${qrCodeUrl}" alt="QR" width="120" height="120" style="display:block;border:1px solid #e5e7eb;border-radius:6px;padding:4px;background:#fff;" />
      <p style="margin:6px 0 0;font-size:10px;color:#9ca3af;text-align:center;">${i.labelQr}</p>
    </td>` : ''

  return `
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
  <tr>
    <td style="padding:20px 24px;">
      <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">${i.paymentBoxHeader}</p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="vertical-align:top;">
            <table cellpadding="0" cellspacing="0" border="0">
              ${detailsHtml}
            </table>
          </td>
          ${qrHtml}
        </tr>
      </table>
    </td>
  </tr>
</table>`
}

// ---------- signature ----------

function buildSignatureHtml(lang: Lang): string {
  const i = REMINDER_I18N[lang]
  return `
<table cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#374151;">
  <tr><td style="padding-bottom:4px;">${i.signGreeting}</td></tr>
  <tr><td style="padding-bottom:2px;font-weight:700;color:#111111;">Rudolf von Zahlung</td></tr>
  <tr><td style="padding-bottom:2px;color:#6b7280;">${i.signTitle}</td></tr>
  <tr><td style="padding-bottom:16px;color:#6b7280;">${i.signCompanyPrep}</td></tr>
  <tr>
    <td style="padding-bottom:16px;">
      <img src="https://vhs-cash.vercel.app/vhs-logo.jpg" alt="vhs." height="48" style="display:block;height:48px;width:auto;border:0;" />
    </td>
  </tr>
  <tr><td style="padding-bottom:2px;"><a href="https://www.v-h-s.cz" style="color:#F04E12;text-decoration:none;">www.v-h-s.cz</a></td></tr>
  <tr><td style="padding-bottom:24px;"><a href="mailto:info@v-h-s.cz" style="color:#F04E12;text-decoration:none;">info@v-h-s.cz</a></td></tr>
  <tr>
    <td style="font-size:11px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:16px;">
      ${i.aiNote}
    </td>
  </tr>
</table>
`
}

// ---------- HTML builder ----------

export function getReminderHtml(level: ReminderLevel, vars: ReminderVars, lang: Lang = 'cs'): string {
  const i = REMINDER_I18N[lang]
  const { number, daysOverdue } = vars

  let bodyHtml: string
  if (level === 1) bodyHtml = i.htmlBody1(number, daysOverdue)
  else if (level === 2) bodyHtml = i.htmlBody2(number, daysOverdue)
  else bodyHtml = i.htmlBody3(number, daysOverdue)

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f9fafb;padding:40px 20px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#111111;padding:20px 32px;">
              <img src="https://vhs-cash.vercel.app/vhs-logo.jpg" alt="vhs." height="40" style="display:block;height:40px;width:auto;border:0;" />
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#374151;">
              ${bodyHtml}
              ${buildPaymentBoxHtml(vars, lang)}
              ${buildSignatureHtml(lang)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
