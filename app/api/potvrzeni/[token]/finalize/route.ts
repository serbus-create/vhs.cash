import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrderByToken, NO_STORE } from '@/lib/public-order'
import { finalizeConfirmedOrder } from '@/lib/order-confirm-finalize'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Vždy jen { ok: true }, klient se o výsledku archivu ani e-mailů nic nedozví.
export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const admin = createAdminClient()
    const row = await findOrderByToken(admin, params.token)
    if (row && row.status === 'confirmed') await finalizeConfirmedOrder(admin, row.id)
  } catch {
    // záměrně ticho; potvrzení platí a krok lze zopakovat z Podpisovny
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
