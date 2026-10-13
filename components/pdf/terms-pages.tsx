import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { RenderResult } from '@/lib/terms/render'
import { MISSING_PLACEHOLDER } from '@/lib/terms/render'
import { TERMS_TEMPLATE_VERSION } from '@/lib/terms/template'

const ORANGE = '#F04E12'
const DARK = '#111111'

export interface TermsConfirmation {
  name: string
  email: string
  confirmedAt: Date | string
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'DejaVu',
    fontSize: 9,
    color: '#333333',
    backgroundColor: '#FFFFFF',
    paddingTop: 40,
    paddingHorizontal: 40,
    paddingBottom: 70,
  },
  title: {
    fontFamily: 'DejaVu-Bold',
    fontSize: 18,
    color: DARK,
    borderLeftWidth: 3,
    borderLeftColor: ORANGE,
    paddingLeft: 10,
  },
  version: { fontSize: 9, color: '#666666', marginTop: 4, marginBottom: 14, paddingLeft: 13 },
  articleHeading: {
    fontFamily: 'DejaVu-Bold',
    fontSize: 11,
    color: DARK,
    marginTop: 12,
    marginBottom: 5,
  },
  clause: { lineHeight: 1.4, marginBottom: 4 },
  bold: { fontFamily: 'DejaVu-Bold' },
  missing: { fontFamily: 'DejaVu-Bold', color: '#B91C1C' },
  confirmBox: {
    marginTop: 18,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#CCCCCC',
  },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#666666',
    borderTopWidth: 0.5,
    borderTopColor: '#CCCCCC',
    paddingTop: 6,
  },
})

function formatDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('cs-CZ', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Prague',
  }).format(date)
}

// Text ustanovení; [DOPLNIT] je tučně a červeně, aby se při kontrole nepřehlédlo.
function ClauseText({ text }: { text: string }) {
  const parts = text.split(MISSING_PLACEHOLDER)
  return (
    <>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Text style={styles.missing}>{MISSING_PLACEHOLDER}</Text>}
          {part}
        </React.Fragment>
      ))}
    </>
  )
}

export default function TermsPages({
  result,
  confirmation,
}: {
  result: RenderResult
  confirmation?: TermsConfirmation | null
}) {
  const footerLabel = `Podmínky spolupráce, verze ${TERMS_TEMPLATE_VERSION}`
  return (
    <Document title={result.title}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{result.title}</Text>
        <Text style={styles.version}>Verze {TERMS_TEMPLATE_VERSION}</Text>

        {result.articles.map((article) => {
          const [first, ...rest] = article.clauses
          return (
            <View key={article.number}>
              {/* nadpis článku zůstává vždy spolu s prvním ustanovením */}
              <View wrap={false}>
                <Text style={styles.articleHeading}>
                  {article.number}. {article.title}
                </Text>
                {first && (
                  <Text style={styles.clause}>
                    <Text style={styles.bold}>{first.id}</Text> <ClauseText text={first.text} />
                  </Text>
                )}
              </View>
              {rest.map((clause) => (
                <Text key={clause.id} style={styles.clause}>
                  <Text style={styles.bold}>{clause.id}</Text> <ClauseText text={clause.text} />
                </Text>
              ))}
            </View>
          )
        })}

        <View style={styles.confirmBox} wrap={false}>
          <Text style={styles.articleHeading}>Potvrzení klientem</Text>
          {confirmation ? (
            <Text style={styles.clause}>
              Potvrzeno elektronicky: {confirmation.name}, {confirmation.email},{' '}
              {formatDateTime(confirmation.confirmedAt)}.
            </Text>
          ) : (
            <Text style={styles.clause}>Čeká na potvrzení klientem.</Text>
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text>{footerLabel}</Text>
          <Text render={({ pageNumber, totalPages }) => `Strana ${pageNumber} z ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
