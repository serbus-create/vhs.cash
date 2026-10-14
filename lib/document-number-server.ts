// Pouze server: atomické číslování dokladů přes RPC next_document_number (migrace 026).
// Funkce je dostupná jen roli service_role, proto vyžaduje admin klienta (lib/supabase/admin.ts).
import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>

/** Vrátí další číslo řady, např. VY-2026-0001. */
export async function nextServerNumber(
  admin: Admin,
  workspaceId: string,
  type: string,
  prefix: string,
  year: number,
): Promise<string> {
  const { data, error } = await admin.rpc('next_document_number', {
    p_workspace: workspaceId,
    p_type: type,
    p_prefix: prefix,
    p_year: year,
  })
  if (error || typeof data !== 'string' || !data) {
    throw new Error('Číslo dokladu se nepodařilo přidělit')
  }
  return data
}
