// Čisté funkce pro cenu a zálohu objednávky. Sdílí PDF (components/pdf/order-pages.tsx)
// a veřejná potvrzovací stránka, aby oba ukazovaly stejné texty. Bez závislosti na react-pdf.
import type { DocumentWithItems, Client, CompanyProfile } from '@/lib/types'
import { formatCzNumber } from '@/lib/terms/render'

export type OrderCenaRezim = 'pevna' | 'hodinova' | 'bez_ceny'

export const asCenaRezim = (v: unknown): OrderCenaRezim =>
  v === 'hodinova' || v === 'bez_ceny' ? v : 'pevna'

/**
 * Součty objednávky se stejnými pravidly jako invoice-template.tsx:
 * částky ze sloupců total_without_vat / total_with_vat, DPH se ukazuje, je-li dodavatel
 * plátce a nejde o reverse charge (zahraniční klient s DIČ).
 */
export function orderPricing(
  doc: DocumentWithItems,
  client: Client | null,
  companyProfile: CompanyProfile | null,
) {
  const country = client?.country ?? null
  const supplierIsVatPayer = companyProfile?.vat_payer !== false
  const isReverseCharge = Boolean(client?.dic) && !!country && country !== 'CZ'
  const showVat = supplierIsVatPayer && !isReverseCharge

  const totalWithoutVat = doc.total_without_vat ?? 0
  const totalWithVat = doc.total_with_vat ?? 0
  const hasItemDiscount = doc.document_items.some((i) => (i.discount_percent ?? 0) > 0)
  const hasDocDiscount = (doc.discount_percent ?? 0) > 0
  const subtotalBeforeDocDiscount = doc.document_items.reduce(
    (s, i) => s + i.quantity * i.unit_price * (1 - (i.discount_percent ?? 0) / 100),
    0,
  )
  return {
    supplierIsVatPayer,
    showVat,
    totalWithoutVat,
    totalWithVat,
    vatAmount: totalWithVat - totalWithoutVat,
    hasItemDiscount,
    hasDocDiscount,
    hasAnyDiscount: hasItemDiscount || hasDocDiscount,
    subtotalBeforeDocDiscount,
  }
}

const currencyLabel = (c: string | null | undefined) => (!c || c === 'CZK' ? 'Kč' : c)

export const formatMoney = (n: number, currency: string | null | undefined) =>
  `${formatCzNumber(n, 2)} ${currencyLabel(currency)}`

const round2 = (n: number) => Math.round(n * 100) / 100

/** Záloha bez DPH u pevné ceny, už zformátovaná; jinak prázdný řetězec. */
export function orderDepositAmountText(
  doc: DocumentWithItems,
  client: Client | null,
  companyProfile: CompanyProfile | null,
): string {
  const tv = doc.terms_values ?? {}
  const depositPct = (tv.zaloha_objednavka_procent ?? '').trim()
  const pct = Number(depositPct.replace(',', '.'))
  if (asCenaRezim(tv.cena_rezim) === 'pevna' && depositPct && Number.isFinite(pct) && pct > 0) {
    const amount = round2((orderPricing(doc, client, companyProfile).totalWithoutVat * pct) / 100)
    return formatCzNumber(amount, Number.isInteger(amount) ? 0 : 2)
  }
  return ''
}

/** Věta textu; `missing` je chybějící údaj, který PDF zvýrazní červeně (ve webu se ukáže stejně jako text). */
export interface OrderPaymentLine {
  text: string
  missing?: string
}

/** Řádky "Cena a platba" objednávky: cena podle způsobu ceny a záloha. */
export function orderPaymentLines(
  doc: DocumentWithItems,
  client: Client | null,
  companyProfile: CompanyProfile | null,
  zalohaCastka?: string,
): { rezim: OrderCenaRezim; price: OrderPaymentLine[]; deposit: OrderPaymentLine } {
  const tv = doc.terms_values ?? {}
  const rezim = asCenaRezim(tv.cena_rezim)
  const pricing = orderPricing(doc, client, companyProfile)
  const { showVat } = pricing
  const fmt = (n: number) => formatMoney(n, doc.currency)

  const rate = (tv.hodinova_sazba ?? '').trim()
  const rateNum = Number(rate.replace(',', '.'))
  const rateText = rate ? (Number.isFinite(rateNum) ? formatCzNumber(rateNum, rateNum % 1 === 0 ? 0 : 2) : rate) : null
  const odhad = (tv.odhad_text ?? '').trim()
  const depositPct = (tv.zaloha_objednavka_procent ?? '40').trim()
  const noDeposit = depositPct === '0'
  // záloha s DPH (jen pro plátce DPH), zaokrouhleno na haléře
  const depositNum = Number(depositPct.replace(',', '.'))
  const depositWithVatRaw = Number.isFinite(depositNum) ? Math.round(pricing.totalWithVat * depositNum) / 100 : 0
  const depositWithVat = formatCzNumber(depositWithVatRaw, Number.isInteger(depositWithVatRaw) ? 0 : 2)

  const price: OrderPaymentLine[] = []
  if (rezim === 'pevna') {
    price.push({
      text: `Pevná cena: ${fmt(pricing.totalWithoutVat)}${showVat ? ` bez DPH (${fmt(pricing.totalWithVat)} s DPH)` : ''}`,
    })
  } else if (rezim === 'hodinova') {
    price.push(
      rateText
        ? { text: `Cena podle odpracovaného času. Hodinová sazba: ${rateText} Kč bez DPH.` }
        : { text: 'Cena podle odpracovaného času. Hodinová sazba: ', missing: '[DOPLNIT]' },
    )
    if (odhad !== '') price.push({ text: `Orientační odhad: ${odhad} (nezávazný)` })
  } else {
    price.push({
      text:
        'Cena se určí z odpracovaného času podle hodinové sazby, kterou dodavatel sdělí e-mailem před zahájením prací.',
    })
  }

  const deposit: OrderPaymentLine = noDeposit
    ? { text: 'Bez zálohy.' }
    : rezim === 'pevna'
      ? {
          text: `Záloha: ${depositPct} % z ceny, tedy ${zalohaCastka ?? ''} Kč${
            showVat ? ` bez DPH (${depositWithVat} Kč s DPH)` : ''
          }, splatná do 7 dnů od doručení zálohové faktury.`,
        }
      : { text: `Záloha: ${depositPct} % z výsledné ceny.` }

  return { rezim, price, deposit }
}
