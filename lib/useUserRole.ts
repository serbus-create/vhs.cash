'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export type UserRole = 'admin' | 'accountant'

export function useUserRole(): {
  role: UserRole
  loading: boolean
  workspaceId: string | null
  isSuperAdmin: boolean
} {
  const [role, setRole] = useState<UserRole>('admin')
  const [loading, setLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }

      const [{ data: member }, { data: profile }] = await Promise.all([
        supabase
          .from('workspace_members')
          .select('workspace_id, role')
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('profiles')
          .select('is_super_admin')
          .eq('id', user.id)
          .single(),
      ])

      if (member) {
        setWorkspaceId(member.workspace_id as string)
        if (member.role === 'accountant') setRole('accountant')
      }
      if (profile?.is_super_admin) setIsSuperAdmin(true)
      setLoading(false)
    })
  }, [])

  return { role, loading, workspaceId, isSuperAdmin }
}
