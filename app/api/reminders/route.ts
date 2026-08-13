import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { getReminderHtml, getLang, type ReminderLevel } from '@/lib/reminder-email'

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
      level: ReminderLevel
      recipientEmail: string
      replyTo?: string
      subject: string
      bodyText: string
    }

    const { documentId, level, recipientEmail, replyTo, subject, bodyText } = body
    if (!documentId || !level || !recipientEmail || !subject || !bodyText) {
      return NextResponse.json({ error: 'Chybí povinné parametry' }, { status: 400 })
    }

    // RLS zajišťuje workspace-scoped přístup — user_id filtr není potřeba
    const { data: doc } = await supabase
      .from('documents')
      .select('id, number, due_date, amount_czk, total_with_vat, currency, variable_symbol, company_profile_id, client_id, paid_amount, exchange_rate, clients(country)')
      .eq('id', documentId)
      .single()

    if (!doc) return NextResponse.json({ error: 'Dokument nenalezen' }, { status: 404 })

    const clientCountry = (Array.isArray(doc.clients) ? doc.clients[0] : doc.clients)?.country ?? null
    const lang = getLang(clientCountry)

    const amount = (doc.amount_czk ?? doc.total_with_vat) as number
    const paidAmount = (doc.paid_amount as number | null) ?? null
    const daysOverdue = doc.due_date
      ? Math.floor((Date.now() - new Date(doc.due_date).getTime()) / 86_400_000)
      : 0

    let companyProfile: { name: string; bank_account: string | null; iban: string | null; swift: string | null } | null = null
    if (doc.company_profile_id) {
      const { data } = await supabase
        .from('company_profiles')
        .select('name, bank_account, iban, swift')
        .eq('id', doc.company_profile_id)
        .single()
      companyProfile = data ?? null
    }

    const totalWithVat = (doc.total_with_vat as number) ?? 0
    let remainingForQr = totalWithVat
    if (paidAmount) {
      if ((doc.currency ?? 'CZK') === 'CZK') {
        remainingForQr = totalWithVat - paidAmount
      } else if (doc.exchange_rate) {
        remainingForQr = totalWithVat - paidAmount / (doc.exchange_rate as number)
      }
      remainingForQr = Math.max(0, Math.round(remainingForQr * 100) / 100)
    }

    let qrCodeUrl: string | null = null
    if (companyProfile?.iban) {
      const qrParams = new URLSearchParams({
        iban: companyProfile.iban,
        amount: String(remainingForQr),
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
      daysOverdue,
      amount,
      dueDate: doc.due_date as string | null,
      currency: (doc.currency ?? 'CZK') as string,
      amountEur: doc.currency === 'EUR' ? (doc.total_with_vat as number) : null,
      bankAccount: companyProfile?.bank_account ?? null,
      iban: companyProfile?.iban ?? null,
      variableSymbol: (doc.variable_symbol as string | null) ?? null,
      qrCodeUrl,
      paidAmount,
    }
    const htmlContent = getReminderHtml(level, vars, lang)

    const { error: sendError } = await resend.emails.send({
      from: 'upominka@v-h-s.cz',
      to: recipientEmail,
      replyTo: replyTo ?? 'info@v-h-s.cz',
      subject,
      html: htmlContent,
      text: bodyText,
    })

    if (sendError) {
      console.error('Resend error:', sendError)
      return NextResponse.json({ error: 'Chyba při odesílání e-mailu' }, { status: 500 })
    }

    const { error: dbError } = await supabase.from('reminders').insert({
      document_id: documentId,
      level,
      recipient_email: recipientEmail,
    })

    if (dbError) {
      console.error('DB insert error:', dbError)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Reminders API error:', err)
    return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 })
  }
}
