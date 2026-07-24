'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Document, DocumentStatus } from '@/lib/types'
import { formatCurrency, formatDate, STATUS_LABELS, TYPE_LABELS, STATUS_COLORS, getDisplayStatus } from '@/lib/utils'

const STATUS_OPTIONS = ['', 'draft', 'issued', 'sent', 'paid', 'overdue', 'cancelled']

const STATUS_OPTION_LIST: DocumentStatus[] = ['draft', 'issued', 'sent', 'paid', 'overdue', 'cancelled']
const TYPE_OPTIONS = ['', 'faktura', 'nabidka', 'objednavka']

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [openStatusId, setOpenStatusId] = useState<string | null>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const supabase = createClient()
  const router = useRouter()

  const loadDocs = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('documents')
      .select('*, clients(name), company_profiles(name, profile_type)')
      .order('created_at', { ascending: false })

    if (typeFilter) query = query.eq('type', typeFilter)
    if (statusFilter) query = query.eq('status', statusFilter)

    const { data } = await query
    setDocuments(data ?? [])
    setLoading(false)
  }, [typeFilter, statusFilter])

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
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Dokumenty</h1>
          <p className="text-gray-500 text-sm mt-1">{documents.length} dokumentů</p>
        </div>
        <Link
          href="/documents/new"
          className="flex items-center gap-2 bg-[#F04E12] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#d9430f] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nový dokument
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
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
        ) : documents.length === 0 ? (
          <div className="py-20 text-center text-gray-400 text-sm">
            Žádné dokumenty.{' '}
            <Link href="/documents/new" className="text-[#F04E12] hover:underline">
              Vytvořte první.
            </Link>
          </div>
        ) : (
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
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {documents.map((doc) => (
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
                  </td>
                  <td className="px-6 py-3.5 text-right font-medium">{formatCurrency(doc.total_with_vat ?? 0, doc.currency)}</td>
                  <td className="px-6 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
