import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })

  const admin = createAdminClient()
  await admin
    .from('workspace_members')
    .update({ joined_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('joined_at', null)

  return NextResponse.json({ ok: true })
}
