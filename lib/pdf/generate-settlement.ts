import { Font, renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import path from 'path'
import type { SupabaseClient } from '@supabase/supabase-js'
import SettlementTemplate from '@/components/pdf/settlement-template'
import type { Client, CompanyProfile } from '@/lib/types'
import { generateQrCodeUrl } from '@/lib/qr'
import { feeQrMessage } from '@/lib/reminders/fees'
import { readEffectiveTerms } from '@/lib/terms/effective'

// Stejná písma jako u faktury (generate.ts), registrace je idempotentní.
const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts')
Font.register({ family: 'DejaVu', src: path.join(FONTS_DIR, 'dejavu.ttf') })
Font.register({ family: 'DejaVu-Bold', src: path.join(FONTS_DIR, 'dejavu-bold.ttf') })
Font.registerHyphenationCallback((word) => [word])

/** PDF vyúčtování (type 'vyuctovani'). Klient supabase určuje přístup (RLS); u jiného typu dokladu vyhodí chybu. */
export async function generateSettlementPdf(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  documentId: string,
): Promise<Buffer> {
  const { data: doc, error } = await supabase.from('documents').select('*').eq('id', documentId).single()
  if (error || !doc || doc.type !== 'vyuctovani') throw new Error(`Settlement not found: ${documentId}`)

  const [clientResult, profileResult, invoiceResult, orderResult] = await Promise.all([
    doc.client_id ? supabase.from('clients').select('*').eq('id', doc.client_id).single() : Promise.resolve({ data: null }),
    doc.company_profile_id ? supabase.from('company_profiles').select('*').eq('id', doc.company_profile_id).single() : Promise.resolve({ data: null }),
    doc.related_invoice_id
      ? supabase.from('documents').select('number, due_date').eq('id', doc.related_invoice_id).eq('workspace_id', doc.workspace_id).single()
      : Promise.resolve({ data: null }),
    doc.order_id
      ? supabase.from('documents').select('number, confirmed_at, terms_values').eq('id', doc.order_id).eq('workspace_id', doc.workspace_id).single()
      : Promise.resolve({ data: null }),
  ])
  const client = (clientResult.data as Client | null) ?? null
  const companyProfile = (profileResult.data as CompanyProfile | null) ?? null
  const invoice = (invoiceResult.data as { number: string; due_date: string | null } | null) ?? null
  const orderRow = orderResult.data as { number: string; confirmed_at: string | null; terms_values: Record<string, string> | null } | null

  const order = orderRow
    ? {
        number: orderRow.number,
        confirmedDate: orderRow.confirmed_at
          ? new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague' }).format(new Date(orderRow.confirmed_at))
          : null,
        termsVersion: readEffectiveTerms(orderRow.terms_values).version,
      }
    : null

  const vs = (doc.terms_values as Record<string, string> | null)?.vs ?? doc.variable_symbol ?? null
  const qrCodeUrl = companyProfile?.iban
    ? await generateQrCodeUrl({
        number: feeQrMessage(doc.number),
        total_with_vat: doc.total_with_vat ?? 0,
        currency: 'CZK',
        variable_symbol: vs,
        iban: companyProfile.iban,
        swift: companyProfile.swift ?? null,
        companyName: companyProfile.name ?? '',
      })
    : null

  return renderToBuffer(
    React.createElement(SettlementTemplate, { doc, client, companyProfile, invoice, order, qrCodeUrl }) as unknown as React.ReactElement,
  )
}
