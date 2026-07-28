import { NextRequest, NextResponse } from 'next/server'
import { generateQrCodeUrl } from '@/lib/qr'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { number, total_with_vat, currency, variable_symbol, iban, swift, companyName } = await req.json()
    if (!iban) return NextResponse.json({ url: null })
    const url = await generateQrCodeUrl({ number, total_with_vat, currency, variable_symbol, iban, swift, companyName })
    return NextResponse.json({ url })
  } catch {
    return NextResponse.json({ url: null })
  }
}
