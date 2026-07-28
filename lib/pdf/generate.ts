import { Font, renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import path from 'path'
import QRCode from 'qrcode'
import InvoiceTemplate from '@/components/pdf/invoice-template'
import type { DocumentWithItems, Client, CompanyProfile } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts')
Font.register({ family: 'DejaVu', src: path.join(FONTS_DIR, 'dejavu.ttf') })
Font.register({ family: 'DejaVu-Bold', src: path.join(FONTS_DIR, 'dejavu-bold.ttf') })
Font.registerHyphenationCallback((word) => [word])

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

export async function generateInvoicePdf(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  documentId: string,
  userId: string,
): Promise<Buffer> {
  const { data: doc, error: docErr } = await supabase
    .from('documents')
    .select('*, document_items(*)')
    .eq('id', documentId)
    .eq('user_id', userId)
    .single()

  if (docErr || !doc) throw new Error(`Document not found: ${documentId}`)

  const [clientResult, profileResult] = await Promise.all([
    doc.client_id
      ? supabase.from('clients').select('*').eq('id', doc.client_id).single()
      : Promise.resolve({ data: null }),
    doc.company_profile_id
      ? supabase.from('company_profiles').select('*').eq('id', doc.company_profile_id).single()
      : Promise.resolve({ data: null }),
  ])

  const client: Client | null = clientResult.data ?? null
  const companyProfile: CompanyProfile | null = profileResult.data ?? null

  let qrCodeUrl: string | null = null
  if (doc.type === 'faktura' && companyProfile?.iban) {
    try {
      const ibanClean = companyProfile.iban.replace(/\s/g, '')
      const amount = (doc.total_with_vat ?? 0).toFixed(2)
      const currency = doc.currency ?? 'CZK'

      let payload: string
      if (currency === 'EUR') {
        const bic = (companyProfile.swift ?? '').replace(/\s/g, '')
        const name = (companyProfile.name ?? '').slice(0, 70)
        payload = [
          'BCD', '002', '1', 'SCT',
          bic, name, ibanClean,
          `EUR${amount}`, '', '',
          doc.number, '',
        ].join('\n')
      } else {
        const vs = doc.variable_symbol ?? ''
        payload = [
          'SPD*1.0',
          `ACC:${ibanClean}`,
          `AM:${amount}`,
          `CC:${currency}`,
          `MSG:${doc.number}`,
          vs ? `X-VS:${vs}` : '',
        ].filter(Boolean).join('*')
      }

      qrCodeUrl = await QRCode.toDataURL(payload, {
        width: 160, margin: 1,
        color: { dark: '#111111', light: '#FFFFFF' },
      })
    } catch (qrErr) {
      console.error('[pdf] QR generation error:', qrErr)
    }
  }

  const buffer: Buffer = await renderToBuffer(
    React.createElement(InvoiceTemplate, {
      doc: doc as DocumentWithItems,
      client,
      companyProfile,
      qrCodeUrl,
      clientCountry: client?.country ?? null,
    }) as unknown as React.ReactElement
  )

  return buffer
}
