import { Font, renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import path from 'path'
import TermsPages, { type TermsConfirmation } from '@/components/pdf/terms-pages'
import { buildPartyIdentification, type PartyInput } from '@/lib/terms/parties'
import { renderTerms } from '@/lib/terms/render'
import type { TermsValues } from '@/lib/terms/defaults'

// Stejná písma jako u faktury (generate.ts), registrace je idempotentní.
const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts')
Font.register({ family: 'DejaVu', src: path.join(FONTS_DIR, 'dejavu.ttf') })
Font.register({ family: 'DejaVu-Bold', src: path.join(FONTS_DIR, 'dejavu-bold.ttf') })
Font.registerHyphenationCallback((word) => [word])

export interface GenerateTermsInput {
  supplier: PartyInput
  client: PartyInput
  values: TermsValues
  confirmation?: TermsConfirmation | null
}

export interface GenerateTermsResult {
  pdf: Buffer
  // chybějící proměnné šablony + chybějící údaje stran (např. "dodavatel.ico")
  missing: string[]
}

export async function generateTermsPdf(input: GenerateTermsInput): Promise<GenerateTermsResult> {
  const supplier = buildPartyIdentification(input.supplier)
  const client = buildPartyIdentification(input.client)

  const result = renderTerms({
    ...input.values,
    dodavatel_identifikace: supplier.text,
    klient_identifikace: client.text,
  })

  const missing = [
    ...result.missing,
    ...supplier.missing.map((m) => `dodavatel.${m}`),
    ...client.missing.map((m) => `klient.${m}`),
  ]

  const pdf: Buffer = await renderToBuffer(
    React.createElement(TermsPages, {
      result,
      confirmation: input.confirmation ?? null,
    }) as unknown as React.ReactElement,
  )

  return { pdf, missing }
}
