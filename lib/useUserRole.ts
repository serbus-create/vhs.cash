'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export type UserRole = 'admin' | 'accountant'

export function useUserRole(): { role: UserRole; loading: boolean; workspaceId: string | null } {
  const [role, setRole] = useState<UserRole>('admin')
  const [loading, setLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      supabase
        .from('workspace_members')
        .select('workspace_id, role')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setWorkspaceId(data.workspace_id as string)
            if (data.role === 'accountant') setRole('accountant')
          }
          setLoading(false)
        })
    })
  }, [])

  return { role, loading, workspaceId }
}
