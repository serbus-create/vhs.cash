import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nepřihlášen' }, { status: 401 })

  const body = await req.json()
  const email = (body.email ?? '').trim().toLowerCase()
  const workspace_id = body.workspace_id as string | undefined
  const role = body.role as string | undefined

  if (!email || !workspace_id || !role) {
    return NextResponse.json({ error: 'Chybí povinné parametry: email, workspace_id, role' }, { status: 400 })
  }
  if (!['admin', 'accountant'].includes(role)) {
    return NextResponse.json({ error: 'Neplatná role — povoleno: admin, accountant' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) {
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const admin = createAdminClient()

  const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })

  const existingUser = users.find((u) => u.email?.toLowerCase() === email)

  if (existingUser) {
    const { data: existingMember } = await admin
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', existingUser.id)
      .maybeSingle()

    if (existingMember) {
      return NextResponse.json(
        { error: 'Uživatel je již členem tohoto workspace' },
        { status: 409 }
      )
    }

    const { error: insertErr } = await admin.from('workspace_members').insert({
      workspace_id,
      user_id: existingUser.id,
      role,
      invited_by: user.id,
      joined_at: null,
    })

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

    return NextResponse.json({
      ok: true,
      existing_user: true,
      message: 'Uživatel již má účet — byl přidán do workspace, ale pozvánkový e-mail nebyl odeslán.',
    })
  }

  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { workspace_id, workspace_role: role },
  })

  if (inviteErr) return NextResponse.json({ error: inviteErr.message }, { status: 500 })

  const { error: memberErr } = await admin.from('workspace_members').insert({
    workspace_id,
    user_id: invited.user.id,
    role,
    invited_by: user.id,
    joined_at: null,
  })

  if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 })

  return NextResponse.json(
    { ok: true, existing_user: false, message: 'Pozvánkový e-mail byl odeslán.' },
    { status: 201 }
  )
}
