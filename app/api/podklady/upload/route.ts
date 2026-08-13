import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { getOrCreateMonthFolder, uploadFile } from '@/lib/google-drive'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const ctx = await getWorkspaceContext(supabase)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (ctx.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!ctx.driveFolderId) return NextResponse.json({ error: 'Drive složka není nakonfigurována pro tento workspace' }, { status: 503 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const yearMonth = (formData.get('yearMonth') as string | null) ?? new Date().toISOString().slice(0, 7)

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const folderId = await getOrCreateMonthFolder(yearMonth, ctx.driveFolderId)
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadFile(buffer, file.name, file.type || 'application/octet-stream', folderId)

    return NextResponse.json(result)
  } catch (err) {
    console.error('Drive upload error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
