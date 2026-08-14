'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useUserRole } from '@/lib/useUserRole'
import {
  formatCurrency,
  formatDate,
  STATUS_LABELS,
  TYPE_LABELS,
  STATUS_COLORS,
  getDisplayStatus,
} from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

// ---------- types ----------

interface DashboardDoc {
  id: string
  number: string
  type: string
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

// ---------- constants ----------

const MONTHS = [
  { num: 1,  short: 'Led', long: 'Leden' },
  { num: 2,  short: 'Úno', long: 'Únor' },
  { num: 3,  short: 'Bře', long: 'Březen' },
  { num: 4,  short: 'Dub', long: 'Duben' },
  { num: 5,  short: 'Kvě', long: 'Květen' },
  { num: 6,  short: 'Čvn', long: 'Červen' },
  { num: 7,  short: 'Čvc', long: 'Červenec' },
  { num: 8,  short: 'Srp', long: 'Srpen' },
  { num: 9,  short: 'Zář', long: 'Září' },
  { num: 10, short: 'Říj', long: 'Říjen' },
  { num: 11, short: 'Lis', long: 'Listopad' },
  { num: 12, short: 'Pro', long: 'Prosinec' },
]

const THIS_YEAR = new Date().getFullYear()
const AVAILABLE_YEARS = Array.from({ length: THIS_YEAR - 2024 + 1 }, (_, i) => 2024 + i)
const YEAR_COLORS = ['#F04E12', '#111111', '#3b82f6', '#10b981', '#8b5cf6']

function czk(d: DashboardDoc) {
  return d.amount_czk ?? d.total_with_vat ?? 0
}

// ---------- page ----------

export default function DashboardPage() {
  const supabase = createClient()
  const { role, workspaceId } = useUserRole()
  const isAdmin = role === 'admin'
  const now = new Date()

  const [docs, setDocs] = useState<DashboardDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all')
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(new Set())
  const [selectedYears, setSelectedYears] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!workspaceId) return
    supabase
      .from('documents')
      .select(
        'id, number, type, status, issue_date, due_date, currency, total_with_vat, amount_czk, paid_amount, clients(name), company_profiles(name, profile_type)',
      )
      .eq('workspace_id', workspaceId)
      .neq('status', 'draft')
      .order('issue_date', { ascending: false })
      .then(({ data }) => {
        setDocs((data ?? []) as unknown as DashboardDoc[])
        setLoading(false)
      })
  }, [workspaceId])

  // entity filter
  const entityFiltered = useMemo(() => {
    if (entityFilter === 'all') return docs
    const want = entityFilter === 'osvc' ? 'osvč' : 'sro'
    return docs.filter((d) => d.company_profiles?.profile_type === want)
  }, [docs, entityFilter])

  // period filter (for financial KPI cards + chart)
  const periodFiltered = useMemo(() => {
    if (selectedMonths.size === 0 && selectedYears.size === 0) return entityFiltered
    return entityFiltered.filter((d) => {
      if (!d.issue_date) return false
      const dt = new Date(d.issue_date)
      const monthOk = selectedMonths.size === 0 || selectedMonths.has(dt.getMonth() + 1)
      const yearOk = selectedYears.size === 0 || selectedYears.has(dt.getFullYear())
      return monthOk && yearOk
    })
  }, [entityFiltered, selectedMonths, selectedYears])

  // KPI — all cards use periodFiltered (entity + period filter)
  const kpiPaid = useMemo(
    () => periodFiltered
      .filter((d) => d.type === 'faktura' && getDisplayStatus(d.status, d.due_date) === 'paid')
      .reduce((s, d) => s + czk(d), 0),
    [periodFiltered],
  )
  const kpiPending = useMemo(
    () => periodFiltered
      .filter((d) => d.type === 'faktura' && ['issued', 'sent', 'overdue'].includes(getDisplayStatus(d.status, d.due_date)))
      .reduce((s, d) => s + czk(d), 0),
    [periodFiltered],
  )
  const kpiOverdue = useMemo(
    () => periodFiltered
      .filter((d) => d.type === 'faktura' && getDisplayStatus(d.status, d.due_date) === 'overdue')
      .reduce((s, d) => s + czk(d), 0),
    [periodFiltered],
  )
  const kpiDocCount = useMemo(
    () => periodFiltered.filter((d) => d.type === 'faktura').length,
    [periodFiltered],
  )

  // overdue count for banner
  const overdueCount = useMemo(
    () => entityFiltered.filter((d) => getDisplayStatus(d.status, d.due_date) === 'overdue').length,
    [entityFiltered],
  )

  // recent docs (entity filtered, top 10)
  const recentDocs = useMemo(() => entityFiltered.slice(0, 10), [entityFiltered])

  // chart
  const chartMonths = useMemo(
    () => (selectedMonths.size > 0 ? MONTHS.filter((m) => selectedMonths.has(m.num)) : MONTHS),
    [selectedMonths],
  )
  const chartYears = useMemo(
    () => (selectedYears.size > 0 ? Array.from(selectedYears).sort((a, b) => a - b) : AVAILABLE_YEARS),
    [selectedYears],
  )
  const chartData = useMemo(() => {
    const paid = entityFiltered.filter((d) => getDisplayStatus(d.status, d.due_date) === 'paid')
    return chartMonths.map((m) => {
      const row: Record<string, number | string> = { month: m.short }
      for (const year of chartYears) {
        row[String(year)] = paid
          .filter((d) => {
            if (!d.issue_date) return false
            const dt = new Date(d.issue_date)
            return dt.getMonth() + 1 === m.num && dt.getFullYear() === year
          })
          .reduce((s, d) => s + czk(d), 0)
      }
      return row
    })
  }, [entityFiltered, chartMonths, chartYears])

  const toggleMonth = (m: number) =>
    setSelectedMonths((prev) => { const n = new Set(prev); n.has(m) ? n.delete(m) : n.add(m); return n })
  const toggleYear = (y: number) =>
    setSelectedYears((prev) => { const n = new Set(prev); n.has(y) ? n.delete(y) : n.add(y); return n })

  // ---------- render ----------

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Načítám…</div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl space-y-6">
      {/* Header + entity filter */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Přehled</h1>
          <p className="text-gray-500 text-sm mt-1">
            {now.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-4">
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
          {isAdmin ? (
            <Link
              href="/documents/new"
              className="flex items-center gap-2 bg-[#F04E12] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#d9430f] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Nový dokument</span>
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
              <span className="hidden sm:inline">Nový dokument</span>
            </button>
          )}
        </div>
      </div>

      {/* Financial chart section */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h2 className="text-sm font-semibold text-[#111111] uppercase tracking-wide">
          Vývoj tržeb — zaplaceno (CZK)
        </h2>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-10">
          {/* Months */}
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Měsíce</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {MONTHS.map((m) => {
                const active = selectedMonths.has(m.num)
                return (
                  <label key={m.num} className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleMonth(m.num)}
                      className="w-3.5 h-3.5 accent-[#F04E12]"
                    />
                    <span className={`text-sm ${active ? 'text-[#111111] font-medium' : 'text-gray-500'}`}>
                      {m.long}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
          {/* Years */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Roky</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              {AVAILABLE_YEARS.map((year, i) => {
                const active = selectedYears.has(year)
                return (
                  <label key={year} className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleYear(year)}
                      className="w-3.5 h-3.5 accent-[#F04E12]"
                    />
                    <span
                      className="text-sm font-semibold"
                      style={{ color: active ? YEAR_COLORS[i % YEAR_COLORS.length] : '#9ca3af' }}
                    >
                      {year}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} barCategoryGap="28%" barGap={3}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v: number) =>
                v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)} M` : v >= 1_000 ? `${Math.round(v / 1_000)} tis.` : String(v)
              }
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              width={58}
            />
            <Tooltip
              formatter={(value, name) => [formatCurrency(Number(value)), String(name)]}
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
              cursor={{ fill: '#f9fafb' }}
            />
            <Legend wrapperStyle={{ fontSize: 13, paddingTop: 10 }} iconType="circle" iconSize={8} />
            {chartYears.map((year, i) => (
              <Bar
                key={year}
                dataKey={String(year)}
                name={String(year)}
                fill={YEAR_COLORS[i % YEAR_COLORS.length]}
                radius={[3, 3, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 4 KPI cards — all driven by entity + period filter */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Zaplaceno" value={formatCurrency(kpiPaid)} color="green" />
        <StatCard label="K úhradě" value={formatCurrency(kpiPending)} color="blue" />
        <StatCard label="Po splatnosti" value={formatCurrency(kpiOverdue)} color="orange" />
        <StatCard label="Dokumenty" value={String(kpiDocCount)} color="gray" />
      </div>

      {/* Overdue banner */}
      {overdueCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="flex-1 font-semibold text-red-700 text-sm">
            {overdueCount} {overdueCount === 1 ? 'faktura po splatnosti' : 'faktury po splatnosti'}
          </p>
          <Link href="/documents?status=overdue" className="text-red-600 text-xs font-medium hover:underline shrink-0">
            Zobrazit →
          </Link>
        </div>
      )}

      {/* Recent docs table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-[#111111] text-sm">Poslední dokumenty</h2>
          <Link href="/documents" className="text-[#F04E12] text-sm hover:underline">
            Zobrazit vše →
          </Link>
        </div>
        {/* Mobile card list */}
        <div className="md:hidden divide-y divide-gray-100">
          {recentDocs.map((doc) => {
            const ds = getDisplayStatus(doc.status, doc.due_date)
            const total = czk(doc)
            return (
              <div key={doc.id} className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-medium text-[#F04E12] text-sm">{doc.number}</span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ds] ?? 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[ds] ?? ds}
                  </span>
                </div>
                <p className="text-sm font-medium text-[#111111]">{doc.clients?.name ?? '—'}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-bold text-[#111111]">{formatCurrency(total)}</span>
                  <span className="text-xs text-gray-400">{formatDate(doc.issue_date)}</span>
                </div>
              </div>
            )
          })}
          {recentDocs.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">
              Žádné dokumenty.{' '}
              {isAdmin && (
                <Link href="/documents/new" className="text-[#F04E12] hover:underline">
                  Vytvořte první.
                </Link>
              )}
            </div>
          )}
        </div>
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Číslo</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Klient</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Typ</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Datum</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Částka</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentDocs.length > 0 ? (
                recentDocs.map((doc) => {
                  const ds = getDisplayStatus(doc.status, doc.due_date)
                  const total = czk(doc)
                  const isPartial = doc.paid_amount != null && doc.paid_amount < total
                  return (
                    <tr key={doc.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-[#F04E12]">{doc.number}</td>
                      <td className="px-6 py-3.5 text-gray-700">{doc.clients?.name ?? '—'}</td>
                      <td className="px-6 py-3.5 text-gray-600">{TYPE_LABELS[doc.type] ?? doc.type}</td>
                      <td className="px-6 py-3.5 text-gray-500">{formatDate(doc.issue_date)}</td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ds] ?? 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABELS[ds] ?? ds}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right font-medium whitespace-nowrap">
                        {isPartial ? (
                          <>
                            <span className="text-[#F04E12]">{formatCurrency(doc.paid_amount!)}</span>
                            <span className="text-gray-400 font-normal"> / {formatCurrency(total)}</span>
                          </>
                        ) : doc.currency === 'EUR' && doc.amount_czk != null ? (
                          <>
                            {formatCurrency(doc.amount_czk)}
                            <span className="ml-1.5 text-gray-400 font-normal text-xs">
                              ({formatCurrency(doc.total_with_vat, 'EUR')})
                            </span>
                          </>
                        ) : (
                          formatCurrency(doc.total_with_vat, doc.currency)
                        )}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-400 text-sm">
                    Žádné dokumenty.{' '}
                    {isAdmin && (
                      <Link href="/documents/new" className="text-[#F04E12] hover:underline">
                        Vytvořte první.
                      </Link>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ---------- StatCard ----------

type CardColor = 'accent' | 'green' | 'blue' | 'orange' | 'gray'

const COLOR_MAP: Record<CardColor, { bg: string; label: string; value: string }> = {
  accent: { bg: 'bg-[#F04E12]',                        label: 'text-orange-100',  value: 'text-white' },
  green:  { bg: 'bg-white border border-gray-100 shadow-sm', label: 'text-green-600', value: 'text-[#111111]' },
  blue:   { bg: 'bg-white border border-gray-100 shadow-sm', label: 'text-blue-600',  value: 'text-[#111111]' },
  orange: { bg: 'bg-white border border-gray-100 shadow-sm', label: 'text-[#F04E12]', value: 'text-[#111111]' },
  gray:   { bg: 'bg-white border border-gray-100 shadow-sm', label: 'text-gray-400',  value: 'text-[#111111]' },
}

function StatCard({ label, value, accent, color }: { label: string; value: string; accent?: boolean; color?: CardColor }) {
  const key: CardColor = accent ? 'accent' : (color ?? 'gray')
  const s = COLOR_MAP[key]
  return (
    <div className={`rounded-xl p-6 ${s.bg}`}>
      <p className={`text-xs font-medium uppercase tracking-wide mb-3 ${s.label}`}>{label}</p>
      <p className={`text-2xl font-bold ${s.value}`}>{value}</p>
    </div>
  )
}
