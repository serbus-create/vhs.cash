import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: { ico: string } }
) {
  const ico = params.ico.trim()

  if (!/^\d{8}$/.test(ico)) {
    return NextResponse.json({ error: 'IČO musí mít 8 číslic' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`,
      {
        headers: { Accept: 'application/json' },
        // no caching — always fresh
        cache: 'no-store',
      }
    )

    if (res.status === 404) {
      return NextResponse.json({ error: 'Subjekt nenalezen' }, { status: 404 })
    }

    if (!res.ok) {
      return NextResponse.json({ error: 'Chyba ARES API' }, { status: 502 })
    }

    const data = await res.json()

    const sidlo = data.sidlo ?? {}
    const streetParts = [
      sidlo.nazevUlice,
      [sidlo.cisloDomovni, sidlo.cisloOrientacni].filter(Boolean).join('/'),
    ].filter(Boolean)

    // `dic` is present in the same ARES response when the subject is a VAT payer
    const dic: string | null = data.dic ?? null

    return NextResponse.json({
      name: data.obchodniJmeno ?? '',
      ico: data.ico ?? ico,
      dic,
      is_vat_payer: dic !== null,
      address: streetParts.join(' ') || sidlo.textovaAdresa || '',
      city: sidlo.nazevObce ?? '',
      zip: sidlo.psc ? String(sidlo.psc) : '',
    })
  } catch (err) {
    return NextResponse.json({ error: 'Chyba při dotazu na ARES' }, { status: 500 })
  }
}
