import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer'
import type { DocumentWithItems, Client, CompanyProfile } from '@/lib/types'
import { getLang, getLocale, TRANSLATIONS } from './invoice-translations'

const ORANGE = '#F04E12'
const DARK = '#111111'

const COUNTRY_NAMES: Record<string, string> = {
  CZ: 'Česká republika',
  AT: 'Österreich',
  SK: 'Slovensko',
  PL: 'Polska',
  DE: 'Deutschland',
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'DejaVu',
    fontSize: 9,
    color: '#333333',
    backgroundColor: '#FFFFFF',
    paddingBottom: 40,
  },
  // ── Header
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
  logoBox: {
    width: 44,
    height: 44,
    backgroundColor: ORANGE,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  logoText: {
    fontFamily: 'DejaVu-Bold',
    color: '#FFFFFF',
    fontSize: 13,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCompany: {
    fontFamily: 'DejaVu-Bold',
    color: '#FFFFFF',
    fontSize: 11,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  docTitle: {
    fontFamily: 'DejaVu-Bold',
    color: '#FFFFFF',
    fontSize: 22,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 3,
  },
  metaLabel: {
    color: '#888888',
    fontSize: 8,
    textAlign: 'right',
    width: 90,
  },
  metaValue: {
    fontFamily: 'DejaVu-Bold',
    color: '#FFFFFF',
    fontSize: 8,
    textAlign: 'right',
    minWidth: 90,
  },
  // ── Party blocks
  parties: {
    flexDirection: 'row',
    marginBottom: 24,
  },
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
  partyName: {
    fontFamily: 'DejaVu-Bold',
    fontSize: 10,
    color: DARK,
    marginBottom: 4,
  },
  partyLine: {
    fontSize: 8,
    color: '#555555',
    marginBottom: 2,
  },
  // ── Items table
  tableSection: {
    paddingHorizontal: 32,
  },
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
  tableRowAlt: {
    backgroundColor: '#FAFAFA',
  },
  tableCell: {
    fontSize: 8,
    color: '#333333',
  },
  // Column widths
  colNum: { width: 24 },
  colDesc: { flex: 1 },
  colQty: { width: 48, textAlign: 'right' },
  colPrice: { width: 72, textAlign: 'right' },
  colVat: { width: 44, textAlign: 'right' },
  colDiscount: { width: 48, textAlign: 'right' },
  colTotal: { width: 80, textAlign: 'right' },
  // ── Totals
  totalsSection: {
    paddingHorizontal: 32,
  },
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  grandTotalLabel: { fontFamily: 'DejaVu-Bold', fontSize: 10, color: '#FFFFFF' },
  grandTotalValue: { fontFamily: 'DejaVu-Bold', fontSize: 12, color: ORANGE },
  // ── Payment box
  paymentSection: {
    paddingHorizontal: 32,
    marginTop: 24,
  },
  paymentBox: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: ORANGE,
    borderRadius: 4,
    padding: 16,
  },
  paymentLeft: { flex: 1 },
  paymentRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 16,
    borderLeftWidth: 1,
    borderLeftColor: '#EEEEEE',
  },
  paymentTitle: {
    fontFamily: 'DejaVu-Bold',
    fontSize: 7,
    color: ORANGE,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  paymentLine: { fontSize: 8, color: '#444444', marginBottom: 3 },
  paymentKey: { color: '#888888' },
  paymentAmountLabel: { fontSize: 8, color: '#888888', marginBottom: 4 },
  paymentAmount: { fontFamily: 'DejaVu-Bold', fontSize: 18, color: DARK },
  // ── QR code
  paymentQr: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#EEEEEE',
  },
  qrImage: { width: 72, height: 72 },
  qrLabel: { fontSize: 7, color: '#AAAAAA', textAlign: 'center', marginTop: 4 },
  // ── Note / penalty blocks
  textBlock: {
    paddingHorizontal: 32,
    marginTop: 14,
  },
  noteText: {
    fontSize: 8,
    color: '#777777',
    lineHeight: 1.5,
  },
  penaltyText: {
    fontSize: 7.5,
    color: '#999999',
    lineHeight: 1.5,
  },
  // ── Footer
  footerSection: {
    paddingHorizontal: 32,
    marginTop: 20,
  },
  footerDivider: {
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    marginBottom: 8,
  },
  footerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  footerContactTitle: {
    fontFamily: 'DejaVu-Bold',
    fontSize: 7,
    color: ORANGE,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  footerContactLine: {
    fontSize: 7,
    color: '#888888',
    marginBottom: 2,
  },
  footerBrand: {
    fontSize: 7,
    color: '#CCCCCC',
    textAlign: 'right',
    marginTop: 2,
  },
})

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

interface Props {
  doc: DocumentWithItems
  client: Client | null
  companyProfile: CompanyProfile | null
  qrCodeUrl: string | null
  clientCountry?: string | null
}

export default function InvoiceTemplate({ doc, client, companyProfile, qrCodeUrl, clientCountry }: Props) {
  // Language and locale derived from client's country
  const country = clientCountry ?? client?.country ?? null
  const lang = getLang(country)
  const locale = getLocale(country)
  const t = TRANSLATIONS[lang]

  const title = t[doc.type as 'faktura' | 'nabidka' | 'objednavka'] ?? t.faktura

  const totalWithoutVat = doc.total_without_vat ?? 0
  const totalWithVat = doc.total_with_vat ?? 0
  const vatAmount = totalWithVat - totalWithoutVat

  const hasItemDiscount = doc.document_items.some((i) => (i.discount_percent ?? 0) > 0)
  const hasDocDiscount = (doc.discount_percent ?? 0) > 0
  const hasAnyDiscount = hasItemDiscount || hasDocDiscount
  const subtotalBeforeDocDiscount = doc.document_items.reduce(
    (s, i) => s + i.quantity * i.unit_price * (1 - (i.discount_percent ?? 0) / 100),
    0,
  )

  const supplierIsVatPayer = companyProfile?.vat_payer !== false
  // Reverse charge (§ 89 ZDPH) — zahraniční EU B2B klient s DIČ, daň odvede zákazník
  const isReverseCharge = Boolean(client?.dic) && !!country && country !== 'CZ'
  const showVat = supplierIsVatPayer && !isReverseCharge

  const isSro = companyProfile?.profile_type === 'sro'

  // Currency-aware formatter using the document currency and client locale
  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: doc.currency ?? 'CZK',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)

  // Plain number formatter (for item quantities and unit prices in the table)
  const fmtNum = (n: number) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

  // Country name shown in client address block for non-CZ clients
  const clientCountryName = country && country !== 'CZ'
    ? (COUNTRY_NAMES[country] ?? country)
    : null

  // Client block heading — "Objednatel" for orders, "Odběratel" otherwise
  const clientBlockLabel = doc.type === 'objednavka' ? t.objednatel : t.odberatel

  const sup = {
    name: companyProfile?.name ?? '—',
    ico: companyProfile?.ico ?? null,
    dic: companyProfile?.dic ?? null,
    address: companyProfile?.address ?? null,
    cityZip: [companyProfile?.zip, companyProfile?.city].filter(Boolean).join(' ') || null,
    email: companyProfile?.email ?? null,
    phone: companyProfile?.phone ?? null,
    web: companyProfile?.web ?? null,
    account: companyProfile?.bank_account ?? null,
    iban: companyProfile?.iban ?? null,
    swift: companyProfile?.swift ?? null,
    spisova_znacka: isSro ? (companyProfile?.spisova_znacka ?? null) : null,
  }

  return (
    <Document title={`${title} ${doc.number}`}>
      <Page size="A4" style={styles.page}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>vhs.</Text>
            </View>
            <View>
              <Text style={styles.headerCompany}>{sup.name}</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <Text style={styles.docTitle}>{title}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{t.cislo}:</Text>
              <Text style={styles.metaValue}>{doc.number}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{t.datumVystaveni}:</Text>
              <Text style={styles.metaValue}>{fmtDate(doc.issue_date)}</Text>
            </View>
            {doc.due_date && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t.datumSplatnosti}:</Text>
                <Text style={styles.metaValue}>{fmtDate(doc.due_date)}</Text>
              </View>
            )}
            {doc.tax_date && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t.duzp}:</Text>
                <Text style={styles.metaValue}>{fmtDate(doc.tax_date)}</Text>
              </View>
            )}
            {doc.variable_symbol && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t.varSymbol}:</Text>
                <Text style={styles.metaValue}>{doc.variable_symbol}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Party blocks ── */}
        <View style={styles.parties}>
          {/* Supplier */}
          <View style={styles.partySupplier}>
            <Text style={styles.partyTitle}>{t.dodavatel}</Text>
            <Text style={styles.partyName}>{sup.name}</Text>
            {sup.address && <Text style={styles.partyLine}>{sup.address}</Text>}
            {sup.cityZip && <Text style={styles.partyLine}>{sup.cityZip}</Text>}
            <Text style={styles.partyLine}>{t.supplierCountry}</Text>
            {sup.ico && (
              <Text style={[styles.partyLine, { marginTop: 6 }]}>{t.ico}: {sup.ico}</Text>
            )}
            {sup.dic && <Text style={styles.partyLine}>{t.dic}: {sup.dic}</Text>}
            {sup.spisova_znacka && (
              <Text style={[styles.partyLine, { color: '#888888', fontSize: 7, marginTop: 4 }]}>
                {sup.spisova_znacka}
              </Text>
            )}
          </View>

          {/* Client */}
          <View style={styles.partyClient}>
            <Text style={styles.partyTitle}>{clientBlockLabel}</Text>
            {client ? (
              <>
                <Text style={styles.partyName}>{client.name}</Text>
                {client.address && <Text style={styles.partyLine}>{client.address}</Text>}
                {(client.zip || client.city) && (
                  <Text style={styles.partyLine}>
                    {[client.zip, client.city].filter(Boolean).join(' ')}
                  </Text>
                )}
                {clientCountryName && (
                  <Text style={styles.partyLine}>{clientCountryName}</Text>
                )}
                {client.ico && (
                  <Text style={[styles.partyLine, { marginTop: 6 }]}>{t.ico}: {client.ico}</Text>
                )}
                {client.dic && <Text style={styles.partyLine}>{t.dic}: {client.dic}</Text>}
                {client.email && <Text style={styles.partyLine}>{client.email}</Text>}
              </>
            ) : (
              <Text style={styles.partyLine}>—</Text>
            )}
          </View>
        </View>

        {/* ── Items table ── */}
        <View style={styles.tableSection}>
          {doc.subject && (
            <Text style={{ fontSize: 9, color: '#555', marginBottom: 10, paddingHorizontal: 4 }}>
              {t.predmet}: {doc.subject}
            </Text>
          )}

          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colNum]}>{t.colNum}</Text>
            <Text style={[styles.tableHeaderCell, styles.colDesc]}>{t.colPopis}</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>{t.colPocet}</Text>
            <Text style={[styles.tableHeaderCell, styles.colPrice]}>{t.colCenaks}</Text>
            {showVat && <Text style={[styles.tableHeaderCell, styles.colVat]}>{t.colDph}</Text>}
            {hasItemDiscount && <Text style={[styles.tableHeaderCell, styles.colDiscount]}>Sleva</Text>}
            <Text style={[styles.tableHeaderCell, styles.colTotal]}>{t.colCelkem}</Text>
          </View>

          {doc.document_items.map((item, idx) => {
            const itemDiscount = item.discount_percent ?? 0
            const lineBase = item.quantity * item.unit_price * (1 - itemDiscount / 100)
            const lineTotal = showVat ? lineBase * (1 + item.vat_rate / 100) : lineBase
            return (
              <View key={item.id} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.tableCell, styles.colNum, { fontFamily: 'DejaVu-Bold', color: ORANGE }]}>
                  {idx + 1}
                </Text>
                <Text style={[styles.tableCell, styles.colDesc]}>{item.description}</Text>
                <Text style={[styles.tableCell, styles.colQty]}>{item.quantity}</Text>
                <Text style={[styles.tableCell, styles.colPrice]}>
                  {fmtNum(item.unit_price)}
                </Text>
                {showVat && (
                  <Text style={[styles.tableCell, styles.colVat]}>{item.vat_rate} %</Text>
                )}
                {hasItemDiscount && (
                  <Text style={[styles.tableCell, styles.colDiscount, itemDiscount > 0 ? { color: ORANGE } : {}]}>
                    {itemDiscount > 0
                      ? item.discount_note
                        ? `${itemDiscount} % (${item.discount_note})`
                        : `${itemDiscount} %`
                      : '—'}
                  </Text>
                )}
                <Text style={[styles.tableCell, styles.colTotal, { fontFamily: 'DejaVu-Bold' }]}>
                  {fmtNum(lineTotal)}
                </Text>
              </View>
            )
          })}
        </View>

        {/* ── "Not a VAT payer" note ── */}
        {!supplierIsVatPayer && (
          <View style={{ paddingHorizontal: 40, marginTop: 6 }}>
            <Text style={{ fontSize: 8, color: '#888888' }}>{t.neniPlatceDph}</Text>
          </View>
        )}

        {/* ── Totals ── */}
        <View style={styles.totalsSection}>
          {hasAnyDiscount && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Mezisoučet</Text>
              <Text style={styles.totalValue}>{fmt(subtotalBeforeDocDiscount)}</Text>
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
                −{fmt(subtotalBeforeDocDiscount - totalWithoutVat)}
              </Text>
            </View>
          )}
          {showVat && (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t.zakladDph}</Text>
                <Text style={styles.totalValue}>{fmt(totalWithoutVat)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t.dph}</Text>
                <Text style={styles.totalValue}>{fmt(vatAmount)}</Text>
              </View>
            </>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>{t.celkemKUhrade}</Text>
            <Text style={styles.grandTotalValue}>{fmt(totalWithVat)}</Text>
          </View>
        </View>

        {/* ── Note ── */}
        <View style={styles.textBlock}>
          <Text style={styles.noteText}>{t.note}</Text>
        </View>

        {/* ── Penalty clause (invoices only) ── */}
        {doc.type === 'faktura' && (
          <View style={[styles.textBlock, { marginTop: 6 }]}>
            <Text style={styles.penaltyText}>{t.penalty}</Text>
          </View>
        )}

        {/* ── Payment box (invoices only) ── */}
        {doc.type === 'faktura' && (
          <View style={styles.paymentSection}>
            <View style={styles.paymentBox}>
              <View style={styles.paymentLeft}>
                <Text style={styles.paymentTitle}>{t.platebniUdaje}</Text>
                {sup.account && (
                  <Text style={styles.paymentLine}>
                    <Text style={styles.paymentKey}>{t.cisloUctu}: </Text>
                    {sup.account}
                  </Text>
                )}
                {sup.iban && (
                  <Text style={styles.paymentLine}>
                    <Text style={styles.paymentKey}>IBAN: </Text>
                    {sup.iban}
                  </Text>
                )}
                {sup.swift && (
                  <Text style={styles.paymentLine}>
                    <Text style={styles.paymentKey}>SWIFT: </Text>
                    {sup.swift}
                  </Text>
                )}
                {doc.variable_symbol && (
                  <Text style={styles.paymentLine}>
                    <Text style={styles.paymentKey}>{t.variabilniSymbol}: </Text>
                    {doc.variable_symbol}
                  </Text>
                )}
                {doc.due_date && (
                  <Text style={styles.paymentLine}>
                    <Text style={styles.paymentKey}>{t.splatnost}: </Text>
                    {fmtDate(doc.due_date)}
                  </Text>
                )}
              </View>
              {qrCodeUrl && (
                <View style={styles.paymentQr}>
                  <Image src={qrCodeUrl} style={styles.qrImage} />
                  <Text style={styles.qrLabel}>{t.qrPlatba}</Text>
                </View>
              )}
              <View style={styles.paymentRight}>
                <Text style={styles.paymentAmountLabel}>{t.kUhradeCelkem}</Text>
                <Text style={styles.paymentAmount}>
                  {fmt(totalWithVat)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Footer ── */}
        <View style={styles.footerSection}>
          <View style={styles.footerDivider} />
          <View style={styles.footerInner}>
            <View>
              <Text style={styles.footerContactTitle}>{t.kontaktniUdaje}</Text>
              {sup.email && <Text style={styles.footerContactLine}>{sup.email}</Text>}
              {sup.phone && <Text style={styles.footerContactLine}>{sup.phone}</Text>}
              <Text style={styles.footerContactLine}>{sup.web ?? 'vhs.agency'}</Text>
            </View>
            <Text style={styles.footerBrand}>{sup.name}</Text>
          </View>
        </View>

      </Page>
    </Document>
  )
}
