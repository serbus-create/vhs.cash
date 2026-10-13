// Pouze server: dokončení potvrzení objednávky (archiv PDF do Disku a e-maily).
// Potvrzení klienta (stav confirmed) se tady nikdy nemění. Každý krok je samostatný,
// zamyká se atomickým UPDATE a při chybě se zámek uvolní, takže ho lze zopakovat.
// Nic se neloguje (jména, e-maily, IP ani token).
import type { SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { generateOrderPdf, loadOrderPdfInput } from '@/lib/pdf/generate-order'
import { getOrCreateMonthFolder, uploadFile } from '@/lib/google-drive'
import { orderPaymentLines, orderDepositAmountText } from '@/lib/order-summary'
import { ORDER_SIGNATURE_HTML, ORDER_SIGNATURE_TEXT, escapeHtml as esc } from '@/lib/order-email'
import { FROM_NAME, FROM_ADDRESS, REPLY_TO, NOTIFY_TO } from '@/lib/order-mail-config'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>

const LOCK_STALE_MS = 10 * 60 * 1000
const SITE_URL = () => (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vhs-cash.vercel.app').replace(/\/$/, '')

export interface FinalizeResult {
  archived: boolean
  mailed: boolean
  /** co selhalo, např. 'archiv', 'e-mail na info', 'e-mail klientovi' */
  failed: string[]
}

const dateTimePrague = (v: string) =>
  new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'long', timeStyle: 'medium', timeZone: 'Europe/Prague' }).format(new Date(v))
const yearPrague = (v: string) =>
  new Intl.DateTimeFormat('cs-CZ', { year: 'numeric', timeZone: 'Europe/Prague' }).format(new Date(v))

export async function finalizeConfirmedOrder(admin: Admin, documentId: string): Promise<FinalizeResult> {
  const result: FinalizeResult = { archived: false, mailed: false, failed: [] }

  const { data: row } = await admin
    .from('documents')
    .select('id, number, status, confirmed_at, workspace_id, archive_drive_file_id, archived_at, confirm_mail_sent_at')
    .eq('id', documentId)
    .single()
  if (!row || row.status !== 'confirmed' || !row.confirmed_at) return result

  let driveFileId: string | null = row.archive_drive_file_id ?? null
  result.archived = !!driveFileId
  result.mailed = !!row.confirm_mail_sent_at
  if (result.archived && result.mailed) return result

  // PDF s razítkem se generuje nejvýše jednou a sdílí ho archiv i e-maily
  let pdfCache: Buffer | null = null
  const getPdf = async () => {
    if (!pdfCache) pdfCache = (await generateOrderPdf(await loadOrderPdfInput(admin, documentId))).pdf
    return pdfCache
  }
  const safeNumber = String(row.number).replace(/[^a-zA-Z0-9-]/g, '_')

  // ── Archiv ──
  if (!driveFileId) {
    const now = new Date()
    let locked = false
    const fresh = await admin
      .from('documents')
      .update({ archived_at: now.toISOString() })
      .eq('id', documentId)
      .is('archive_drive_file_id', null)
      .is('archived_at', null)
      .select('id')
    locked = !fresh.error && !!fresh.data?.length
    if (!locked) {
      // zámek starší než 10 minut je zapomenutý
      const stale = await admin
        .from('documents')
        .update({ archived_at: now.toISOString() })
        .eq('id', documentId)
        .is('archive_drive_file_id', null)
        .lt('archived_at', new Date(now.getTime() - LOCK_STALE_MS).toISOString())
        .select('id')
      locked = !stale.error && !!stale.data?.length
    }
    if (locked) {
      try {
        const { data: ws } = await admin.from('workspaces').select('drive_folder_id').eq('id', row.workspace_id).single()
        const root = (ws?.drive_folder_id as string | null) ?? null
        if (!root) throw new Error('no-folder')
        const objednavky = await getOrCreateMonthFolder('Objednávky', root)
        const yearFolder = await getOrCreateMonthFolder(yearPrague(row.confirmed_at), objednavky)
        const file = await uploadFile(await getPdf(), `Objednavka-${safeNumber}-potvrzeno.pdf`, 'application/pdf', yearFolder)
        const { error } = await admin
          .from('documents')
          .update({ archive_drive_file_id: file.id, archived_at: new Date().toISOString() })
          .eq('id', documentId)
        if (error) throw new Error('db')
        driveFileId = file.id
        result.archived = true
      } catch {
        await admin.from('documents').update({ archived_at: null }).eq('id', documentId).is('archive_drive_file_id', null)
        result.failed.push('archiv')
      }
    } else {
      // běží jiný pokus nebo je už hotovo; stav přečteme znovu
      const { data: again } = await admin.from('documents').select('archive_drive_file_id').eq('id', documentId).single()
      driveFileId = again?.archive_drive_file_id ?? null
      result.archived = !!driveFileId
    }
  }

  // ── E-maily ──
  if (!result.mailed) {
    const { data: lock } = await admin
      .from('documents')
      .update({ confirm_mail_sent_at: new Date().toISOString() })
      .eq('id', documentId)
      .is('confirm_mail_sent_at', null)
      .select('id')
    if (lock?.length) {
      let allSent = false
      try {
        const input = await loadOrderPdfInput(admin, documentId)
        const { doc, client, companyProfile } = input
        const pdf = await getPdf()
        const attachments = [{ filename: `Objednavka-${safeNumber}-potvrzeno.pdf`, content: pdf }]
        const from = `${FROM_NAME} <${FROM_ADDRESS}>`
        const resend = new Resend(process.env.RESEND_API_KEY)

        // e-mail na info@
        const payment = orderPaymentLines(doc, client, companyProfile, orderDepositAmountText(doc, client, companyProfile))
        const tv = doc.terms_values ?? {}
        const priceLines = [...payment.price, payment.deposit].map((l) => `${l.text}${l.missing ?? ''}`)
        const lines: [string, string][] = [
          ['Číslo objednávky', doc.number],
          ['Klient', client?.name ?? '—'],
          ['Dodavatel', companyProfile?.name ?? '—'],
          ['Předmět zakázky', doc.subject ?? '—'],
          ['Termín', (tv.termin_text ?? '').trim() || 'dle dohody'],
          ['Položky', doc.document_items.map((i) => `${i.description} (${i.quantity} ks)`).join('\n') || '—'],
          ['Cena a záloha', priceLines.join('\n')],
          ['Potvrdil(a)', `${doc.confirmed_by_name ?? ''}, ${doc.confirmed_by_role ?? ''}`],
          ['E-mail', doc.confirmed_by_email ?? '—'],
          ['Telefon', doc.confirmed_by_phone ?? '—'],
          ['Čas potvrzení', dateTimePrague(row.confirmed_at)],
          ['IP adresa', doc.confirmed_ip ?? '—'],
          ['Prohlížeč', doc.confirmed_user_agent ?? '—'],
          ['Znění souhlasu', tv.consent_text ?? '—'],
          ['Otisk podmínek', doc.terms_hash ?? '—'],
          ['Soubor v Disku', driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view` : 'zatím neuloženo'],
          ['Objednávka v appce', `${SITE_URL()}/documents/${doc.id}`],
        ]
        const notifyText = lines.map(([k, v]) => `${k}: ${v}`).join('\n')
        const notifyHtml = `<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8"></head><body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111111;">
<p style="margin:0 0 14px 0;font-size:16px;font-weight:bold;">Objednávka ${esc(doc.number)} byla potvrzena</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:640px;">
${lines
  .map(
    ([k, v]) =>
      `<tr><td style="padding:6px 14px 6px 0;vertical-align:top;color:#666666;white-space:nowrap;">${esc(k)}</td><td style="padding:6px 0;vertical-align:top;word-break:break-word;">${esc(v).replace(/\n/g, '<br>')}</td></tr>`,
  )
  .join('\n')}
</table></body></html>`

        const clientEmail = (doc.confirmed_by_email ?? '').trim()
        const clientText = `Dobrý den,

děkuji za potvrzení objednávky č. ${doc.number}. V příloze posílám kopii s potvrzením. Pokud cokoliv nesedí, odpovězte prosím na tento e-mail.

Děkuji a přeji hezký den

${ORDER_SIGNATURE_TEXT}`
        const clientHtml = `<!DOCTYPE html>
<html lang="cs"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111111;">
<p style="margin:0 0 14px 0;">Dobrý den,</p>
<p style="margin:0 0 14px 0;">děkuji za potvrzení objednávky č. <strong>${esc(doc.number)}</strong>. V příloze posílám kopii s potvrzením. Pokud cokoliv nesedí, odpovězte prosím na tento e-mail.</p>
<p style="margin:0 0 20px 0;">Děkuji a přeji hezký den</p>
${ORDER_SIGNATURE_HTML}
</body></html>`

        const send = async (payload: Parameters<typeof resend.emails.send>[0], label: string) => {
          try {
            const { error } = await resend.emails.send(payload)
            if (error) throw new Error('send')
            return true
          } catch {
            result.failed.push(label)
            return false
          }
        }
        // oba se odešlou, i když jeden selže
        const okNotify = await send(
          { from, to: NOTIFY_TO, replyTo: REPLY_TO, subject: `Objednávka ${doc.number} potvrzena: ${client?.name ?? ''}`, html: notifyHtml, text: notifyText, attachments },
          'e-mail na info',
        )
        const okClient = await send(
          { from, to: clientEmail, replyTo: REPLY_TO, subject: `Potvrzení objednávky ${doc.number}`, html: clientHtml, text: clientText, attachments },
          'e-mail klientovi',
        )
        allSent = okNotify && okClient
      } catch {
        if (!result.failed.includes('e-mail')) result.failed.push('e-mail')
      }
      if (allSent) {
        result.mailed = true
      } else {
        await admin.from('documents').update({ confirm_mail_sent_at: null }).eq('id', documentId)
      }
    } else {
      // jiný pokus už e-maily odesílá nebo je odeslal
      result.mailed = true
    }
  }

  return result
}
