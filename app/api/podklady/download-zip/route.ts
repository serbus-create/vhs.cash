import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { findMonthFolder, listFiles, downloadFileBuffer } from '@/lib/google-drive'

export async function GET(req: NextRequest) {
  try {
    const yearMonth = req.nextUrl.searchParams.get('yearMonth') ?? new Date().toISOString().slice(0, 7)
    const folderId = await findMonthFolder(yearMonth)
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
