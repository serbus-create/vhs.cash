'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  formatCurrency,
  formatDate,
  STATUS_COLORS,
  STATUS_LABELS,
  getDisplayStatus,
} from '@/lib/utils'

// ---------- types ----------

interface AccountingDoc {
  id: string
  number: string
  status: string
  issue_date: string | null
  due_date: string | null
  currency: string
  total_with_vat: number
  amount_czk: number | null
  paid_amount: number | null
  clients: { name: string } | null
  company_profiles: { name: string; profile_type: string } | null
}

type EntityFilter = 'all' | 'osvc' | 'sro'
type Tab = 'faktury' | 'podklady'

interface MockFile {
  id: string
  name: string
  size: number
  type: string
  uploadedAt: Date
}

// ---------- constants ----------

const MONTH_SLUGS = [
  'leden', 'unor', 'brezen', 'duben', 'kveten', 'cerven',
  'cervenec', 'srpen', 'zari', 'rijen', 'listopad', 'prosinec',
]

function monthLabel(year: number, month: number): string {
  const raw = new Date(year, month - 1, 1).toLocaleDateString('cs-CZ', {
    month: 'long',
    year: 'numeric',
  })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fileIcon(type: string) {
  const isPdf = type === 'application/pdf'
  if (isPdf) {
    return (
      <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h.01M12 12h3" />
        </svg>
      </div>
    )
  }
  return (
    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  )
}

// ---------- MonthNav shared component ----------

function MonthNav({
  navDate,
  onPrev,
  onNext,
}: {
  navDate: { year: number; month: number }
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-1 py-1">
      <button
        onClick={onPrev}
        className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-[#111111] transition-colors"
        aria-label="Předchozí měsíc"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <span className="min-w-[160px] text-center text-sm font-semibold text-[#111111] select-none px-1">
        {monthLabel(navDate.year, navDate.month)}
      </span>
      <button
        onClick={onNext}
        className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-[#111111] transition-colors"
        aria-label="Následující měsíc"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}

// ---------- main component ----------

export default function AccountingPage() {
  const supabase = createClient()
  const now = new Date()

  const [activeTab, setActiveTab] = useState<Tab>('faktury')

  // — Faktury tab state —
  const [navDate, setNavDate] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all')
  const [docs, setDocs] = useState<AccountingDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  // — Podklady tab state —
  const [podkladyNavDate, setPodkladyNavDate] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const [mockFiles, setMockFiles] = useState<MockFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase
      .from('documents')
      .select(
        'id, number, status, issue_date, due_date, currency, total_with_vat, amount_czk, paid_amount, clients(name), company_profiles(name, profile_type)',
      )
      .eq('type', 'faktura')
      .neq('status', 'draft')
      .order('issue_date', { ascending: false })
      .then(({ data }) => {
        setDocs((data ?? []) as unknown as AccountingDoc[])
        setLoading(false)
      })
  }, [])

  // — Faktury navigation —
  const goPrev = () =>
    setNavDate(({ year, month }) => {
      const d = new Date(year, month - 2)
      return { year: d.getFullYear(), month: d.getMonth() + 1 }
    })
  const goNext = () =>
    setNavDate(({ year, month }) => {
      const d = new Date(year, month)
      return { year: d.getFullYear(), month: d.getMonth() + 1 }
    })

  // — Podklady navigation —
  const goPodkladyPrev = () =>
    setPodkladyNavDate(({ year, month }) => {
      const d = new Date(year, month - 2)
      return { year: d.getFullYear(), month: d.getMonth() + 1 }
    })
  const goPodkladyNext = () =>
    setPodkladyNavDate(({ year, month }) => {
      const d = new Date(year, month)
      return { year: d.getFullYear(), month: d.getMonth() + 1 }
    })

  const filtered = useMemo(() => {
    return docs.filter((d) => {
      if (!d.issue_date) return false
      const dt = new Date(d.issue_date)
      if (dt.getFullYear() !== navDate.year || dt.getMonth() + 1 !== navDate.month) return false
      if (entityFilter === 'all') return true
      const want = entityFilter === 'osvc' ? 'osvč' : 'sro'
      return d.company_profiles?.profile_type === want
    })
  }, [docs, navDate, entityFilter])

  const filteredPodklady = useMemo(() => {
    return mockFiles.filter((f) => {
      const d = f.uploadedAt
      return d.getFullYear() === podkladyNavDate.year && d.getMonth() + 1 === podkladyNavDate.month
    })
  }, [mockFiles, podkladyNavDate])

  // ZIP download
  const handleZipDownload = async () => {
    if (filtered.length === 0) return
    setDownloading(true)
    setDownloadError('')
    try {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      await Promise.all(
        filtered.map(async (doc) => {
          const res = await fetch(`/api/pdf?id=${doc.id}`)
          if (!res.ok) return
          const buf = await res.arrayBuffer()
          zip.file(`${doc.number.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`, buf)
        }),
      )
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `faktury-${MONTH_SLUGS[navDate.month - 1]}-${navDate.year}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setDownloadError(String(err))
    } finally {
      setDownloading(false)
    }
  }

  // Mock file upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    const newFiles: MockFile[] = files.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      size: f.size,
      type: f.type,
      uploadedAt: new Date(),
    }))
    setMockFiles((prev) => [...newFiles, ...prev])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDeleteMockFile = (id: string) => {
    setMockFiles((prev) => prev.filter((f) => f.id !== id))
  }

  // ---------- render ----------

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <h1 className="text-2xl font-bold text-[#111111]">Účetnictví</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['faktury', 'podklady'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-[#F04E12] text-[#F04E12]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab === 'faktury' ? 'Faktury' : 'Podklady pro účetní'}
          </button>
        ))}
      </div>

      {/* ── TAB: Faktury ── */}
      {activeTab === 'faktury' && (
        <>
          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-4">
            <MonthNav navDate={navDate} onPrev={goPrev} onNext={goNext} />

            {/* Entity filter */}
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

            {/* ZIP download */}
            <div className="ml-auto flex items-center gap-3">
              {downloadError && <span className="text-xs text-red-600">{downloadError}</span>}
              <button
                onClick={handleZipDownload}
                disabled={downloading || filtered.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-[#F04E12] text-white rounded-lg text-sm font-semibold hover:bg-[#d9430f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                {downloading ? 'Generuji…' : `Stáhnout vše (ZIP)${filtered.length ? ` · ${filtered.length}` : ''}`}
              </button>
            </div>
          </div>

          {/* Invoice table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
              <h2 className="text-sm font-semibold text-[#111111] uppercase tracking-wide">Faktury</h2>
              {!loading && <span className="text-xs text-gray-400">{filtered.length} záznamů</span>}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-gray-400 text-sm">Načítám…</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Číslo</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Klient</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Vystavovatel</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Vydáno</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Splatnost</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Celkem (CZK)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.length > 0 ? (
                      filtered.map((doc) => {
                        const ds = getDisplayStatus(doc.status, doc.due_date)
                        const czk = doc.amount_czk ?? doc.total_with_vat
                        const isPartial = doc.paid_amount != null && doc.paid_amount < czk
                        return (
                          <tr key={doc.id} className="hover:bg-gray-50/60 transition-colors">
                            <td className="px-6 py-3 font-medium text-[#F04E12] whitespace-nowrap">{doc.number}</td>
                            <td className="px-6 py-3 text-gray-700">{doc.clients?.name ?? '—'}</td>
                            <td className="px-6 py-3 text-gray-600">{doc.company_profiles?.name ?? '—'}</td>
                            <td className="px-6 py-3 text-gray-500 whitespace-nowrap">{formatDate(doc.issue_date)}</td>
                            <td className="px-6 py-3 text-gray-500 whitespace-nowrap">{formatDate(doc.due_date)}</td>
                            <td className="px-6 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLORS[ds] ?? 'bg-gray-100 text-gray-600'}`}>
                                {STATUS_LABELS[ds] ?? ds}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-right font-medium whitespace-nowrap">
                              <span className={isPartial ? 'text-gray-400 line-through text-xs' : ''}>
                                {formatCurrency(czk)}
                              </span>
                              {doc.currency === 'EUR' && doc.amount_czk != null && (
                                <span className="ml-1.5 text-gray-400 font-normal text-xs">
                                  ({formatCurrency(doc.total_with_vat, 'EUR')})
                                </span>
                              )}
                              {isPartial && (
                                <div className="text-[#F04E12] font-semibold">
                                  {formatCurrency(doc.paid_amount!)} zaplaceno
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-16 text-center text-gray-400 text-sm">
                          Žádné faktury pro {monthLabel(navDate.year, navDate.month).toLowerCase()}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── TAB: Podklady pro účetní ── */}
      {activeTab === 'podklady' && (
        <div className="space-y-6">
          {/* Header card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-[#111111]">Podklady pro účetní</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Nahrávejte sem faktury od dodavatelů, výpisy z banky, účtenky a další podklady pro měsíční uzávěrku.
                </p>
                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Soubory se zatím neukládají trvale — připravujeme napojení na Google Disk.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Upload button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-[#F04E12] text-white rounded-lg text-sm font-semibold hover:bg-[#d9430f] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Nahrát soubor
                </button>
                {/* Download all — disabled, upcoming */}
                <div className="relative group">
                  <button
                    disabled
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm font-semibold cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Stáhnout vše
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    Bude dostupné po napojení Google Disku
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Month navigation */}
          <div className="flex items-center gap-4">
            <MonthNav navDate={podkladyNavDate} onPrev={goPodkladyPrev} onNext={goPodkladyNext} />
            <span className="text-sm text-gray-400">
              {filteredPodklady.length === 0
                ? 'Žádné soubory pro tento měsíc'
                : `${filteredPodklady.length} soubor${filteredPodklady.length === 1 ? '' : filteredPodklady.length < 5 ? 'y' : 'ů'}`}
            </span>
          </div>

          {/* File list */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {filteredPodklady.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-400 text-sm">
                  Žádné soubory pro {monthLabel(podkladyNavDate.year, podkladyNavDate.month).toLowerCase()}.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 text-[#F04E12] text-sm font-medium hover:underline"
                >
                  Nahrát první soubor
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Soubor</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Typ</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Velikost</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Nahráno</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredPodklady.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          {fileIcon(f.type)}
                          <span className="font-medium text-[#111111] truncate max-w-[280px]">{f.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-gray-500 text-xs font-mono uppercase">
                        {f.type === 'application/pdf' ? 'PDF' : f.type.split('/')[1]?.toUpperCase() ?? f.type}
                      </td>
                      <td className="px-6 py-3.5 text-gray-500 text-xs">{formatFileSize(f.size)}</td>
                      <td className="px-6 py-3.5 text-gray-500 text-xs whitespace-nowrap">
                        {f.uploadedAt.toLocaleString('cs-CZ', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => handleDeleteMockFile(f.id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded"
                          title="Odebrat"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
