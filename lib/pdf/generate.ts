import { Font, renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import path from 'path'
import InvoiceTemplate from '@/components/pdf/invoice-template'
import type { DocumentWithItems, Client, CompanyProfile } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateQrCodeUrl as _generateQrCodeUrl } from '@/lib/qr'

const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts')
Font.register({ family: 'DejaVu', src: path.join(FONTS_DIR, 'dejavu.ttf') })
Font.register({ family: 'DejaVu-Bold', src: path.join(FONTS_DIR, 'dejavu-bold.ttf') })
Font.registerHyphenationCallback((word) => [word])

export { generateQrCodeUrl } from '@/lib/qr'

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
    qrCodeUrl = await _generateQrCodeUrl({
      number: doc.number,
      total_with_vat: doc.total_with_vat ?? 0,
      currency: doc.currency ?? 'CZK',
      variable_symbol: doc.variable_symbol ?? null,
      iban: companyProfile.iban,
      swift: companyProfile.swift ?? null,
      companyName: companyProfile.name ?? '',
    })
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
