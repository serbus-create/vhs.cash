import { formatCurrency, formatDate } from '@/lib/utils'

export type ReminderLevel = 1 | 2 | 3

interface ReminderVars {
  number: string
  daysOverdue: number
  amount: number
  dueDate: string | null
  // Payment details — optional, shown in payment box when provided
  currency?: string
  amountEur?: number | null
  bankAccount?: string | null
  iban?: string | null
  variableSymbol?: string | null
  qrCodeUrl?: string | null
}

export function getReminderSubject(level: ReminderLevel, vars: ReminderVars): string {
  const { number, daysOverdue } = vars
  if (level === 1) return `Faktura č. ${number} po splatnosti — možná jste ji přehlédli`
  if (level === 2) return `Upomínka — faktura č. ${number} je ${daysOverdue} dní po splatnosti`
  return `DŮLEŽITÉ — faktura č. ${number} je ${daysOverdue} dní po splatnosti`
}

export function getReminderBodyText(level: ReminderLevel, vars: ReminderVars): string {
  const { number, daysOverdue, amount, dueDate, iban, bankAccount, variableSymbol } = vars
  const amountFormatted = formatCurrency(amount)
  const dateFormatted = formatDate(dueDate)

  const paymentLines = [
    `Částka k úhradě: ${amountFormatted}`,
    `Datum splatnosti: ${dateFormatted}`,
    bankAccount ? `Číslo účtu: ${bankAccount}` : null,
    iban ? `IBAN: ${iban}` : null,
    variableSymbol ? `Variabilní symbol: ${variableSymbol}` : null,
  ].filter(Boolean).join('\n')

  if (level === 1) {
    return `Dobrý den,

možná jste naši fakturu č. ${number} jen přehlédli — dovolujeme si připomenout, že je po splatnosti (${daysOverdue} dní).

${paymentLines}

Budeme rádi za úhradu v nejbližších dnech. Pokud jste již zaplatili, omluvte prosím tuto zprávu — platby se občas na cestě zpozdí.

Děkujeme za pochopení a těšíme se na další spolupráci.`
  }

  if (level === 2) {
    return `Dobrý den,

faktura č. ${number} je již ${daysOverdue} dní po splatnosti a dosud jsme neobdrželi platbu.

${paymentLines}

Žádáme Vás o neprodlenou úhradu. Pokud platba již proběhla, prosíme o zaslání potvrzení nebo dokladu o platbě, abychom mohli fakturu uzavřít.

V případě jakýchkoliv nejasností nás prosím kontaktujte.`
  }

  return `Vážený zákazníku,

faktura č. ${number} je ${daysOverdue} dní po splatnosti a dosud nebyla uhrazena.

${paymentLines}

Žádáme o okamžitou úhradu celé dlužné částky. Pokud k úhradě nedojde do 7 dnů od doručení tohoto e-mailu, budu nucen předat celou věc humanoidnímu tvorovi z naší společnosti, který ji následně postoupí právnímu zástupci k vymáhání pohledávky včetně příslušenství.

V případě, že jde o nedorozumění nebo jste platbu již provedli, kontaktujte nás prosím neprodleně.`
}

// ---------- payment box ----------

function buildPaymentBoxHtml(vars: ReminderVars): string {
  const { number, amount, dueDate, currency, amountEur, bankAccount, iban, variableSymbol, qrCodeUrl } = vars
  const amountCzkFormatted = formatCurrency(amount)
  const dateFormatted = formatDate(dueDate)

  const amountDisplay = currency === 'EUR' && amountEur != null
    ? `${amountCzkFormatted} <span style="color:#6b7280;font-weight:400;font-size:14px;">(${formatCurrency(amountEur, 'EUR')})</span>`
    : amountCzkFormatted

  const rows: { label: string; value: string }[] = [
    { label: 'Faktura č.', value: number },
    { label: 'Částka k úhradě', value: amountDisplay },
    ...(bankAccount ? [{ label: 'Číslo účtu', value: bankAccount }] : []),
    ...(iban ? [{ label: 'IBAN', value: iban }] : []),
    ...(variableSymbol ? [{ label: 'Variabilní symbol', value: variableSymbol }] : []),
    { label: 'Datum splatnosti', value: dateFormatted },
  ]

  const detailsHtml = rows.map(({ label, value }) => `
    <tr>
      <td style="padding:5px 16px 5px 0;color:#6b7280;font-size:12px;white-space:nowrap;vertical-align:top;">${label}</td>
      <td style="padding:5px 0;font-size:13px;font-weight:600;color:#111111;vertical-align:top;">${value}</td>
    </tr>`).join('')

  const qrHtml = qrCodeUrl ? `
    <td style="vertical-align:top;padding-left:20px;text-align:center;width:140px;">
      <img src="${qrCodeUrl}" alt="QR platba" width="120" height="120" style="display:block;border:1px solid #e5e7eb;border-radius:6px;padding:4px;background:#fff;" />
      <p style="margin:6px 0 0;font-size:10px;color:#9ca3af;text-align:center;">Zaplatit QR kódem</p>
    </td>` : ''

  return `
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
  <tr>
    <td style="padding:20px 24px;">
      <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Platební údaje</p>
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

const SIGNATURE_HTML = `
<table cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#374151;">
  <tr><td style="padding-bottom:4px;">S pozdravem</td></tr>
  <tr><td style="padding-bottom:2px;font-weight:700;color:#111111;">Rudolf von Zahlung</td></tr>
  <tr><td style="padding-bottom:2px;color:#6b7280;">Referent z oddělení trpělivosti</td></tr>
  <tr><td style="padding-bottom:16px;color:#6b7280;">ve společnosti</td></tr>
  <tr>
    <td style="padding-bottom:16px;">
      <img src="https://vhs-cash.vercel.app/vhs-logo.jpg" alt="vhs." height="48" style="display:block;height:48px;width:auto;border:0;" />
    </td>
  </tr>
  <tr><td style="padding-bottom:2px;"><a href="https://www.v-h-s.cz" style="color:#F04E12;text-decoration:none;">www.v-h-s.cz</a></td></tr>
  <tr><td style="padding-bottom:24px;"><a href="mailto:info@v-h-s.cz" style="color:#F04E12;text-decoration:none;">info@v-h-s.cz</a></td></tr>
  <tr>
    <td style="font-size:11px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:16px;">
      Tento e-mail vygeneroval AI systém vhs. — VHSka,<br>který ohlídá každou zbloudilou fakturku.
    </td>
  </tr>
</table>
`

// ---------- HTML builder ----------

export function getReminderHtml(level: ReminderLevel, vars: ReminderVars): string {
  const { number, daysOverdue } = vars

  let bodyHtml = ''

  if (level === 1) {
    bodyHtml = `
      <p>Dobrý den,</p>
      <p>možná jste naši fakturu č. <strong>${number}</strong> jen přehlédli — dovolujeme si připomenout, že je po splatnosti (<strong>${daysOverdue} dní</strong>).</p>
      <p>Budeme rádi za úhradu v nejbližších dnech. Pokud jste již zaplatili, omluvte prosím tuto zprávu — platby se občas na cestě zpozdí.</p>
      <p>Děkujeme za pochopení a těšíme se na další spolupráci.</p>
    `
  } else if (level === 2) {
    bodyHtml = `
      <p>Dobrý den,</p>
      <p>faktura č. <strong>${number}</strong> je již <strong>${daysOverdue} dní po splatnosti</strong> a dosud jsme neobdrželi platbu.</p>
      <p>Žádáme Vás o neprodlenou úhradu. Pokud platba již proběhla, prosíme o zaslání potvrzení nebo dokladu o platbě, abychom mohli fakturu uzavřít.</p>
      <p>V případě jakýchkoliv nejasností nás prosím kontaktujte.</p>
    `
  } else {
    bodyHtml = `
      <p>Vážený zákazníku,</p>
      <p>faktura č. <strong>${number}</strong> je <strong>${daysOverdue} dní po splatnosti</strong> a dosud nebyla uhrazena.</p>
      <p>Žádáme o okamžitou úhradu celé dlužné částky. Pokud k úhradě nedojde do 7 dnů od doručení tohoto e-mailu, budu nucen předat celou věc humanoidnímu tvorovi z naší společnosti, který ji následně postoupí právnímu zástupci k vymáhání pohledávky včetně příslušenství.</p>
      <p>V případě, že jde o nedorozumění nebo jste platbu již provedli, kontaktujte nás prosím neprodleně.</p>
    `
  }

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
              ${buildPaymentBoxHtml(vars)}
              ${SIGNATURE_HTML}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
