'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, STATUS_LABELS } from '@/lib/utils'
import { FEE_TITLES, isFeeKind } from '@/lib/reminders/fees'

interface SentEvent { id: string; milestone: number; sent_at: string | null }
interface FeeDoc { id: string; number: string; fee_kind: string | null; total_with_vat: number | null; status: string }

/** Jen pro čtení: odeslané upomínky a vystavená vyúčtování poplatků této faktury. Bez dat se nic nevykreslí. */
export default function InvoiceRemindersInfo({ invoiceId, workspaceId }: { invoiceId: string; workspaceId: string | null }) {
  const [events, setEvents] = useState<SentEvent[]>([])
  const [fees, setFees] = useState<FeeDoc[]>([])

  useEffect(() => {
    if (!workspaceId) return
    const supabase = createClient()
    let cancelled = false
    Promise.all([
      supabase
        .from('reminder_events')
        .select('id, milestone, sent_at')
        .eq('workspace_id', workspaceId)
        .eq('invoice_id', invoiceId)
        .eq('status', 'sent')
        .order('milestone', { ascending: true }),
      supabase
        .from('documents')
        .select('id, number, fee_kind, total_with_vat, status')
        .eq('workspace_id', workspaceId)
        .eq('type', 'vyuctovani')
        .eq('related_invoice_id', invoiceId)
        .order('created_at', { ascending: true }),
    ]).then(([e, f]) => {
      if (cancelled) return
      setEvents((e.data ?? []) as SentEvent[])
      setFees((f.data ?? []) as FeeDoc[])
    })
    return () => { cancelled = true }
  }, [invoiceId, workspaceId])

  if (events.length === 0 && fees.length === 0) return null

  return (
    <div className="mb-4 bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 text-sm">
      <h2 className="text-xs font-semibold text-[#111111] mb-2 uppercase tracking-wide">Upomínky a poplatky</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {events.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Odeslané upomínky</p>
            <ul className="space-y-0.5">
              {events.map((e) => (
                <li key={e.id} className="text-gray-700">{e.milestone}. den po splatnosti · {formatDate(e.sent_at)}</li>
              ))}
            </ul>
          </div>
        )}
        {fees.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Vyúčtování</p>
            <ul className="space-y-0.5">
              {fees.map((f) => (
                <li key={f.id} className="text-gray-700">
                  {f.number}
                  {isFeeKind(f.fee_kind) ? ` · ${FEE_TITLES[f.fee_kind]}` : ''} · {formatCurrency(f.total_with_vat ?? 0)} · {STATUS_LABELS[f.status] ?? f.status}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
