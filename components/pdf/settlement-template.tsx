import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { Client, CompanyProfile } from '@/lib/types'
import { formatZip } from '@/lib/terms/parties'
import { FEE_TITLES, isFeeKind, type FeeKind } from '@/lib/reminders/fees'

// Vyúčtování smluvní pokuty nebo paušální náhrady: stejný vizuální styl jako faktura, bez položek, DPH a DUZP.

const ORANGE = '#F04E12'
const DARK = '#111111'

const styles = StyleSheet.create({
  page: { fontFamily: 'DejaVu', fontSize: 9, color: '#333333', backgroundColor: '#FFFFFF', paddingBottom: 40 },
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
  logoBox: { width: 44, height: 44, backgroundColor: ORANGE, borderRadius: 4, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  logoText: { fontFamily: 'DejaVu-Bold', color: '#FFFFFF', fontSize: 13 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerCompany: { fontFamily: 'DejaVu-Bold', color: '#FFFFFF', fontSize: 11 },
  headerRight: { alignItems: 'flex-end', maxWidth: 330 },
  docTitle: { fontFamily: 'DejaVu-Bold', color: '#FFFFFF', fontSize: 15, marginBottom: 8, textAlign: 'right' },
  metaRow: { flexDirection: 'row', gap: 8, marginBottom: 3 },
  metaLabel: { color: '#888888', fontSize: 8, textAlign: 'right', width: 90 },
  metaValue: { fontFamily: 'DejaVu-Bold', color: '#FFFFFF', fontSize: 8, textAlign: 'right', minWidth: 90 },
  parties: { flexDirection: 'row', marginBottom: 24 },
  partySupplier: { flex: 1, backgroundColor: '#FFF3EF', borderLeftWidth: 3, borderLeftColor: ORANGE, padding: 20, paddingLeft: 29 },
  partyClient: { flex: 1, backgroundColor: '#F6F6F6', borderLeftWidth: 3, borderLeftColor: ORANGE, padding: 20, paddingLeft: 29 },
  partyTitle: { fontFamily: 'DejaVu-Bold', fontSize: 7, color: ORANGE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  partyName: { fontFamily: 'DejaVu-Bold', fontSize: 10, color: DARK, marginBottom: 4 },
  partyLine: { fontSize: 8, color: '#555555', marginBottom: 2 },
  section: { paddingHorizontal: 32, marginBottom: 14 },
  sectionTitle: { fontFamily: 'DejaVu-Bold', fontSize: 7, color: ORANGE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  bodyStrong: { fontFamily: 'DejaVu-Bold', fontSize: 10, color: DARK, marginBottom: 6 },
  bodyText: { fontSize: 8.5, color: '#333333', lineHeight: 1.5, marginBottom: 4 },
  calcBox: { backgroundColor: '#F6F6F6', borderLeftWidth: 3, borderLeftColor: ORANGE, padding: 10, marginTop: 4 },
  paymentSection: { paddingHorizontal: 32, marginTop: 10 },
  paymentBox: { flexDirection: 'row', borderWidth: 1.5, borderColor: ORANGE, borderRadius: 4, padding: 16 },
  paymentLeft: { flex: 1 },
  paymentRight: { alignItems: 'flex-end', justifyContent: 'center', paddingLeft: 16, borderLeftWidth: 1, borderLeftColor: '#EEEEEE' },
  paymentTitle: { fontFamily: 'DejaVu-Bold', fontSize: 7, color: ORANGE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  paymentLine: { fontSize: 8, color: '#444444', marginBottom: 3 },
  paymentKey: { color: '#888888' },
  paymentAmountLabel: { fontSize: 8, color: '#888888', marginBottom: 4 },
  paymentAmount: { fontFamily: 'DejaVu-Bold', fontSize: 18, color: DARK },
  paymentQr: { width: 96, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderLeftWidth: 1, borderLeftColor: '#EEEEEE' },
  qrImage: { width: 72, height: 72 },
  qrLabel: { fontSize: 7, color: '#AAAAAA', textAlign: 'center', marginTop: 4 },
  noteText: { fontSize: 8, color: '#777777', lineHeight: 1.5, paddingHorizontal: 32, marginTop: 14 },
  footerSection: { paddingHorizontal: 32, marginTop: 20 },
  footerDivider: { borderTopWidth: 1, borderTopColor: '#EEEEEE', marginBottom: 8 },
  footerInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  footerContactTitle: { fontFamily: 'DejaVu-Bold', fontSize: 7, color: ORANGE, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  footerContactLine: { fontSize: 7, color: '#888888', marginBottom: 2 },
  footerBrand: { fontSize: 7, color: '#CCCCCC', textAlign: 'right', marginTop: 2 },
})

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}.${m}.${y}`
}
const fmtKc = (n: number) =>
  new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
const fmtPlain = (n: number) =>
  new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n)

export interface SettlementTemplateProps {
  doc: {
    number: string
    issue_date: string | null
    due_date: string | null
    total_with_vat: number | null
    fee_kind: string | null
    variable_symbol: string | null
    terms_values: Record<string, string> | null
  }
  client: Client | null
  companyProfile: CompanyProfile | null
  /** faktura, ke které se vyúčtování vztahuje */
  invoice: { number: string; due_date: string | null } | null
  /** potvrzená objednávka s podmínkami */
  order: { number: string; confirmedDate: string | null; termsVersion: string | null } | null
  qrCodeUrl: string | null
}

export default function SettlementTemplate({ doc, client, companyProfile, invoice, order, qrCodeUrl }: SettlementTemplateProps) {
  const kind: FeeKind = isFeeKind(doc.fee_kind) ? doc.fee_kind : 'pokuta'
  const title = FEE_TITLES[kind]
  const amount = doc.total_with_vat ?? 0
  const tv = doc.terms_values ?? {}
  const vs = tv.vs ?? doc.variable_symbol ?? null
  const paragraph = tv.paragraph ?? (kind === 'pausal' ? '6.3' : kind === 'denni' ? '6.4' : '6.2')

  const supplierName = companyProfile?.name ?? '—'
  const supplierCityZip = [formatZip(companyProfile?.zip), companyProfile?.city].filter(Boolean).join(' ')
  const clientCityZip = [formatZip(client?.zip), client?.city].filter(Boolean).join(' ')

  const base = Number(tv.base)
  const days = Number(tv.days)
  const rate = Number(tv.rate)
  const dayFrom = tv.day_from ?? '22'
  const dayTo = tv.day_to ?? '30'

  const termsLine = order
    ? `Podle podmínek spolupráce${order.termsVersion ? ` v${order.termsVersion}` : ''} potvrzených v objednávce č. ${order.number}${order.confirmedDate ? ` dne ${order.confirmedDate}` : ''}, čl. ${paragraph}.`
    : `Podle podmínek spolupráce, čl. ${paragraph}.`

  return (
    <Document title={`${title} ${doc.number}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>vhs.</Text>
            </View>
            <Text style={styles.headerCompany}>{supplierName}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.docTitle}>{title}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Číslo:</Text>
              <Text style={styles.metaValue}>{doc.number}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Datum vystavení:</Text>
              <Text style={styles.metaValue}>{fmtDate(doc.issue_date)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Datum splatnosti:</Text>
              <Text style={styles.metaValue}>{fmtDate(doc.due_date)}</Text>
            </View>
            {vs && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Var. symbol:</Text>
                <Text style={styles.metaValue}>{vs}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.parties}>
          <View style={styles.partySupplier}>
            <Text style={styles.partyTitle}>Dodavatel</Text>
            <Text style={styles.partyName}>{supplierName}</Text>
            {companyProfile?.address && <Text style={styles.partyLine}>{companyProfile.address}</Text>}
            {supplierCityZip ? <Text style={styles.partyLine}>{supplierCityZip}</Text> : null}
            {companyProfile?.ico && <Text style={[styles.partyLine, { marginTop: 6 }]}>IČO: {companyProfile.ico}</Text>}
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
              </>
            ) : (
              <Text style={styles.partyLine}>—</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Předmět vyúčtování</Text>
          <Text style={styles.bodyStrong}>
            K faktuře č. {invoice?.number ?? '—'}
            {invoice?.due_date ? ` (splatnost ${fmtDate(invoice.due_date)})` : ''}
          </Text>
          <Text style={styles.bodyText}>{termsLine}</Text>
          {kind === 'pausal' && (
            <Text style={styles.bodyText}>Zákonná paušální náhrada nákladů spojených s uplatněním pohledávky podle § 3 nařízení vlády č. 351/2013 Sb.</Text>
          )}
          {kind === 'denni' && Number.isFinite(base) && Number.isFinite(days) && Number.isFinite(rate) && (
            <View style={styles.calcBox}>
              <Text style={styles.bodyText}>
                {new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 3 }).format(rate)} % z dlužné částky {fmtPlain(base)} Kč za {days} dnů (od {dayFrom}. do {dayTo}. dne po splatnosti) = {fmtPlain(amount)} Kč
              </Text>
            </View>
          )}
        </View>

        <View style={styles.paymentSection}>
          <View style={styles.paymentBox}>
            <View style={styles.paymentLeft}>
              <Text style={styles.paymentTitle}>Platební údaje</Text>
              {companyProfile?.bank_account && (
                <Text style={styles.paymentLine}>
                  <Text style={styles.paymentKey}>Číslo účtu: </Text>
                  {companyProfile.bank_account}
                </Text>
              )}
              {companyProfile?.iban && (
                <Text style={styles.paymentLine}>
                  <Text style={styles.paymentKey}>IBAN: </Text>
                  {companyProfile.iban}
                </Text>
              )}
              {companyProfile?.swift && (
                <Text style={styles.paymentLine}>
                  <Text style={styles.paymentKey}>SWIFT: </Text>
                  {companyProfile.swift}
                </Text>
              )}
              {vs && (
                <Text style={styles.paymentLine}>
                  <Text style={styles.paymentKey}>Variabilní symbol: </Text>
                  {vs}
                </Text>
              )}
              <Text style={styles.paymentLine}>
                <Text style={styles.paymentKey}>Splatnost: </Text>
                {fmtDate(doc.due_date)}
              </Text>
            </View>
            {qrCodeUrl && (
              <View style={styles.paymentQr}>
                <Image src={qrCodeUrl} style={styles.qrImage} />
                <Text style={styles.qrLabel}>QR platba</Text>
              </View>
            )}
            <View style={styles.paymentRight}>
              <Text style={styles.paymentAmountLabel}>Částka k úhradě</Text>
              <Text style={styles.paymentAmount}>{fmtKc(amount)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.noteText}>Tento doklad není fakturou ani daňovým dokladem.</Text>

        <View style={styles.footerSection}>
          <View style={styles.footerDivider} />
          <View style={styles.footerInner}>
            <View>
              <Text style={styles.footerContactTitle}>Kontaktní údaje</Text>
              {companyProfile?.email && <Text style={styles.footerContactLine}>{companyProfile.email}</Text>}
              {companyProfile?.phone && <Text style={styles.footerContactLine}>{companyProfile.phone}</Text>}
              <Text style={styles.footerContactLine}>{companyProfile?.web ?? 'vhs.agency'}</Text>
            </View>
            <Text style={styles.footerBrand}>{supplierName}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
