'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUserRole } from '@/lib/useUserRole'

interface WorkspaceMember {
  id: string
  user_id: string
  email: string | null
  role: 'admin' | 'accountant'
  joined_at: string | null
  invited_by_email: string | null
  created_at: string
}

interface Workspace {
  id: string
  name: string
  drive_folder_id: string | null
  created_at: string
  members: WorkspaceMember[]
}

export default function AdminWorkspacesPage() {
  const { isSuperAdmin, loading: roleLoading } = useUserRole()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDrive, setCreateDrive] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [inviteWorkspaceId, setInviteWorkspaceId] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'accountant'>('admin')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/workspaces')
      if (!res.ok) {
        const body = await res.json()
        setError(body.error ?? 'Chyba při načítání')
      } else {
        setWorkspaces(await res.json())
      }
    } catch {
      setError('Síťová chyba')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!roleLoading && isSuperAdmin) fetchWorkspaces()
    if (!roleLoading && !isSuperAdmin) setLoading(false)
  }, [roleLoading, isSuperAdmin, fetchWorkspaces])

  const handleCreate = async () => {
    if (!createName.trim()) { setCreateError('Název je povinný'); return }
    setCreating(true)
    setCreateError('')
    const res = await fetch('/api/admin/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: createName.trim(), drive_folder_id: createDrive.trim() || null }),
    })
    const body = await res.json()
    if (!res.ok) {
      setCreateError(body.error ?? 'Chyba')
    } else {
      setShowCreateModal(false)
      setCreateName('')
      setCreateDrive('')
      fetchWorkspaces()
    }
    setCreating(false)
  }

  const openInvite = (wsId: string) => {
    setInviteWorkspaceId(wsId)
    setInviteEmail('')
    setInviteRole('admin')
    setInviteError('')
    setInviteSuccess('')
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteWorkspaceId) { setInviteError('E-mail je povinný'); return }
    setInviting(true)
    setInviteError('')
    setInviteSuccess('')
    const res = await fetch('/api/admin/invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim(), workspace_id: inviteWorkspaceId, role: inviteRole }),
    })
    const body = await res.json()
    if (!res.ok) {
      setInviteError(body.error ?? 'Chyba')
    } else {
      setInviteSuccess(body.message)
      setInviteEmail('')
      fetchWorkspaces()
    }
    setInviting(false)
  }

  if (roleLoading || loading) {
    return (
      <div className="p-8 text-center text-gray-400 text-sm">Načítám…</div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="p-8 max-w-lg">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 font-semibold">Přístup odepřen</p>
          <p className="text-red-500 text-sm mt-1">Tato stránka je dostupná pouze pro super administrátory.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Správa workspace</h1>
          <p className="text-gray-500 text-sm mt-1">Přehled všech workspace a jejich členů</p>
        </div>
        <button
          onClick={() => { setShowCreateModal(true); setCreateError('') }}
          className="flex items-center gap-2 bg-[#F04E12] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#d9430f] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nový workspace
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
      )}

      {workspaces.length === 0 && !error && (
        <div className="bg-white border border-gray-100 rounded-xl p-12 text-center text-gray-400 text-sm">
          Žádné workspace.
        </div>
      )}

      <div className="space-y-6">
        {workspaces.map((ws) => (
          <div key={ws.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div>
                <h2 className="font-semibold text-[#111111]">{ws.name}</h2>
                <div className="flex items-center gap-4 mt-0.5 text-xs text-gray-400">
                  <span>ID: <span className="font-mono">{ws.id}</span></span>
                  {ws.drive_folder_id && (
                    <span>Drive: <span className="font-mono">{ws.drive_folder_id}</span></span>
                  )}
                  <span>Vytvořeno: {new Date(ws.created_at).toLocaleDateString('cs-CZ')}</span>
                </div>
              </div>
              <button
                onClick={() => openInvite(ws.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#F04E12] border border-[#F04E12]/30 rounded-lg hover:bg-[#F04E12]/5 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Pozvat uživatele
              </button>
            </div>

            {ws.members.length === 0 ? (
              <div className="px-5 py-4 text-sm text-gray-400">Žádní členové.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-50">
                    <th className="px-5 py-2.5 text-left font-medium">E-mail</th>
                    <th className="px-5 py-2.5 text-left font-medium">Role</th>
                    <th className="px-5 py-2.5 text-left font-medium">Stav</th>
                    <th className="px-5 py-2.5 text-left font-medium">Pozval</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ws.members.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3 font-medium text-[#111111]">{m.email ?? m.user_id}</td>
                      <td className="px-5 py-3">
                        <RoleBadge role={m.role} />
                      </td>
                      <td className="px-5 py-3">
                        {m.joined_at ? (
                          <span className="text-green-600 text-xs font-medium">
                            Přijato {new Date(m.joined_at).toLocaleDateString('cs-CZ')}
                          </span>
                        ) : (
                          <span className="text-amber-500 text-xs font-medium">Čeká na přijetí</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs">{m.invited_by_email ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>

      {/* Create workspace modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="h-1 bg-[#F04E12]" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-[#111111]">Nový workspace</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4">
                <FormField
                  label="Název workspace *"
                  placeholder="Jakub Novák"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                />
                <FormField
                  label="Google Drive folder ID (volitelně)"
                  placeholder="0AG4MXXvRHurBUk9PVA"
                  value={createDrive}
                  onChange={(e) => setCreateDrive(e.target.value)}
                />
              </div>
              {createError && <p className="text-red-500 text-sm mt-3">{createError}</p>}
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Zrušit
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 py-2.5 bg-[#F04E12] text-white rounded-lg text-sm font-semibold hover:bg-[#d9430f] transition-colors disabled:opacity-60"
                >
                  {creating ? 'Vytvářím…' : 'Vytvořit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite user modal */}
      {inviteWorkspaceId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="h-1 bg-[#F04E12]" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-[#111111]">Pozvat uživatele</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {workspaces.find((w) => w.id === inviteWorkspaceId)?.name}
                  </p>
                </div>
                <button onClick={() => setInviteWorkspaceId(null)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4">
                <FormField
                  label="E-mail *"
                  placeholder="uzivatel@firma.cz"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  type="email"
                />
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Role</label>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
                    {(['admin', 'accountant'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setInviteRole(r)}
                        className={`flex-1 py-2 transition-colors ${
                          inviteRole === r
                            ? 'bg-[#111111] text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {r === 'admin' ? 'Admin' : 'Účetní'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {inviteError && <p className="text-red-500 text-sm mt-3">{inviteError}</p>}
              {inviteSuccess && (
                <p className="text-green-600 text-sm mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  {inviteSuccess}
                </p>
              )}
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setInviteWorkspaceId(null)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Zavřít
                </button>
                <button
                  onClick={handleInvite}
                  disabled={inviting}
                  className="flex-1 py-2.5 bg-[#F04E12] text-white rounded-lg text-sm font-semibold hover:bg-[#d9430f] transition-colors disabled:opacity-60"
                >
                  {inviting ? 'Odesílám…' : 'Pozvat'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  return role === 'admin' ? (
    <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-[#111111] text-white">
      Admin
    </span>
  ) : (
    <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-200">
      Účetní
    </span>
  )
}

function FormField({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  placeholder: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
      />
    </div>
  )
}
