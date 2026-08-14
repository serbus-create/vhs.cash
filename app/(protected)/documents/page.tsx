'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Document, DocumentStatus } from '@/lib/types'
import { formatCurrency, formatDate, monthLabel, STATUS_LABELS, TYPE_LABELS, STATUS_COLORS, getDisplayStatus } from '@/lib/utils'
import { useUserRole } from '@/lib/useUserRole'
import MonthNav from '@/components/month-nav'

type EntityFilter = 'all' | 'osvc' | 'sro'

const STATUS_OPTIONS = ['', 'draft', 'issued', 'sent', 'paid', 'overdue', 'cancelled']

const STATUS_OPTION_LIST: DocumentStatus[] = ['draft', 'issued', 'sent', 'paid', 'overdue', 'cancelled']
const TYPE_OPTIONS = ['', 'faktura', 'nabidka', 'objednavka']

export default function DocumentsPage() {
  const now = new Date()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [navDate, setNavDate] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all')
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [openStatusId, setOpenStatusId] = useState<string | null>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const [paymentDoc, setPaymentDoc] = useState<Document | null>(null)
  const [paymentInput, setPaymentInput] = useState('')
  const supabase = createClient()
  const router = useRouter()
  const { role, workspaceId } = useUserRole()
  const isAdmin = role === 'admin'

  const goPrev = () => setNavDate(({ year, month }) => {
    const d = new Date(year, month - 2)
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })
  const goNext = () => setNavDate(({ year, month }) => {
    const d = new Date(year, month)
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })

  const filtered = useMemo(() => {
    return documents.filter((doc) => {
      const dateStr = doc.issue_date ?? doc.created_at
      const dt = new Date(dateStr)
      if (dt.getFullYear() !== navDate.year || dt.getMonth() + 1 !== navDate.month) return false
      if (entityFilter === 'all') return true
      const want = entityFilter === 'osvc' ? 'osvč' : 'sro'
      return (doc as any).company_profiles?.profile_type === want
    })
  }, [documents, navDate, entityFilter])

  const loadDocs = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    let query = supabase
      .from('documents')
      .select('*, clients(name), company_profiles(name, profile_type)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (typeFilter) query = query.eq('type', typeFilter)
    if (statusFilter) query = query.eq('status', statusFilter)

    const { data } = await query
    setDocuments(data ?? [])
    setLoading(false)
  }, [typeFilter, statusFilter, workspaceId])

  useEffect(() => { loadDocs() }, [loadDocs])

  useEffect(() => {
    if (!openStatusId) return
    const close = () => { setOpenStatusId(null); setDropdownPos(null) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [openStatusId])

  const updateStatus = async (docId: string, newStatus: DocumentStatus) => {
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status: newStatus } : d))
    setOpenStatusId(null)
    setDropdownPos(null)
    await supabase.from('documents').update({ status: newStatus }).eq('id', docId)
  }

  const openPaymentModal = (doc: Document) => {
    setPaymentDoc(doc)
    setPaymentInput(doc.paid_amount != null ? String(doc.paid_amount) : '')
  }

  const savePayment = async () => {
    if (!paymentDoc) return
    const amount = parseFloat(paymentInput)
    if (isNaN(amount) || amount < 0) return
    const total = paymentDoc.amount_czk ?? paymentDoc.total_with_vat ?? 0
    const isFullyPaid = amount >= total
    const updates: Record<string, unknown> = { paid_amount: amount }
    if (isFullyPaid) updates.status = 'paid'
    const { error } = await supabase.from('documents').update(updates).eq('id', paymentDoc.id)
    if (!error) {
      setDocuments(prev => prev.map(d =>
        d.id === paymentDoc.id
          ? { ...d, paid_amount: amount, ...(isFullyPaid ? { status: 'paid' as DocumentStatus } : {}) }
          : d
      ))
      setPaymentDoc(null)
    }
  }

  const deleteDoc = async (id: string) => {
    if (!confirm('Smazat dokument? Tato akce je nevratná.')) return
    await supabase.from('documents').delete().eq('id', id)
    loadDocs()
  }

  const downloadPdf = async (doc: Document) => {
    setDownloadingId(doc.id)
    setPdfError(null)
    try {
      const res = await fetch(`/api/pdf?id=${doc.id}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail ?? body.error ?? `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const typeLabel = doc.type === 'faktura' ? 'Faktura' : doc.type === 'nabidka' ? 'Nabidka' : 'Objednavka'
      a.href = url
      a.download = `${typeLabel}-${doc.number}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF download error:', err)
      setPdfError(String(err))
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Dokumenty</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} dokumentů</p>
        </div>
        {isAdmin ? (
          <Link
            href="/documents/new"
            className="flex items-center gap-2 bg-[#F04E12] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#d9430f] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nový dokument
          </Link>
        ) : (
          <button
            disabled
            title="Tato akce vyžaduje roli administrátora"
            className="flex items-center gap-2 bg-gray-100 text-gray-400 px-4 py-2.5 rounded-lg text-sm font-semibold cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nový dokument
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 mb-6">
        <MonthNav navDate={navDate} onPrev={goPrev} onNext={goNext} />

        <div className="flex bg-gray-100 rounded-lg p-1 gap-0.5">
          {(['osvc', 'sro', 'all'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setEntityFilter(v)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                entityFilter === v
                  ? 'bg-[#F04E12] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {v === 'all' ? 'Vše' : v === 'osvc' ? 'OSVČ' : 's.r.o.'}
            </button>
          ))}
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
        >
          <option value="">Všechny typy</option>
          {TYPE_OPTIONS.filter(Boolean).map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
        >
          <option value="">Všechny statusy</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        {(typeFilter || statusFilter) && (
          <button
            onClick={() => { setTypeFilter(''); setStatusFilter('') }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-[#F04E12] transition-colors"
          >
            Zrušit filtry
          </button>
        )}
      </div>

      {/* PDF error banner */}
      {pdfError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-start justify-between gap-3">
          <span><strong>Chyba PDF:</strong> {pdfError}</span>
          <button onClick={() => setPdfError(null)} className="shrink-0 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm">Načítám…</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-gray-400 text-sm">
            {documents.length === 0 ? (
              <>
                Žádné dokumenty.{' '}
                {isAdmin && (
                  <Link href="/documents/new" className="text-[#F04E12] hover:underline">
                    Vytvořte první.
                  </Link>
                )}
              </>
            ) : (
              `Žádné dokumenty pro ${monthLabel(navDate.year, navDate.month).toLowerCase()}.`
            )}
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-gray-100">
              {filtered.map((doc) => {
                const ds = getDisplayStatus(doc.status, doc.due_date)
                const total = doc.total_with_vat ?? 0
                return (
                  <div
                    key={doc.id}
                    onClick={() => router.push(`/documents/${doc.id}`)}
                    className="p-4 hover:bg-orange-50/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="font-semibold text-[#F04E12] text-sm">{doc.number}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ds] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[ds] ?? doc.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[#111111]">{(doc.clients as any)?.name ?? '—'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{TYPE_LABELS[doc.type] ?? doc.type}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-bold text-[#111111]">{formatCurrency(total, doc.currency)}</span>
                      <span className="text-xs text-gray-400">
                        {doc.due_date ? `Spl. ${formatDate(doc.due_date)}` : formatDate(doc.issue_date)}
                      </span>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                        {doc.type === 'faktura' && (
                          <button
                            onClick={() => openPaymentModal(doc)}
                            className="flex-1 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            Platba
                          </button>
                        )}
                        <button
                          onClick={() => router.push(`/documents/${doc.id}`)}
                          className="flex-1 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          Upravit
                        </button>
                        <button
                          onClick={() => downloadPdf(doc)}
                          disabled={downloadingId === doc.id}
                          className="flex-1 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
                        >
                          {downloadingId === doc.id ? '…' : 'PDF'}
                        </button>
                        <button
                          onClick={() => deleteDoc(doc.id)}
                          className="py-1.5 px-2 border border-gray-200 rounded-lg text-xs font-medium text-red-400 hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Číslo</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Klient</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Vydal</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Typ</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Datum</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Splatnost</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Částka</th>
                {isAdmin && <th className="px-6 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((doc) => (
                <tr
                  key={doc.id}
                  onClick={() => router.push(`/documents/${doc.id}`)}
                  className="hover:bg-orange-50/40 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-3.5 font-medium text-[#F04E12]">{doc.number}</td>
                  <td className="px-6 py-3.5 text-gray-700">{(doc.clients as any)?.name ?? '—'}</td>
                  <td className="px-6 py-3.5">
                    {(doc as any).company_profiles ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-700 truncate max-w-[140px]">{(doc as any).company_profiles.name}</span>
                        {(doc as any).company_profiles.profile_type === 'sro' ? (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">s.r.o.</span>
                        ) : (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600">OSVČ</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-gray-600">{TYPE_LABELS[doc.type] ?? doc.type}</td>
                  <td className="px-6 py-3.5 text-gray-500">{formatDate(doc.issue_date)}</td>
                  <td className="px-6 py-3.5 text-gray-500">{doc.due_date ? formatDate(doc.due_date) : '—'}</td>
                  <td className="px-6 py-3.5" onClick={(e) => e.stopPropagation()}>
                    {isAdmin ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (openStatusId === doc.id) {
                              setOpenStatusId(null)
                              setDropdownPos(null)
                            } else {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                              setDropdownPos({ top: rect.bottom + 4, left: rect.left })
                              setOpenStatusId(doc.id)
                            }
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${STATUS_COLORS[getDisplayStatus(doc.status, doc.due_date)] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {STATUS_LABELS[getDisplayStatus(doc.status, doc.due_date)] ?? doc.status}
                          <svg className="w-2.5 h-2.5 opacity-60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {openStatusId === doc.id && dropdownPos && (
                          <div
                            style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left }}
                            className="z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[170px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {STATUS_OPTION_LIST.map((value) => (
                              <button
                                key={value}
                                onClick={() => updateStatus(doc.id, value)}
                                className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2 ${doc.status === value ? 'bg-gray-50' : ''}`}
                              >
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[value]}`}>
                                  {STATUS_LABELS[value]}
                                </span>
                                {doc.status === value && (
                                  <svg className="w-3 h-3 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[getDisplayStatus(doc.status, doc.due_date)] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[getDisplayStatus(doc.status, doc.due_date)] ?? doc.status}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-right font-medium">
                    {formatCurrency(doc.total_with_vat ?? 0, doc.currency)}
                    {doc.paid_amount != null && doc.paid_amount < (doc.amount_czk ?? doc.total_with_vat ?? 0) && (
                      <div className="text-xs text-gray-400 font-normal mt-0.5">
                        uhrazeno {formatCurrency(doc.paid_amount)}
                      </div>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Record payment — only for faktury */}
                        {doc.type === 'faktura' && (
                          <button
                            onClick={() => openPaymentModal(doc)}
                            className="p-1.5 text-gray-400 hover:text-[#F04E12] transition-colors rounded"
                            title="Zaznamenat platbu"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <rect x="2" y="6" width="20" height="12" rx="2" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                              <circle cx="12" cy="12" r="2" strokeWidth={1.8} />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 12h.01M18 12h.01" />
                            </svg>
                          </button>
                        )}
                        {/* Edit */}
                        <button
                          onClick={() => router.push(`/documents/${doc.id}`)}
                          className="p-1.5 text-gray-400 hover:text-[#F04E12] transition-colors rounded"
                          title="Upravit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>

                        {/* PDF download */}
                        <button
                          onClick={() => downloadPdf(doc)}
                          disabled={downloadingId === doc.id}
                          className="p-1.5 text-gray-400 hover:text-[#F04E12] transition-colors rounded disabled:opacity-40"
                          title="Stáhnout PDF"
                        >
                          {downloadingId === doc.id ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          )}
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => deleteDoc(doc.id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded"
                          title="Smazat"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
            </div>
          </>
        )}
      </div>
      {/* Payment modal */}
      {paymentDoc && (() => {
        const total = paymentDoc.amount_czk ?? paymentDoc.total_with_vat ?? 0
        const inputAmount = parseFloat(paymentInput)
        const remaining = isNaN(inputAmount) ? total : Math.max(0, total - inputAmount)
        const isFullyPaid = !isNaN(inputAmount) && inputAmount >= total
        const canSave = !isNaN(inputAmount) && inputAmount >= 0

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setPaymentDoc(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <h2 className="text-base font-bold text-[#111111]">Zaznamenat platbu</h2>
                <p className="text-sm text-gray-500 mt-1">{paymentDoc.number}</p>
              </div>

              <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-500">Celková částka</span>
                <span className="text-sm font-semibold text-[#111111]">{formatCurrency(total)}</span>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Uhrazeno (Kč)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentInput}
                  onChange={(e) => setPaymentInput(e.target.value)}
                  placeholder="0"
                  autoFocus
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12] focus:border-transparent transition-colors"
                />
                {isFullyPaid ? (
                  <p className="text-xs font-medium text-green-600 pt-0.5">Faktura bude označena jako zaplacena</p>
                ) : (
                  <p className="text-xs text-gray-400 pt-0.5">
                    Zbývá doplatit: {formatCurrency(remaining)}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setPaymentDoc(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Zrušit
                </button>
                <button
                  onClick={savePayment}
                  disabled={!canSave}
                  className="flex-1 px-4 py-2.5 bg-[#F04E12] text-white rounded-lg text-sm font-semibold hover:bg-[#d9430f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Uložit
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
