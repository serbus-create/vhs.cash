import React from 'react'
import { Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { DocumentWithItems, Client, CompanyProfile } from '@/lib/types'
import { formatCzNumber } from '@/lib/terms/render'
import { formatZip } from '@/lib/terms/parties'
import SupplierSignatures from './supplier-signatures'
import ConfirmationStamp from './confirmation-stamp'

const ORANGE = '#F04E12'
const DARK = '#111111'

export type OrderCenaRezim = 'pevna' | 'hodinova' | 'bez_ceny'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'DejaVu',
    fontSize: 9,
    color: '#333333',
    backgroundColor: '#FFFFFF',
    paddingBottom: 60,
  },
  header: {
    backgroundColor: DARK,
    borderTopWidth: 3,
    borderTopColor: ORANGE,
    borderLeftWidth: 3,
    borderLeftColor: ORANGE,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  logoBox: {
    width: 44,
    height: 44,
    backgroundColor: ORANGE,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  logoText: { fontFamily: 'DejaVu-Bold', color: '#FFFFFF', fontSize: 13 },
  headerCompany: { fontFamily: 'DejaVu-Bold', color: '#FFFFFF', fontSize: 11 },
  headerRight: { alignItems: 'flex-end' },
  docTitle: { fontFamily: 'DejaVu-Bold', color: '#FFFFFF', fontSize: 22, marginBottom: 8 },
  metaRow: { flexDirection: 'row', gap: 8, marginBottom: 3 },
  metaLabel: { color: '#888888', fontSize: 8, textAlign: 'right', width: 90 },
  metaValue: {
    fontFamily: 'DejaVu-Bold',
    color: '#FFFFFF',
    fontSize: 8,
    textAlign: 'right',
    minWidth: 90,
  },
  parties: { flexDirection: 'row', marginBottom: 20 },
  partySupplier: {
    flex: 1,
    backgroundColor: '#FFF3EF',
    borderLeftWidth: 3,
    borderLeftColor: ORANGE,
    padding: 20,
    paddingLeft: 29,
  },
  partyClient: {
    flex: 1,
    backgroundColor: '#F6F6F6',
    borderLeftWidth: 3,
    borderLeftColor: ORANGE,
    padding: 20,
    paddingLeft: 29,
  },
  partyTitle: {
    fontFamily: 'DejaVu-Bold',
    fontSize: 7,
    color: ORANGE,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  partyName: { fontFamily: 'DejaVu-Bold', fontSize: 10, color: DARK, marginBottom: 4 },
  partyLine: { fontSize: 8, color: '#555555', marginBottom: 2 },
  tableSection: { paddingHorizontal: 32 },
  subject: { fontSize: 9, color: '#555555', marginBottom: 10, paddingHorizontal: 4 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: DARK,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 2,
  },
  tableHeaderCell: {
    fontFamily: 'DejaVu-Bold',
    color: '#FFFFFF',
    fontSize: 7,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tableRowAlt: { backgroundColor: '#FAFAFA' },
  tableCell: { fontSize: 8, color: '#333333' },
  colNum: { width: 24 },
  colDesc: { flex: 1 },
  colQty: { width: 48, textAlign: 'right' },
  colPrice: { width: 72, textAlign: 'right' },
  colVat: { width: 44, textAlign: 'right' },
  colDiscount: { width: 48, textAlign: 'right' },
  colTotal: { width: 80, textAlign: 'right' },
  totalsSection: { paddingHorizontal: 32, marginTop: 4 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  totalLabel: { fontSize: 8, color: '#666666' },
  totalValue: { fontFamily: 'DejaVu-Bold', fontSize: 8, color: '#333333' },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: DARK,
    borderRadius: 2,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  grandTotalLabel: { fontFamily: 'DejaVu-Bold', fontSize: 9, color: '#FFFFFF' },
  grandTotalValue: { fontFamily: 'DejaVu-Bold', fontSize: 11, color: ORANGE },
  priceSection: { paddingHorizontal: 32, marginTop: 18 },
  priceBox: {
    borderWidth: 1.5,
    borderColor: ORANGE,
    borderRadius: 4,
    padding: 14,
  },
  priceTitle: {
    fontFamily: 'DejaVu-Bold',
    fontSize: 7,
    color: ORANGE,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  priceLine: { fontSize: 8.5, color: '#333333', lineHeight: 1.4, marginBottom: 3 },
  priceMissing: { fontFamily: 'DejaVu-Bold', color: '#B91C1C' },
  signSection: { paddingHorizontal: 32, marginTop: 8 },
  signClient: { marginTop: 14 },
  signClientLabel: { fontFamily: 'DejaVu-Bold', fontSize: 9, color: DARK, marginBottom: 8 },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#666666',
    borderTopWidth: 0.5,
    borderTopColor: '#CCCCCC',
    paddingTop: 6,
  },
})

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

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

function Missing({ children }: { children: string }) {
  return <Text style={styles.priceMissing}>{children}</Text>
}

export default function OrderPage({
  doc,
  client,
  companyProfile,
  zalohaCastka,
}: {
  doc: DocumentWithItems
  client: Client | null
  companyProfile: CompanyProfile | null
  /** částka zálohy bez DPH (jen u pevné ceny), už zformátovaná */
  zalohaCastka?: string
}) {
  const tv = doc.terms_values ?? {}
  const rezim = asCenaRezim(tv.cena_rezim)
  const pricing = orderPricing(doc, client, companyProfile)
  const { showVat, hasItemDiscount, hasDocDiscount, hasAnyDiscount } = pricing
  const fmt = (n: number) => formatMoney(n, doc.currency)
  const fmtNum = (n: number) => formatCzNumber(n, 2)
  const priced = rezim === 'pevna'

  const supplierName = companyProfile?.name ?? '—'
  const supplierCityZip = [formatZip(companyProfile?.zip), companyProfile?.city].filter(Boolean).join(' ')
  const clientCityZip = [formatZip(client?.zip), client?.city].filter(Boolean).join(' ')

  const rate = (tv.hodinova_sazba ?? '').trim()
  const rateNum = Number(rate.replace(',', '.'))
  const rateText = rate ? (Number.isFinite(rateNum) ? formatCzNumber(rateNum, rateNum % 1 === 0 ? 0 : 2) : rate) : null
  const odhad = (tv.odhad_text ?? '').trim()
  const depositPct = (tv.zaloha_objednavka_procent ?? '40').trim()
  const noDeposit = depositPct === '0'

  return (
    <Page size="A4" style={styles.page}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>vhs.</Text>
          </View>
          <Text style={styles.headerCompany}>{supplierName}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.docTitle}>Objednávka</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Číslo:</Text>
            <Text style={styles.metaValue}>{doc.number}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Datum vystavení:</Text>
            <Text style={styles.metaValue}>{fmtDate(doc.issue_date)}</Text>
          </View>
        </View>
      </View>

      {/* ── Dodavatel a klient ── */}
      <View style={styles.parties}>
        <View style={styles.partySupplier}>
          <Text style={styles.partyTitle}>Dodavatel</Text>
          <Text style={styles.partyName}>{supplierName}</Text>
          {companyProfile?.address && <Text style={styles.partyLine}>{companyProfile.address}</Text>}
          {supplierCityZip ? <Text style={styles.partyLine}>{supplierCityZip}</Text> : null}
          {companyProfile?.ico && (
            <Text style={[styles.partyLine, { marginTop: 6 }]}>IČO: {companyProfile.ico}</Text>
          )}
          {companyProfile?.dic && <Text style={styles.partyLine}>DIČ: {companyProfile.dic}</Text>}
        </View>
        <View style={styles.partyClient}>
          <Text style={styles.partyTitle}>Klient</Text>
          {client ? (
            <>
              <Text style={styles.partyName}>{client.name}</Text>
              {client.address && <Text style={styles.partyLine}>{client.address}</Text>}
              {clientCityZip ? <Text style={styles.partyLine}>{clientCityZip}</Text> : null}
              {client.ico && <Text style={[styles.partyLine, { marginTop: 6 }]}>IČO: {client.ico}</Text>}
              {client.dic && <Text style={styles.partyLine}>DIČ: {client.dic}</Text>}
              {(doc.contact_name || doc.contact_email) && (
                <View style={{ marginTop: 6 }}>
                  <Text style={[styles.partyLine, { color: ORANGE, fontFamily: 'DejaVu-Bold' }]}>
                    Kontaktní osoba
                  </Text>
                  {doc.contact_name && <Text style={styles.partyLine}>{doc.contact_name}</Text>}
                  {doc.contact_email && <Text style={styles.partyLine}>{doc.contact_email}</Text>}
                </View>
              )}
            </>
          ) : (
            <Text style={styles.partyLine}>—</Text>
          )}
        </View>
      </View>

      {/* ── Položky ── */}
      <View style={styles.tableSection}>
        {doc.subject && <Text style={styles.subject}>Předmět zakázky: {doc.subject}</Text>}
        <Text style={styles.subject}>Termín: {(tv.termin_text ?? '').trim() || 'dle dohody'}</Text>

        <View style={styles.tableHeader} wrap={false}>
          <Text style={[styles.tableHeaderCell, styles.colNum]}>#</Text>
          <Text style={[styles.tableHeaderCell, styles.colDesc]}>Popis</Text>
          <Text style={[styles.tableHeaderCell, styles.colQty]}>Počet</Text>
          {priced && <Text style={[styles.tableHeaderCell, styles.colPrice]}>Cena/ks</Text>}
          {priced && showVat && <Text style={[styles.tableHeaderCell, styles.colVat]}>DPH</Text>}
          {priced && hasItemDiscount && (
            <Text style={[styles.tableHeaderCell, styles.colDiscount]}>Sleva</Text>
          )}
          {priced && <Text style={[styles.tableHeaderCell, styles.colTotal]}>Celkem</Text>}
        </View>

        {doc.document_items.map((item, idx) => {
          const itemDiscount = item.discount_percent ?? 0
          const lineBase = item.quantity * item.unit_price * (1 - itemDiscount / 100)
          const lineTotal = showVat ? lineBase * (1 + item.vat_rate / 100) : lineBase
          return (
            <View
              key={item.id}
              wrap={false}
              style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={[styles.tableCell, styles.colNum, { fontFamily: 'DejaVu-Bold', color: ORANGE }]}>
                {idx + 1}
              </Text>
              <Text style={[styles.tableCell, styles.colDesc]}>{item.description}</Text>
              <Text style={[styles.tableCell, styles.colQty]}>{item.quantity}</Text>
              {priced && (
                <Text style={[styles.tableCell, styles.colPrice]}>{fmtNum(item.unit_price)}</Text>
              )}
              {priced && showVat && (
                <Text style={[styles.tableCell, styles.colVat]}>{item.vat_rate} %</Text>
              )}
              {priced && hasItemDiscount && (
                <Text style={[styles.tableCell, styles.colDiscount, itemDiscount > 0 ? { color: ORANGE } : {}]}>
                  {itemDiscount > 0
                    ? item.discount_note
                      ? `${itemDiscount} % (${item.discount_note})`
                      : `${itemDiscount} %`
                    : '—'}
                </Text>
              )}
              {priced && (
                <Text style={[styles.tableCell, styles.colTotal, { fontFamily: 'DejaVu-Bold' }]}>
                  {fmtNum(lineTotal)}
                </Text>
              )}
            </View>
          )
        })}
      </View>

      {/* ── Součty (jen pevná cena) ── */}
      {priced && (
        <View style={styles.totalsSection} wrap={false}>
          {hasAnyDiscount && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Mezisoučet</Text>
              <Text style={styles.totalValue}>{fmt(pricing.subtotalBeforeDocDiscount)}</Text>
            </View>
          )}
          {hasDocDiscount && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: ORANGE }]}>
                {doc.discount_note
                  ? `Sleva ${doc.discount_percent} % — ${doc.discount_note}`
                  : `Sleva (${doc.discount_percent} %)`}
              </Text>
              <Text style={[styles.totalValue, { color: ORANGE }]}>
                −{fmt(pricing.subtotalBeforeDocDiscount - pricing.totalWithoutVat)}
              </Text>
            </View>
          )}
          {showVat && (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Základ DPH</Text>
                <Text style={styles.totalValue}>{fmt(pricing.totalWithoutVat)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>DPH</Text>
                <Text style={styles.totalValue}>{fmt(pricing.vatAmount)}</Text>
              </View>
            </>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Cena celkem</Text>
            <Text style={styles.grandTotalValue}>{fmt(pricing.totalWithVat)}</Text>
          </View>
          {!pricing.supplierIsVatPayer && (
            <Text style={{ fontSize: 8, color: '#888888', marginTop: 6, paddingHorizontal: 8 }}>
              Dodavatel není plátcem DPH.
            </Text>
          )}
        </View>
      )}

      {/* ── Cena a platba ── */}
      <View style={styles.priceSection} wrap={false}>
        <View style={styles.priceBox}>
          <Text style={styles.priceTitle}>Cena a platba</Text>
          {rezim === 'pevna' && (
            <Text style={styles.priceLine}>
              Pevná cena: {fmt(pricing.totalWithoutVat)}
              {showVat ? ` bez DPH (${fmt(pricing.totalWithVat)} s DPH)` : ''}
            </Text>
          )}
          {rezim === 'hodinova' && (
            <>
              <Text style={styles.priceLine}>
                Cena podle odpracovaného času. Hodinová sazba:{' '}
                {rateText ? `${rateText} Kč bez DPH.` : <Missing>[DOPLNIT]</Missing>}
              </Text>
              {odhad !== '' && (
                <Text style={styles.priceLine}>Orientační odhad: {odhad} (nezávazný)</Text>
              )}
            </>
          )}
          {rezim === 'bez_ceny' && (
            <Text style={styles.priceLine}>
              Cena se určí z odpracovaného času podle hodinové sazby, kterou dodavatel sdělí e-mailem před
              zahájením prací.
            </Text>
          )}
          {noDeposit ? (
            <Text style={styles.priceLine}>Bez zálohy.</Text>
          ) : rezim === 'pevna' ? (
            <Text style={styles.priceLine}>
              Záloha: {depositPct} % z ceny, tedy {zalohaCastka ?? ''} Kč bez DPH, splatná do 7 dnů od doručení
              faktury
            </Text>
          ) : (
            <Text style={styles.priceLine}>Záloha: {depositPct} % z výsledné ceny.</Text>
          )}
        </View>
      </View>

      {/* ── Podpisy ── */}
      <View style={styles.signSection} wrap={false}>
        <SupplierSignatures supplier={{ name: supplierName, profile_type: companyProfile?.profile_type }} />
        <View style={styles.signClient}>
          <Text style={styles.signClientLabel}>Za klienta{client?.name ? `: ${client.name}` : ''}</Text>
          <ConfirmationStamp />
        </View>
      </View>

      <View style={styles.footer} fixed>
        <Text>Objednávka {doc.number}</Text>
        <Text render={({ pageNumber, totalPages }) => `Strana ${pageNumber} z ${totalPages}`} />
      </View>
    </Page>
  )
}
