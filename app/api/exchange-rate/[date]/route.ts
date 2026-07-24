import { NextResponse } from 'next/server'
import { getEurCzkRate } from '@/lib/exchange-rate'

export async function GET(
  _req: Request,
  { params }: { params: { date: string } },
) {
  const { date } = params
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'Neplatný formát data (očekáváno YYYY-MM-DD)' },
      { status: 400 },
    )
  }
  try {
    const result = await getEurCzkRate(date)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}
