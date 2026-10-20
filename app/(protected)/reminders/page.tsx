'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useUserRole } from '@/lib/useUserRole'
import { daysBetween, todayPrague } from '@/lib/reminders/schedule'
import { REMINDER_FROM, REMINDER_REPLY_TO } from '@/lib/reminders/config'
import type { ReminderPlan } from '@/lib/reminders/plan'

type Tab = 'queue' | 'sent' | 'skipped' | 'fees'
type EventTab = Exclude<Tab, 'fees'>

interface FeeRow {
  id: string
  number: string
  subject: string | null
  total_with_vat: number | null
  issue_date: string | null
  due_date: string | null
  status: 'issued' | 'sent' | 'paid' | 'cancelled'
  related_invoice_id: string | null
  invoice: { number: string } | { number: string }[] | null
  clients: { name: string } | { name: string }[] | null
}

const FEE_STATUS: Record<FeeRow['status'], { label: string; cls: string }> = {
  issued: { label: 'Vystaveno', cls: 'bg-gray-200 text-gray-700' },
  sent: { label: 'Odesláno', cls: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Zaplaceno', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Stornováno', cls: 'bg-red-100 text-red-700' },
}
const firstOf = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

interface EventRow {
  id: string
  invoice_id: string
  milestone: number
  due_date: string
  scheduled_for: string
  status: 'pending' | 'sending' | 'sent' | 'skipped' | 'failed'
  plan: ReminderPlan | null
  subject: string | null
  body_text: string | null
  body_html: string | null
  recipient_email: string | null
  skip_reason: string | null
  sent_at: string | null
  error: string | null
  invoice: { number: string; clients: { name: string } | { name: string }[] | null } | null
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'queue', label: 'Ke schválení' },
  { id: 'sent', label: 'Odesláno' },
  { id: 'skipped', label: 'Přeskočeno' },
  { id: 'fees', label: 'Poplatky' },
]

const tabOf = (s: EventRow['status']): EventTab =>
  s === 'sent' ? 'sent' : s === 'skipped' ? 'skipped' : 'queue'

const clientName = (e: EventRow) => {
  const c = e.invoice?.clients
  return (Array.isArray(c) ? c[0]?.name : c?.name) ?? '—'
}

export default function RemindersQueuePage() {
  const supabase = createClient()
  const { role, workspaceId } = useUserRole()
  const isAdmin = role === 'admin'
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('queue')
  const [preview, setPreview] = useState<EventRow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [fees, setFees] = useState<FeeRow[]>([])
  const [paidDialog, setPaidDialog] = useState<{ fee: FeeRow; date: string } | null>(null)
  const [waiveDialog, setWaiveDialog] = useState<FeeRow | null>(null)
  const today = todayPrague()

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const { data } = await supabase
      .from('reminder_events')
      .select('*, invoice:documents!invoice_id(number, clients(name))')
      .eq('workspace_id', workspaceId)
      .neq('status', 'sending')
      .order('scheduled_for', { ascending: true })
    setEvents((data ?? []) as unknown as EventRow[])
    const { data: feeData } = await supabase
      .from('documents')
      .select('id, number, subject, total_with_vat, issue_date, due_date, status, related_invoice_id, invoice:documents!related_invoice_id(number), clients(name)')
      .eq('workspace_id', workspaceId)
      .eq('type', 'vyuctovani')
      .order('created_at', { ascending: false })
    setFees((feeData ?? []) as unknown as FeeRow[])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { queue: 0, sent: 0, skipped: 0, fees: fees.length }
    for (const e of events) c[tabOf(e.status)] += 1
    return c
  }, [events, fees])
  const visible = tab === 'fees' ? [] : events.filter((e) => tabOf(e.status) === tab)

  const send = async (e: EventRow) => {
    if (!confirm(`Odeslat upomínku na adresu ${e.recipient_email}?`)) return
    setBusyId(e.id)
    setMessage(null)
    try {
      const res = await fetch('/api/reminders/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: e.id }),
      })
      const j = await res.json().catch(() => ({}))
      setMessage(res.ok ? { ok: true, text: 'Upomínka byla odeslána.' } : { ok: false, text: j.error ?? 'Odeslání se nezdařilo.' })
      setPreview(null)
    } catch {
      setMessage({ ok: false, text: 'Síťová chyba. Zkuste to znovu.' })
    } finally {
      setBusyId(null)
      load()
    }
  }

  const skip = async (e: EventRow) => {
    const reason = prompt('Důvod přeskočení (nepovinné):')
    if (reason === null) return
    setBusyId(e.id)
    setMessage(null)
    try {
      const res = await fetch('/api/reminders/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: e.id, reason }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) setMessage({ ok: false, text: j.error ?? 'Přeskočení se nezdařilo.' })
      setPreview(null)
    } finally {
      setBusyId(null)
      load()
    }
  }

  const markPaid = async () => {
    if (!paidDialog) return
    const { fee, date } = paidDialog
    setBusyId(fee.id)
    setMessage(null)
    try {
      const res = await fetch('/api/reminders/fees/paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: fee.id, paidDate: date }),
      })
      const j = await res.json().catch(() => ({}))
      setMessage(res.ok ? { ok: true, text: `Vyúčtování ${fee.number} je označeno jako zaplacené.` } : { ok: false, text: j.error ?? 'Uložení se nezdařilo.' })
      setPaidDialog(null)
    } catch {
      setMessage({ ok: false, text: 'Síťová chyba. Zkuste to znovu.' })
    } finally {
      setBusyId(null)
      load()
    }
  }

  const waive = async () => {
    if (!waiveDialog) return
    const fee = waiveDialog
    setBusyId(fee.id)
    setMessage(null)
    try {
      const res = await fetch('/api/reminders/fees/waive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: fee.id }),
      })
      const j = await res.json().catch(() => ({}))
      setMessage(res.ok ? { ok: true, text: `Vyúčtování ${fee.number} bylo odpuštěno.` } : { ok: false, text: j.error ?? 'Uložení se nezdařilo.' })
      setWaiveDialog(null)
    } catch {
      setMessage({ ok: false, text: 'Síťová chyba. Zkuste to znovu.' })
    } finally {
      setBusyId(null)
      load()
    }
  }

  const sendDisabledReason = (e: EventRow): string | null => {
    if (!isAdmin) return 'Odeslat může jen administrátor'
    if (!e.recipient_email) return 'Klient nemá e-mail'
    if (e.plan?.feesBlocked) return 'Poplatky jsou vypnuté'
    return null
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Upomínky</h1>
          <p className="text-gray-500 text-sm mt-1">Fronta ke schválení: nic se neodešle bez vašeho potvrzení.</p>
        </div>
        <Link href="/reminders/manual" className="text-sm text-[#F04E12] hover:underline shrink-0">
          Starší faktury (ruční upomínky)
        </Link>
      </div>

      {message && (
        <div className={`text-sm px-4 py-3 rounded-lg border ${message.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${tab === t.id ? 'border-[#F04E12] text-[#F04E12]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label} <span className="ml-1 text-xs text-gray-400">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400 text-sm">Načítám…</div>
      ) : tab === 'fees' ? (
        fees.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center text-gray-500 text-sm">Zatím žádná vyúčtování poplatků</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="px-4 py-3">Číslo</th>
                  <th className="px-4 py-3">Doklad</th>
                  <th className="px-4 py-3">Faktura</th>
                  <th className="px-4 py-3">Klient</th>
                  <th className="px-4 py-3 text-right">Částka</th>
                  <th className="px-4 py-3">Vystaveno</th>
                  <th className="px-4 py-3">Splatnost</th>
                  <th className="px-4 py-3">Stav</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {fees.map((f) => {
                  const st = FEE_STATUS[f.status] ?? FEE_STATUS.issued
                  const open = f.status === 'issued' || f.status === 'sent'
                  const inv = firstOf(f.invoice)
                  return (
                    <tr key={f.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3 font-medium text-[#111111] whitespace-nowrap">{f.number}</td>
                      <td className="px-4 py-3">{f.subject ?? '—'}</td>
                      <td className="px-4 py-3">
                        {f.related_invoice_id ? (
                          <Link href={`/documents/${f.related_invoice_id}`} className="text-[#F04E12] hover:underline">{inv?.number ?? 'faktura'}</Link>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">{firstOf(f.clients)?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">{formatCurrency(f.total_with_vat ?? 0)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(f.issue_date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(f.due_date)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {isAdmin && (
                          <>
                            <a href={`/api/pdf?id=${f.id}`} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 mr-2 inline-block">
                              Stáhnout PDF
                            </a>
                            {open && (
                              <>
                                <button
                                  onClick={() => setPaidDialog({ fee: f, date: today })}
                                  disabled={busyId === f.id}
                                  className="px-3 py-1.5 bg-[#F04E12] text-white rounded-lg text-xs font-medium disabled:opacity-40 mr-2"
                                >
                                  Označit jako zaplaceno
                                </button>
                                <button
                                  onClick={() => setWaiveDialog(f)}
                                  disabled={busyId === f.id}
                                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                                >
                                  Odpustit
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center text-gray-500 text-sm">
          {tab === 'queue' ? 'Žádné upomínky ke schválení' : tab === 'sent' ? 'Zatím nic odesláno' : 'Nic nebylo přeskočeno'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <th className="px-4 py-3">Faktura</th>
                <th className="px-4 py-3">Klient</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Milník</th>
                <th className="px-4 py-3">Dnů po spl.</th>
                <th className="px-4 py-3 text-right">Dlužná částka</th>
                <th className="px-4 py-3">Termín</th>
                <th className="px-4 py-3">Podmínky</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => {
                const disabledReason = sendDisabledReason(e)
                const canAct = e.status === 'pending' || e.status === 'failed'
                return (
                  <tr key={e.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-[#F04E12]">
                      <Link href={`/documents/${e.invoice_id}`} className="hover:underline">{e.invoice?.number ?? '—'}</Link>
                      {e.status === 'failed' && <span className="ml-2 text-xs text-red-600" title={e.error ?? ''}>neúspěšné</span>}
                    </td>
                    <td className="px-4 py-3">{clientName(e)}</td>
                    <td className="px-4 py-3">
                      {e.recipient_email ?? <span className="text-red-600 font-medium">chybí e-mail</span>}
                    </td>
                    <td className="px-4 py-3">{e.milestone}. den</td>
                    <td className="px-4 py-3">{Math.max(0, daysBetween(e.due_date, today))}</td>
                    <td className="px-4 py-3 text-right">
                      {e.plan ? formatCurrency(e.plan.amountDue, e.plan.currency) : '—'}
                    </td>
                    <td className="px-4 py-3">{formatDate(e.status === 'sent' ? e.sent_at : e.scheduled_for)}</td>
                    <td className="px-4 py-3" title={e.plan?.feeReason ?? ''}>
                      {e.plan?.eligibleForFees ? 'ano' : 'ne'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {e.status === 'skipped' && <span className="text-xs text-gray-400">{e.skip_reason}</span>}
                      <button onClick={() => setPreview(e)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 mr-2">
                        Náhled
                      </button>
                      {canAct && (
                        <>
                          <button
                            onClick={() => send(e)}
                            disabled={!!disabledReason || busyId === e.id}
                            title={disabledReason ?? ''}
                            className="px-3 py-1.5 bg-[#F04E12] text-white rounded-lg text-xs font-medium disabled:opacity-40 mr-2"
                          >
                            Odeslat
                          </button>
                          {isAdmin && (
                            <button onClick={() => skip(e)} disabled={busyId === e.id} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                              Přeskočit
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {paidDialog && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPaidDialog(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={(ev) => ev.stopPropagation()}>
            <h2 className="font-semibold text-[#111111]">Označit jako zaplaceno</h2>
            <p className="text-sm text-gray-600">Vyúčtování {paidDialog.fee.number}, částka {formatCurrency(paidDialog.fee.total_with_vat ?? 0)}.</p>
            <label className="block text-sm text-gray-600">
              Datum úhrady
              <input
                type="date"
                value={paidDialog.date}
                max={today}
                onChange={(ev) => setPaidDialog({ ...paidDialog, date: ev.target.value })}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPaidDialog(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Zrušit</button>
              <button onClick={markPaid} disabled={!paidDialog.date || busyId === paidDialog.fee.id} className="px-4 py-2 bg-[#F04E12] text-white rounded-lg text-sm font-medium disabled:opacity-40">Uložit</button>
            </div>
          </div>
        </div>
      )}

      {waiveDialog && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setWaiveDialog(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={(ev) => ev.stopPropagation()}>
            <h2 className="font-semibold text-[#111111]">Odpustit poplatek</h2>
            <p className="text-sm text-gray-600">
              Vyúčtování {waiveDialog.number} ({formatCurrency(waiveDialog.total_with_vat ?? 0)}) se stornuje a systém ho už znovu nevystaví. Tuto akci nelze vrátit zpět.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setWaiveDialog(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Zrušit</button>
              <button onClick={waive} disabled={busyId === waiveDialog.id} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-40">Odpustit</button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(ev) => ev.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-[#111111]">Náhled: {preview.invoice?.number} · {preview.milestone}. den</h2>
              <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="px-6 py-4 space-y-1 text-sm">
              <p><span className="text-gray-400 inline-block w-32">Komu</span>{preview.recipient_email ?? <span className="text-red-600">chybí e-mail</span>}</p>
              <p><span className="text-gray-400 inline-block w-32">Od</span>{REMINDER_FROM}</p>
              <p><span className="text-gray-400 inline-block w-32">Odpovědi na</span>{REMINDER_REPLY_TO}</p>
              <p><span className="text-gray-400 inline-block w-32">Předmět</span>{preview.subject ?? '—'}</p>
              <p>
                <span className="text-gray-400 inline-block w-32">Příloha</span>
                <a href={`/api/pdf?id=${preview.invoice_id}`} target="_blank" rel="noreferrer" className="text-[#F04E12] hover:underline">
                  faktura {preview.invoice?.number} (PDF)
                </a>
              </p>
              {preview.plan?.eligibleForFees && preview.milestone >= 8 && (
                <p className="text-xs text-gray-500 pt-1">
                  Při odeslání se vystaví vyúčtování smluvních pokut a náhrady podle podmínek objednávky; e-mail je bude obsahovat včetně přehledu dlužných částek, QR kódů a PDF příloh.
                </p>
              )}
              <p className="text-xs text-gray-400 pt-1">Text se při odeslání přepočítá k aktuálnímu dni.</p>
            </div>
            <div className="px-6 pb-4">
              {preview.body_html ? (
                <iframe title="Náhled e-mailu" sandbox="" srcDoc={preview.body_html} className="w-full h-[480px] border border-gray-200 rounded-lg" />
              ) : (
                <p className="text-sm text-gray-400">Bez náhledu.</p>
              )}
            </div>
            {(preview.status === 'pending' || preview.status === 'failed') && (
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
                {isAdmin && (
                  <button onClick={() => skip(preview)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Přeskočit</button>
                )}
                <button
                  onClick={() => send(preview)}
                  disabled={!!sendDisabledReason(preview) || busyId === preview.id}
                  title={sendDisabledReason(preview) ?? ''}
                  className="px-4 py-2 bg-[#F04E12] text-white rounded-lg text-sm font-medium disabled:opacity-40"
                >
                  Odeslat
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
