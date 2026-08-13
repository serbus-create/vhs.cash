import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { findMonthFolder, listFiles } from '@/lib/google-drive'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const ctx = await getWorkspaceContext(supabase)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!ctx.driveFolderId) return NextResponse.json({ error: 'Drive složka není nakonfigurována pro tento workspace' }, { status: 503 })

    const yearMonth = req.nextUrl.searchParams.get('yearMonth') ?? new Date().toISOString().slice(0, 7)
    const folderId = await findMonthFolder(yearMonth, ctx.driveFolderId)
    if (!folderId) return NextResponse.json([])
    const files = await listFiles(folderId)
    return NextResponse.json(files)
  } catch (err) {
    console.error('Drive list error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
