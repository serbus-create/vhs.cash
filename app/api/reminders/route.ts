import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getReminderHtml, getLang, type ReminderLevel } from '@/lib/reminder-email'
import { generateInvoicePdf, generateQrCodeUrl } from '@/lib/pdf/generate'

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

    const body = await req.json() as {
      documentId: string
      level: ReminderLevel
      recipientEmail: string
      subject: string
      bodyText: string
    }

    const { documentId, level, recipientEmail, subject, bodyText } = body
    if (!documentId || !level || !recipientEmail || !subject || !bodyText) {
      return NextResponse.json({ error: 'Chybí povinné parametry' }, { status: 400 })
    }

    // Fetch document with client country for language detection
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
    const daysOverdue = doc.due_date
      ? Math.floor((Date.now() - new Date(doc.due_date).getTime()) / 86_400_000)
      : 0

    // Fetch company profile for payment details + QR code
    let companyProfile: { name: string; bank_account: string | null; iban: string | null; swift: string | null } | null = null
    if (doc.company_profile_id) {
      const { data } = await supabase
        .from('company_profiles')
        .select('name, bank_account, iban, swift')
        .eq('id', doc.company_profile_id)
        .single()
      companyProfile = data ?? null
    }

    // Generate QR code
    let qrCodeUrl: string | null = null
    if (companyProfile?.iban) {
      qrCodeUrl = await generateQrCodeUrl({
        number: doc.number as string,
        total_with_vat: doc.total_with_vat as number,
        currency: (doc.currency ?? 'CZK') as string,
        variable_symbol: doc.variable_symbol as string | null,
        iban: companyProfile.iban,
        swift: companyProfile.swift,
        companyName: companyProfile.name,
      })
    }

    const vars = {
      number: doc.number as string,
      daysOverdue,
      amount,
      dueDate: doc.due_date as string | null,
      currency: (doc.currency ?? 'CZK') as string,
      amountEur: doc.currency === 'EUR' ? (doc.total_with_vat as number) : null,
      bankAccount: companyProfile?.bank_account ?? null,
      iban: companyProfile?.iban ?? null,
      variableSymbol: (doc.variable_symbol as string | null) ?? null,
      qrCodeUrl,
    }
    const htmlContent = getReminderHtml(level, vars, lang)

    // Generate PDF attachment — fail gracefully if rendering fails
    let pdfAttachment: { filename: string; content: Buffer } | null = null
    try {
      const pdfBuffer = await generateInvoicePdf(supabase, documentId, user.id)
      const safeNumber = (doc.number as string).replace(/[^a-zA-Z0-9-]/g, '_')
      pdfAttachment = { filename: `faktura-${safeNumber}.pdf`, content: pdfBuffer }
      console.log('[reminders] PDF generated, size:', pdfBuffer.length)
    } catch (pdfErr) {
      console.error('[reminders] PDF generation failed, sending without attachment:', pdfErr)
    }

    const { error: sendError } = await resend.emails.send({
      from: 'upominka@v-h-s.cz',
      to: recipientEmail,
      replyTo: 'info@v-h-s.cz',
      subject,
      html: htmlContent,
      text: bodyText,
      ...(pdfAttachment ? { attachments: [pdfAttachment] } : {}),
    })

    if (sendError) {
      console.error('Resend error:', sendError)
      return NextResponse.json({ error: 'Chyba při odesílání e-mailu' }, { status: 500 })
    }

    // Record in reminders table
    const { error: dbError } = await supabase.from('reminders').insert({
      document_id: documentId,
      level,
      recipient_email: recipientEmail,
    })

    if (dbError) {
      console.error('DB insert error:', dbError)
      // Email was sent — don't fail the request, just log
    }

    return NextResponse.json({ ok: true, pdfAttached: pdfAttachment !== null })
  } catch (err) {
    console.error('Reminders API error:', err)
    return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 })
  }
}
