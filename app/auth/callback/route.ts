import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user?.user_metadata?.workspace_id) {
        const workspaceId = user.user_metadata.workspace_id as string
        const admin = createAdminClient()
        await admin
          .from('workspace_members')
          .update({ joined_at: new Date().toISOString() })
          .eq('workspace_id', workspaceId)
          .eq('user_id', user.id)
          .is('joined_at', null)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
