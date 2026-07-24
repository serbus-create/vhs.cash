'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Client } from '@/lib/types'

const EMPTY_FORM = {
  name: '', ico: '', dic: '', address: '', city: '', zip: '', email: '', phone: '',
}

const COUNTRIES = [
  { code: 'CZ', label: '🇨🇿 Česká republika' },
  { code: 'AT', label: '🇦🇹 Rakousko' },
  { code: 'SK', label: '🇸🇰 Slovensko' },
  { code: 'PL', label: '🇵🇱 Polsko' },
  { code: 'DE', label: '🇩🇪 Německo' },
]

const VAT_PLACEHOLDER: Record<string, string> = {
  AT: 'ATU12345678',
  SK: 'SK1234567890',
  PL: 'PL1234567890',
  DE: 'DE123456789',
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [country, setCountry] = useState('CZ')
  const [saving, setSaving] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [isVatPayer, setIsVatPayer] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  const supabase = createClient()

  const loadClients = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('clients').select('*').order('name')
    setClients(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadClients() }, [loadClients])

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setCountry('CZ')
    setError('')
    setLookupError('')
    setIsVatPayer(null)
    setShowModal(true)
  }

  const openEdit = (c: Client) => {
    setEditing(c)
    setForm({ name: c.name, ico: c.ico ?? '', dic: c.dic ?? '', address: c.address ?? '', city: c.city ?? '', zip: c.zip ?? '', email: c.email ?? '', phone: c.phone ?? '' })
    setCountry(c.country ?? 'CZ')
    setError('')
    setLookupError('')
    setIsVatPayer(c.dic ? true : null)
    setShowModal(true)
  }

  const lookupCompany = async () => {
    const id = form.ico.trim()
    if (!id) { setLookupError(country === 'CZ' ? 'Zadejte IČO' : 'Zadejte VAT ID'); return }
    setLookupLoading(true)
    setLookupError('')
    setIsVatPayer(null)
    try {
      const url = country === 'CZ'
        ? `/api/ares/${id}`
        : `/api/vies/${country}/${encodeURIComponent(id)}`
      const res = await fetch(url)
      if (!res.ok) {
        setLookupError(country === 'CZ' ? 'Subjekt nenalezen v ARES' : 'Subjekt nenalezen ve VIES')
        return
      }
      const data = await res.json()
      setIsVatPayer(data.is_vat_payer ?? false)
      setForm((f) => ({
        ...f,
        name: data.name || f.name,
        ico: data.ico || f.ico,
        dic: data.dic || '',
        address: data.address || f.address,
        city: data.city || f.city,
        zip: data.zip || f.zip,
      }))
    } catch {
      setLookupError('Chyba při dotazu')
    } finally {
      setLookupLoading(false)
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Název je povinný'); return }
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()

    if (editing) {
      const { error: err } = await supabase.from('clients').update({ ...form, country }).eq('id', editing.id)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('clients').insert({ ...form, country, user_id: user!.id })
      if (err) { setError(err.message); setSaving(false); return }
    }

    setSaving(false)
    setShowModal(false)
    loadClients()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu smazat klienta?')) return
    await supabase.from('clients').delete().eq('id', id)
    loadClients()
  }

  const field = (key: keyof typeof EMPTY_FORM) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  const icoLabel = country === 'CZ' ? 'IČO' : 'VAT ID / UID'
  const icoPlaceholder = country === 'CZ' ? '12345678' : (VAT_PLACEHOLDER[country] ?? '')
  const lookupBtnLabel = country === 'CZ' ? 'Hledat ARES' : 'Hledat VIES'

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Klienti</h1>
          <p className="text-gray-500 text-sm mt-1">{clients.length} klientů</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-[#F04E12] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#d9430f] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Přidat klienta
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm">Načítám…</div>
        ) : clients.length === 0 ? (
          <div className="py-20 text-center text-gray-400 text-sm">
            Žádní klienti.{' '}
            <button onClick={openAdd} className="text-[#F04E12] hover:underline">
              Přidejte prvního.
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Název</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">IČO / VAT ID</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">DIČ</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Město</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-6 py-3.5 font-medium text-[#111111]">{c.name}</td>
                  <td className="px-6 py-3.5 text-gray-500 font-mono text-xs">{c.ico ?? '—'}</td>
                  <td className="px-6 py-3.5 text-gray-500 font-mono text-xs">{c.dic ?? '—'}</td>
                  <td className="px-6 py-3.5 text-gray-600">{c.city ?? '—'}</td>
                  <td className="px-6 py-3.5 text-gray-600">{c.email ?? '—'}</td>
                  <td className="px-6 py-3.5 text-right">
                    <button onClick={() => openEdit(c)} className="text-gray-400 hover:text-[#F04E12] transition-colors mr-3 text-xs font-medium">
                      Upravit
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="text-gray-400 hover:text-red-500 transition-colors text-xs font-medium">
                      Smazat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="h-1 bg-[#F04E12]" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-[#111111]">
                  {editing ? 'Upravit klienta' : 'Přidat klienta'}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Country */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Země</label>
                  <select
                    value={country}
                    onChange={(e) => {
                      setCountry(e.target.value)
                      setLookupError('')
                      setIsVatPayer(null)
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {/* IČO / VAT ID + lookup */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">{icoLabel}</label>
                  <div className="flex gap-2">
                    <input
                      {...field('ico')}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
                      placeholder={icoPlaceholder}
                    />
                    <button
                      type="button"
                      onClick={lookupCompany}
                      disabled={lookupLoading}
                      className="px-4 py-2 bg-[#F04E12]/10 text-[#F04E12] rounded-lg text-sm font-medium hover:bg-[#F04E12]/20 transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {lookupLoading ? '…' : lookupBtnLabel}
                    </button>
                  </div>
                  {lookupError && <p className="text-red-500 text-xs mt-1">{lookupError}</p>}
                </div>

                <FormField label="Název *" placeholder="Firma s.r.o." {...field('name')} />

                {/* DIČ with VAT-payer badge */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <label className="text-xs font-medium text-gray-600">DIČ</label>
                    {isVatPayer === false && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        Neplátce DPH
                      </span>
                    )}
                    {isVatPayer === true && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
                        Plátce DPH
                      </span>
                    )}
                  </div>
                  <input
                    {...field('dic')}
                    placeholder={country === 'CZ' ? 'CZ12345678' : 'EU VAT number'}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
                  />
                </div>

                <FormField label="Ulice a číslo" placeholder="Česká 35" {...field('address')} />

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Město" placeholder="Praha" {...field('city')} />
                  <FormField label="PSČ" placeholder="110 00" {...field('zip')} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Email" placeholder="info@firma.cz" {...field('email')} />
                  <FormField label="Telefon" placeholder="+420 000 000 000" {...field('phone')} />
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

function FormField({
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
