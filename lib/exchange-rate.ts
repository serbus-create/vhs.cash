const cache = new Map<string, number>()

function toCnbDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${d}.${m}.${y}`
}

function prevDay(isoDate: string): string {
  const date = new Date(isoDate)
  date.setDate(date.getDate() - 1)
  return date.toISOString().split('T')[0]
}

async function fetchRateForDate(isoDate: string): Promise<number | null> {
  const url =
    `https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt?date=${toCnbDate(isoDate)}`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const text = await res.text()
    for (const line of text.split('\n')) {
      const parts = line.split('|')
      if (parts.length < 5 || parts[3].trim() !== 'EUR') continue
      const amount = parseFloat(parts[2].replace(',', '.'))
      const rate = parseFloat(parts[4].replace(',', '.'))
      if (!isNaN(amount) && !isNaN(rate) && amount > 0) return rate / amount
    }
    return null
  } catch {
    return null
  }
}

/**
 * Vrátí kurz EUR/CZK pro zadané datum (formát YYYY-MM-DD).
 * Pokud ČNB pro daný den nemá data (víkend/svátek), zkouší až 7 předchozích dní.
 * Výsledky jsou cachované in-memory po dobu životnosti procesu.
 */
export async function getEurCzkRate(
  isoDate: string,
): Promise<{ rate: number; date: string }> {
  let current = isoDate
  for (let i = 0; i < 7; i++) {
    const cached = cache.get(current)
    if (cached !== undefined) return { rate: cached, date: current }
    const rate = await fetchRateForDate(current)
    if (rate !== null) {
      cache.set(current, rate)
      return { rate, date: current }
    }
    current = prevDay(current)
  }
  throw new Error(
    `Nepodařilo se načíst kurz EUR/CZK pro datum ${isoDate} ani pro předchozích 7 dní`,
  )
}
