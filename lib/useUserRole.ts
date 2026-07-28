'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export type UserRole = 'admin' | 'accountant'

export function useUserRole(): { role: UserRole; loading: boolean } {
  const [role, setRole] = useState<UserRole>('admin')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.role === 'accountant') setRole('accountant')
          setLoading(false)
        })
    })
  }, [])

  return { role, loading }
}
