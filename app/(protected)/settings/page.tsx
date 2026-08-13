'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CompanyProfile } from '@/lib/types'
import { useUserRole } from '@/lib/useUserRole'

const EMPTY_FORM = {
  name: '',
  ico: '',
  dic: '',
  address: '',
  city: '',
  zip: '',
  email: '',
  phone: '',
  web: '',
  bank_account: '',
  iban: '',
  swift: '',
  profile_type: 'sro',
  spisova_znacka: '',
}

export default function SettingsPage() {
  const [profiles, setProfiles] = useState<CompanyProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CompanyProfile | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [vatPayer, setVatPayer] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const { role } = useUserRole()
  const isAdmin = role === 'admin'

  const loadProfiles = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('company_profiles')
      .select('*')
      .order('is_default', { ascending: false })
      .order('name')
    setProfiles(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadProfiles() }, [loadProfiles])

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setVatPayer(true)
    setError('')
    setShowModal(true)
  }

  const openEdit = (p: CompanyProfile) => {
    setEditing(p)
    setForm({
      name: p.name,
      ico: p.ico ?? '',
      dic: p.dic ?? '',
      address: p.address ?? '',
      city: p.city ?? '',
      zip: p.zip ?? '',
      email: p.email ?? '',
      phone: p.phone ?? '',
      web: p.web ?? '',
      bank_account: p.bank_account ?? '',
      iban: p.iban ?? '',
      swift: p.swift ?? '',
      profile_type: p.profile_type ?? 'sro',
      spisova_znacka: p.spisova_znacka ?? '',
    })
    setVatPayer(p.vat_payer ?? true)
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Název je povinný'); return }
    setSaving(true)
    setError('')
    if (editing) {
      const { error: err } = await supabase
        .from('company_profiles')
        .update({ ...form, vat_payer: vatPayer })
        .eq('id', editing.id)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const isFirst = profiles.length === 0
      const { error: err } = await supabase.from('company_profiles').insert({
        ...form,
        vat_payer: vatPayer,
        user_id: user!.id,
        workspace_id: '999b13d2-9fd3-4ae6-8ad0-8a1af5dfbbd6',
        is_default: isFirst,
      })
      if (err) { setError(err.message); setSaving(false); return }
    }

    setSaving(false)
    setShowModal(false)
    loadProfiles()
  }

  const setDefault = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('company_profiles').update({ is_default: false }).eq('user_id', user!.id)
    await supabase.from('company_profiles').update({ is_default: true }).eq('id', id)
    loadProfiles()
  }

  const handleDelete = async (p: CompanyProfile) => {
    if (!confirm(`Smazat profil "${p.name}"?`)) return
    await supabase.from('company_profiles').delete().eq('id', p.id)
    loadProfiles()
  }

  const f = (key: keyof typeof EMPTY_FORM) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  })

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Nastavení</h1>
          <p className="text-gray-500 text-sm mt-1">Profily dodavatele pro fakturaci</p>
        </div>
        {isAdmin ? (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-[#F04E12] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#d9430f] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Přidat profil
          </button>
        ) : (
          <button
            disabled
            title="Tato akce vyžaduje roli administrátora"
            className="flex items-center gap-2 bg-gray-100 text-gray-400 px-4 py-2.5 rounded-lg text-sm font-semibold cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Přidat profil
          </button>
        )}
      </div>

      {/* Profile cards */}
      {loading ? (
        <div className="py-20 text-center text-gray-400 text-sm">Načítám…</div>
      ) : profiles.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-20 text-center">
          <div className="w-12 h-12 bg-[#F04E12]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#F04E12]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm mb-4">Žádné profily dodavatele.</p>
          {isAdmin && (
            <button onClick={openAdd} className="text-[#F04E12] text-sm font-medium hover:underline">
              Přidat první profil
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {profiles.map((p) => (
            <div
              key={p.id}
              className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-shadow hover:shadow-md ${
                p.is_default ? 'border-[#F04E12]/30' : 'border-gray-100'
              }`}
            >
              {/* Top stripe for default */}
              {p.is_default && <div className="h-0.5 bg-[#F04E12]" />}

              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: company info */}
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-10 h-10 bg-[#111111] rounded-lg flex items-center justify-center shrink-0">
                      <span className="text-white font-bold text-xs">
                        {p.name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-[#111111]">{p.name}</h3>
                        {p.is_default && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F04E12]/10 text-[#F04E12] text-xs font-medium rounded-full">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            Výchozí
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          p.profile_type === 'osvč'
                            ? 'bg-blue-50 text-blue-600 border border-blue-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                          {p.profile_type === 'osvč' ? 'OSVČ' : 's.r.o.'}
                        </span>
                        {p.vat_payer ? (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
                            Plátce DPH
                          </span>
                        ) : (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                            Neplátce DPH
                          </span>
                        )}
                        {p.ico && <span>IČO {p.ico}</span>}
                        {p.dic && <span>DIČ {p.dic}</span>}
                        {(p.address || p.city) && (
                          <span>{[p.address, p.city].filter(Boolean).join(', ')}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: actions */}
                  {isAdmin && (
                    <div className="flex items-center gap-2 shrink-0">
                      {!p.is_default && (
                        <button
                          onClick={() => setDefault(p.id)}
                          className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:border-[#F04E12] hover:text-[#F04E12] transition-colors"
                        >
                          Nastavit jako výchozí
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(p)}
                        className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:border-gray-300 hover:text-gray-700 transition-colors"
                      >
                        Upravit
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        className="px-3 py-1.5 text-xs font-medium text-gray-400 border border-gray-200 rounded-lg hover:border-red-200 hover:text-red-500 transition-colors"
                      >
                        Smazat
                      </button>
                    </div>
                  )}
                </div>

                {/* Bank details */}
                {(p.bank_account || p.iban) && (
                  <div className="mt-4 pt-4 border-t border-gray-50 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                    {p.bank_account && (
                      <span>
                        <span className="text-gray-400">Účet:</span> {p.bank_account}
                      </span>
                    )}
                    {p.iban && (
                      <span>
                        <span className="text-gray-400">IBAN:</span> {p.iban}
                      </span>
                    )}
                    {p.swift && (
                      <span>
                        <span className="text-gray-400">SWIFT:</span> {p.swift}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4 overflow-hidden">
            <div className="h-1 bg-[#F04E12]" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-[#111111]">
                  {editing ? 'Upravit profil' : 'Nový profil dodavatele'}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Profile type toggle */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Typ subjektu</label>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
                    {(['sro', 'osvč'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setForm((p) => ({ ...p, profile_type: type }))
                          // Auto-set VAT payer default when switching type
                          if (!editing) setVatPayer(type === 'sro')
                        }}
                        className={`flex-1 py-2 transition-colors ${
                          form.profile_type === type
                            ? 'bg-[#111111] text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {type === 'sro' ? 's.r.o.' : 'OSVČ'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* VAT payer checkbox */}
                <label className="flex items-center gap-3 cursor-pointer select-none group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={vatPayer}
                      onChange={(e) => setVatPayer(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-9 h-5 rounded-full transition-colors ${vatPayer ? 'bg-green-500' : 'bg-gray-200'}`} />
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${vatPayer ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Plátce DPH</span>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {vatPayer
                        ? 'Na fakturách se zobrazí DPH rozpis a sazby'
                        : 'Faktury budou bez DPH — bude přidána poznámka "Nejsem plátce DPH"'}
                    </p>
                  </div>
                </label>

                <ModalField label="Název *" placeholder="goodveritas s.r.o." {...f('name')} />

                <div className="grid grid-cols-2 gap-3">
                  <ModalField label="IČO" placeholder="19759584" {...f('ico')} />
                  <ModalField label="DIČ" placeholder="CZ19759584" {...f('dic')} />
                </div>

                <ModalField label="Ulice a číslo" placeholder="Česká 35" {...f('address')} />

                <div className="grid grid-cols-2 gap-3">
                  <ModalField label="Město" placeholder="České Budějovice" {...f('city')} />
                  <ModalField label="PSČ" placeholder="370 01" {...f('zip')} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <ModalField label="Email" placeholder="info@firma.cz" {...f('email')} />
                  <ModalField label="Telefon" placeholder="+420 000 000 000" {...f('phone')} />
                </div>

                <ModalField label="Web" placeholder="vhs.agency" {...f('web')} />

                {/* Spisová značka — s.r.o. only */}
                {form.profile_type === 'sro' && (
                  <ModalField
                    label="Spisová značka"
                    placeholder="např. C 29769 vedená u KS v Českých Budějovicích"
                    {...f('spisova_znacka')}
                  />
                )}

                {/* Bank details section */}
                <div className="pt-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                    Bankovní spojení
                  </p>
                  <div className="space-y-3">
                    <ModalField label="Číslo účtu" placeholder="6630014359/0800" {...f('bank_account')} />
                    <ModalField label="IBAN" placeholder="CZ26 0800 0000 0066 3001 4359" {...f('iban')} />
                    <ModalField label="SWIFT / BIC" placeholder="GIBACZPX" {...f('swift')} />
                  </div>
                </div>
              </div>

              {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Zrušit
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-[#F04E12] text-white rounded-lg text-sm font-semibold hover:bg-[#d9430f] transition-colors disabled:opacity-60"
                >
                  {saving ? 'Ukládám…' : 'Uložit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ModalField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
      />
    </div>
  )
}
