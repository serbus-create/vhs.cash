import { formatCurrency, formatDate } from '@/lib/utils'
import { getLang, type Lang } from '@/lib/reminder-email'

export { getLang, type Lang }

export interface InvoiceEmailVars {
  number: string
  amount: number
  dueDate: string | null
  currency?: string
  amountEur?: number | null
  bankAccount?: string | null
  iban?: string | null
  variableSymbol?: string | null
  qrCodeUrl?: string | null
}

interface InvoiceEmailI18n {
  subject: (number: string) => string
  bodyIntro: (number: string) => string
  bodyOutro: string
  htmlBodyIntro: (number: string) => string
  htmlBodyOutro: string
  paymentBoxHeader: string
  labelInvoice: string
  labelAmount: string
  labelAccount: string
  labelVs: string
  labelDueDate: string
  labelQr: string
  signGreeting: string
  signTitle: string
  signCompanyPrep: string
  aiNote: string
}

const i18nCs: InvoiceEmailI18n = {
  subject: (n) => `Faktura č. ${n} k úhradě`,
  bodyIntro: (n) =>
    `Dobrý den,\n\nděkujeme Vám za spolupráci! V příloze Vám posíláme fakturu č. ${n} k proplacení.`,
  bodyOutro:
    `Pokud by cokoliv nebylo v pořádku, dejte prosím vědět — vše k Vaší spokojenosti rádi vyřešíme. Stačí nás kontaktovat e-mailem nebo telefonicky.\n\nTěšíme se na další spolupráci!`,
  htmlBodyIntro: (n) =>
    `<p>Dobrý den,</p>
      <p>děkujeme Vám za spolupráci! V příloze Vám posíláme fakturu č. <strong>${n}</strong> k proplacení.</p>`,
  htmlBodyOutro:
    `<p>Pokud by cokoliv nebylo v pořádku, dejte prosím vědět — vše k Vaší spokojenosti rádi vyřešíme. Stačí nás kontaktovat e-mailem nebo telefonicky.</p>
      <p>Těšíme se na další spolupráci!</p>`,
  paymentBoxHeader: 'Platební údaje',
  labelInvoice: 'Faktura č.',
  labelAmount: 'Částka k úhradě',
  labelAccount: 'Číslo účtu',
  labelVs: 'Variabilní symbol',
  labelDueDate: 'Datum splatnosti',
  labelQr: 'Zaplatit QR kódem',
  signGreeting: 'S pozdravem',
  signTitle: 'Referentka oddělení vděčnosti',
  signCompanyPrep: 've společnosti',
  aiNote: 'Tento e-mail vygeneroval AI systém vhs. — VHSka,<br>který doručí každou fakturu tam, kam patří.',
}

const i18nDe: InvoiceEmailI18n = {
  subject: (n) => `Rechnung Nr. ${n} zur Zahlung`,
  bodyIntro: (n) =>
    `Guten Tag,\n\nvielen Dank für Ihre Zusammenarbeit! Anbei senden wir Ihnen die Rechnung Nr. ${n} zur Begleichung.`,
  bodyOutro:
    `Sollte etwas nicht in Ordnung sein, teilen Sie uns das bitte mit — wir lösen alles gerne zu Ihrer Zufriedenheit. Sie erreichen uns per E-Mail oder telefonisch.\n\nWir freuen uns auf weitere Zusammenarbeit!`,
  htmlBodyIntro: (n) =>
    `<p>Guten Tag,</p>
      <p>vielen Dank für Ihre Zusammenarbeit! Anbei senden wir Ihnen die Rechnung Nr. <strong>${n}</strong> zur Begleichung.</p>`,
  htmlBodyOutro:
    `<p>Sollte etwas nicht in Ordnung sein, teilen Sie uns das bitte mit — wir lösen alles gerne zu Ihrer Zufriedenheit. Sie erreichen uns per E-Mail oder telefonisch.</p>
      <p>Wir freuen uns auf weitere Zusammenarbeit!</p>`,
  paymentBoxHeader: 'Zahlungsinformationen',
  labelInvoice: 'Rechnungs-Nr.',
  labelAmount: 'Zahlungsbetrag',
  labelAccount: 'Kontonummer',
  labelVs: 'Verwendungszweck',
  labelDueDate: 'Fälligkeitsdatum',
  labelQr: 'Per QR-Code bezahlen',
  signGreeting: 'Mit freundlichen Grüßen',
  signTitle: 'Referentin der Dankbarkeitsabteilung',
  signCompanyPrep: 'im Auftrag von',
  aiNote: 'Diese E-Mail wurde vom KI-System vhs. — VHSka generiert,<br>das jede Rechnung dorthin bringt, wo sie hingehört.',
}

const i18nPl: InvoiceEmailI18n = {
  subject: (n) => `Faktura nr ${n} do zapłaty`,
  bodyIntro: (n) =>
    `Dzień dobry,\n\ndziękujemy za współpracę! W załączniku przesyłamy fakturę nr ${n} do zapłaty.`,
  bodyOutro:
    `Jeśli cokolwiek nie będzie w porządku, proszę dać nam znać — chętnie rozwiążemy wszystko ku Państwa zadowoleniu. Można się z nami skontaktować mailowo lub telefonicznie.\n\nCieszymy się na dalszą współpracę!`,
  htmlBodyIntro: (n) =>
    `<p>Dzień dobry,</p>
      <p>dziękujemy za współpracę! W załączniku przesyłamy fakturę nr <strong>${n}</strong> do zapłaty.</p>`,
  htmlBodyOutro:
    `<p>Jeśli cokolwiek nie będzie w porządku, proszę dać nam znać — chętnie rozwiążemy wszystko ku Państwa zadowoleniu. Można się z nami skontaktować mailowo lub telefonicznie.</p>
      <p>Cieszymy się na dalszą współpracę!</p>`,
  paymentBoxHeader: 'Dane płatnicze',
  labelInvoice: 'Faktura nr',
  labelAmount: 'Kwota do zapłaty',
  labelAccount: 'Numer konta',
  labelVs: 'Tytuł przelewu',
  labelDueDate: 'Termin płatności',
  labelQr: 'Zapłać kodem QR',
  signGreeting: 'Z poważaniem',
  signTitle: 'Referentka działu wdzięczności',
  signCompanyPrep: 'w imieniu firmy',
  aiNote: 'Ta wiadomość została wygenerowana przez system AI vhs. — VHSka,<br>który dostarczy każdą fakturę tam, gdzie jej miejsce.',
}

const INVOICE_EMAIL_I18N: Record<Lang, InvoiceEmailI18n> = { cs: i18nCs, sk: i18nCs, de: i18nDe, pl: i18nPl }

export function getInvoiceEmailSubject(number: string, lang: Lang = 'cs'): string {
  return INVOICE_EMAIL_I18N[lang].subject(number)
}

export function getInvoiceEmailBodyText(vars: InvoiceEmailVars, lang: Lang = 'cs'): string {
  const i = INVOICE_EMAIL_I18N[lang]
  const { number, amount, dueDate, bankAccount, iban, variableSymbol } = vars
  const dateFormatted = formatDate(dueDate)

  const paymentLines = [
    `${i.labelAmount}: ${formatCurrency(amount)}`,
    `${i.labelDueDate}: ${dateFormatted}`,
    bankAccount ? `${i.labelAccount}: ${bankAccount}` : null,
    iban ? `IBAN: ${iban}` : null,
    variableSymbol ? `${i.labelVs}: ${variableSymbol}` : null,
  ].filter(Boolean).join('\n')

  return `${i.bodyIntro(number)}\n\n${paymentLines}\n\n${i.bodyOutro}`
}

function buildPaymentBox(vars: InvoiceEmailVars, lang: Lang): string {
  const i = INVOICE_EMAIL_I18N[lang]
  const { number, amount, dueDate, currency, amountEur, bankAccount, iban, variableSymbol, qrCodeUrl } = vars
  const amountCzkFormatted = formatCurrency(amount)
  const dateFormatted = formatDate(dueDate)

  const amountDisplay = currency === 'EUR' && amountEur != null
    ? `${amountCzkFormatted} <span style="color:#6b7280;font-weight:400;font-size:14px;">(${formatCurrency(amountEur, 'EUR')})</span>`
    : amountCzkFormatted

  const rows: { label: string; value: string }[] = [
    { label: i.labelInvoice, value: number },
    { label: i.labelAmount, value: amountDisplay },
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

function buildSignature(lang: Lang): string {
  const i = INVOICE_EMAIL_I18N[lang]
  return `
<table cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#374151;">
  <tr><td style="padding-bottom:4px;">${i.signGreeting}</td></tr>
  <tr><td style="padding-bottom:2px;font-weight:700;color:#111111;">Matylda Doručovatelka</td></tr>
  <tr><td style="padding-bottom:2px;color:#6b7280;">${i.signTitle}</td></tr>
  <tr><td style="padding-bottom:16px;color:#6b7280;">${i.signCompanyPrep}</td></tr>
  <tr>
    <td style="padding-bottom:16px;">
      <img src="https://vhs-cash.vercel.app/vhs-logo.jpg" alt="vhs." height="48" style="display:block;height:48px;width:auto;border:0;" />
    </td>
  </tr>
  <tr><td style="padding-bottom:2px;"><a href="https://www.v-h-s.cz" style="color:#F04E12;text-decoration:none;">www.v-h-s.cz</a></td></tr>
  <tr><td style="padding-bottom:2px;"><a href="mailto:info@v-h-s.cz" style="color:#F04E12;text-decoration:none;">info@v-h-s.cz</a></td></tr>
  <tr><td style="padding-bottom:24px;"><a href="tel:+420725468614" style="color:#F04E12;text-decoration:none;">+420 725 468 614</a></td></tr>
  <tr>
    <td style="font-size:11px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:16px;">
      ${i.aiNote}
    </td>
  </tr>
</table>
`
}

export function getInvoiceEmailHtml(vars: InvoiceEmailVars, lang: Lang = 'cs'): string {
  const i = INVOICE_EMAIL_I18N[lang]
  const { number } = vars

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
              ${i.htmlBodyIntro(number)}
              ${buildPaymentBox(vars, lang)}
              ${i.htmlBodyOutro}
              ${buildSignature(lang)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
