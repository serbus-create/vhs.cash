import type { DocumentWithItems, Client, CompanyProfile } from '@/lib/types'

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const COUNTRY_NAMES: Record<string, string> = {
  CZ: 'Česká republika',
  AT: 'Rakousko',
  SK: 'Slovensko',
  PL: 'Polsko',
  DE: 'Německo',
}

const makeFmt = (currency: string) => (n: number) =>
  new Intl.NumberFormat('cs-CZ', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const fmtNum = (n: number) =>
  new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

const TYPE_TITLES: Record<string, string> = {
  faktura: 'Faktura',
  nabidka: 'Cenová nabídka',
  objednavka: 'Objednávka',
}

export function generateInvoiceHtml(params: {
  doc: DocumentWithItems
  client: Client | null
  companyProfile: CompanyProfile | null
  qrCodeUrl: string | null
}): string {
  const { doc, client, companyProfile, qrCodeUrl } = params

  const supplierIsVatPayer = companyProfile?.vat_payer !== false
  const clientIsVatPayer = Boolean(client?.dic)
  const showVat = supplierIsVatPayer && clientIsVatPayer
  const isSro = companyProfile?.profile_type === 'sro'

  const fmt = makeFmt(doc.currency ?? 'CZK')

  const totalWithoutVat = doc.total_without_vat ?? 0
  const totalWithVat = doc.total_with_vat ?? 0
  const vatAmount = totalWithVat - totalWithoutVat
  const finalTotal = showVat ? totalWithVat : totalWithoutVat

  const hasItemDiscount = doc.document_items.some((i) => (i.discount_percent ?? 0) > 0)
  const hasDocDiscount = (doc.discount_percent ?? 0) > 0
  const hasAnyDiscount = hasItemDiscount || hasDocDiscount
  const subtotalBeforeDocDiscount = doc.document_items.reduce(
    (s, i) => s + i.quantity * i.unit_price * (1 - (i.discount_percent ?? 0) / 100),
    0,
  )

  const clientCountry = client?.country ?? null
  const clientCountryName = clientCountry && clientCountry !== 'CZ'
    ? (COUNTRY_NAMES[clientCountry] ?? clientCountry)
    : null

  const sup = {
    name: companyProfile?.name ?? '',
    ico: companyProfile?.ico ?? '',
    dic: companyProfile?.dic ?? '',
    address: companyProfile?.address ?? '',
    cityZip: [companyProfile?.zip, companyProfile?.city].filter(Boolean).join(' '),
    email: companyProfile?.email ?? '',
    phone: companyProfile?.phone ?? '',
    web: companyProfile?.web || 'vhs.agency',
    account: companyProfile?.bank_account ?? '',
    iban: companyProfile?.iban ?? '',
    swift: companyProfile?.swift ?? '',
    spisova_znacka: isSro ? (companyProfile?.spisova_znacka ?? '') : '',
  }

  const title = TYPE_TITLES[doc.type] ?? 'Dokument'

  const itemRows = doc.document_items
    .map((item, idx) => {
      const itemDiscount = item.discount_percent ?? 0
      const lineBase = item.quantity * item.unit_price * (1 - itemDiscount / 100)
      const lineTotal = showVat ? lineBase * (1 + item.vat_rate / 100) : lineBase
      const bg = idx % 2 === 1 ? '#fafafa' : '#ffffff'
      return `
        <tr style="background:${bg};">
          <td style="width:24px;font-weight:700;color:#F04E12;padding:7px 8px;border-bottom:1px solid #f0f0f0;">${idx + 1}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #f0f0f0;">${esc(item.description)}</td>
          <td style="text-align:right;width:52px;padding:7px 8px;border-bottom:1px solid #f0f0f0;">${item.quantity}</td>
          <td style="text-align:right;width:80px;padding:7px 8px;border-bottom:1px solid #f0f0f0;">${fmtNum(item.unit_price)}</td>
          ${showVat ? `<td style="text-align:right;width:44px;padding:7px 8px;border-bottom:1px solid #f0f0f0;">${item.vat_rate} %</td>` : ''}
          ${hasItemDiscount ? `<td style="text-align:right;width:48px;padding:7px 8px;border-bottom:1px solid #f0f0f0;${itemDiscount > 0 ? 'color:#F04E12;' : 'color:#aaa;'}">${itemDiscount > 0 ? (item.discount_note ? `${itemDiscount} % (${esc(item.discount_note)})` : `${itemDiscount} %`) : '—'}</td>` : ''}
          <td style="text-align:right;width:88px;font-weight:700;padding:7px 8px;border-bottom:1px solid #f0f0f0;">${fmtNum(lineTotal)}</td>
        </tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    font-size: 9pt;
    color: #333;
    background: #fff;
    width: 210mm;
  }
</style>
</head>
<body>

<!-- ── HEADER ─────────────────────────────────────────────── -->
<div style="
  background:#111111;
  border-top:3px solid #F04E12;
  border-left:3px solid #F04E12;
  padding:24px 32px;
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
">
  <div style="display:flex;align-items:center;gap:14px;">
    <div style="width:44px;height:44px;background:#F04E12;border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      <span style="color:#fff;font-weight:700;font-size:13px;">vhs.</span>
    </div>
    <span style="color:#fff;font-weight:700;font-size:11px;">${esc(sup.name)}</span>
  </div>
  <div style="text-align:right;">
    <div style="color:#fff;font-weight:700;font-size:22px;margin-bottom:8px;">${esc(title)}</div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:3px;">
      <span style="color:#888;font-size:8px;">Číslo:</span>
      <span style="color:#fff;font-weight:700;font-size:8px;min-width:90px;text-align:right;">${esc(doc.number)}</span>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:3px;">
      <span style="color:#888;font-size:8px;">Datum vystavení:</span>
      <span style="color:#fff;font-weight:700;font-size:8px;min-width:90px;text-align:right;">${fmtDate(doc.issue_date)}</span>
    </div>
    ${doc.due_date ? `
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:3px;">
      <span style="color:#888;font-size:8px;">Datum splatnosti:</span>
      <span style="color:#fff;font-weight:700;font-size:8px;min-width:90px;text-align:right;">${fmtDate(doc.due_date)}</span>
    </div>` : ''}
    ${doc.tax_date ? `
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:3px;">
      <span style="color:#888;font-size:8px;">DUZP:</span>
      <span style="color:#fff;font-weight:700;font-size:8px;min-width:90px;text-align:right;">${fmtDate(doc.tax_date)}</span>
    </div>` : ''}
    ${doc.variable_symbol ? `
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:3px;">
      <span style="color:#888;font-size:8px;">Var. symbol:</span>
      <span style="color:#fff;font-weight:700;font-size:8px;min-width:90px;text-align:right;">${esc(doc.variable_symbol)}</span>
    </div>` : ''}
  </div>
</div>

<!-- ── PARTY BLOCKS ──────────────────────────────────────── -->
<div style="display:flex;margin-bottom:24px;">
  <div style="flex:1;background:#FFF3EF;border-left:3px solid #F04E12;padding:20px 20px 20px 29px;">
    <div style="font-size:7px;font-weight:700;color:#F04E12;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Dodavatel</div>
    <div style="font-size:10pt;font-weight:700;color:#111;margin-bottom:4px;">${esc(sup.name)}</div>
    ${sup.address ? `<div style="font-size:8pt;color:#555;margin-bottom:2px;">${esc(sup.address)}</div>` : ''}
    ${sup.cityZip ? `<div style="font-size:8pt;color:#555;margin-bottom:2px;">${esc(sup.cityZip)}</div>` : ''}
    ${sup.ico ? `<div style="font-size:8pt;color:#555;margin-top:6px;margin-bottom:2px;">IČO: ${esc(sup.ico)}</div>` : ''}
    ${sup.dic ? `<div style="font-size:8pt;color:#555;margin-bottom:2px;">DIČ: ${esc(sup.dic)}</div>` : ''}
    ${sup.spisova_znacka ? `<div style="font-size:7pt;color:#888;margin-top:4px;">${esc(sup.spisova_znacka)}</div>` : ''}
  </div>
  <div style="flex:1;background:#F6F6F6;border-left:3px solid #F04E12;padding:20px 20px 20px 29px;">
    <div style="font-size:7px;font-weight:700;color:#F04E12;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Odběratel</div>
    ${client ? `
      <div style="font-size:10pt;font-weight:700;color:#111;margin-bottom:4px;">${esc(client.name)}</div>
      ${client.address ? `<div style="font-size:8pt;color:#555;margin-bottom:2px;">${esc(client.address)}</div>` : ''}
      ${(client.zip || client.city) ? `<div style="font-size:8pt;color:#555;margin-bottom:2px;">${esc([client.zip, client.city].filter(Boolean).join(' '))}</div>` : ''}
      ${clientCountryName ? `<div style="font-size:8pt;color:#555;margin-bottom:2px;">${esc(clientCountryName)}</div>` : ''}
      ${client.ico ? `<div style="font-size:8pt;color:#555;margin-top:6px;margin-bottom:2px;">IČO: ${esc(client.ico)}</div>` : ''}
      ${client.dic ? `<div style="font-size:8pt;color:#555;margin-bottom:2px;">DIČ: ${esc(client.dic)}</div>` : ''}
      ${client.email ? `<div style="font-size:8pt;color:#555;margin-bottom:2px;">${esc(client.email)}</div>` : ''}
    ` : '<div style="font-size:8pt;color:#555;">—</div>'}
  </div>
</div>

<!-- ── ITEMS TABLE ───────────────────────────────────────── -->
<div style="padding:0 32px;">
  ${doc.subject ? `<p style="font-size:9pt;color:#555;margin-bottom:10px;padding:0 4px;">Objednávka: ${esc(doc.subject)}</p>` : ''}
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr>
        <th style="background:#111;color:#fff;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:7px 8px;text-align:left;width:24px;">#</th>
        <th style="background:#111;color:#fff;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:7px 8px;text-align:left;">Popis</th>
        <th style="background:#111;color:#fff;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:7px 8px;text-align:right;width:52px;">Počet</th>
        <th style="background:#111;color:#fff;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:7px 8px;text-align:right;width:80px;">Cena/ks</th>
        ${showVat ? '<th style="background:#111;color:#fff;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:7px 8px;text-align:right;width:44px;">DPH</th>' : ''}
        ${hasItemDiscount ? '<th style="background:#111;color:#fff;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:7px 8px;text-align:right;width:48px;">Sleva</th>' : ''}
        <th style="background:#111;color:#fff;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:7px 8px;text-align:right;width:88px;">Celkem</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>
</div>

<!-- ── VAT NOTE ──────────────────────────────────────────── -->
${!supplierIsVatPayer ? '<div style="padding:6px 40px 0;"><span style="font-size:8pt;color:#888;">Nejsem plátce DPH</span></div>' : ''}

<!-- ── TOTALS ────────────────────────────────────────────── -->
<div style="padding:0 32px;margin-top:0;">
  ${hasAnyDiscount ? `
  <div style="display:flex;justify-content:space-between;padding:4px 8px;">
    <span style="font-size:8pt;color:#666;">Mezisoučet</span>
    <span style="font-size:8pt;color:#333;font-weight:700;">${fmt(subtotalBeforeDocDiscount)}</span>
  </div>` : ''}
  ${hasDocDiscount ? `
  <div style="display:flex;justify-content:space-between;padding:4px 8px;">
    <span style="font-size:8pt;color:#F04E12;">${doc.discount_note ? `Sleva ${doc.discount_percent} % — ${esc(doc.discount_note)}` : `Sleva (${doc.discount_percent} %)`}</span>
    <span style="font-size:8pt;color:#F04E12;font-weight:700;">−${fmt(subtotalBeforeDocDiscount - totalWithoutVat)}</span>
  </div>` : ''}
  ${showVat ? `
  <div style="display:flex;justify-content:space-between;padding:4px 8px;">
    <span style="font-size:8pt;color:#666;">Základ DPH</span>
    <span style="font-size:8pt;color:#333;font-weight:700;">${fmt(totalWithoutVat)}</span>
  </div>
  <div style="display:flex;justify-content:space-between;padding:4px 8px;">
    <span style="font-size:8pt;color:#666;">DPH</span>
    <span style="font-size:8pt;color:#333;font-weight:700;">${fmt(vatAmount)}</span>
  </div>` : ''}
  <div style="display:flex;justify-content:space-between;background:#111;border-radius:2px;padding:10px 12px;margin-top:4px;">
    <span style="font-size:10pt;color:#fff;font-weight:700;">Celkem k úhradě</span>
    <span style="font-size:12pt;color:#F04E12;font-weight:700;">${fmt(finalTotal)}</span>
  </div>
</div>

<!-- ── NOTE + PENALTY ────────────────────────────────────── -->
<div style="padding:0 32px;margin-top:14px;">
  <p style="font-size:8pt;color:#777;font-style:italic;line-height:1.5;">Fakturujeme Vám za dodané zboží či služby. Děkujeme za Vámi projevenou důvěru a těšíme se na další projekty.</p>
</div>
${isSro ? `
<div style="padding:0 32px;margin-top:6px;">
  <p style="font-size:7.5pt;color:#999;line-height:1.5;">Při zpožděné úhradě Vám budeme účtovat penále ve výši 0,05 % z dlužné částky za každý započatý den prodlení. Při prodlení nad 21 dnů se sazba zvyšuje na 0,1 %.</p>
</div>` : ''}

<!-- ── PAYMENT BOX (faktura only) ────────────────────────── -->
${doc.type === 'faktura' ? `
<div style="padding:0 32px;margin-top:24px;">
  <div style="display:flex;border:1.5px solid #F04E12;border-radius:4px;padding:16px;">
    <div style="flex:1;">
      <div style="font-size:7pt;font-weight:700;color:#F04E12;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Platební údaje</div>
      ${sup.account ? `<div style="font-size:8pt;color:#444;margin-bottom:3px;"><span style="color:#888;">Číslo účtu: </span>${esc(sup.account)}</div>` : ''}
      ${sup.iban ? `<div style="font-size:8pt;color:#444;margin-bottom:3px;"><span style="color:#888;">IBAN: </span>${esc(sup.iban)}</div>` : ''}
      ${sup.swift ? `<div style="font-size:8pt;color:#444;margin-bottom:3px;"><span style="color:#888;">SWIFT: </span>${esc(sup.swift)}</div>` : ''}
      ${doc.variable_symbol ? `<div style="font-size:8pt;color:#444;margin-bottom:3px;"><span style="color:#888;">Variabilní symbol: </span>${esc(doc.variable_symbol)}</div>` : ''}
      ${doc.due_date ? `<div style="font-size:8pt;color:#444;margin-bottom:3px;"><span style="color:#888;">Splatnost: </span>${fmtDate(doc.due_date)}</div>` : ''}
    </div>
    ${qrCodeUrl ? `
    <div style="width:96px;padding:0 12px;border-left:1px solid #eee;display:flex;flex-direction:column;align-items:center;justify-content:center;">
      <img src="${qrCodeUrl}" width="72" height="72" alt="QR platba" style="display:block;">
      <div style="font-size:7pt;color:#aaa;text-align:center;margin-top:4px;">QR Platba</div>
    </div>` : ''}
    <div style="border-left:1px solid #eee;padding-left:16px;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;">
      <div style="font-size:8pt;color:#888;margin-bottom:4px;">K úhradě celkem</div>
      <div style="font-size:18pt;font-weight:700;color:#111;">${fmt(finalTotal)}</div>
    </div>
  </div>
</div>` : ''}

<!-- ── FOOTER ────────────────────────────────────────────── -->
<div style="padding:0 32px;margin-top:20px;">
  <div style="border-top:1px solid #eee;margin-bottom:8px;"></div>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <div style="font-size:7pt;font-weight:700;color:#F04E12;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">Kontaktní údaje</div>
      ${sup.email ? `<div style="font-size:7pt;color:#888;margin-bottom:2px;">${esc(sup.email)}</div>` : ''}
      ${sup.phone ? `<div style="font-size:7pt;color:#888;margin-bottom:2px;">${esc(sup.phone)}</div>` : ''}
      <div style="font-size:7pt;color:#888;margin-bottom:2px;">${esc(sup.web)}</div>
    </div>
    <div style="font-size:7pt;color:#ccc;text-align:right;margin-top:2px;">${esc(sup.name)}</div>
  </div>
</div>

</body>
</html>`
}
