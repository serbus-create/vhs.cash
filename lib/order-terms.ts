// Pole objednávky podle podmínek spolupráce (kontakt, způsob ceny, sazba, záloha).
// Platí jen pro documents.type = 'objednavka'. Logika podmínek v lib/terms/ se nemění.

import type { TermsValues } from '@/lib/terms/defaults'

export type CenaRezim = 'pevna' | 'hodinova' | 'bez_ceny'

export interface OrderTermsState {
  contactName: string
  contactEmail: string
  cenaRezim: CenaRezim
  hodinovaSazba: string
  zaloha: string
  /** true, pokud uživatel zálohu ručně změnil (pak se při změně způsobu ceny nepřepisuje) */
  zalohaEdited: boolean
  odhadText: string
}

export const DEFAULT_DEPOSIT_FIXED = 40

export const defaultDeposit = (r: CenaRezim): number => (r === 'pevna' ? DEFAULT_DEPOSIT_FIXED : 0)

export const isPriced = (r: CenaRezim): boolean => r === 'pevna'

export const initialOrderTerms = (): OrderTermsState => ({
  contactName: '',
  contactEmail: '',
  cenaRezim: 'pevna',
  hodinovaSazba: '',
  zaloha: String(DEFAULT_DEPOSIT_FIXED),
  zalohaEdited: false,
  odhadText: '',
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
  const storedDeposit = tv.zaloha_objednavka_procent
  return {
    contactName: doc.contact_name ?? '',
    contactEmail: doc.contact_email ?? '',
    cenaRezim,
    hodinovaSazba: tv.hodinova_sazba ?? '',
    zaloha: storedDeposit ?? String(defaultDeposit(cenaRezim)),
    zalohaEdited: storedDeposit !== undefined && storedDeposit !== String(defaultDeposit(cenaRezim)),
    odhadText: tv.odhad_text ?? '',
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** "900", "900 Kč", "1 200,50" -> číslo; neplatné = NaN */
const parseRate = (s: string): number =>
  Number(s.replace(/[\s  ]/g, '').replace(/kč$/i, '').replace(',', '.'))

/**
 * Validace polí. strict = vytvoření/vydání dokumentu (vyžaduje hodinovou sazbu),
 * jinak koncept (sazba nepovinná, ale pokud je vyplněná, musí být platná).
 */
export function validateOrderTerms(s: OrderTermsState, strict: boolean): string | null {
  const email = s.contactEmail.trim()
  if (email && !EMAIL_RE.test(email)) return 'E-mail kontaktní osoby nemá platný formát'

  const rate = s.hodinovaSazba.trim()
  if (!rate && strict) return 'Hodinová sazba je povinná (použije se v čl. 2.3 podmínek)'
  if (rate) {
    const n = parseRate(rate)
    if (!Number.isFinite(n) || n <= 0) return 'Hodinová sazba musí být číslo větší než 0'
  }

  const dep = s.zaloha.trim()
  if (!/^\d{1,3}$/.test(dep) || Number(dep) > 100) return 'Záloha musí být celé číslo od 0 do 100'
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
  if (rate) merged.hodinova_sazba = String(parseRate(rate))
  else delete merged.hodinova_sazba

  merged.zaloha_objednavka_procent = String(Number(s.zaloha.trim()))

  const odhad = s.odhadText.trim()
  if (odhad && !isPriced(s.cenaRezim)) merged.odhad_text = odhad
  else delete merged.odhad_text

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
