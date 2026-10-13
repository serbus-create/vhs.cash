// Pouze server: vytvoření odkazu k potvrzení objednávky (snapshot podmínek, token, stav sent).
// Sdílí route /api/podpisovna/link a /api/podpisovna/send.
import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { hashToken, newToken, LINK_VALID_DAYS } from '@/lib/order-link'
import { buildOrderTerms, loadOrderPdfInput } from '@/lib/pdf/generate-order'
import { TERMS_TEMPLATE_VERSION } from '@/lib/terms/template'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any, any, any>

/** Chyba s HTTP kódem a českou zprávou pro uživatele. */
export class OrderLinkError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

const PREVIOUS_FIELDS = [
  'status',
  'confirm_token_hash',
  'terms_sent_at',
  'terms_expires_at',
  'terms_snapshot',
  'terms_hash',
  'terms_values',
  'confirmed_at',
  'confirmed_by_name',
  'confirmed_by_role',
  'confirmed_by_email',
  'confirmed_by_phone',
  'confirmed_ip',
  'terms_mail_sent_at',
  'terms_mail_to',
] as const

export type PreviousOrderState = Record<(typeof PREVIOUS_FIELDS)[number], unknown>

export interface CreatedOrderLink {
  token: string
  confirmUrl: string
  expiresAt: string
  missing: string[]
  previous: PreviousOrderState
}

export async function createOrderLink({
  supabase,
  workspaceId,
  documentId,
  origin,
}: {
  supabase: Supabase
  workspaceId: string
  documentId: string
  /** základ adresy odkazu, např. https://vhs-cash.vercel.app */
  origin: string
}): Promise<CreatedOrderLink> {
  const { data } = await supabase
    .from('documents')
    .select(`id, type, workspace_id, contact_name, contact_email, ${PREVIOUS_FIELDS.join(', ')}`)
    .eq('id', documentId)
    .eq('workspace_id', workspaceId)
    .single()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = data as Record<string, any> | null
  if (!doc || doc.type !== 'objednavka') throw new OrderLinkError('Objednávka nenalezena', 404)
  if (!['issued', 'sent', 'expired'].includes(doc.status)) {
    throw new OrderLinkError('Odkaz lze vytvořit jen u vydané, odeslané nebo vypršelé objednávky', 400)
  }
  if (!doc.contact_name?.trim() || !doc.contact_email?.trim()) {
    throw new OrderLinkError('Chybí jméno nebo e-mail kontaktní osoby. Doplňte je v objednávce.', 400)
  }

  const previous = Object.fromEntries(PREVIOUS_FIELDS.map((f) => [f, doc[f] ?? null])) as PreviousOrderState

  // Podmínky se sestaví z aktuálního stavu (u sent/expired se přebírá nový snapshot)
  const input = await loadOrderPdfInput(supabase, documentId)
  const { result, missing } = buildOrderTerms(input)
  const snapshot = JSON.stringify(result)
  const termsHash = createHash('sha256').update(snapshot).digest('hex')

  const token = newToken()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + LINK_VALID_DAYS * 24 * 60 * 60 * 1000)

  const { error } = await supabase
    .from('documents')
    .update({
      confirm_token_hash: hashToken(token),
      terms_sent_at: now.toISOString(),
      terms_expires_at: expiresAt.toISOString(),
      status: 'sent',
      terms_snapshot: snapshot,
      terms_hash: termsHash,
      terms_values: { ...(doc.terms_values ?? {}), terms_version: TERMS_TEMPLATE_VERSION },
      confirmed_at: null,
      confirmed_by_name: null,
      confirmed_by_role: null,
      confirmed_by_email: null,
      confirmed_by_phone: null,
      confirmed_ip: null,
      terms_mail_sent_at: null,
      terms_mail_to: null,
    })
    .eq('id', documentId)
    .eq('workspace_id', workspaceId)
  if (error) throw new OrderLinkError('Uložení se nezdařilo', 500)

  return {
    token,
    confirmUrl: `${origin.replace(/\/$/, '')}/potvrzeni/${token}`,
    expiresAt: expiresAt.toISOString(),
    missing,
    previous,
  }
}

/** Vrátí původní hodnoty; jen pokud je stále platný nově vytvořený odkaz (nepřepíše pozdější změnu). */
export async function rollbackOrderLink({
  supabase,
  workspaceId,
  documentId,
  token,
  previous,
}: {
  supabase: Supabase
  workspaceId: string
  documentId: string
  token: string
  previous: PreviousOrderState
}): Promise<boolean> {
  const { data, error } = await supabase
    .from('documents')
    .update(previous)
    .eq('id', documentId)
    .eq('workspace_id', workspaceId)
    .eq('confirm_token_hash', hashToken(token))
    .select('id')
  return !error && !!data?.length
}

export function requestOrigin(req: { headers: { get(name: string): string | null } }): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    `${req.headers.get('x-forwarded-proto') ?? 'https'}://${req.headers.get('x-forwarded-host') ?? req.headers.get('host')}`
  )
}
