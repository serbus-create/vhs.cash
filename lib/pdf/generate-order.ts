import { Document, Font, renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import path from 'path'
import type { SupabaseClient } from '@supabase/supabase-js'
import OrderPage, { asCenaRezim, orderPricing } from '@/components/pdf/order-pages'
import { TermsPagesBody } from '@/components/pdf/terms-pages'
import { buildPartyIdentification, type PartyInput } from '@/lib/terms/parties'
import { extractVariables, formatCzNumber, renderTerms } from '@/lib/terms/render'
import type { TermsValues } from '@/lib/terms/defaults'
import type { DocumentWithItems, Client, CompanyProfile } from '@/lib/types'

// Stejná písma jako u faktury (generate.ts), registrace je idempotentní.
const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts')
Font.register({ family: 'DejaVu', src: path.join(FONTS_DIR, 'dejavu.ttf') })
Font.register({ family: 'DejaVu-Bold', src: path.join(FONTS_DIR, 'dejavu-bold.ttf') })
Font.registerHyphenationCallback((word) => [word])

export interface OrderPdfInput {
  doc: DocumentWithItems
  client: Client | null
  companyProfile: CompanyProfile | null
}

export interface OrderPdfResult {
  pdf: Buffer
  // chybějící proměnné šablony a údaje stran (např. "dodavatel.ico", "klient.address")
  missing: string[]
}

/** Načte dokument s položkami, klienta a firemní profil (přes klienta přihlášeného uživatele, tedy s RLS). */
export async function loadOrderPdfInput(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  documentId: string,
): Promise<OrderPdfInput> {
  const { data: doc, error } = await supabase
    .from('documents')
    .select('*, document_items(*)')
    .eq('id', documentId)
    .single()
  if (error || !doc) throw new Error(`Document not found: ${documentId}`)

  const [clientResult, profileResult] = await Promise.all([
    doc.client_id
      ? supabase.from('clients').select('*').eq('id', doc.client_id).single()
      : Promise.resolve({ data: null }),
    doc.company_profile_id
      ? supabase.from('company_profiles').select('*').eq('id', doc.company_profile_id).single()
      : Promise.resolve({ data: null }),
  ])

  return {
    doc: doc as DocumentWithItems,
    client: (clientResult.data as Client | null) ?? null,
    companyProfile: (profileResult.data as CompanyProfile | null) ?? null,
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100

export async function generateOrderPdf(input: OrderPdfInput): Promise<OrderPdfResult> {
  const { doc, client, companyProfile } = input
  const tv = doc.terms_values ?? {}
  const rezim = asCenaRezim(tv.cena_rezim)

  // jen klíče, které šablona používá; ostatní (cena_rezim, hodinova_sazba, ...) se ignorují
  const templateKeys = new Set(extractVariables())
  const values: TermsValues = {}
  for (const [key, value] of Object.entries(tv)) {
    if (templateKeys.has(key) && typeof value === 'string') values[key] = value
  }

  // Záloha objednávky má přednost před výchozí zálohou podmínek, ať čl. 5.3 neříká jiné procento
  const depositPct = (tv.zaloha_objednavka_procent ?? '').trim()
  // Je-li záloha 0 (Bez zálohy), nechá se výchozí text čl. 5.3, ať nestojí "výchozí je 0 %"
  if (depositPct && Number(depositPct.replace(',', '.')) > 0) values.zaloha_procent = depositPct

  // zaloha_castka: u pevné ceny základ bez DPH krát procento, jinak prázdné (render vynechá závorku)
  let zalohaCastka = ''
  const pct = Number(depositPct.replace(',', '.'))
  if (rezim === 'pevna' && depositPct && Number.isFinite(pct) && pct > 0) {
    const amount = round2((orderPricing(doc, client, companyProfile).totalWithoutVat * pct) / 100)
    zalohaCastka = formatCzNumber(amount, Number.isInteger(amount) ? 0 : 2)
  }
  values.zaloha_castka = zalohaCastka

  const supplierInput: PartyInput = {
    name: companyProfile?.name ?? '',
    ico: companyProfile?.ico,
    dic: companyProfile?.dic,
    address: companyProfile?.address,
    city: companyProfile?.city,
    zip: companyProfile?.zip,
    profile_type: companyProfile?.profile_type,
    spisova_znacka: companyProfile?.spisova_znacka,
    represented_by: companyProfile?.represented_by,
  }
  const clientInput: PartyInput = {
    name: client?.name ?? '',
    ico: client?.ico,
    dic: client?.dic,
    address: client?.address,
    city: client?.city,
    zip: client?.zip,
    entity_type: client?.entity_type,
    represented_by: client?.represented_by,
  }
  const supplier = buildPartyIdentification(supplierInput)
  const clientParty = buildPartyIdentification(clientInput)

  const result = renderTerms({
    ...values,
    dodavatel_identifikace: supplier.text,
    klient_identifikace: clientParty.text,
  })

  const missing = [
    ...result.missing,
    ...supplier.missing.map((m) => `dodavatel.${m}`),
    // spisová značka se u klienta nevyžaduje
    ...clientParty.missing.filter((m) => m !== 'spisova_znacka').map((m) => `klient.${m}`),
  ]
  if (!(client?.entity_type ?? '').trim()) missing.push('klient.entity_type')
  if (rezim === 'hodinova' && !(tv.hodinova_sazba ?? '').trim()) missing.push('hodinova_sazba')

  const pdf: Buffer = await renderToBuffer(
    React.createElement(
      Document,
      { title: `Objednávka ${doc.number}` },
      React.createElement(OrderPage, { doc, client, companyProfile, zalohaCastka }),
      React.createElement(TermsPagesBody, { result, showConfirmation: false }),
    ) as unknown as React.ReactElement,
  )

  return { pdf, missing: Array.from(new Set(missing)) }
}
