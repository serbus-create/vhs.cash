import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEurCzkRate } from '@/lib/exchange-rate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface DocRow {
  id: string
  number: string | null
  currency: string
  total_with_vat: number
  issue_date: string | null
  status: string
}

export async function GET(req: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
  }

  const { data: roleProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (roleProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const number = searchParams.get('number')

  const query = supabase
    .from('documents')
    .select('id, number, type, status, currency, total_with_vat, exchange_rate, amount_czk, issue_date, due_date')

  const { data, error } = number
    ? await query.eq('number', number)
    : await query.is('amount_czk', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ count: data?.length ?? 0, docs: data })
}

export async function POST() {
  const supabase = await createClient()

  const { data: authData, error: authErr } = await supabase.auth.getUser()
  console.log('[backfill] auth user:', authData?.user?.id ?? 'NULL', 'err:', authErr?.message ?? 'none')

  if (!authData?.user) {
    return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
  }

  const { data: roleProfile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).single()
  if (roleProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: docs, error: selectErr } = await supabase
    .from('documents')
    .select('id, number, currency, total_with_vat, issue_date, status')
    .is('amount_czk', null)

  console.log('[backfill] SELECT docs with null amount_czk:', docs?.length ?? 0, 'err:', selectErr?.message ?? 'none')
  if (selectErr) {
    return NextResponse.json({ error: selectErr.message }, { status: 500 })
  }

  const typedDocs = (docs ?? []) as DocRow[]

  if (typedDocs.length === 0) {
    return NextResponse.json({ message: 'Žádné dokumenty k dopočítání.', ok: 0, skipped: 0, failed: 0, results: [] })
  }

  const results: { number: string; status: 'ok' | 'skipped' | 'failed'; detail: string }[] = []
  let ok = 0, skipped = 0, failed = 0

  for (const doc of typedDocs) {
    const label = doc.number ?? doc.id
    console.log(`[backfill] Processing ${label} currency=${doc.currency} total=${doc.total_with_vat} issue_date=${doc.issue_date}`)

    let exchange_rate: number
    let amount_czk: number

    if (doc.currency === 'EUR') {
      if (!doc.issue_date) {
        console.log(`[backfill]   → SKIP: chybí issue_date`)
        results.push({ number: label, status: 'skipped', detail: 'chybí issue_date' })
        skipped++
        continue
      }
      try {
        const { rate, date } = await getEurCzkRate(doc.issue_date)
        exchange_rate = rate
        amount_czk = Math.round(doc.total_with_vat * rate * 100) / 100
        console.log(`[backfill]   → kurz ${rate} (ČNB ${date}), amount_czk=${amount_czk}`)
      } catch (err) {
        console.error(`[backfill]   → FAIL getEurCzkRate:`, err)
        results.push({ number: label, status: 'failed', detail: String(err) })
        failed++
        continue
      }
    } else if (doc.currency === 'CZK') {
      exchange_rate = 1
      amount_czk = Math.round(doc.total_with_vat * 100) / 100
      console.log(`[backfill]   → CZK 1:1, amount_czk=${amount_czk}`)
    } else {
      console.log(`[backfill]   → SKIP: nepodporovaná měna "${doc.currency}"`)
      results.push({ number: label, status: 'skipped', detail: `nepodporovaná měna "${doc.currency}"` })
      skipped++
      continue
    }

    const { data: updated, error: updateErr } = await supabase
      .from('documents')
      .update({ exchange_rate, amount_czk })
      .eq('id', doc.id)
      .select('id, exchange_rate, amount_czk')

    console.log(`[backfill]   → UPDATE result: updated=${JSON.stringify(updated)} err=${updateErr?.message ?? 'none'}`)

    if (updateErr) {
      results.push({ number: label, status: 'failed', detail: updateErr.message })
      failed++
    } else if (!updated || updated.length === 0) {
      results.push({ number: label, status: 'failed', detail: 'UPDATE provedl 0 řádků (RLS nebo chybné id)' })
      failed++
    } else {
      results.push({ number: label, status: 'ok', detail: `exchange_rate=${updated[0].exchange_rate}, amount_czk=${updated[0].amount_czk}` })
      ok++
    }
  }

  console.log(`[backfill] Hotovo: ok=${ok} skipped=${skipped} failed=${failed}`)
  return NextResponse.json({ message: `Hotovo: ${ok} OK, ${skipped} přeskočeno, ${failed} chyb`, ok, skipped, failed, results })
}
