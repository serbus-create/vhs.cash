import React from 'react'
import { Image, StyleSheet, Text, View } from '@react-pdf/renderer'
import { LOGO_VHS, SIGNATURE_MILOS, SIGNATURE_PETR } from './branding'

const ORANGE = '#F04E12'

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  company: { fontFamily: 'DejaVu-Bold', fontSize: 9, color: '#111111', marginBottom: 8 },
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    padding: 10,
    borderWidth: 1.2,
    borderColor: ORANGE,
    borderRadius: 6,
  },
  logo: { width: 40, height: 40, marginRight: 14, marginTop: 2 },
  signer: { width: 190 },
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
const PEOPLE: Record<string, { image: string; email: string; phone: string }> = {
  'petr janošťák': { image: SIGNATURE_PETR, email: 'janostak@v-h-s.cz', phone: '+420 723 433 405' },
  'miloš serbus': { image: SIGNATURE_MILOS, email: 'serbus@v-h-s.cz', phone: '+420 725 468 614' },
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
    return { name, role, image: p?.image, email: p?.email, phone: p?.phone }
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
        <View style={styles.box}>
          <Image src={LOGO_VHS} style={styles.logo} />
          {signers.map((s, i) => (
            <View key={s.name} style={[styles.signer, i < signers.length - 1 ? { marginRight: 18 } : {}]}>
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
