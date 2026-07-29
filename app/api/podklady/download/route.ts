import { NextRequest, NextResponse } from 'next/server'
import { downloadFileBuffer, getFileMetadata } from '@/lib/google-drive'

export async function GET(req: NextRequest) {
  try {
    const fileId = req.nextUrl.searchParams.get('fileId')
    if (!fileId) return NextResponse.json({ error: 'No fileId' }, { status: 400 })

    const [buffer, meta] = await Promise.all([
      downloadFileBuffer(fileId),
      getFileMetadata(fileId),
    ])

    const safeName = encodeURIComponent(meta.name).replace(/'/g, '%27')
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': meta.mimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${safeName}`,
      },
    })
  } catch (err) {
    console.error('Drive download error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
