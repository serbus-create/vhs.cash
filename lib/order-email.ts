// E-mail s objednávkou k potvrzení (šablona). Jen sestavuje obsah, nic neodesílá.

const LOGO_URL = 'https://vhs-cash.vercel.app/vhs-logo-black.png'
const ORANGE = '#F04E12'

const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/** Podpis Miloše Serbuse; sdílí e-mail k potvrzení i e-maily po potvrzení. */
export const ORDER_SIGNATURE_TEXT = `Miloš Serbus
Produkce | Strategie | Supervize
Jednatel ve společnosti
www.v-h-s.cz
info@v-h-s.cz
+420 725 468 614`

export const ORDER_SIGNATURE_HTML = `<p style="margin:0;"><strong>Miloš Serbus</strong></p>
<p style="margin:0;">Produkce | Strategie | Supervize</p>
<p style="margin:0 0 12px 0;">Jednatel ve společnosti</p>
<p style="margin:0 0 12px 0;"><img src="${LOGO_URL}" width="150" alt="vhs." style="display:block;width:150px;height:auto;border:0;"></p>
<p style="margin:0;"><a href="https://www.v-h-s.cz" style="color:#111111;">www.v-h-s.cz</a></p>
<p style="margin:0;"><a href="mailto:info@v-h-s.cz" style="color:#111111;">info@v-h-s.cz</a></p>
<p style="margin:0;"><a href="tel:+420725468614" style="color:#111111;">+420 725 468 614</a></p>`

export const escapeHtml = esc

export function buildOrderEmail({ docNumber, confirmUrl }: { docNumber: string; confirmUrl: string }): {
  subject: string
  html: string
  text: string
} {
  const subject = `Objednávka ${docNumber} k potvrzení`

  const text = `Dobrý den,

v příloze posílám objednávku č. ${docNumber} a podmínky spolupráce. Prosím o jejich potvrzení jedním z těchto způsobů:

1) KLIKNUTÍM NA ODKAZ (doporučujeme)
Zkontrolujete údaje, doplníte jméno a funkci a potvrdíte. Je to nejrychlejší cesta.
Zkontrolovat a potvrdit: ${confirmUrl}

2) Odpovědí na tento e-mail
Napíšete „Souhlasím s objednávkou a podmínkami spolupráce“ a uvedete své jméno a funkci.

Po potvrzení Vám zašlu kopii s potvrzením. Odkaz je platný 30 dnů.

Děkuji a přeji hezký den

${ORDER_SIGNATURE_TEXT}`

  const num = esc(docNumber)
  const url = esc(confirmUrl)
  const font = 'font-family:Arial,Helvetica,sans-serif;'
  const p = 'margin:0 0 14px 0;'

  const html = `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
<tr><td align="left" style="padding:24px;${font}font-size:15px;line-height:1.5;color:#111111;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
<tr><td style="${font}font-size:15px;line-height:1.5;color:#111111;">
<p style="${p}">Dobrý den,</p>
<p style="${p}">v příloze posílám objednávku č. <strong>${num}</strong> a podmínky spolupráce. Prosím o jejich potvrzení jedním z těchto způsobů:</p>

<!-- Způsob 1: doporučený, výrazný -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px 0;">
<tr>
<td width="5" bgcolor="${ORANGE}" style="background:${ORANGE};font-size:0;line-height:0;">&nbsp;</td>
<td bgcolor="#FFF3EF" style="background:#FFF3EF;padding:16px 18px;${font}font-size:15px;line-height:1.5;color:#111111;">
<div style="margin:0 0 4px 0;font-size:11px;font-weight:bold;letter-spacing:1px;color:${ORANGE};">DOPORUČUJEME</div>
<div style="margin:0 0 6px 0;font-size:17px;font-weight:bold;color:#111111;">1. Kliknutím na tlačítko</div>
<div style="margin:0 0 14px 0;">Zkontrolujete údaje, doplníte jméno a funkci a potvrdíte. <strong>Je to nejrychlejší cesta.</strong></div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" bgcolor="${ORANGE}" style="background:${ORANGE};border-radius:6px;">
<a href="${url}" target="_blank" style="display:inline-block;padding:13px 28px;${font}font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;">Zkontrolovat a potvrdit</a>
</td></tr>
</table>
</td>
</tr>
</table>

<!-- Způsob 2: alternativa, nenápadná -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
<tr>
<td width="5" bgcolor="#CCCCCC" style="background:#CCCCCC;font-size:0;line-height:0;">&nbsp;</td>
<td bgcolor="#F6F6F6" style="background:#F6F6F6;padding:12px 18px;${font}font-size:14px;line-height:1.5;color:#444444;">
<div style="margin:0 0 4px 0;font-size:15px;font-weight:bold;color:#444444;">2. Odpovědí na tento e-mail</div>
<div style="margin:0;">Napíšete <strong>„Souhlasím s objednávkou a podmínkami spolupráce“</strong> a uvedete své jméno a funkci.</div>
</td>
</tr>
</table>

<p style="${p}">Po potvrzení Vám zašlu kopii s potvrzením. Odkaz je platný 30 dnů.</p>
<p style="margin:0 0 20px 0;">Děkuji a přeji hezký den</p>

${ORDER_SIGNATURE_HTML}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  return { subject, html, text }
}
