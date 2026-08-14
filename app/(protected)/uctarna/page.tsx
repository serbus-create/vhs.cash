'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useUserRole } from '@/lib/useUserRole'
import {
  getInvoiceEmailSubject,
  getInvoiceEmailBodyText,
  getLang,
  type Lang,
  type InvoiceEmailVars,
} from '@/lib/uctarna-email'

// ---------- types ----------

interface IssuedInvoice {
  id: string
  number: string
  issue_date: string
  due_date: string | null
  total_with_vat: number
  currency: string
  amount_czk: number | null
  variable_symbol: string | null
  company_profile_id: string | null
  client_id: string | null
  clients: { name: string; email: string | null; country: string | null } | null
}

interface CompanyProfileInfo {
  id: string
  name: string
  bank_account: string | null
  iban: string | null
  swift: string | null
}

interface ModalState {
  doc: IssuedInvoice
  lang: Lang
  subject: string
  bodyText: string
  recipientEmail: string
  replyTo: string
  qrCodeUrl: string | null
  profile: CompanyProfileInfo | null
}

// ---------- helpers ----------

function monthLabel(yearMonth: string): string {
  const label = new Date(yearMonth + '-01').toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function buildQrUrl(profile: CompanyProfileInfo, vars: { amount: number; currency: string; number: string; variableSymbol: string | null }): string {
  const p = new URLSearchParams({
    iban: profile.iban!,
    amount: String(vars.amount),
    currency: vars.currency,
    number: vars.number,
  })
  if (vars.variableSymbol) p.set('vs', vars.variableSymbol)
  if (profile.swift) p.set('swift', profile.swift)
  if (profile.name) p.set('name', profile.name)
  return `/api/qr-code?${p.toString()}`
}

// ---------- main component ----------

export default function UctarnaPage() {
  const supabase = createClient()
  const { role, workspaceId } = useUserRole()
  const isAdmin = role === 'admin'
  const [docs, setDocs] = useState<IssuedInvoice[]>([])
  const [profiles, setProfiles] = useState<Record<string, CompanyProfileInfo>>({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [markingId, setMarkingId] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceId) return
    async function load() {
      setLoading(true)
      const [docsRes, profilesRes] = await Promise.all([
        supabase
          .from('documents')
          .select('id, number, issue_date, due_date, total_with_vat, currency, amount_czk, variable_symbol, company_profile_id, client_id, clients(name, email, country)')
          .eq('workspace_id', workspaceId)
          .eq('type', 'faktura')
          .eq('status', 'issued')
          .order('issue_date', { ascending: false }),
        supabase
          .from('company_profiles')
          .select('id, name, bank_account, iban, swift')
          .eq('workspace_id', workspaceId),
      ])

      const profileMap: Record<string, CompanyProfileInfo> = {}
      for (const p of profilesRes.data ?? []) {
        profileMap[p.id] = p as CompanyProfileInfo
      }
      setProfiles(profileMap)

      const result: IssuedInvoice[] = (docsRes.data ?? []).map((d) => ({
        id: d.id,
        number: d.number,
        issue_date: d.issue_date,
        due_date: d.due_date ?? null,
        total_with_vat: d.total_with_vat,
        currency: d.currency,
        amount_czk: d.amount_czk ?? null,
        variable_symbol: d.variable_symbol ?? null,
        company_profile_id: d.company_profile_id ?? null,
        client_id: d.client_id ?? null,
        clients: (Array.isArray(d.clients) ? d.clients[0] : d.clients) as IssuedInvoice['clients'],
      }))

      setDocs(result)
      setLoading(false)
    }
    load()
  }, [workspaceId])

  const grouped = useMemo(() => {
    const byMonth: Record<string, IssuedInvoice[]> = {}
    for (const doc of docs) {
      const key = doc.issue_date.slice(0, 7)
      if (!byMonth[key]) byMonth[key] = []
      byMonth[key].push(doc)
    }
    return Object.entries(byMonth).sort(([a], [b]) => b.localeCompare(a))
  }, [docs])

  const openModal = (doc: IssuedInvoice) => {
    const lang = getLang(doc.clients?.country)
    const amount = doc.amount_czk ?? doc.total_with_vat
    const profile = doc.company_profile_id ? (profiles[doc.company_profile_id] ?? null) : null

    const vars: InvoiceEmailVars = {
      number: doc.number,
      amount,
      dueDate: doc.due_date,
      currency: doc.currency,
      amountEur: doc.currency === 'EUR' ? doc.total_with_vat : null,
      bankAccount: profile?.bank_account ?? null,
      iban: profile?.iban ?? null,
      variableSymbol: doc.variable_symbol,
    }

    const qrCodeUrl = profile?.iban
      ? buildQrUrl(profile, { amount: doc.total_with_vat, currency: doc.currency ?? 'CZK', number: doc.number, variableSymbol: doc.variable_symbol })
      : null

    setModal({
      doc,
      lang,
      subject: getInvoiceEmailSubject(doc.number, lang),
      bodyText: getInvoiceEmailBodyText(vars, lang),
      recipientEmail: doc.clients?.email ?? '',
      replyTo: 'info@v-h-s.cz',
      qrCodeUrl,
      profile,
    })
    setSendError('')
  }

  const handleSend = async () => {
    if (!modal) return
    if (!modal.recipientEmail) { setSendError('Chybí e-mail příjemce.'); return }
    setSending(true)
    setSendError('')
    try {
      const res = await fetch('/api/uctarna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: modal.doc.id,
          recipientEmail: modal.recipientEmail,
          replyTo: modal.replyTo,
          subject: modal.subject,
          bodyText: modal.bodyText,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setSendError(json.error ?? 'Chyba při odesílání.'); return }
      setDocs((prev) => prev.filter((d) => d.id !== modal.doc.id))
      setModal(null)
    } catch {
      setSendError('Síťová chyba. Zkuste to znovu.')
    } finally {
      setSending(false)
    }
  }

  const handleMarkSent = async (docId: string) => {
    setMarkingId(docId)
    const { error } = await supabase
      .from('documents')
      .update({ status: 'sent' })
      .eq('id', docId)
    if (!error) {
      setDocs((prev) => prev.filter((d) => d.id !== docId))
    }
    setMarkingId(null)
    setConfirmId(null)
  }

  // ---------- render ----------

  return (
    <div className="p-4 md:p-8 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Účtárna</h1>
        {!loading && (
          <p className="text-gray-500 text-sm mt-1">
            {docs.length === 0
              ? 'Žádné faktury čekající na odeslání'
              : `${docs.length} faktura${docs.length === 1 ? '' : docs.length < 5 ? 'y' : ''} čeká na odeslání`}
          </p>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400 text-sm">Načítám…</div>
      ) : docs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-20 text-center">
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-500 font-medium">Žádné faktury k odeslání</p>
          <p className="text-gray-400 text-sm mt-1">Všechny vydané faktury byly odeslány klientům.</p>
        </div>
      ) : (
        grouped.map(([monthKey, group]) => (
          <div key={monthKey} className="space-y-3">
            <h2 className="text-sm font-semibold text-[#111111] uppercase tracking-wide">
              {monthLabel(monthKey)}
              <span className="ml-2 text-gray-400 font-normal normal-case">({group.length})</span>
            </h2>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Mobile card list */}
              <div className="md:hidden divide-y divide-gray-100">
                {group.map((doc) => {
                  const amount = doc.amount_czk ?? doc.total_with_vat
                  const profileName = doc.company_profile_id ? (profiles[doc.company_profile_id]?.name ?? '—') : '—'
                  const noEmail = !doc.clients?.email
                  return (
                    <div key={doc.id} className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-semibold text-[#F04E12] text-sm">{doc.number}</span>
                        <span className="text-xs text-gray-400">{formatDate(doc.due_date)}</span>
                      </div>
                      <p className="text-sm font-medium text-[#111111]">{doc.clients?.name ?? '—'}</p>
                      <p className="text-xs text-gray-500">{profileName}</p>
                      {noEmail && <p className="text-xs text-amber-600 mt-0.5">Chybí e-mail klienta</p>}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-bold text-[#111111]">{formatCurrency(amount)}</span>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => openModal(doc)}
                            disabled={noEmail}
                            className="flex-1 py-1.5 bg-[#F04E12] text-white rounded-lg text-xs font-semibold hover:bg-[#d9430f] transition-colors disabled:opacity-40"
                          >
                            Poslat fakturu
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Faktura</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Klient</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Vystavovatel</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Datum vydání</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Splatnost</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Částka (CZK)</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {group.map((doc) => {
                    const amount = doc.amount_czk ?? doc.total_with_vat
                    const profileName = doc.company_profile_id ? (profiles[doc.company_profile_id]?.name ?? '—') : '—'
                    const noEmail = !doc.clients?.email
                    const isConfirming = confirmId === doc.id
                    const isMarking = markingId === doc.id

                    return (
                      <tr key={doc.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-6 py-3.5 font-medium text-[#F04E12]">{doc.number}</td>
                        <td className="px-6 py-3.5">
                          <div className="text-gray-700">{doc.clients?.name ?? '—'}</div>
                          {noEmail && (
                            <div className="text-xs text-amber-600 mt-0.5">Chybí e-mail klienta</div>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-gray-500">{profileName}</td>
                        <td className="px-6 py-3.5 text-gray-500 whitespace-nowrap">{formatDate(doc.issue_date)}</td>
                        <td className="px-6 py-3.5 text-gray-500 whitespace-nowrap">{doc.due_date ? formatDate(doc.due_date) : '—'}</td>
                        <td className="px-6 py-3.5 text-right font-medium whitespace-nowrap">
                          {formatCurrency(amount)}
                          {doc.currency === 'EUR' && doc.total_with_vat != null && (
                            <div className="text-xs text-gray-400 font-normal mt-0.5">
                              ({formatCurrency(doc.total_with_vat, 'EUR')})
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-3.5">
                          {isAdmin && (
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => openModal(doc)}
                                disabled={noEmail}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F04E12] text-white rounded-lg text-xs font-semibold hover:bg-[#d9430f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                                title={noEmail ? 'Klient nemá zadaný e-mail' : undefined}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                Poslat fakturu
                              </button>

                              {isConfirming ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-500 whitespace-nowrap">Opravdu?</span>
                                  <button
                                    onClick={() => handleMarkSent(doc.id)}
                                    disabled={isMarking}
                                    className="px-2 py-1.5 bg-gray-700 text-white rounded-lg text-xs font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
                                  >
                                    {isMarking ? '…' : 'Ano'}
                                  </button>
                                  <button
                                    onClick={() => setConfirmId(null)}
                                    className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                                  >
                                    Ne
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmId(doc.id)}
                                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors whitespace-nowrap"
                                >
                                  Odešlu si sám
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        ))
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
              {/* Title */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-[#111111]">Odeslat fakturu</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {modal.doc.number} · {modal.doc.clients?.name ?? '—'}
                  </p>
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
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Příjemce</label>
                <input
                  type="email"
                  value={modal.recipientEmail}
                  onChange={(e) => setModal((m) => m ? { ...m, recipientEmail: e.target.value } : m)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12]"
                  placeholder="email@klient.cz"
                />
              </div>

              {/* Reply-to */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Odpovědi na</label>
                <div className="flex gap-2">
                  {(['info@v-h-s.cz', 'serbus@v-h-s.cz'] as const).map((addr) => (
                    <button
                      key={addr}
                      type="button"
                      onClick={() => setModal((m) => m ? { ...m, replyTo: addr } : m)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        modal.replyTo === addr
                          ? 'bg-[#F04E12] text-white border-[#F04E12]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {addr}
                    </button>
                  ))}
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
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F04E12] resize-y font-mono leading-relaxed"
                />
              </div>

              {/* Payment box preview */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Platební údaje (součást e-mailu)</p>
                </div>
                <div className="px-4 py-4 flex gap-4">
                  <div className="flex-1 min-w-0">
                    <table className="text-sm w-full">
                      <tbody>
                        <PaymentRow label="Faktura č." value={modal.doc.number} />
                        <PaymentRow
                          label="Částka k úhradě"
                          value={
                            modal.doc.currency === 'EUR' && modal.doc.total_with_vat != null
                              ? `${formatCurrency(modal.doc.amount_czk ?? modal.doc.total_with_vat)} (${formatCurrency(modal.doc.total_with_vat, 'EUR')})`
                              : formatCurrency(modal.doc.amount_czk ?? modal.doc.total_with_vat)
                          }
                        />
                        {modal.profile?.bank_account && (
                          <PaymentRow label="Číslo účtu" value={modal.profile.bank_account} />
                        )}
                        {modal.profile?.iban && (
                          <PaymentRow label="IBAN" value={modal.profile.iban} />
                        )}
                        {modal.doc.variable_symbol && (
                          <PaymentRow label="Variabilní symbol" value={modal.doc.variable_symbol} />
                        )}
                        {modal.doc.due_date && (
                          <PaymentRow label="Datum splatnosti" value={formatDate(modal.doc.due_date)} />
                        )}
                        {!modal.profile && (
                          <tr>
                            <td colSpan={2} className="py-1 text-xs text-gray-400 italic">
                              Platební údaje nebyly nalezeny (chybí profil dodavatele)
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {modal.qrCodeUrl ? (
                    <div className="shrink-0 text-center">
                      <img
                        src={modal.qrCodeUrl}
                        alt="QR platba"
                        width={96}
                        height={96}
                        className="border border-gray-200 rounded-lg p-1"
                      />
                      <p className="text-xs text-gray-400 mt-1">QR platba</p>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* PDF note */}
              <div className="text-xs text-gray-400 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                E-mail bude odeslán s PDF přílohou faktury · Odesílací adresa: uctarna@v-h-s.cz
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
                      Odeslat fakturu
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
