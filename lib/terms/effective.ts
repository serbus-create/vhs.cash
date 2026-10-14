// Efektivní hodnoty podmínek uložené při vytvoření odkazu (terms_values.terms_effective).
// Čistá logika bez závislostí. Klíč terms_effective šablona nepoužívá, takže se nevykresluje.

import { TERMS_DEFAULTS } from './defaults'

export interface EffectiveTerms {
  /** verze šablony, podle které se odkaz vytvořil; null u starších objednávek */
  version: string | null
  /** dny po splatnosti: upominka_1..4 a predani_dny */
  reminderDays: number[]
  fee1: number
  fee2: number
  feeTotal: number
  /** zákonná paušální náhrada v Kč */
  statutoryFee: number
  /** smluvní pokuta v % z dlužné částky za den prodlení */
  dailyPenaltyPercent: number
}

/** Český zápis čísla ("1 200", "0,1") na číslo; neplatný vstup vrací null. */
export function parseCzNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/[\s  ]/g, '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null
  return Number(cleaned)
}

function num(source: Record<string, unknown>, key: string): number {
  const parsed = parseCzNumber(source[key])
  if (parsed !== null) return parsed
  // neplatná hodnota = výchozí hodnota pole
  return parseCzNumber(TERMS_DEFAULTS[key]) ?? 0
}

function parseEffective(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function readEffectiveTerms(termsValues: Record<string, string> | null | undefined): EffectiveTerms {
  const effective = parseEffective(termsValues?.terms_effective)
  const source: Record<string, unknown> = effective ?? TERMS_DEFAULTS
  const rawVersion = effective?.terms_version ?? termsValues?.terms_version
  return {
    version: typeof rawVersion === 'string' && rawVersion.trim() ? rawVersion.trim() : null,
    reminderDays: ['upominka_1', 'upominka_2', 'upominka_3', 'upominka_4', 'predani_dny'].map((k) => num(source, k)),
    fee1: num(source, 'poplatek_1'),
    fee2: num(source, 'poplatek_2'),
    feeTotal: num(source, 'poplatek_celkem'),
    statutoryFee: num(source, 'zakonna_nahrada'),
    dailyPenaltyPercent: num(source, 'pokuta_prodleni'),
  }
}
