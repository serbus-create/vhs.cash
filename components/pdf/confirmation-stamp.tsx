import React from 'react'
import { StyleSheet, Text, View } from '@react-pdf/renderer'

// Potvrzení klienta: modrofialový "úřední" rámeček bez loga (logo vhs. patří dodavateli).
const INDIGO = '#3F3A8F'
const INDIGO_BG = '#F6F6FC'

const styles = StyleSheet.create({
  box: {
    alignSelf: 'flex-start',
    width: 250,
    padding: 10,
    borderWidth: 1.4,
    borderColor: INDIGO,
    borderRadius: 6,
    backgroundColor: INDIGO_BG,
  },
  label: { fontFamily: 'DejaVu-Bold', fontSize: 8, color: INDIGO, letterSpacing: 0.5, marginBottom: 4 },
  main: { fontFamily: 'DejaVu-Bold', fontSize: 8.5, color: '#111111', marginBottom: 2 },
  line: { fontSize: 7.5, color: '#444444', marginBottom: 1 },
  small: { fontSize: 6.5, color: '#777777', marginTop: 3 },
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

/** Potvrzení klienta. Bez dat se ukáže čárkovaný rámeček "Čeká na potvrzení klientem". */
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
      <Text style={styles.label}>POTVRZENO ELEKTRONICKY</Text>
      <Text style={styles.main}>{data.signer}</Text>
      <Text style={styles.line}>{formatDateTime(data.confirmedAt)}</Text>
      <Text style={styles.line}>{data.email}</Text>
      <Text style={styles.line}>{data.documentLabel}</Text>
      {data.fingerprint ? (
        <Text style={styles.small}>Kontrolní otisk {data.fingerprint.slice(0, 8).toUpperCase()}</Text>
      ) : null}
    </View>
  )
}
