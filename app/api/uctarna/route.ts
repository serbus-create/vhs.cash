import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { getInvoiceEmailHtml, getInvoiceEmailBodyText, getLang } from '@/lib/uctarna-email'
import { generateInvoicePdf } from '@/lib/pdf/generate'

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://vhs-cash.vercel.app'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await getWorkspaceContext(supabase)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (ctx.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — tato akce vyžaduje roli administrátora' }, { status: 403 })
    }

    const body = await req.json() as {
      documentId: string
      recipientEmail: string
      replyTo?: string
      subject: string
      bodyText: string
    }

    const { documentId, recipientEmail, replyTo, subject, bodyText } = body
    if (!documentId || !recipientEmail || !subject || !bodyText) {
      return NextResponse.json({ error: 'Chybí povinné parametry' }, { status: 400 })
    }

    // RLS zajišťuje workspace-scoped přístup — user_id filtr není potřeba
    const { data: doc } = await supabase
      .from('documents')
      .select('id, number, due_date, amount_czk, total_with_vat, currency, variable_symbol, company_profile_id, client_id, clients(country)')
      .eq('id', documentId)
      .single()

    if (!doc) return NextResponse.json({ error: 'Dokument nenalezen' }, { status: 404 })

    const clientCountry = (Array.isArray(doc.clients) ? doc.clients[0] : doc.clients)?.country ?? null
    const lang = getLang(clientCountry)

    const amount = (doc.amount_czk ?? doc.total_with_vat) as number

    let companyProfile: { name: string; bank_account: string | null; iban: string | null; swift: string | null } | null = null
    if (doc.company_profile_id) {
      const { data } = await supabase
        .from('company_profiles')
        .select('name, bank_account, iban, swift')
        .eq('id', doc.company_profile_id)
        .single()
      companyProfile = data ?? null
    }

    let qrCodeUrl: string | null = null
    if (companyProfile?.iban) {
      const qrParams = new URLSearchParams({
        iban: companyProfile.iban,
        amount: String(doc.total_with_vat ?? 0),
        currency: (doc.currency ?? 'CZK') as string,
        number: doc.number as string,
        ...(doc.variable_symbol ? { vs: doc.variable_symbol as string } : {}),
        ...(companyProfile.swift ? { swift: companyProfile.swift } : {}),
        ...(companyProfile.name ? { name: companyProfile.name } : {}),
      })
      qrCodeUrl = `${APP_BASE_URL}/api/qr-code?${qrParams.toString()}`
    }

    const vars = {
      number: doc.number as string,
      amount,
      dueDate: doc.due_date as string | null,
      currency: (doc.currency ?? 'CZK') as string,
      amountEur: doc.currency === 'EUR' ? (doc.total_with_vat as number) : null,
      bankAccount: companyProfile?.bank_account ?? null,
      iban: companyProfile?.iban ?? null,
      variableSymbol: (doc.variable_symbol as string | null) ?? null,
      qrCodeUrl,
    }

    const htmlContent = getInvoiceEmailHtml(vars, lang)

    let pdfAttachment: { filename: string; content: Buffer } | null = null
    try {
      const pdfBuffer = await generateInvoicePdf(supabase, documentId)
      const safeNumber = (doc.number as string).replace(/[^a-zA-Z0-9-]/g, '_')
      pdfAttachment = { filename: `faktura-${safeNumber}.pdf`, content: pdfBuffer }
    } catch (pdfErr) {
      console.error('[uctarna] PDF generation failed:', pdfErr)
    }

    const { error: sendError } = await resend.emails.send({
      from: 'uctarna@v-h-s.cz',
      to: recipientEmail,
      replyTo: replyTo ?? 'info@v-h-s.cz',
      subject,
      html: htmlContent,
      text: bodyText,
      ...(pdfAttachment ? { attachments: [pdfAttachment] } : {}),
    })

    if (sendError) {
      console.error('[uctarna] Resend error:', sendError)
      return NextResponse.json({ error: 'Chyba při odesílání e-mailu' }, { status: 500 })
    }

    // RLS zaručuje, že update projde jen pro dokument v rámci workspace admina
    const { error: updateError } = await supabase
      .from('documents')
      .update({ status: 'sent' })
      .eq('id', documentId)

    if (updateError) {
      console.error('[uctarna] Status update error:', updateError)
    }

    return NextResponse.json({ ok: true, pdfAttached: pdfAttachment !== null })
  } catch (err) {
    console.error('[uctarna] API error:', err)
    return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 })
  }
}
