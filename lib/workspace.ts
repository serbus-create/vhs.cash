import type { SupabaseClient } from '@supabase/supabase-js'

export type WorkspaceRole = 'admin' | 'accountant'

export interface WorkspaceContext {
  workspaceId: string
  role: WorkspaceRole
  driveFolderId: string | null
}

/**
 * Server-side lookup: vrátí workspace context přihlášeného uživatele.
 * Dělá 2 DB dotazy (workspace_members + workspaces). Používat v API routes
 * a server komponentách — NIKDY na klientu (tam použij useUserRole hook).
 */
export async function getWorkspaceContext(
  supabase: SupabaseClient,
): Promise<WorkspaceContext | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .single()

  if (!member) return null

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('drive_folder_id')
    .eq('id', member.workspace_id)
    .single()

  return {
    workspaceId: member.workspace_id as string,
    role: member.role as WorkspaceRole,
    driveFolderId: (workspace?.drive_folder_id as string | null) ?? null,
  }
}
