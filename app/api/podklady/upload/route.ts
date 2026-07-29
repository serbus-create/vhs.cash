import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateMonthFolder, uploadFile } from '@/lib/google-drive'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const yearMonth = (formData.get('yearMonth') as string | null) ?? new Date().toISOString().slice(0, 7)

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const folderId = await getOrCreateMonthFolder(yearMonth)
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadFile(buffer, file.name, file.type || 'application/octet-stream', folderId)

    return NextResponse.json(result)
  } catch (err) {
    console.error('Drive upload error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
