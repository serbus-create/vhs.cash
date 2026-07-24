/**
 * Zpětné dopočítání exchange_rate a amount_czk pro existující faktury.
 *
 * Spuštění:
 *   npx tsx scripts/backfill-exchange-rates.ts
 *
 * Potřebuje proměnné prostředí — načítá je z .env.local v kořeni projektu.
 * Pro zápis přes RLS je nutný SUPABASE_SERVICE_ROLE_KEY (nebo NEXT_PUBLIC_SUPABASE_ANON_KEY
 * pokud RLS pro UPDATE documents neblokuje).
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'
import { getEurCzkRate } from '../lib/exchange-rate'

// ---------- načtení .env.local ----------
const envPath = join(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([^=#\s][^=]*)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    const value = m[2].trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Chybí NEXT_PUBLIC_SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY',
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function backfill() {
  const { data: docs, error } = await supabase
    .from('documents')
    .select('id, currency, issue_date, total_with_vat, status, number')
    .in('status', ['issued', 'sent', 'paid', 'overdue', 'cancelled'])
    .is('amount_czk', null)

  if (error) {
    console.error('Chyba při načítání dokumentů:', error.message)
    process.exit(1)
  }

  if (!docs || docs.length === 0) {
    console.log('Žádné dokumenty k dopočítání.')
    return
  }

  console.log(`Zpracovávám ${docs.length} dokumentů...\n`)
  let ok = 0
  let skipped = 0
  let failed = 0

  for (const doc of docs) {
    const label = `${doc.number ?? doc.id} [${doc.currency}]`
    try {
      let exchange_rate: number
      let amount_czk: number

      if (doc.currency === 'EUR') {
        if (!doc.issue_date) {
          console.warn(`  ⚠ ${label}: chybí issue_date, přeskakuji`)
          skipped++
          continue
        }
        const { rate, date } = await getEurCzkRate(doc.issue_date)
        exchange_rate = rate
        amount_czk = Math.round(doc.total_with_vat * rate * 100) / 100
        console.log(
          `  ✓ ${label}: kurz ${rate.toFixed(4)} CZK/EUR (ČNB ${date}), amount_czk=${amount_czk}`,
        )
      } else if (doc.currency === 'CZK') {
        exchange_rate = 1
        amount_czk = Math.round(doc.total_with_vat * 100) / 100
        console.log(`  ✓ ${label}: CZK 1:1, amount_czk=${amount_czk}`)
      } else {
        console.warn(`  ⚠ ${label}: nepodporovaná měna "${doc.currency}", přeskakuji`)
        skipped++
        continue
      }

      const { error: updateErr } = await supabase
        .from('documents')
        .update({ exchange_rate, amount_czk })
        .eq('id', doc.id)

      if (updateErr) {
        console.error(`  ✗ ${label}: ${updateErr.message}`)
        failed++
      } else {
        ok++
      }
    } catch (err) {
      console.error(`  ✗ ${label}: ${String(err)}`)
      failed++
    }
  }

  console.log(`\nHotovo: ${ok} OK, ${skipped} přeskočeno, ${failed} chyb`)
}

backfill()
