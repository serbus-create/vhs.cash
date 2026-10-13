import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrderByToken, isLinkExpired, NO_STORE } from '@/lib/public-order'
import { generateOrderPdf, loadOrderPdfInput } from '@/lib/pdf/generate-order'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const notFound = () =>
  new Response(JSON.stringify({ error: 'Nenalezeno' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', ...NO_STORE },
  })

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const admin = createAdminClient()
    const row = await findOrderByToken(admin, params.token)
    if (!row) return notFound()
    const ok = row.status === 'confirmed' || (row.status === 'sent' && !isLinkExpired(row))
    if (!ok) return notFound()

    const { pdf } = await generateOrderPdf(await loadOrderPdfInput(admin, row.id))
    const filename = `Objednavka-${row.number.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdf.length),
        ...NO_STORE,
      },
    })
  } catch {
    return notFound()
  }
}
