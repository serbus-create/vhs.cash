import { NextRequest, NextResponse } from 'next/server'
import { deleteFile } from '@/lib/google-drive'

export async function DELETE(req: NextRequest) {
  try {
    const fileId = req.nextUrl.searchParams.get('fileId')
    if (!fileId) return NextResponse.json({ error: 'No fileId' }, { status: 400 })
    await deleteFile(fileId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Drive delete error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
