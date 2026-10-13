// Pouze server: sdílené pomocné funkce veřejných cest /potvrzeni a /api/potvrzeni.
// Dokument se vždy hledá podle otisku tokenu. Admin klienta si vytváří volající (stránka a routes).
import type { SupabaseClient } from '@supabase/supabase-js'
import { hashToken } from '@/lib/order-link'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>

// newToken() = 32 bajtů base64url = 43 znaků; delší nebo jiné vstupy ani nehashujeme
const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/

export interface PublicOrderRow {
  id: string
  number: string
  status: string
  terms_expires_at: string | null
  confirmed_at: string | null
  terms_values: Record<string, string> | null
}

/** Objednávka podle tokenu; null, když token nemá platný tvar nebo nic neodpovídá. */
export async function findOrderByToken(admin: Admin, token: string): Promise<PublicOrderRow | null> {
  if (!TOKEN_RE.test(token)) return null
  const { data } = await admin
    .from('documents')
    .select('id, number, status, terms_expires_at, confirmed_at, terms_values')
    .eq('confirm_token_hash', hashToken(token))
    .eq('type', 'objednavka')
    .maybeSingle()
  return (data as PublicOrderRow | null) ?? null
}

export const isLinkExpired = (row: { terms_expires_at: string | null }): boolean =>
  !row.terms_expires_at || new Date(row.terms_expires_at).getTime() <= Date.now()

/** Zapíše vypršení, jen pokud je objednávka stále ve stavu sent. */
export async function markExpired(admin: Admin, token: string): Promise<void> {
  await admin
    .from('documents')
    .update({ status: 'expired' })
    .eq('confirm_token_hash', hashToken(token))
    .eq('type', 'objednavka')
    .eq('status', 'sent')
}

export const consentText = (orderNumber: string): string =>
  `Souhlasím s podmínkami spolupráce a s objednávkou č. ${orderNumber}, prohlašuji, že jsem oprávněn za klienta jednat.`

export const NO_STORE = { 'Cache-Control': 'no-store' } as const
