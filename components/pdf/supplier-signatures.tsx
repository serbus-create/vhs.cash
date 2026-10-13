import React from 'react'
import { Image, StyleSheet, Text, View } from '@react-pdf/renderer'
import { LOGO_VHS, SIGNATURE_MILOS, SIGNATURE_PETR } from './branding'

const ORANGE = '#F04E12'

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  company: { fontFamily: 'DejaVu-Bold', fontSize: 9, color: '#111111', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    width: 245,
    padding: 10,
    marginRight: 12,
    marginBottom: 8,
    borderWidth: 1.2,
    borderColor: ORANGE,
    borderRadius: 6,
  },
  logo: { position: 'absolute', top: 8, right: 8, width: 26, height: 26 },
  imageBox: { height: 42, justifyContent: 'flex-end' },
  image: { height: 38, objectFit: 'contain', objectPositionX: 0 },
  line: { borderTopWidth: 0.7, borderTopColor: '#666666', marginTop: 2, paddingTop: 3 },
  name: { fontFamily: 'DejaVu-Bold', fontSize: 8.5, color: '#111111' },
  role: { fontSize: 7.5, color: '#555555' },
  contact: { fontSize: 7.5, color: '#444444', marginTop: 1 },
})

export interface Signer {
  name: string
  /** funkce pod jménem, například "jednatel"; u OSVČ se neuvádí */
  role?: string
  /** podpis jako data URI; bez něj se ukáže jen jméno a čára */
  image?: string
  email?: string
  phone?: string
}

/** Podpisy a kontakty podle jména osoby (malá písmena). */
// Jedna značka, jeden společný e-mail; telefon je osobní.
const SUPPLIER_EMAIL = 'info@v-h-s.cz'

const PEOPLE: Record<string, { image: string; phone: string }> = {
  'petr janošťák': { image: SIGNATURE_PETR, phone: '+420 723 433 405' },
  'miloš serbus': { image: SIGNATURE_MILOS, phone: '+420 725 468 614' },
}

const personFor = (name: string) => PEOPLE[name.trim().toLowerCase()]

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
  const make = (name: string, role?: string): Signer => {
    const p = personFor(name)
    return { name, role, image: p?.image, email: SUPPLIER_EMAIL, phone: p?.phone }
  }
  const type = (supplier.profile_type ?? '').toLowerCase()
  if (type === 'sro') {
    const names = JEDNATELE_BY_COMPANY[supplier.name.trim().toLowerCase()] ?? []
    return names.map((name) => make(name, 'jednatel'))
  }
  return [make(supplier.name)]
}

export default function SupplierSignatures({ supplier }: { supplier: SupplierForSignatures }) {
  const signers = signersForSupplier(supplier)
  return (
    <View style={styles.wrap} wrap={false}>
      <Text style={styles.company}>Za dodavatele: {supplier.name}</Text>
      {signers.length > 0 && (
        <View style={styles.row}>
          {signers.map((s) => (
            <View key={s.name} style={styles.card} wrap={false}>
              <Image src={LOGO_VHS} style={styles.logo} />
              <View style={styles.imageBox}>{s.image ? <Image src={s.image} style={styles.image} /> : null}</View>
              <View style={styles.line}>
                <Text style={styles.name}>{s.name}</Text>
                {s.role ? <Text style={styles.role}>{s.role}</Text> : null}
                {s.email ? <Text style={styles.contact}>{s.email}</Text> : null}
                {s.phone ? <Text style={styles.contact}>{s.phone}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
