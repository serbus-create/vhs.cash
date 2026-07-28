'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  getReminderSubject,
  getReminderBodyText,
  getReminderLabels,
  getLang,
  type ReminderLevel,
  type Lang,
  type ReminderLabels,
} from '@/lib/reminder-email'

// ---------- types ----------

interface OverdueDoc {
  id: string
  number: string
  due_date: string
  amount_czk: number | null
  total_with_vat: number
  currency: string
  variable_symbol: string | null
  company_profile_id: string | null
  clients: { name: string; email: string | null; country: string | null } | null
  last_reminder: { sent_at: string; level: number } | null
}

interface PaymentInfo {
  bankAccount: string | null
  iban: string | null
  swift: string | null
  companyName: string
}

interface ModalState {
  doc: OverdueDoc
  level: ReminderLevel
  lang: Lang
  labels: ReminderLabels
  subject: string
  bodyText: string
  qrCodeUrl: string | null
  paymentInfo: PaymentInfo | null
  qrLoading: boolean
}

// ---------- helpers ----------

function daysOverdue(dueDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - new Date(dueDate).getTime()) / 86_400_000)
}

function reminderLevel(days: number): ReminderLevel {
  if (days >= 30) return 3
  if (days >= 15) return 2
  return 1
}

const LEVEL_CONFIG: Record<ReminderLevel, { label: string; color: string; badgeClass: string; sectionBg: string }> = {
  1: {
    label: 'Nedávno po splatnosti',
    color: '#F59E0B',
    badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
    sectionBg: 'border-amber-200',
  },
  2: {
    label: 'Výrazně po splatnosti',
    color: '#F04E12',
    badgeClass: 'bg-orange-50 text-[#F04E12] border border-orange-200',
    sectionBg: 'border-orange-200',
  },
  3: {
    label: 'Vážně po splatnosti',
    color: '#DC2626',
    badgeClass: 'bg-red-50 text-red-700 border border-red-200',
    sectionBg: 'border-red-200',
  },
}

const LEVEL_RANGE: Record<ReminderLevel, string> = {
  1: '1–14 dní',
  2: '15–29 dní',
  3: '30+ dní',
}

function levelBadge(level: ReminderLevel) {
  const cfg = LEVEL_CONFIG[level]
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badgeClass}`}>
      {LEVEL_RANGE[level]}
    </span>
  )
}

async function fetchQrCode(params: {
  number: string
  total_with_vat: number
  currency: string
  variable_symbol: string | null
  iban: string
  swift: string | null
  companyName: string
}): Promise<string | null> {
  try {
    const res = await fetch('/api/qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    const { url } = await res.json()
    return url ?? null
  } catch {
    return null
  }
}

// ---------- main component ----------

export default function RemindersPage() {
  const supabase = createClient()
  const [docs, setDocs] = useState<OverdueDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [sentIds, setSentIds] = useState<Record<string, { sentAt: string; level: number }>>({})

  useEffect(() => {
    async function load() {
      setLoading(true)
      const today = new Date().toISOString().split('T')[0]

      const { data: documents } = await supabase
        .from('documents')
        .select('id, number, due_date, amount_czk, total_with_vat, currency, variable_symbol, company_profile_id, clients(name, email, country)')
        .eq('type', 'faktura')
        .not('status', 'in', '("paid","cancelled","draft")')
        .lt('due_date', today)
        .order('due_date', { ascending: true })

      if (!documents?.length) {
        setDocs([])
        setLoading(false)
        return
      }

      const docIds = documents.map((d) => d.id)

      const { data: reminders } = await supabase
        .from('reminders')
        .select('document_id, sent_at, level')
        .in('document_id', docIds)
        .order('sent_at', { ascending: false })

      const lastReminderMap: Record<string, { sent_at: string; level: number }> = {}
      for (const r of reminders ?? []) {
        if (!lastReminderMap[r.document_id]) {
          lastReminderMap[r.document_id] = { sent_at: r.sent_at, level: r.level }
        }
      }

      const result: OverdueDoc[] = documents.map((d) => ({
        id: d.id,
        number: d.number,
        due_date: d.due_date,
        amount_czk: d.amount_czk,
        total_with_vat: d.total_with_vat,
        currency: d.currency,
        variable_symbol: d.variable_symbol ?? null,
        company_profile_id: d.company_profile_id ?? null,
        clients: (Array.isArray(d.clients) ? d.clients[0] : d.clients) as { name: string; email: string | null; country: string | null } | null,
        last_reminder: lastReminderMap[d.id] ?? null,
      }))

      setDocs(result)
      setLoading(false)
    }
    load()
  }, [])

  const grouped = useMemo(() => {
    const byLevel: Record<ReminderLevel, OverdueDoc[]> = { 1: [], 2: [], 3: [] }
    for (const doc of docs) {
      const days = daysOverdue(doc.due_date)
      const lvl = reminderLevel(days)
      byLevel[lvl].push(doc)
    }
    return byLevel
  }, [docs])

  const openModal = async (doc: OverdueDoc) => {
    const days = daysOverdue(doc.due_date)
    const level = reminderLevel(days)
    const lang = getLang(doc.clients?.country)
    const labels = getReminderLabels(lang)
    const amount = doc.amount_czk ?? doc.total_with_vat
    const vars = { number: doc.number, daysOverdue: days, amount, dueDate: doc.due_date }

    setModal({
      doc,
      level,
      lang,
      labels,
      subject: getReminderSubject(level, vars, lang),
      bodyText: getReminderBodyText(level, vars, lang),
      qrCodeUrl: null,
      paymentInfo: null,
      qrLoading: true,
    })
    setSendError('')

    if (doc.company_profile_id) {
      const { data: profile } = await supabase
        .from('company_profiles')
        .select('name, bank_account, iban, swift')
        .eq('id', doc.company_profile_id)
        .single()

      if (profile) {
        const paymentInfo: PaymentInfo = {
          bankAccount: profile.bank_account ?? null,
          iban: profile.iban ?? null,
          swift: profile.swift ?? null,
          companyName: profile.name ?? '',
        }

        let qrCodeUrl: string | null = null
        if (profile.iban) {
          qrCodeUrl = await fetchQrCode({
            number: doc.number,
            total_with_vat: doc.total_with_vat,
            currency: doc.currency ?? 'CZK',
            variable_symbol: doc.variable_symbol,
            iban: profile.iban,
            swift: profile.swift ?? null,
            companyName: profile.name ?? '',
          })
        }

        setModal((prev) => prev ? { ...prev, qrCodeUrl, paymentInfo, qrLoading: false } : prev)
        return
      }
    }

    setModal((prev) => prev ? { ...prev, qrLoading: false } : prev)
  }

  const handleSend = async () => {
    if (!modal) return
    const recipientEmail = modal.doc.clients?.email
    if (!recipientEmail) {
      setSendError('Klient nemá zadaný e-mail.')
      return
    }
    setSending(true)
    setSendError('')
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: modal.doc.id,
          level: modal.level,
          recipientEmail,
          subject: modal.subject,
          bodyText: modal.bodyText,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setSendError(json.error ?? 'Chyba při odesílání.')
        return
      }
      setSentIds((prev) => ({
        ...prev,
        [modal.doc.id]: { sentAt: new Date().toISOString(), level: modal.level },
      }))
      setModal(null)
    } catch {
      setSendError('Síťová chyba. Zkuste to znovu.')
    } finally {
      setSending(false)
    }
  }

  // ---------- render ----------

  const totalCount = docs.length

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Upomínky</h1>
        {!loading && (
          <p className="text-gray-500 text-sm mt-1">
            {totalCount === 0
              ? 'Žádné faktury po splatnosti'
              : `${totalCount} faktur${totalCount === 1 ? 'a' : totalCount < 5 ? 'y' : ''} po splatnosti`}
          </p>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400 text-sm">Načítám…</div>
      ) : totalCount === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-20 text-center">
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-500 font-medium">Žádné faktury po splatnosti</p>
          <p className="text-gray-400 text-sm mt-1">Všechny faktury jsou uhrazeny nebo ve lhůtě.</p>
        </div>
      ) : (
        ([3, 2, 1] as ReminderLevel[]).map((level) => {
          const group = grouped[level]
          if (group.length === 0) return null
          const cfg = LEVEL_CONFIG[level]
          return (
            <div key={level} className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-[#111111] uppercase tracking-wide">
                  {cfg.label}
                </h2>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badgeClass}`}>
                  {group.length}
                </span>
              </div>

              <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${cfg.sectionBg}`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Faktura</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Klient</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Splatnost</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Dní po splatnosti</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Částka (CZK)</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Naposledy upomínka</th>
                      <th className="px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {group.map((doc) => {
                      const days = daysOverdue(doc.due_date)
                      const amount = doc.amount_czk ?? doc.total_with_vat
                      const lastSent = sentIds[doc.id] ?? doc.last_reminder
                      const noEmail = !doc.clients?.email

                      return (
                        <tr key={doc.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-6 py-3.5 font-medium text-[#F04E12]">{doc.number}</td>
                          <td className="px-6 py-3.5">
                            <div className="text-gray-700">{doc.clients?.name ?? '—'}</div>
                            {noEmail && (
                              <div className="text-xs text-amber-600 mt-0.5">Chybí e-mail klienta</div>
                            )}
                          </td>
                          <td className="px-6 py-3.5 text-gray-500 whitespace-nowrap">{formatDate(doc.due_date)}</td>
                          <td className="px-6 py-3.5">
                            <span className="inline-flex items-center gap-1.5 font-semibold text-sm" style={{ color: cfg.color }}>
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.color }} />
                              {days} dní
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-right font-medium whitespace-nowrap">
                            {formatCurrency(amount)}
                          </td>
                          <td className="px-6 py-3.5">
                            {lastSent ? (
                              <div>
                                <div className="text-xs text-gray-500">
                                  {new Date(lastSent.sentAt).toLocaleDateString('cs-CZ')}
                                </div>
                                <div className="mt-0.5">{levelBadge(lastSent.level as ReminderLevel)}</div>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Ještě neodeslána</span>
                            )}
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            <button
                              onClick={() => openModal(doc)}
                              disabled={noEmail}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F04E12] text-white rounded-lg text-xs font-semibold hover:bg-[#d9430f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                              title={noEmail ? 'Klient nemá zadaný e-mail' : undefined}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              Poslat upomínku
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })
      )}

      {/* ── Modal ── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !sending && setModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 bg-[#F04E12] rounded-t-2xl" />

            <div className="p-6 space-y-5">
              {/* Title row */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-[#111111]">Náhled upomínky</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-500">Faktura {modal.doc.number}</span>
                    <span className="text-gray-300">·</span>
                    {levelBadge(modal.level)}
                  </div>
                </div>
                <button
                  onClick={() => setModal(null)}
                  disabled={sending}
                  className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Recipient */}
              <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center gap-3">
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <div className="text-sm">
                  <span className="text-gray-500">Příjemce: </span>
                  <span className="font-medium text-[#111111]">{modal.doc.clients?.name}</span>
                  <span className="text-gray-500 ml-2">&lt;{modal.doc.clients?.email}&gt;</span>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Předmět</label>
                <input
                  value={modal.subject}
                  onChange={(e) => setModal((m) => m ? { ...m, subject: e.target.value } : m)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Tělo zprávy</label>
                <textarea
                  value={modal.bodyText}
                  onChange={(e) => setModal((m) => m ? { ...m, bodyText: e.target.value } : m)}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12] resize-y font-mono leading-relaxed"
                />
              </div>

              {/* Payment box preview */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Platební údaje (součást e-mailu)</p>
                </div>
                {modal.qrLoading ? (
                  <div className="px-4 py-5 flex items-center gap-2 text-gray-400 text-sm">
                    <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Načítám platební údaje…
                  </div>
                ) : (
                  <div className="px-4 py-4 flex gap-4">
                    {/* Payment details */}
                    <div className="flex-1 min-w-0">
                      <table className="text-sm w-full">
                        <tbody>
                          <PaymentRow label={modal.labels.labelInvoice} value={modal.doc.number} />
                          <PaymentRow
                            label={modal.labels.labelAmount}
                            value={
                              modal.doc.currency === 'EUR' && modal.doc.total_with_vat != null
                                ? `${formatCurrency(modal.doc.amount_czk ?? modal.doc.total_with_vat)} (${formatCurrency(modal.doc.total_with_vat, 'EUR')})`
                                : formatCurrency(modal.doc.amount_czk ?? modal.doc.total_with_vat)
                            }
                          />
                          {modal.paymentInfo?.bankAccount && (
                            <PaymentRow label={modal.labels.labelAccount} value={modal.paymentInfo.bankAccount} />
                          )}
                          {modal.paymentInfo?.iban && (
                            <PaymentRow label="IBAN" value={modal.paymentInfo.iban} />
                          )}
                          {modal.doc.variable_symbol && (
                            <PaymentRow label={modal.labels.labelVs} value={modal.doc.variable_symbol} />
                          )}
                          <PaymentRow label={modal.labels.labelDueDate} value={formatDate(modal.doc.due_date)} />
                          {!modal.paymentInfo && (
                            <tr>
                              <td colSpan={2} className="py-1 text-xs text-gray-400 italic">
                                Platební údaje nebyly nalezeny (chybí profil dodavatele)
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {/* QR code */}
                    {modal.qrCodeUrl ? (
                      <div className="shrink-0 text-center">
                        <img
                          src={modal.qrCodeUrl}
                          alt="QR platba"
                          width={96}
                          height={96}
                          className="border border-gray-200 rounded-lg p-1"
                        />
                        <p className="text-xs text-gray-400 mt-1">{modal.labels.labelQr}</p>
                      </div>
                    ) : modal.paymentInfo?.iban == null && !modal.qrLoading ? (
                      <div className="shrink-0 w-24 flex items-center justify-center text-xs text-gray-300 text-center">
                        QR není k dispozici (chybí IBAN)
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Signature preview */}
              <div className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide font-medium">Podpis (automaticky připojen)</p>
                <div className="text-sm text-gray-600 space-y-0.5">
                  <p>{modal.labels.signGreeting}</p>
                  <p className="font-bold text-[#111111]">Rudolf von Zahlung</p>
                  <p className="text-gray-500">{modal.labels.signTitle}</p>
                  <p className="text-gray-500">{modal.labels.signCompanyPrep}</p>
                  <p className="font-black text-[#F04E12] text-2xl" style={{ fontFamily: 'Georgia, serif' }}>vhs.</p>
                  <p className="text-gray-500 text-xs">www.v-h-s.cz · info@v-h-s.cz</p>
                  <p
                    className="text-gray-400 text-xs pt-1 border-t border-gray-200 mt-2"
                    dangerouslySetInnerHTML={{ __html: modal.labels.aiNote }}
                  />
                </div>
              </div>

              {/* Send info note */}
              <div className="text-xs text-gray-400 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Odesílací adresa: upominka@v-h-s.cz · E-mail bude odeslán jako HTML s formátovaným podpisem a PDF přílohou.
              </div>

              {sendError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                  {sendError}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setModal(null)}
                  disabled={sending}
                  className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Zrušit
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex-1 py-2.5 bg-[#F04E12] text-white rounded-lg text-sm font-semibold hover:bg-[#d9430f] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {sending ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Odesílám…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Odeslat upomínku
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PaymentRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="pr-4 py-1 text-xs text-gray-500 whitespace-nowrap align-top">{label}</td>
      <td className="py-1 text-xs font-semibold text-[#111111]">{value}</td>
    </tr>
  )
}
