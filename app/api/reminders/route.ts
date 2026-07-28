import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getReminderHtml, type ReminderLevel } from '@/lib/reminder-email'

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

    // Verify document belongs to user and fetch data for HTML
    const { data: doc } = await supabase
      .from('documents')
      .select('id, number, due_date, amount_czk, total_with_vat, currency')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (!doc) return NextResponse.json({ error: 'Dokument nenalezen' }, { status: 404 })

    const amount = (doc.amount_czk ?? doc.total_with_vat) as number
    const daysOverdue = doc.due_date
      ? Math.floor((Date.now() - new Date(doc.due_date).getTime()) / 86_400_000)
      : 0

    const vars = { number: doc.number as string, daysOverdue, amount, dueDate: doc.due_date as string | null }
    const htmlContent = getReminderHtml(level, vars)

    // Convert plain text body to HTML paragraphs for the text version
    const textBody = bodyText

    const { error: sendError } = await resend.emails.send({
      from: 'upominka@v-h-s.cz',
      to: recipientEmail,
      subject,
      html: htmlContent,
      text: textBody,
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

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Reminders API error:', err)
    return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 })
  }
}
