'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { readEffectiveTerms } from '@/lib/terms/effective'

export interface LinkableOrder {
  id: string
  number: string
  client_id: string | null
  confirmed_at: string | null
  terms_values: Record<string, string> | null
  clients: { name: string } | null
}

interface Props {
  workspaceId: string | null
  clientId: string
  value: string
  onChange: (orderId: string, order: LinkableOrder | null) => void
  disabled?: boolean
}

/** Nepovinný výběr potvrzené objednávky s podmínkami pro fakturu (documents.order_id). */
export default function OrderLinkSelect({ workspaceId, clientId, value, onChange, disabled }: Props) {
  const supabase = createClient()
  const [orders, setOrders] = useState<LinkableOrder[]>([])
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (!workspaceId) return
    supabase
      .from('documents')
      .select('id, number, client_id, confirmed_at, terms_values, clients(name)')
      .eq('workspace_id', workspaceId)
      .eq('type', 'objednavka')
      .eq('status', 'confirmed')
      .order('confirmed_at', { ascending: false })
      .then(({ data }) => {
        setOrders(((data ?? []) as unknown as (Omit<LinkableOrder, 'clients'> & { clients: { name: string } | { name: string }[] | null })[]).map((o) => ({
          ...o,
          clients: Array.isArray(o.clients) ? (o.clients[0] ?? null) : o.clients,
        })))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  const visible = useMemo(
    () => orders.filter((o) => showAll || !clientId || o.client_id === clientId || o.id === value),
    [orders, showAll, clientId, value],
  )
  const selected = orders.find((o) => o.id === value) ?? null

  let info = 'Bez potvrzených podmínek: upomínky půjdou bez smluvních pokut'
  if (selected) {
    const version = readEffectiveTerms(selected.terms_values).version
    info = `Podmínky${version ? ` v${version}` : ''} potvrzeny ${formatDate(selected.confirmed_at)}; při prodlení se účtují smluvní pokuty podle čl. 6`
  }

  return (
    <div className="col-span-2">
      <label className="block text-xs font-medium text-gray-600 mb-1.5">
        Objednávka s podmínkami
        <span className="ml-1.5 text-gray-400 font-normal">nepovinné</span>
      </label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value, orders.find((o) => o.id === e.target.value) ?? null)}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12] disabled:bg-gray-50 disabled:text-gray-400"
      >
        <option value="">— bez objednávky —</option>
        {visible.map((o) => (
          <option key={o.id} value={o.id}>
            {o.number} · {o.clients?.name ?? 'bez klienta'} · potvrzeno {formatDate(o.confirmed_at)}
          </option>
        ))}
      </select>
      <div className="mt-1.5 flex items-start justify-between gap-3">
        <p className={`text-xs ${selected ? 'text-green-700' : 'text-gray-400'}`}>{info}</p>
        {clientId && (
          <label className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0 cursor-pointer">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            Zobrazit všechny
          </label>
        )}
      </div>
    </div>
  )
}
