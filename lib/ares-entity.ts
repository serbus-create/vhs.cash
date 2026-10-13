/**
 * Typ klienta z kódu právní formy ARES (pole pravniForma).
 * 100 až 110 = fyzická osoba podnikající (OSVČ), jiný platný kód = firma.
 */
export function entityTypeFromLegalForm(
  code: string | number | null | undefined,
): 'firma' | 'osvc' | null {
  if (code === null || code === undefined) return null
  const text = String(code).trim()
  if (!/^\d+$/.test(text)) return null
  const n = parseInt(text, 10)
  if (!Number.isFinite(n)) return null
  return n >= 100 && n <= 110 ? 'osvc' : 'firma'
}
