'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  formatCurrency,
  formatDate,
  STATUS_COLORS,
  STATUS_LABELS,
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

interface FinanceDoc {
  id: string
  number: string
  status: string
  issue_date: string | null
  due_date: string | null
  currency: string
  total_with_vat: number
  amount_czk: number | null
  company_profile_id: string | null
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

// ---------- helpers ----------

function docCzk(d: FinanceDoc): number {
  return d.amount_czk ?? d.total_with_vat ?? 0
}

// ---------- main component ----------

export default function FinancePage() {
  const supabase = createClient()

  const [docs, setDocs] = useState<FinanceDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all')
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(new Set())
  const [selectedYears, setSelectedYears] = useState<Set<number>>(new Set())

  useEffect(() => {
    supabase
      .from('documents')
      .select(
        'id, number, status, issue_date, due_date, currency, total_with_vat, amount_czk, company_profile_id, clients(name), company_profiles(name, profile_type)',
      )
      .neq('status', 'draft')
      .order('issue_date', { ascending: false })
      .then(({ data }) => {
        setDocs((data ?? []) as unknown as FinanceDoc[])
        setLoading(false)
      })
  }, [])

  // ------ entity filter ------

  const entityFiltered = useMemo(() => {
    if (entityFilter === 'all') return docs
    const want = entityFilter === 'osvc' ? 'osvč' : 'sro'
    return docs.filter((d) => d.company_profiles?.profile_type === want)
  }, [docs, entityFilter])

  // ------ period filter (for KPI + table) ------

  const periodFiltered = useMemo(() => {
    if (selectedMonths.size === 0 && selectedYears.size === 0) return entityFiltered
    return entityFiltered.filter((d) => {
      if (!d.issue_date) return false
      const date = new Date(d.issue_date)
      const m = date.getMonth() + 1
      const y = date.getFullYear()
      const monthOk = selectedMonths.size === 0 || selectedMonths.has(m)
      const yearOk = selectedYears.size === 0 || selectedYears.has(y)
      return monthOk && yearOk
    })
  }, [entityFiltered, selectedMonths, selectedYears])

  // ------ KPI ------

  const kpiPaid = useMemo(
    () =>
      periodFiltered
        .filter((d) => getDisplayStatus(d.status, d.due_date) === 'paid')
        .reduce((s, d) => s + docCzk(d), 0),
    [periodFiltered],
  )

  const kpiPending = useMemo(
    () =>
      periodFiltered
        .filter((d) => ['issued', 'sent'].includes(getDisplayStatus(d.status, d.due_date)))
        .reduce((s, d) => s + docCzk(d), 0),
    [periodFiltered],
  )

  const kpiOverdue = useMemo(
    () =>
      periodFiltered
        .filter((d) => getDisplayStatus(d.status, d.due_date) === 'overdue')
        .reduce((s, d) => s + docCzk(d), 0),
    [periodFiltered],
  )

  // ------ chart axes ------

  const chartMonths = useMemo(
    () => (selectedMonths.size > 0 ? MONTHS.filter((m) => selectedMonths.has(m.num)) : MONTHS),
    [selectedMonths],
  )

  const chartYears = useMemo(
    () => (selectedYears.size > 0 ? Array.from(selectedYears).sort((a, b) => a - b) : AVAILABLE_YEARS),
    [selectedYears],
  )

  // ------ chart data (entity filtered only, period is the X axis itself) ------

  const chartData = useMemo(() => {
    const paid = entityFiltered.filter((d) => getDisplayStatus(d.status, d.due_date) === 'paid')
    return chartMonths.map((m) => {
      const row: Record<string, number | string> = { month: m.short }
      for (const year of chartYears) {
        row[String(year)] = paid
          .filter((d) => {
            if (!d.issue_date) return false
            const date = new Date(d.issue_date)
            return date.getMonth() + 1 === m.num && date.getFullYear() === year
          })
          .reduce((sum, d) => sum + docCzk(d), 0)
      }
      return row
    })
  }, [entityFiltered, chartMonths, chartYears])

  // ------ toggle helpers ------

  const toggleMonth = (m: number) =>
    setSelectedMonths((prev) => {
      const next = new Set(prev)
      next.has(m) ? next.delete(m) : next.add(m)
      return next
    })

  const toggleYear = (y: number) =>
    setSelectedYears((prev) => {
      const next = new Set(prev)
      next.has(y) ? next.delete(y) : next.add(y)
      return next
    })

  // ------ render ------

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Načítám…</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* ---- Header + entity filter ---- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Účetnictví</h1>
          <p className="text-gray-500 text-sm mt-1">Finanční přehled faktur v CZK</p>
        </div>

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
      </div>

      {/* ---- KPI cards ---- */}
      <div className="grid grid-cols-3 gap-5">
        <KpiCard
          label="Celkem zaplaceno"
          value={formatCurrency(kpiPaid)}
          labelColor="text-green-600"
          icon={
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <KpiCard
          label="K úhradě"
          value={formatCurrency(kpiPending)}
          labelColor="text-blue-600"
          icon={
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <KpiCard
          label="Po splatnosti"
          value={formatCurrency(kpiOverdue)}
          labelColor="text-[#F04E12]"
          icon={
            <svg className="w-5 h-5 text-[#F04E12]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          }
        />
      </div>

      {/* ---- Period filter + chart ---- */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h2 className="text-sm font-semibold text-[#111111] uppercase tracking-wide">
          Vývoj tržeb — zaplaceno (CZK)
        </h2>

        {/* Month checkboxes */}
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2.5">Měsíce</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {MONTHS.map((m) => {
              const active = selectedMonths.has(m.num)
              return (
                <label key={m.num} className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleMonth(m.num)}
                    className="w-3.5 h-3.5 accent-[#F04E12] rounded"
                  />
                  <span className={`text-sm transition-colors ${active ? 'text-[#111111] font-medium' : 'text-gray-500'}`}>
                    {m.long}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Year checkboxes */}
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2.5">Roky</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {AVAILABLE_YEARS.map((year, i) => {
              const active = selectedYears.has(year)
              const color = YEAR_COLORS[i % YEAR_COLORS.length]
              return (
                <label key={year} className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleYear(year)}
                    className="w-3.5 h-3.5 accent-[#F04E12] rounded"
                  />
                  <span
                    className="text-sm font-semibold transition-colors"
                    style={{ color: active ? color : '#9ca3af' }}
                  >
                    {year}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Bar chart */}
        <div className="pt-2">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} barCategoryGap="28%" barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) =>
                  v >= 1000000
                    ? `${(v / 1000000).toFixed(1)} M`
                    : v >= 1000
                    ? `${Math.round(v / 1000)} tis.`
                    : String(v)
                }
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip
                formatter={(value, name) => [formatCurrency(Number(value)), String(name)]}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  fontSize: 13,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}
                cursor={{ fill: '#f9fafb' }}
              />
              <Legend
                wrapperStyle={{ fontSize: 13, paddingTop: 12 }}
                iconType="circle"
                iconSize={8}
              />
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
      </div>

      {/* ---- Invoice table ---- */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <h2 className="text-sm font-semibold text-[#111111] uppercase tracking-wide">Faktury</h2>
          <span className="text-xs text-gray-400 font-normal">{periodFiltered.length} záznamů</span>
        </div>

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
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Částka</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {periodFiltered.length > 0 ? (
                periodFiltered.map((doc) => {
                  const displayStatus = getDisplayStatus(doc.status, doc.due_date)
                  return (
                    <tr key={doc.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-[#F04E12] whitespace-nowrap">
                        {doc.number}
                      </td>
                      <td className="px-6 py-3.5 text-gray-700">
                        {doc.clients?.name ?? '—'}
                      </td>
                      <td className="px-6 py-3.5 text-gray-600">
                        {doc.company_profiles?.name ?? '—'}
                      </td>
                      <td className="px-6 py-3.5 text-gray-500 whitespace-nowrap">
                        {formatDate(doc.issue_date)}
                      </td>
                      <td className="px-6 py-3.5 text-gray-500 whitespace-nowrap">
                        {formatDate(doc.due_date)}
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                            STATUS_COLORS[displayStatus] ?? 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {STATUS_LABELS[displayStatus] ?? displayStatus}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right font-medium whitespace-nowrap">
                        {doc.currency === 'EUR' && doc.amount_czk != null ? (
                          <>
                            {formatCurrency(doc.total_with_vat, 'EUR')}
                            <span className="ml-1.5 text-gray-400 font-normal text-xs">
                              ({formatCurrency(doc.amount_czk)})
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
                  <td colSpan={7} className="px-6 py-16 text-center text-gray-400 text-sm">
                    Žádné faktury pro zvolené filtry.
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

// ---------- KpiCard ----------

interface KpiCardProps {
  label: string
  value: string
  labelColor: string
  icon: React.ReactNode
}

function KpiCard({ label, value, labelColor, icon }: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-3">
        <p className={`text-xs font-semibold uppercase tracking-wide ${labelColor}`}>{label}</p>
        {icon}
      </div>
      <p className="text-2xl font-bold text-[#111111]">{value}</p>
    </div>
  )
}
