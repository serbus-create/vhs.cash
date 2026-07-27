'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, getDisplayStatus } from '@/lib/utils'
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

interface ChartDoc {
  status: string
  issue_date: string | null
  due_date: string | null
  amount_czk: number | null
  total_with_vat: number
  company_profiles: { profile_type: string } | null
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

function docCzk(d: ChartDoc) {
  return d.amount_czk ?? d.total_with_vat ?? 0
}

// ---------- component ----------

export default function DashboardChart() {
  const supabase = createClient()
  const [docs, setDocs] = useState<ChartDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all')
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(new Set())
  const [selectedYears, setSelectedYears] = useState<Set<number>>(new Set())

  useEffect(() => {
    supabase
      .from('documents')
      .select('status, issue_date, due_date, amount_czk, total_with_vat, company_profiles(profile_type)')
      .neq('status', 'draft')
      .then(({ data }) => {
        setDocs((data ?? []) as unknown as ChartDoc[])
        setLoading(false)
      })
  }, [])

  // entity filter
  const entityFiltered = useMemo(() => {
    if (entityFilter === 'all') return docs
    const want = entityFilter === 'osvc' ? 'osvč' : 'sro'
    return docs.filter((d) => d.company_profiles?.profile_type === want)
  }, [docs, entityFilter])

  // period filter (for KPI cards)
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

  // KPI
  const kpiPaid = useMemo(
    () => periodFiltered
      .filter((d) => getDisplayStatus(d.status, d.due_date) === 'paid')
      .reduce((s, d) => s + docCzk(d), 0),
    [periodFiltered],
  )
  const kpiPending = useMemo(
    () => periodFiltered
      .filter((d) => ['issued', 'sent'].includes(getDisplayStatus(d.status, d.due_date)))
      .reduce((s, d) => s + docCzk(d), 0),
    [periodFiltered],
  )
  const kpiOverdue = useMemo(
    () => periodFiltered
      .filter((d) => getDisplayStatus(d.status, d.due_date) === 'overdue')
      .reduce((s, d) => s + docCzk(d), 0),
    [periodFiltered],
  )

  // chart axes
  const chartMonths = useMemo(
    () => (selectedMonths.size > 0 ? MONTHS.filter((m) => selectedMonths.has(m.num)) : MONTHS),
    [selectedMonths],
  )
  const chartYears = useMemo(
    () => (selectedYears.size > 0 ? Array.from(selectedYears).sort((a, b) => a - b) : AVAILABLE_YEARS),
    [selectedYears],
  )

  // chart data — entity filtered, months/years as axes
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
          .reduce((s, d) => s + docCzk(d), 0)
      }
      return row
    })
  }, [entityFiltered, chartMonths, chartYears])

  const toggleMonth = (m: number) =>
    setSelectedMonths((prev) => { const n = new Set(prev); n.has(m) ? n.delete(m) : n.add(m); return n })
  const toggleYear = (y: number) =>
    setSelectedYears((prev) => { const n = new Set(prev); n.has(y) ? n.delete(y) : n.add(y); return n })

  if (loading) {
    return (
      <div className="mt-8 rounded-xl border border-gray-100 bg-white shadow-sm p-6 flex items-center justify-center h-32">
        <p className="text-gray-400 text-sm">Načítám finanční data…</p>
      </div>
    )
  }

  return (
    <div className="mt-8 space-y-5">
      {/* Section header + entity filter */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#111111] uppercase tracking-wide">
          Finanční přehled (CZK)
        </h2>
        <div className="flex bg-gray-100 rounded-lg p-1 gap-0.5">
          {(['osvc', 'sro', 'all'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setEntityFilter(v)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
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

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-5">
        <KpiCard label="Celkem zaplaceno" value={formatCurrency(kpiPaid)} accent="green" />
        <KpiCard label="K úhradě" value={formatCurrency(kpiPending)} accent="blue" />
        <KpiCard label="Po splatnosti" value={formatCurrency(kpiOverdue)} accent="orange" />
      </div>

      {/* Period filter + chart */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
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

        {/* Chart */}
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
    </div>
  )
}

// ---------- sub-component ----------

type Accent = 'green' | 'blue' | 'orange'

const ACCENT_STYLES: Record<Accent, string> = {
  green:  'text-green-600',
  blue:   'text-blue-600',
  orange: 'text-[#F04E12]',
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent: Accent }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${ACCENT_STYLES[accent]}`}>{label}</p>
      <p className="text-2xl font-bold text-[#111111]">{value}</p>
    </div>
  )
}
