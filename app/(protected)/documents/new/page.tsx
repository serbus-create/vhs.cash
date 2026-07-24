'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Client, CompanyProfile } from '@/lib/types'
import { formatCurrency, TYPE_PREFIX } from '@/lib/utils'

interface LineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
}

const newItem = (): LineItem => ({
  id: Math.random().toString(36).slice(2),
  description: '',
  quantity: 1,
  unitPrice: 0,
  vatRate: 21,
})

const numericPart = (s: string) => s.replace(/\D/g, '')

export default function NewDocumentPage() {
  const router = useRouter()
  const supabase = createClient()

  const [docType, setDocType] = useState<'faktura' | 'nabidka' | 'objednavka'>('faktura')
  const [number, setNumber] = useState('')
  const [clientId, setClientId] = useState('')
  const [subject, setSubject] = useState('')
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().split('T')[0]
  })
  const [taxDate, setTaxDate] = useState(() => new Date().toISOString().split('T')[0])
  const [variableSymbol, setVariableSymbol] = useState('')
  const [items, setItems] = useState<LineItem[]>([newItem()])
  const [clients, setClients] = useState<Client[]>([])
  const [companyProfiles, setCompanyProfiles] = useState<CompanyProfile[]>([])
  const [companyProfileId, setCompanyProfileId] = useState('')
  const [currency, setCurrency] = useState('CZK')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Track whether the user has manually edited the variable symbol
  const vsManuallyEdited = useRef(false)

  // Derive profile type from selected profile
  const selectedProfile = companyProfiles.find((p) => p.id === companyProfileId)
  const isSro = selectedProfile?.profile_type === 'sro'

  // Load clients and company profiles
  useEffect(() => {
    supabase.from('clients').select('*').order('name').then(({ data }) => setClients(data ?? []))
    supabase
      .from('company_profiles')
      .select('*')
      .order('is_default', { ascending: false })
      .order('name')
      .then(({ data }) => {
        const list = data ?? []
        setCompanyProfiles(list)
        const def = list.find((p) => p.is_default) ?? list[0]
        if (def) setCompanyProfileId(def.id)
      })
  }, [])

  // Generate document number and auto-populate variable symbol on type change
  const generateNumber = useCallback(async (type: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    const year = new Date().getFullYear()
    const { count } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user!.id)
      .eq('type', type)
      .gte('created_at', `${year}-01-01`)
    const seq = String((count ?? 0) + 1).padStart(4, '0')
    const num = `${TYPE_PREFIX[type]}-${year}-${seq}`
    setNumber(num)
    // Reset manual override on type change so VS tracks the new number
    vsManuallyEdited.current = false
    setVariableSymbol(numericPart(num))
  }, [])

  useEffect(() => { generateNumber(docType) }, [docType, generateNumber])

  // When user edits the number field manually, keep VS in sync unless overridden
  const handleNumberChange = (val: string) => {
    setNumber(val)
    if (!vsManuallyEdited.current) {
      setVariableSymbol(numericPart(val))
    }
  }

  // Mark VS as manually overridden once user types in it
  const handleVsChange = (val: string) => {
    vsManuallyEdited.current = true
    setVariableSymbol(val)
  }

  // Computed totals
  const totalWithoutVat = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const vatAmount = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0)
  const totalWithVat = totalWithoutVat + vatAmount

  const updateItem = (id: string, key: keyof LineItem, value: string | number) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [key]: value } : it)))
  }

  const removeItem = (id: string) => {
    if (items.length === 1) return
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const handleSave = async (status: 'draft' | 'sent') => {
    if (!number.trim()) { setError('Číslo dokumentu je povinné'); return }
    if (items.some((i) => !i.description.trim())) { setError('Každá položka musí mít popis'); return }

    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()

    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .insert({
        user_id: user!.id,
        client_id: clientId || null,
        company_profile_id: companyProfileId || null,
        type: docType,
        number,
        subject: subject || null,
        issue_date: issueDate,
        due_date: docType === 'faktura' ? dueDate : null,
        tax_date: (docType === 'faktura' && isSro) ? taxDate : null,
        variable_symbol: variableSymbol || null,
        status,
        currency,
        total_without_vat: Math.round(totalWithoutVat * 100) / 100,
        total_with_vat: Math.round(totalWithVat * 100) / 100,
      })
      .select()
      .single()

    if (docErr || !doc) { setError(docErr?.message ?? 'Chyba při ukládání'); setSaving(false); return }

    const { error: itemsErr } = await supabase.from('document_items').insert(
      items.map((i) => ({
        document_id: doc.id,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unitPrice,
        vat_rate: i.vatRate,
      }))
    )

    if (itemsErr) { setError(itemsErr.message); setSaving(false); return }

    // Dopočítat kurz a CZK ekvivalent při vydání faktury
    if (status !== 'draft') {
      if (currency === 'EUR' && issueDate) {
        try {
          const rateRes = await fetch(`/api/exchange-rate/${issueDate}`)
          if (rateRes.ok) {
            const { rate } = await rateRes.json() as { rate: number }
            await supabase.from('documents').update({
              exchange_rate: rate,
              amount_czk: Math.round(totalWithVat * rate * 100) / 100,
            }).eq('id', doc.id)
          }
        } catch { /* nekritická chyba — kurz lze doplnit zpětně */ }
      } else if (currency === 'CZK') {
        await supabase.from('documents').update({
          exchange_rate: 1,
          amount_czk: Math.round(totalWithVat * 100) / 100,
        }).eq('id', doc.id)
      }
    }

    router.push('/documents')
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-[#111111]">Nový dokument</h1>
      </div>

      <div className="space-y-6">
        {/* Basic info */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-[#111111] mb-4 uppercase tracking-wide">Základní informace</h2>
          <div className="grid grid-cols-2 gap-4">

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Typ dokumentu</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as typeof docType)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
              >
                <option value="faktura">Faktura</option>
                <option value="nabidka">Cenová nabídka</option>
                <option value="objednavka">Objednávka</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Číslo dokumentu</label>
              <input
                value={number}
                onChange={(e) => handleNumberChange(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Dodavatel
                {companyProfiles.length === 0 && (
                  <a href="/settings" className="ml-2 text-[#F04E12] font-normal normal-case hover:underline">
                    + přidat v Nastavení
                  </a>
                )}
              </label>
              <select
                value={companyProfileId}
                onChange={(e) => setCompanyProfileId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
              >
                <option value="">— Bez profilu —</option>
                {companyProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.is_default ? ' ★' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Klient</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
              >
                <option value="">— Vyberte klienta —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Měna</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
              >
                <option value="CZK">CZK — Česká koruna</option>
                <option value="EUR">EUR — Euro</option>
                <option value="PLN">PLN — Polský zlotý</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Předmět</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Popis zakázky"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Datum vystavení</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
              />
            </div>

            {docType === 'faktura' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Datum splatnosti</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
                  />
                </div>

                {/* DUZP — only for s.r.o. profiles */}
                {isSro && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      DUZP
                      <span className="ml-1.5 text-gray-400 font-normal normal-case">datum uskutečnění zdanitelného plnění</span>
                    </label>
                    <input
                      type="date"
                      value={taxDate}
                      onChange={(e) => setTaxDate(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Variabilní symbol
                    <span className="ml-1.5 text-gray-400 font-normal">auto</span>
                  </label>
                  <input
                    value={variableSymbol}
                    onChange={(e) => handleVsChange(e.target.value)}
                    placeholder="20260001"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
                  />
                </div>
              </>
            )}

          </div>
        </div>

        {/* Line items */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-[#111111] uppercase tracking-wide">Položky</h2>
          </div>

          <div className="grid grid-cols-[2fr_80px_120px_80px_110px_36px] gap-2 px-6 py-2 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
            <span>Popis</span>
            <span>Počet</span>
            <span>Cena/ks (bez DPH)</span>
            <span>DPH %</span>
            <span className="text-right">Celkem s DPH</span>
            <span />
          </div>

          <div className="divide-y divide-gray-50">
            {items.map((item, idx) => {
              const lineTotal = item.quantity * item.unitPrice * (1 + item.vatRate / 100)
              return (
                <div key={item.id} className="grid grid-cols-[2fr_80px_120px_80px_110px_36px] gap-2 px-6 py-3 items-center">
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                    placeholder={`Položka ${idx + 1}`}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
                  />
                  <input
                    type="number" min="0" step="0.001"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
                  />
                  <input
                    type="number" min="0" step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
                  />
                  <select
                    value={item.vatRate}
                    onChange={(e) => updateItem(item.id, 'vatRate', parseFloat(e.target.value))}
                    className="px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
                  >
                    <option value={0}>0 %</option>
                    <option value={12}>12 %</option>
                    <option value={21}>21 %</option>
                  </select>
                  <span className="text-right text-sm font-medium text-[#111111]">
                    {formatCurrency(lineTotal, currency)}
                  </span>
                  <button
                    onClick={() => removeItem(item.id)}
                    disabled={items.length === 1}
                    className="flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors disabled:opacity-20"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>

          <div className="px-6 py-4 border-t border-gray-100">
            <button
              onClick={() => setItems((prev) => [...prev, newItem()])}
              className="flex items-center gap-2 text-sm text-[#F04E12] font-medium hover:text-[#d9430f] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Přidat položku
            </button>
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="max-w-xs ml-auto space-y-2 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Základ DPH</span>
              <span>{formatCurrency(totalWithoutVat, currency)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>DPH</span>
              <span>{formatCurrency(vatAmount, currency)}</span>
            </div>
            <div className="flex justify-between font-bold text-base text-[#111111] border-t border-gray-100 pt-2 mt-2">
              <span>Celkem s DPH</span>
              <span className="text-[#F04E12]">{formatCurrency(totalWithVat, currency)}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{error}</div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => router.back()}
            className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Zrušit
          </button>
          <button
            onClick={() => handleSave('draft')}
            disabled={saving}
            className="px-5 py-2.5 border border-[#F04E12] text-[#F04E12] rounded-lg text-sm font-semibold hover:bg-[#F04E12]/5 transition-colors disabled:opacity-60"
          >
            Uložit jako koncept
          </button>
          <button
            onClick={() => handleSave('sent')}
            disabled={saving}
            className="px-5 py-2.5 bg-[#F04E12] text-white rounded-lg text-sm font-semibold hover:bg-[#d9430f] transition-colors disabled:opacity-60"
          >
            {saving ? 'Ukládám…' : 'Vytvořit dokument'}
          </button>
        </div>
      </div>
    </div>
  )
}
