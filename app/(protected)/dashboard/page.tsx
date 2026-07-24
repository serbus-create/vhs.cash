import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, formatDate, STATUS_LABELS, TYPE_LABELS, STATUS_COLORS } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const todayStr = now.toISOString().split('T')[0]

  const [{ data: monthDocs }, { data: recentDocs }, { count: totalCount }, { count: overdueCount }] = await Promise.all([
    supabase
      .from('documents')
      .select('total_with_vat, status, currency')
      .eq('user_id', user!.id)
      .gte('issue_date', firstOfMonth),
    supabase
      .from('documents')
      .select('*, clients(name)')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user!.id)
      .gte('issue_date', firstOfMonth),
    supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user!.id)
      .not('status', 'in', '("paid","cancelled","storno")')
      .not('due_date', 'is', null)
      .lt('due_date', todayStr),
  ])

  // Group totals by currency so mixed-currency months aren't summed into a meaningless number
  const invoicedByCurrency: Record<string, number> = {}
  const unpaidByCurrency: Record<string, number> = {}
  for (const d of monthDocs ?? []) {
    const cur = (d.currency as string | null) ?? 'CZK'
    invoicedByCurrency[cur] = (invoicedByCurrency[cur] ?? 0) + (d.total_with_vat || 0)
    if (d.status === 'sent') {
      unpaidByCurrency[cur] = (unpaidByCurrency[cur] ?? 0) + (d.total_with_vat || 0)
    }
  }

  const fmtByCurrency = (map: Record<string, number>) => {
    const entries = Object.entries(map)
    if (entries.length === 0) return formatCurrency(0)
    return entries.map(([cur, amt]) => formatCurrency(amt, cur)).join(' / ')
  }

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Přehled</h1>
          <p className="text-gray-500 text-sm mt-1">
            {now.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })}
          </p>
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <StatCard
          label="Vyfakturováno tento měsíc"
          value={fmtByCurrency(invoicedByCurrency)}
          accent
        />
        <StatCard label="Čeká na platbu" value={fmtByCurrency(unpaidByCurrency)} />
        <StatCard label="Dokumenty tento měsíc" value={String(totalCount ?? 0)} />
      </div>

      {/* Overdue warning */}
      {(overdueCount ?? 0) > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div className="flex-1">
            <p className="font-semibold text-red-700 text-sm">
              {overdueCount} {overdueCount === 1 ? 'faktura po splatnosti' : 'faktury po splatnosti'}
            </p>
          </div>
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

        <div className="overflow-x-auto">
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
              {recentDocs?.length ? (
                recentDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-[#F04E12]">{doc.number}</td>
                    <td className="px-6 py-3.5 text-gray-700">{(doc.clients as any)?.name ?? '—'}</td>
                    <td className="px-6 py-3.5 text-gray-600">{TYPE_LABELS[doc.type] ?? doc.type}</td>
                    <td className="px-6 py-3.5 text-gray-500">{formatDate(doc.issue_date)}</td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[doc.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[doc.status] ?? doc.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right font-medium">{formatCurrency(doc.total_with_vat ?? 0, (doc as any).currency ?? 'CZK')}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-400 text-sm">
                    Žádné dokumenty. <Link href="/documents/new" className="text-[#F04E12] hover:underline">Vytvořte první.</Link>
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

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl p-6 ${
        accent
          ? 'bg-[#F04E12] text-white'
          : 'bg-white border border-gray-100 shadow-sm text-[#111111]'
      }`}
    >
      <p className={`text-xs font-medium uppercase tracking-wide mb-3 ${accent ? 'text-orange-100' : 'text-gray-400'}`}>
        {label}
      </p>
      <p className={`text-2xl font-bold ${accent ? 'text-white' : 'text-[#111111]'}`}>{value}</p>
    </div>
  )
}
