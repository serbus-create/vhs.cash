'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Client, CompanyProfile, DocumentItem, DocumentStatus, DocumentType } from '@/lib/types'
import { formatCurrency, TYPE_LABELS, STATUS_LABELS } from '@/lib/utils'

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

const STATUS_OPTIONS: { value: DocumentStatus; label: string }[] = [
  { value: 'draft', label: 'Koncept' },
  { value: 'sent', label: 'Vydáno' },
  { value: 'paid', label: 'Zaplaceno' },
  { value: 'cancelled', label: 'Storno' },
]

export default function EditDocumentPage() {
  const router = useRouter()
  const params = useParams()
  const docId = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [docType, setDocType] = useState<DocumentType>('faktura')
  const [status, setStatus] = useState<DocumentStatus>('draft')
  const [number, setNumber] = useState('')
  const [clientId, setClientId] = useState('')
  const [companyProfileId, setCompanyProfileId] = useState('')
  const [subject, setSubject] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [taxDate, setTaxDate] = useState('')
  const [variableSymbol, setVariableSymbol] = useState('')
  const [items, setItems] = useState<LineItem[]>([newItem()])
  const [clients, setClients] = useState<Client[]>([])
  const [companyProfiles, setCompanyProfiles] = useState<CompanyProfile[]>([])
  const [currency, setCurrency] = useState('CZK')
  const [hasExchangeRate, setHasExchangeRate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const [pdfError, setPdfError] = useState('')
  const [saved, setSaved] = useState(false)

  // Derive profile type for DUZP field visibility
  const selectedProfile = companyProfiles.find((p) => p.id === companyProfileId)
  const isSro = selectedProfile?.profile_type === 'sro'

  useEffect(() => {
    Promise.all([
      supabase.from('clients').select('*').order('name'),
      supabase.from('company_profiles').select('*').order('is_default', { ascending: false }).order('name'),
      supabase.from('documents').select('*, document_items(*)').eq('id', docId).single(),
    ]).then(([clientsRes, profilesRes, docRes]) => {
      setClients(clientsRes.data ?? [])
      setCompanyProfiles(profilesRes.data ?? [])

      if (!docRes.data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      const doc = docRes.data
      setDocType(doc.type as DocumentType)
      setStatus(doc.status as DocumentStatus)
      setNumber(doc.number ?? '')
      setClientId(doc.client_id ?? '')
      setCompanyProfileId(doc.company_profile_id ?? '')
      setSubject(doc.subject ?? '')
      setIssueDate(doc.issue_date ?? '')
      setDueDate(doc.due_date ?? '')
      setTaxDate(doc.tax_date ?? '')
      setVariableSymbol(doc.variable_symbol ?? '')
      setCurrency(doc.currency ?? 'CZK')
      setHasExchangeRate(doc.exchange_rate != null)

      const fetchedItems: DocumentItem[] = doc.document_items ?? []
      setItems(
        fetchedItems.length > 0
          ? fetchedItems.map((i) => ({
              id: i.id,
              description: i.description,
              quantity: i.quantity,
              unitPrice: i.unit_price,
              vatRate: i.vat_rate,
            }))
          : [newItem()]
      )
      setLoading(false)
    })
  }, [docId])

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

  const handleUpdate = async () => {
    if (!number.trim()) { setError('Číslo dokumentu je povinné'); return }
    if (items.some((i) => !i.description.trim())) { setError('Každá položka musí mít popis'); return }

    setSaving(true)
    setError('')
    setSaved(false)

    // Dopočítat kurz při prvním přechodu do stavu issued / sent
    const exchangeFields: { exchange_rate?: number; amount_czk?: number } = {}
    if (['issued', 'sent'].includes(status) && !hasExchangeRate) {
      if (currency === 'EUR' && issueDate) {
        try {
          const rateRes = await fetch(`/api/exchange-rate/${issueDate}`)
          if (rateRes.ok) {
            const { rate } = await rateRes.json() as { rate: number }
            exchangeFields.exchange_rate = rate
            exchangeFields.amount_czk = Math.round(totalWithVat * rate * 100) / 100
          }
        } catch { /* nekritická chyba */ }
      } else if (currency === 'CZK') {
        exchangeFields.exchange_rate = 1
        exchangeFields.amount_czk = Math.round(totalWithVat * 100) / 100
      }
    }

    const { error: docErr } = await supabase
      .from('documents')
      .update({
        type: docType,
        status,
        number,
        client_id: clientId || null,
        company_profile_id: companyProfileId || null,
        subject: subject || null,
        issue_date: issueDate,
        due_date: docType === 'faktura' ? (dueDate || null) : null,
        tax_date: (docType === 'faktura' && isSro) ? (taxDate || null) : null,
        variable_symbol: variableSymbol || null,
        currency,
        total_without_vat: Math.round(totalWithoutVat * 100) / 100,
        total_with_vat: Math.round(totalWithVat * 100) / 100,
        ...exchangeFields,
      })
      .eq('id', docId)

    if (docErr) { setError(docErr.message); setSaving(false); return }
    if (exchangeFields.exchange_rate !== undefined) setHasExchangeRate(true)

    // Replace items atomically
    await supabase.from('document_items').delete().eq('document_id', docId)
    const { error: itemsErr } = await supabase.from('document_items').insert(
      items.map((i) => ({
        document_id: docId,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unitPrice,
        vat_rate: i.vatRate,
      }))
    )

    if (itemsErr) { setError(itemsErr.message); setSaving(false); return }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleDownloadPdf = async () => {
    setDownloading(true)
    setPdfError('')
    try {
      const res = await fetch(`/api/pdf?id=${docId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail ?? body.error ?? `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${TYPE_LABELS[docType] ?? docType}-${number}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setPdfError(String(err))
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Načítám…</div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Dokument nenalezen.</p>
        <button onClick={() => router.push('/documents')} className="text-[#F04E12] mt-2 text-sm hover:underline">
          ← Zpět na dokumenty
        </button>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/documents')} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#111111]">{number}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{TYPE_LABELS[docType]}</p>
          </div>
        </div>

        <button
          onClick={handleDownloadPdf}
          disabled={downloading}
          className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:border-[#F04E12] hover:text-[#F04E12] transition-colors disabled:opacity-50"
        >
          {downloading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          Stáhnout PDF
        </button>
      </div>

      {pdfError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-start justify-between gap-3">
          <span><strong>Chyba PDF:</strong> {pdfError}</span>
          <button onClick={() => setPdfError('')} className="shrink-0 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      <div className="space-y-6">
        {/* Basic info */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-[#111111] mb-4 uppercase tracking-wide">Základní informace</h2>
          <div className="grid grid-cols-2 gap-4">

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Typ dokumentu</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocumentType)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
              >
                <option value="faktura">Faktura</option>
                <option value="nabidka">Cenová nabídka</option>
                <option value="objednavka">Objednávka</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as DocumentStatus)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Číslo dokumentu</label>
              <input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Dodavatel
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
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Variabilní symbol</label>
                  <input
                    value={variableSymbol}
                    onChange={(e) => setVariableSymbol(e.target.value)}
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
        <div className="flex gap-3 justify-end items-center">
          {saved && (
            <span className="text-green-600 text-sm font-medium flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Uloženo
            </span>
          )}
          <button
            onClick={() => router.push('/documents')}
            className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Zpět
          </button>
          <button
            onClick={handleUpdate}
            disabled={saving}
            className="px-5 py-2.5 bg-[#F04E12] text-white rounded-lg text-sm font-semibold hover:bg-[#d9430f] transition-colors disabled:opacity-60"
          >
            {saving ? 'Ukládám…' : 'Uložit změny'}
          </button>
        </div>
      </div>
    </div>
  )
}
