import React from 'react'
import { Image, StyleSheet, Text, View } from '@react-pdf/renderer'
import { SIGNATURE_MILOS, SIGNATURE_PETR } from './branding'

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  company: { fontFamily: 'DejaVu-Bold', fontSize: 9, color: '#111111', marginBottom: 8 },
  row: { flexDirection: 'row' },
  signer: { width: 170, marginRight: 24 },
  imageBox: { height: 42, justifyContent: 'flex-end' },
  image: { height: 38, objectFit: 'contain', objectPositionX: 0 },
  line: { borderTopWidth: 0.7, borderTopColor: '#666666', marginTop: 2, paddingTop: 3 },
  name: { fontFamily: 'DejaVu-Bold', fontSize: 8.5, color: '#111111' },
  role: { fontSize: 7.5, color: '#555555' },
})

export interface Signer {
  name: string
  /** funkce pod jménem, například "jednatel"; u OSVČ se neuvádí */
  role?: string
  /** podpis jako data URI; bez něj se ukáže jen jméno a čára */
  image?: string
}

/** Podpisy podle jména osoby (malá písmena, bez ohledu na diakritiku se nehledá). */
const SIGNATURE_BY_PERSON: Record<string, string> = {
  'petr janošťák': SIGNATURE_PETR,
  'miloš serbus': SIGNATURE_MILOS,
}

const imageFor = (name: string): string | undefined => SIGNATURE_BY_PERSON[name.trim().toLowerCase()]

/** Jednatelé s.r.o., kteří podepisují za firmu. Každý jedná samostatně, na dokumentu jsou oba. */
const JEDNATELE_BY_COMPANY: Record<string, string[]> = {
  'goodveritas s.r.o.': ['Petr Janošťák', 'Miloš Serbus'],
}

export interface SupplierForSignatures {
  name: string
  /** company_profiles.profile_type */
  profile_type?: string | null
}

/**
 * Kdo podepisuje za dodavatele:
 * - s.r.o.: jednatelé z přehledu výše (neznámá firma = žádný podpis, jen jméno firmy),
 * - OSVČ: jen sám podnikatel, bez funkce.
 */
export function signersForSupplier(supplier: SupplierForSignatures): Signer[] {
  const type = (supplier.profile_type ?? '').toLowerCase()
  if (type === 'sro') {
    const names = JEDNATELE_BY_COMPANY[supplier.name.trim().toLowerCase()] ?? []
    return names.map((name) => ({ name, role: 'jednatel', image: imageFor(name) }))
  }
  return [{ name: supplier.name, image: imageFor(supplier.name) }]
}

export default function SupplierSignatures({ supplier }: { supplier: SupplierForSignatures }) {
  const signers = signersForSupplier(supplier)
  return (
    <View style={styles.wrap} wrap={false}>
      <Text style={styles.company}>Za dodavatele: {supplier.name}</Text>
      {signers.length > 0 && (
        <View style={styles.row}>
          {signers.map((s) => (
            <View key={s.name} style={styles.signer}>
              <View style={styles.imageBox}>{s.image ? <Image src={s.image} style={styles.image} /> : null}</View>
              <View style={styles.line}>
                <Text style={styles.name}>{s.name}</Text>
                {s.role ? <Text style={styles.role}>{s.role}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
