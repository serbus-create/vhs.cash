import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { entityTypeFromLegalForm } from '@/lib/ares-entity'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_CLIENTS = 100
const PAUSE_MS = 150
const CALL_TIMEOUT_MS = 4000
// Rozpočet pod maxDuration, aby odpověď stihla odejít i při pomalém ARES
const TIME_BUDGET_MS = 50_000

async function fetchLegalForm(ico: string): Promise<string | null> {
  const res = await fetch(
    `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`,
    {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    }
  )
  if (!res.ok) return null
  const data = await res.json()
  return data.pravniForma != null ? String(data.pravniForma) : null
}

export async function POST() {
  const supabase = await createClient()
  const ctx = await getWorkspaceContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })
  if (ctx.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, ico')
    .eq('workspace_id', ctx.workspaceId)
    .eq('country', 'CZ')
    .is('entity_type', null)
    .not('ico', 'is', null)
    .neq('ico', '')
    .order('name')
    .limit(MAX_CLIENTS)

  if (error) return NextResponse.json({ error: 'Načtení klientů se nezdařilo' }, { status: 500 })

  const started = Date.now()
  let updated = 0
  let skipped = 0
  const failedNames: string[] = []

  for (const c of clients ?? []) {
    if (Date.now() - started > TIME_BUDGET_MS) { skipped += 1; continue }
    const ico = String(c.ico).trim()
    if (!/^\d{8}$/.test(ico)) { failedNames.push(c.name); continue }

    let type: 'firma' | 'osvc' | null = null
    try {
      type = entityTypeFromLegalForm(await fetchLegalForm(ico))
    } catch {
      type = null
    }

    if (!type) {
      failedNames.push(c.name)
    } else {
      const { error: upErr } = await supabase
        .from('clients')
        .update({ entity_type: type })
        .eq('id', c.id)
        .eq('workspace_id', ctx.workspaceId)
      if (upErr) failedNames.push(c.name)
      else updated += 1
    }
    await new Promise((r) => setTimeout(r, PAUSE_MS))
  }

  return NextResponse.json({
    updated,
    skipped,
    failed: failedNames.length,
    failed_names: failedNames,
  })
}
