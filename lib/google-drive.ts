import { google } from 'googleapis'
import { Readable } from 'stream'

function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
  return google.drive({ version: 'v3', auth })
}

export async function findMonthFolder(yearMonth: string, rootFolderId: string): Promise<string | null> {
  const drive = getDriveClient()
  const parent = rootFolderId
  const res = await drive.files.list({
    q: `name='${yearMonth}' and mimeType='application/vnd.google-apps.folder' and '${parent}' in parents and trashed=false`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  return res.data.files?.[0]?.id ?? null
}

export async function getOrCreateMonthFolder(yearMonth: string, rootFolderId: string): Promise<string> {
  const existing = await findMonthFolder(yearMonth, rootFolderId)
  if (existing) return existing
  const drive = getDriveClient()
  const res = await drive.files.create({
    requestBody: {
      name: yearMonth,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [rootFolderId],
    },
    fields: 'id',
    supportsAllDrives: true,
  })
  return res.data.id!
}

export interface DriveFile {
  id: string
  name: string
  size: number
  mimeType: string
  createdTime: string
}

export async function listFiles(folderId: string): Promise<DriveFile[]> {
  const drive = getDriveClient()
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, size, mimeType, createdTime)',
    orderBy: 'createdTime desc',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  return (res.data.files ?? []).map((f) => ({
    id: f.id!,
    name: f.name!,
    size: Number(f.size ?? 0),
    mimeType: f.mimeType ?? 'application/octet-stream',
    createdTime: f.createdTime ?? new Date().toISOString(),
  }))
}

export async function uploadFile(
  buffer: Buffer,
  name: string,
  mimeType: string,
  folderId: string,
): Promise<{ id: string; name: string }> {
  const drive = getDriveClient()
  const res = await drive.files.create({
    requestBody: { name, parents: [folderId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: 'id, name',
    supportsAllDrives: true,
  })
  return { id: res.data.id!, name: res.data.name! }
}

export async function getFileMetadata(fileId: string): Promise<{ name: string; mimeType: string }> {
  const drive = getDriveClient()
  const res = await drive.files.get({
    fileId,
    fields: 'name, mimeType',
    supportsAllDrives: true,
  })
  return { name: res.data.name!, mimeType: res.data.mimeType ?? 'application/octet-stream' }
}

export async function downloadFileBuffer(fileId: string): Promise<Buffer> {
  const drive = getDriveClient()
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  )
  return Buffer.from(res.data as unknown as ArrayBuffer)
}

export async function deleteFile(fileId: string): Promise<void> {
  const drive = getDriveClient()
  await drive.files.delete({ fileId, supportsAllDrives: true })
}
