import React from 'react'
import { Image, StyleSheet, Text, View } from '@react-pdf/renderer'
import { LOGO_VHS } from './branding'

const ORANGE = '#F04E12'
const DARK = '#111111'

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    width: 250,
    padding: 8,
    borderWidth: 1.4,
    borderColor: ORANGE,
    borderRadius: 6,
  },
  logo: { width: 42, height: 42 },
  textCol: { marginLeft: 10, flexGrow: 1 },
  label: { fontFamily: 'DejaVu-Bold', fontSize: 8, color: ORANGE, letterSpacing: 0.5, marginBottom: 3 },
  main: { fontFamily: 'DejaVu-Bold', fontSize: 8.5, color: DARK, marginBottom: 1.5 },
  line: { fontSize: 7.5, color: '#444444', marginBottom: 1 },
  small: { fontSize: 6.5, color: '#888888', marginTop: 2 },
  pendingBox: {
    alignSelf: 'flex-start',
    width: 250,
    padding: 10,
    borderWidth: 1,
    borderColor: '#BBBBBB',
    borderStyle: 'dashed',
    borderRadius: 6,
  },
  pendingText: { fontSize: 8.5, color: '#777777' },
})

export interface StampData {
  /** jméno a funkce osoby, která potvrdila, například "Jan Vzorový, jednatel" */
  signer: string
  email: string
  confirmedAt: Date | string
  documentLabel: string
  /** první znaky otisku textu podmínek, kontrolní údaj */
  fingerprint?: string
}

function formatDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('cs-CZ', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Prague',
  }).format(date)
}

/** Razítko potvrzení. Bez dat se ukáže čárkovaný rámeček "Čeká na potvrzení". */
export default function ConfirmationStamp({ data }: { data?: StampData | null }) {
  if (!data) {
    return (
      <View style={styles.pendingBox}>
        <Text style={styles.pendingText}>Čeká na potvrzení klientem.</Text>
      </View>
    )
  }
  return (
    <View style={styles.box}>
      <Image src={LOGO_VHS} style={styles.logo} />
      <View style={styles.textCol}>
        <Text style={styles.label}>POTVRZENO ELEKTRONICKY</Text>
        <Text style={styles.main}>{data.signer}</Text>
        <Text style={styles.line}>{formatDateTime(data.confirmedAt)}</Text>
        <Text style={styles.line}>{data.email}</Text>
        <Text style={styles.line}>{data.documentLabel}</Text>
        {data.fingerprint ? (
          <Text style={styles.small}>Kontrolní otisk {data.fingerprint.slice(0, 8).toUpperCase()}</Text>
        ) : null}
      </View>
    </View>
  )
}
