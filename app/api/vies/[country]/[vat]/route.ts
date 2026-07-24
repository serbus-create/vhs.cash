import { NextResponse } from 'next/server'

const SUPPORTED = new Set(['AT', 'SK', 'PL', 'DE'])

export async function GET(
  _req: Request,
  { params }: { params: { country: string; vat: string } }
) {
  const country = params.country.toUpperCase()
  const vatRaw = params.vat.trim().toUpperCase()

  if (!SUPPORTED.has(country)) {
    return NextResponse.json({ error: 'Unsupported country' }, { status: 400 })
  }

  // Strip country prefix if the user included it (e.g. "ATU12345678" → "U12345678")
  const vatForApi = vatRaw.startsWith(country) ? vatRaw.slice(country.length) : vatRaw

  if (!vatForApi) {
    return NextResponse.json({ error: 'Prázdné VAT ID' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${country}/vat/${vatForApi}`,
      { headers: { Accept: 'application/json' }, cache: 'no-store' }
    )

    if (res.status === 404) {
      return NextResponse.json({ error: 'Subjekt nenalezen ve VIES' }, { status: 404 })
    }

    if (!res.ok) {
      return NextResponse.json({ error: 'Chyba VIES API' }, { status: 502 })
    }

    const data = await res.json()

    if (!data.isValid) {
      return NextResponse.json({ error: 'Neplatné VAT ID' }, { status: 404 })
    }

    // Parse address — VIES returns a newline-delimited string
    const lines = (data.address ?? '').split('\n').map((l: string) => l.trim()).filter(Boolean)
    const street = lines[0] ?? ''
    const cityLine = lines[1] ?? ''
    const zipCityMatch = cityLine.match(/^(\d{4,6})\s+(.+)$/)
    const zip = zipCityMatch ? zipCityMatch[1] : ''
    const city = zipCityMatch ? zipCityMatch[2] : cityLine

    const fullVat = country + vatForApi

    return NextResponse.json({
      name: data.name ?? '',
      ico: fullVat,
      dic: fullVat,
      is_vat_payer: true,
      address: street,
      city,
      zip,
    })
  } catch {
    return NextResponse.json({ error: 'Chyba při dotazu na VIES' }, { status: 500 })
  }
}
