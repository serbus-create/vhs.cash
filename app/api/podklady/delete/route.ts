import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { deleteFile } from '@/lib/google-drive'

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const ctx = await getWorkspaceContext(supabase)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (ctx.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const fileId = req.nextUrl.searchParams.get('fileId')
    if (!fileId) return NextResponse.json({ error: 'No fileId' }, { status: 400 })
    await deleteFile(fileId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Drive delete error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
