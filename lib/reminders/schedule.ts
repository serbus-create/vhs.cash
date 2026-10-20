// Harmonogram upomínek: čistá logika bez závislostí.
// Datumy jsou řetězce 'YYYY-MM-DD' a počítá se v kalendářních dnech (UTC aritmetika nad čistým datem),
// takže výsledek nezávisí na časové zóně prohlížeče ani serveru ani na přechodu letního času.

/** Dny po splatnosti, ve kterých vzniká upomínka. */
export const MILESTONES = [1, 8, 15, 22, 30] as const
export type Milestone = (typeof MILESTONES)[number]

const MS_PER_DAY = 86_400_000

function dayNumber(dateStr: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr)
  if (!m) throw new Error(`Neplatné datum: ${dateStr}`)
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / MS_PER_DAY
}

/** Přičte n kalendářních dnů k datu 'YYYY-MM-DD'. */
export function addDays(dateStr: string, n: number): string {
  return new Date((dayNumber(dateStr) + n) * MS_PER_DAY).toISOString().slice(0, 10)
}

/** Počet kalendářních dnů od a do b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round(dayNumber(b) - dayNumber(a))
}

/** Dnešní datum v Europe/Prague jako 'YYYY-MM-DD'. */
export function todayPrague(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(now)
}

/** Milníky, jejichž termín (splatnost + n dní) nastal dnes nebo dřív. */
export function dueMilestones(dueDate: string, today: string): Milestone[] {
  return MILESTONES.filter((m) => addDays(dueDate, m) <= today)
}
