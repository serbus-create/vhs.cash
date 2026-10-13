// Pole objednávky podle podmínek spolupráce (kontakt, způsob ceny, sazba, záloha).
// Platí jen pro documents.type = 'objednavka'. Logika podmínek v lib/terms/ se nemění.

import type { TermsValues } from '@/lib/terms/defaults'

export type CenaRezim = 'pevna' | 'hodinova' | 'bez_ceny'

export interface OrderTermsState {
  contactName: string
  contactEmail: string
  cenaRezim: CenaRezim
  hodinovaSazba: string
  /** záloha v % (ve všech způsobech ceny) */
  zalohaProcent: string
  /** "Bez zálohy": ukládá se 0 %, zadané procento zůstane zachováno */
  bezZalohy: boolean
  /** uživatel zálohu (procenta nebo "Bez zálohy") ručně změnil */
  zalohaTouched: boolean
  odhadText: string
  /** termín plnění, volný text (výchozí 'dle dohody') */
  terminText: string
}

export const DEFAULT_TERMIN = 'dle dohody'
export const TERMIN_MAX = 200

export const isPriced = (r: CenaRezim): boolean => r === 'pevna'

export const initialOrderTerms = (): OrderTermsState => ({
  contactName: '',
  contactEmail: '',
  cenaRezim: 'pevna',
  hodinovaSazba: '',
  zalohaProcent: '40',
  bezZalohy: false,
  zalohaTouched: false,
  odhadText: '',
  terminText: DEFAULT_TERMIN,
})

const asRezim = (v: unknown): CenaRezim =>
  v === 'hodinova' || v === 'bez_ceny' ? v : 'pevna'

/** Předvyplnění z uloženého dokumentu; chybějící terms_values (starší objednávky) = pevná cena, záloha 40. */
export function parseOrderTerms(doc: {
  contact_name?: string | null
  contact_email?: string | null
  terms_values?: Record<string, string> | null
}): OrderTermsState {
  const tv = doc.terms_values ?? {}
  const cenaRezim = asRezim(tv.cena_rezim)
  return {
    contactName: doc.contact_name ?? '',
    contactEmail: doc.contact_email ?? '',
    cenaRezim,
    hodinovaSazba: tv.hodinova_sazba ?? '',
    zalohaProcent: tv.zaloha_objednavka_procent ?? '40',
    bezZalohy: tv.zaloha_objednavka_procent === '0',
    zalohaTouched: tv.zaloha_objednavka_procent !== undefined,
    odhadText: tv.odhad_text ?? '',
    terminText: tv.termin_text?.trim() || DEFAULT_TERMIN,
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** "900", "900 Kč", "1 200,50" -> číslo; neplatné = NaN */
const parseAmount = (s: string): number =>
  Number(s.replace(/[\s\u00A0\u202F]/g, '').replace(/kč$/i, '').replace(',', '.'))

/**
 * Validace polí. strict = vytvoření/vydání dokumentu (u hodinové sazby vyžaduje sazbu),
 * jinak koncept (sazba nepovinná, ale pokud je vyplněná, musí být platná).
 */
export function validateOrderTerms(s: OrderTermsState, strict: boolean): string | null {
  const email = s.contactEmail.trim()
  if (email && !EMAIL_RE.test(email)) return 'E-mail kontaktní osoby nemá platný formát'

  if (s.cenaRezim === 'hodinova') {
    const rate = s.hodinovaSazba.trim()
    if (!rate && strict) return 'Hodinová sazba je povinná'
    if (rate) {
      const n = parseAmount(rate)
      if (!Number.isFinite(n) || n <= 0) return 'Hodinová sazba musí být číslo větší než 0'
    }
  }

  if (s.terminText.trim().length > TERMIN_MAX) return `Termín může mít nejvýše ${TERMIN_MAX} znaků`

  if (!s.bezZalohy) {
    const dep = s.zalohaProcent.trim()
    if (!/^\d{1,3}$/.test(dep) || Number(dep) > 100) return 'Záloha musí být celé číslo od 0 do 100 %'
  }
  return null
}

/**
 * Hodnoty pro uložení. terms_values se slučuje s již uloženými klíči;
 * přepisují se jen naše čtyři klíče (prázdné se odstraní).
 */
export function buildOrderTermsPayload(s: OrderTermsState, existing: TermsValues | null | undefined) {
  const merged: TermsValues = { ...(existing ?? {}) }
  merged.cena_rezim = s.cenaRezim

  const rate = s.hodinovaSazba.trim()
  if (s.cenaRezim === 'hodinova' && rate) merged.hodinova_sazba = String(parseAmount(rate))
  else delete merged.hodinova_sazba

  merged.zaloha_objednavka_procent = s.bezZalohy ? '0' : String(Number(s.zalohaProcent.trim()))
  delete merged.zaloha_objednavka_castka

  const odhad = s.odhadText.trim()
  if (odhad && s.cenaRezim === 'hodinova') merged.odhad_text = odhad
  else delete merged.odhad_text

  merged.termin_text = s.terminText.trim().slice(0, TERMIN_MAX) || DEFAULT_TERMIN

  return {
    contact_name: s.contactName.trim() || null,
    contact_email: s.contactEmail.trim() || null,
    terms_values: merged,
  }
}

/** Text do sloupce částky v seznamu objednávek; null = zobrazit částku jako dnes. */
export function orderPriceLabel(doc: {
  type: string
  terms_values?: Record<string, string> | null
}): string | null {
  if (doc.type !== 'objednavka') return null
  const r = doc.terms_values?.cena_rezim
  if (r === 'hodinova') return 'Hodinová sazba'
  if (r === 'bez_ceny') return 'Bez ceny'
  return null
}

const PARTY_FIELD_LABELS: Record<string, string> = {
  name: 'název',
  address: 'adresa',
  ico: 'IČO',
  spisova_znacka: 'spisová značka',
  represented_by: 'zástupce firmy',
  entity_type: 'typ klienta (firma, OSVČ)',
}

/** Čitelný název chybějícího údaje z hlavičky X-Terms-Missing, např. "dodavatel.ico" -> "IČO dodavatele". */
export function missingLabel(key: string): string {
  if (key === 'hodinova_sazba') return 'hodinová sazba'
  if (key === 'klient.entity_type') return PARTY_FIELD_LABELS.entity_type
  const [party, field] = key.split('.')
  if ((party === 'dodavatel' || party === 'klient') && field) {
    const label = PARTY_FIELD_LABELS[field] ?? field
    const owner = party === 'dodavatel' ? 'dodavatele' : 'klienta'
    // "adresa klienta", "IČO dodavatele"; samotný "zástupce firmy" doplníme o stranu
    return field === 'represented_by' ? `${label} (${party === 'dodavatel' ? 'dodavatel' : 'klient'})` : `${label} ${owner}`
  }
  return key
}
