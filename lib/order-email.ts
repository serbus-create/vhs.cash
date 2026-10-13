// E-mail s objednávkou k potvrzení (šablona). Jen sestavuje obsah, nic neodesílá.

const LOGO_URL = 'https://vhs-cash.vercel.app/vhs-logo-black.png'

const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export function buildOrderEmail({ docNumber, confirmUrl }: { docNumber: string; confirmUrl: string }): {
  subject: string
  html: string
  text: string
} {
  const subject = `Objednávka ${docNumber} k potvrzení`

  const text = `Dobrý den,

v příloze posílám objednávku č. ${docNumber} a podmínky spolupráce. Prosím o jejich potvrzení jedním z těchto způsobů:

- Kliknutím na tlačítko níže. Zkontrolujete údaje, doplníte jméno a funkci a potvrdíte. Je to nejrychlejší cesta.
- Odpovědí na tento e-mail, ve které napíšete „Souhlasím s objednávkou a podmínkami spolupráce“ a uvedete své jméno a funkci.

Po potvrzení Vám zašlu kopii s potvrzením. Odkaz je platný 30 dnů.

Děkuji a přeji hezký den

Zkontrolovat a potvrdit: ${confirmUrl}

Miloš Serbus
Produkce | Strategie | Supervize
Jednatel ve společnosti
www.v-h-s.cz
info@v-h-s.cz
+420 725 468 614`

  const num = esc(docNumber)
  const url = esc(confirmUrl)
  const p = 'margin:0 0 14px 0;'

  const html = `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
<tr><td align="left" style="padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111111;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111111;">
<p style="${p}">Dobrý den,</p>
<p style="${p}">v příloze posílám objednávku č. ${num} a podmínky spolupráce. Prosím o jejich potvrzení jedním z těchto způsobů:</p>
<ul style="margin:0 0 14px 0;padding-left:20px;">
<li style="margin:0 0 8px 0;">Kliknutím na tlačítko níže. Zkontrolujete údaje, doplníte jméno a funkci a potvrdíte. Je to nejrychlejší cesta.</li>
<li style="margin:0 0 8px 0;">Odpovědí na tento e-mail, ve které napíšete „Souhlasím s objednávkou a podmínkami spolupráce“ a uvedete své jméno a funkci.</li>
</ul>
<p style="${p}">Po potvrzení Vám zašlu kopii s potvrzením. Odkaz je platný 30 dnů.</p>
<p style="${p}">Děkuji a přeji hezký den</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;">
<tr><td align="center" bgcolor="#F04E12" style="background:#F04E12;border-radius:6px;">
<a href="${url}" target="_blank" style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Zkontrolovat a potvrdit</a>
</td></tr>
</table>
<p style="margin:0;"><strong>Miloš Serbus</strong></p>
<p style="margin:0;">Produkce | Strategie | Supervize</p>
<p style="margin:0 0 12px 0;">Jednatel ve společnosti</p>
<p style="margin:0 0 12px 0;"><img src="${LOGO_URL}" width="150" alt="vhs." style="display:block;width:150px;height:auto;border:0;"></p>
<p style="margin:0;"><a href="https://www.v-h-s.cz" style="color:#111111;">www.v-h-s.cz</a></p>
<p style="margin:0;"><a href="mailto:info@v-h-s.cz" style="color:#111111;">info@v-h-s.cz</a></p>
<p style="margin:0;"><a href="tel:+420725468614" style="color:#111111;">+420 725 468 614</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  return { subject, html, text }
}
