import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { findMonthFolder, listFiles, downloadFileBuffer } from '@/lib/google-drive'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const ctx = await getWorkspaceContext(supabase)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!ctx.driveFolderId) return NextResponse.json({ error: 'Drive složka není nakonfigurována pro tento workspace' }, { status: 503 })

    const yearMonth = req.nextUrl.searchParams.get('yearMonth') ?? new Date().toISOString().slice(0, 7)
    const folderId = await findMonthFolder(yearMonth, ctx.driveFolderId)
    if (!folderId) return NextResponse.json({ error: 'No files' }, { status: 404 })

    const files = await listFiles(folderId)
    if (files.length === 0) return NextResponse.json({ error: 'No files' }, { status: 404 })

    const zip = new JSZip()
    await Promise.all(
      files.map(async (file) => {
        const buffer = await downloadFileBuffer(file.id)
        zip.file(file.name, buffer)
      }),
    )

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="podklady-${yearMonth}.zip"`,
      },
    })
  } catch (err) {
    console.error('Drive download-zip error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
