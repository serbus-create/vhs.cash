import QRCode from 'qrcode'

export async function generateQrCodeUrl(params: {
  number: string
  total_with_vat: number
  currency: string
  variable_symbol?: string | null
  iban: string
  swift?: string | null
  companyName: string
}): Promise<string | null> {
  try {
    const { number, total_with_vat, currency, variable_symbol, iban, swift, companyName } = params
    const ibanClean = iban.replace(/\s/g, '')
    const amount = (total_with_vat ?? 0).toFixed(2)

    let payload: string
    if (currency === 'EUR') {
      const bic = (swift ?? '').replace(/\s/g, '')
      const name = companyName.slice(0, 70)
      payload = [
        'BCD', '002', '1', 'SCT',
        bic, name, ibanClean,
        `EUR${amount}`, '', '',
        number, '',
      ].join('\n')
    } else {
      const vs = variable_symbol ?? ''
      payload = [
        'SPD*1.0',
        `ACC:${ibanClean}`,
        `AM:${amount}`,
        `CC:${currency}`,
        `MSG:${number}`,
        vs ? `X-VS:${vs}` : '',
      ].filter(Boolean).join('*')
    }

    return await QRCode.toDataURL(payload, {
      width: 160, margin: 1,
      color: { dark: '#111111', light: '#FFFFFF' },
    })
  } catch (err) {
    console.error('[qr] generation error:', err)
    return null
  }
}
