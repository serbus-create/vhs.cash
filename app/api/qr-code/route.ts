import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'

export const runtime = 'nodejs'

// Public endpoint — no auth needed; called by email clients loading the QR image.
// Accepts payment params directly in query string (same data already visible in email body).
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const iban = searchParams.get('iban')
  const amount = searchParams.get('amount')
  const currency = searchParams.get('currency') ?? 'CZK'
  const number = searchParams.get('number') ?? ''
  const vs = searchParams.get('vs') ?? ''
  const swift = searchParams.get('swift') ?? ''
  const name = searchParams.get('name') ?? ''

  if (!iban || !amount) {
    return new NextResponse('Missing required params', { status: 400 })
  }

  try {
    const ibanClean = iban.replace(/\s/g, '')
    const amountFixed = parseFloat(amount).toFixed(2)

    let payload: string
    if (currency === 'EUR') {
      const bic = swift.replace(/\s/g, '')
      payload = [
        'BCD', '002', '1', 'SCT',
        bic, name.slice(0, 70), ibanClean,
        `EUR${amountFixed}`, '', '',
        number, '',
      ].join('\n')
    } else {
      payload = [
        'SPD*1.0',
        `ACC:${ibanClean}`,
        `AM:${amountFixed}`,
        `CC:${currency}`,
        `MSG:${number}`,
        vs ? `X-VS:${vs}` : '',
      ].filter(Boolean).join('*')
    }

    const pngBuffer = await QRCode.toBuffer(payload, {
      width: 160, margin: 1,
      color: { dark: '#111111', light: '#FFFFFF' },
    })

    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (err) {
    console.error('[qr-code] generation error:', err)
    return new NextResponse('QR generation failed', { status: 500 })
  }
}
