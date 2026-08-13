import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function verifySuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_super_admin) return null
  return user
}

export async function GET() {
  const user = await verifySuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const [{ data: workspaces, error: wsErr }, { data: members, error: membErr }] = await Promise.all([
    admin.from('workspaces').select('id, name, drive_folder_id, created_at').order('created_at'),
    admin.from('workspace_members').select('id, workspace_id, user_id, role, invited_by, joined_at, created_at'),
  ])

  if (wsErr) return NextResponse.json({ error: wsErr.message }, { status: 500 })
  if (membErr) return NextResponse.json({ error: membErr.message }, { status: 500 })

  const allUserIds = Array.from(new Set([
    ...(members ?? []).map((m) => m.user_id as string),
    ...(members ?? []).filter((m) => m.invited_by).map((m) => m.invited_by as string),
  ]))

  const emailMap: Record<string, string> = {}
  await Promise.all(
    allUserIds.map(async (uid) => {
      const { data: { user: u } } = await admin.auth.admin.getUserById(uid)
      if (u?.email) emailMap[uid] = u.email
    })
  )

  const result = (workspaces ?? []).map((ws) => ({
    ...ws,
    members: (members ?? [])
      .filter((m) => m.workspace_id === ws.id)
      .map((m) => ({
        id: m.id,
        user_id: m.user_id,
        email: emailMap[m.user_id as string] ?? null,
        role: m.role,
        joined_at: m.joined_at,
        invited_by_email: m.invited_by ? (emailMap[m.invited_by as string] ?? null) : null,
        created_at: m.created_at,
      })),
  }))

  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const user = await verifySuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const name = (body.name ?? '').trim()
  const drive_folder_id = (body.drive_folder_id ?? '').trim() || null

  if (!name) return NextResponse.json({ error: 'Název workspace je povinný' }, { status: 400 })

  const admin = createAdminClient()
  const { data: workspace, error } = await admin
    .from('workspaces')
    .insert({ name, drive_folder_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(workspace, { status: 201 })
}
