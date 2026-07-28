import { formatCurrency, formatDate } from '@/lib/utils'

export type ReminderLevel = 1 | 2 | 3

interface ReminderVars {
  number: string
  daysOverdue: number
  amount: number
  dueDate: string | null
}

export function getReminderSubject(level: ReminderLevel, vars: ReminderVars): string {
  const { number, daysOverdue } = vars
  if (level === 1) return `Faktura č. ${number} po splatnosti — možná jste ji přehlédli`
  if (level === 2) return `Upomínka — faktura č. ${number} je ${daysOverdue} dní po splatnosti`
  return `DŮLEŽITÉ — faktura č. ${number} je ${daysOverdue} dní po splatnosti`
}

export function getReminderBodyText(level: ReminderLevel, vars: ReminderVars): string {
  const { number, daysOverdue, amount, dueDate } = vars
  const amountFormatted = formatCurrency(amount)
  const dateFormatted = formatDate(dueDate)

  if (level === 1) {
    return `Dobrý den,

možná jste naši fakturu č. ${number} jen přehlédli — dovolujeme si připomenout, že je po splatnosti (${daysOverdue} dní).

Částka k úhradě: ${amountFormatted}
Datum splatnosti: ${dateFormatted}

Budeme rádi za úhradu v nejbližších dnech. Pokud jste již zaplatili, omluvte prosím tuto zprávu — platby se občas na cestě zpozdí.

Děkujeme za pochopení a těšíme se na další spolupráci.`
  }

  if (level === 2) {
    return `Dobrý den,

faktura č. ${number} je již ${daysOverdue} dní po splatnosti a dosud jsme neobdrželi platbu.

Částka k úhradě: ${amountFormatted}
Datum splatnosti: ${dateFormatted}

Žádáme Vás o neprodlenou úhradu. Pokud platba již proběhla, prosíme o zaslání potvrzení nebo dokladu o platbě, abychom mohli fakturu uzavřít.

V případě jakýchkoliv nejasností nás prosím kontaktujte.`
  }

  return `Vážený zákazníku,

faktura č. ${number} je ${daysOverdue} dní po splatnosti a dosud nebyla uhrazena.

Částka k úhradě: ${amountFormatted}
Datum splatnosti: ${dateFormatted}

Žádáme o okamžitou úhradu celé dlužné částky. Pokud k úhradě nedojde do 7 dnů od doručení tohoto e-mailu, budu nucen předat celou věc humanoidnímu tvorovi z naší společnosti, který ji následně postoupí právnímu zástupci k vymáhání pohledávky včetně příslušenství.

V případě, že jde o nedorozumění nebo jste platbu již provedli, kontaktujte nás prosím neprodleně.`
}

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

export function getReminderHtml(level: ReminderLevel, vars: ReminderVars): string {
  const { number, daysOverdue, amount, dueDate } = vars
  const amountFormatted = formatCurrency(amount)
  const dateFormatted = formatDate(dueDate)

  let bodyHtml = ''

  if (level === 1) {
    bodyHtml = `
      <p>Dobrý den,</p>
      <p>možná jste naši fakturu č. <strong>${number}</strong> jen přehlédli — dovolujeme si připomenout, že je po splatnosti (<strong>${daysOverdue} dní</strong>).</p>
      <table cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;background:#fff7f5;border-radius:8px;padding:16px 20px;border-left:3px solid #F04E12;">
        <tr><td style="padding-bottom:6px;color:#6b7280;font-size:13px;">Částka k úhradě</td></tr>
        <tr><td style="font-size:20px;font-weight:700;color:#111111;padding-bottom:12px;">${amountFormatted}</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;">Datum splatnosti: <strong style="color:#111111;">${dateFormatted}</strong></td></tr>
      </table>
      <p>Budeme rádi za úhradu v nejbližších dnech. Pokud jste již zaplatili, omluvte prosím tuto zprávu — platby se občas na cestě zpozdí.</p>
      <p>Děkujeme za pochopení a těšíme se na další spolupráci.</p>
    `
  } else if (level === 2) {
    bodyHtml = `
      <p>Dobrý den,</p>
      <p>faktura č. <strong>${number}</strong> je již <strong>${daysOverdue} dní po splatnosti</strong> a dosud jsme neobdrželi platbu.</p>
      <table cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;background:#fff7f5;border-radius:8px;padding:16px 20px;border-left:3px solid #F04E12;">
        <tr><td style="padding-bottom:6px;color:#6b7280;font-size:13px;">Částka k úhradě</td></tr>
        <tr><td style="font-size:20px;font-weight:700;color:#111111;padding-bottom:12px;">${amountFormatted}</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;">Datum splatnosti: <strong style="color:#111111;">${dateFormatted}</strong></td></tr>
      </table>
      <p>Žádáme Vás o neprodlenou úhradu. Pokud platba již proběhla, prosíme o zaslání potvrzení nebo dokladu o platbě, abychom mohli fakturu uzavřít.</p>
      <p>V případě jakýchkoliv nejasností nás prosím kontaktujte.</p>
    `
  } else {
    bodyHtml = `
      <p>Vážený zákazníku,</p>
      <p>faktura č. <strong>${number}</strong> je <strong>${daysOverdue} dní po splatnosti</strong> a dosud nebyla uhrazena.</p>
      <table cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;background:#fff7f5;border-radius:8px;padding:16px 20px;border-left:3px solid #F04E12;">
        <tr><td style="padding-bottom:6px;color:#6b7280;font-size:13px;">Částka k úhradě</td></tr>
        <tr><td style="font-size:20px;font-weight:700;color:#111111;padding-bottom:12px;">${amountFormatted}</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;">Datum splatnosti: <strong style="color:#111111;">${dateFormatted}</strong></td></tr>
      </table>
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
