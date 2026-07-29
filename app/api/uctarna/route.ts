import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getInvoiceEmailHtml, getInvoiceEmailBodyText, getLang } from '@/lib/uctarna-email'
import { generateInvoicePdf } from '@/lib/pdf/generate'

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://vhs-cash.vercel.app'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY)

async function createSupabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            )
          } catch {}
        },
      },
    },
  )
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: roleProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (roleProfile?.role !== 'admin') {
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

    // Fetch document
    const { data: doc } = await supabase
      .from('documents')
      .select('id, number, due_date, amount_czk, total_with_vat, currency, variable_symbol, company_profile_id, client_id, clients(country)')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (!doc) return NextResponse.json({ error: 'Dokument nenalezen' }, { status: 404 })

    const clientCountry = (Array.isArray(doc.clients) ? doc.clients[0] : doc.clients)?.country ?? null
    const lang = getLang(clientCountry)

    const amount = (doc.amount_czk ?? doc.total_with_vat) as number

    // Fetch company profile for payment details + QR
    let companyProfile: { name: string; bank_account: string | null; iban: string | null; swift: string | null } | null = null
    if (doc.company_profile_id) {
      const { data } = await supabase
        .from('company_profiles')
        .select('name, bank_account, iban, swift')
        .eq('id', doc.company_profile_id)
        .single()
      companyProfile = data ?? null
    }

    // Build QR code URL
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

    // Generate PDF attachment
    let pdfAttachment: { filename: string; content: Buffer } | null = null
    try {
      const pdfBuffer = await generateInvoicePdf(supabase, documentId, user.id)
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

    // Update document status to 'sent'
    const { error: updateError } = await supabase
      .from('documents')
      .update({ status: 'sent' })
      .eq('id', documentId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('[uctarna] Status update error:', updateError)
    }

    return NextResponse.json({ ok: true, pdfAttached: pdfAttachment !== null })
  } catch (err) {
    console.error('[uctarna] API error:', err)
    return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 })
  }
}
