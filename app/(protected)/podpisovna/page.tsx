'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Document } from '@/lib/types'
import { orderPriceLabel, missingLabel } from '@/lib/order-terms'
import { buildOrderEmail } from '@/lib/order-email'
import { formatCurrency, formatDate, STATUS_LABELS, STATUS_COLORS } from '@/lib/utils'
import { useUserRole } from '@/lib/useUserRole'

const TABS = [
  { status: 'issued', label: 'K odeslání' },
  { status: 'sent', label: 'Čeká na potvrzení' },
  { status: 'confirmed', label: 'Potvrzeno' },
  { status: 'expired', label: 'Vypršelo' },
] as const

const PREVIEW_CONFIRM_URL = 'https://vhs-cash.vercel.app/potvrzeni/ukazka'

const Missing = () => <span className="text-red-600 font-medium">chybí</span>

function Contact({ doc }: { doc: Document }) {
  return (
    <div className="text-sm">
      <div>{doc.contact_name?.trim() ? doc.contact_name : <Missing />}</div>
      <div className="text-gray-500">{doc.contact_email?.trim() ? doc.contact_email : <Missing />}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

export default function PodpisovnaPage() {
  const supabase = createClient()
  const { role, loading: roleLoading, workspaceId } = useUserRole()
  const isAdmin = !roleLoading && role === 'admin'
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<string>('issued')
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)

  useEffect(() => {
    if (!workspaceId) return
    setLoading(true)
    supabase
      .from('documents')
      .select('*, clients(name)')
      .eq('workspace_id', workspaceId)
      .eq('type', 'objednavka')
      .in('status', ['issued', 'sent', 'confirmed', 'expired'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setDocuments((data ?? []) as Document[])
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const d of documents) c[d.status] = (c[d.status] ?? 0) + 1
    return c
  }, [documents])

  const rows = documents.filter((d) => d.status === tab)

  const PreviewButton = ({ doc }: { doc: Document }) => (
    <button
      onClick={() => setPreviewDoc(doc)}
      disabled={!isAdmin}
      title={isAdmin ? undefined : 'Tato akce vyžaduje roli administrátora'}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
        isAdmin ? 'border-gray-200 text-[#111111] hover:border-[#F04E12] hover:text-[#F04E12]' : 'border-gray-100 text-gray-300 cursor-not-allowed'
      }`}
    >
      Náhled
    </button>
  )

  const priceOf = (doc: Document) => orderPriceLabel(doc) ?? formatCurrency(doc.total_with_vat ?? 0, doc.currency)

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#111111]">Podpisovna</h1>
        <p className="text-gray-500 text-sm mt-1">Objednávky k odeslání a potvrzení</p>
      </div>

      <div className="flex gap-1 overflow-x-auto mb-4 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.status}
            onClick={() => setTab(t.status)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.status ? 'border-[#F04E12] text-[#F04E12]' : 'border-transparent text-gray-500 hover:text-[#111111]'
            }`}
          >
            {t.label} <span className="ml-1 text-xs text-gray-400">({counts[t.status] ?? 0})</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Načítání…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Žádné objednávky v této záložce</div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {rows.map((doc) => (
                <div key={doc.id} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <Link href={`/documents/${doc.id}`} className="font-semibold text-[#F04E12] text-sm">{doc.number}</Link>
                    <StatusBadge status={doc.status} />
                  </div>
                  <p className="text-sm font-medium text-[#111111] mb-1">{(doc.clients as any)?.name ?? '—'}</p>
                  <Contact doc={doc} />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-bold text-[#111111]">{priceOf(doc)}</span>
                    <span className="text-xs text-gray-400">{doc.terms_sent_at ? `Odesláno ${formatDate(doc.terms_sent_at)}` : 'Neodesláno'}</span>
                  </div>
                  <div className="mt-3"><PreviewButton doc={doc} /></div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <table className="hidden md:table w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Číslo</th>
                  <th className="px-4 py-3">Klient</th>
                  <th className="px-4 py-3">Kontaktní osoba</th>
                  <th className="px-4 py-3">Cena</th>
                  <th className="px-4 py-3">Odesláno</th>
                  <th className="px-4 py-3">Stav</th>
                  <th className="px-4 py-3">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((doc) => (
                  <tr key={doc.id} className="hover:bg-orange-50/40 transition-colors">
                    <td className="px-4 py-3 text-sm font-semibold">
                      <Link href={`/documents/${doc.id}`} className="text-[#F04E12] hover:underline">{doc.number}</Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#111111]">{(doc.clients as any)?.name ?? '—'}</td>
                    <td className="px-4 py-3"><Contact doc={doc} /></td>
                    <td className="px-4 py-3 text-sm font-bold text-[#111111]">{priceOf(doc)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{doc.terms_sent_at ? formatDate(doc.terms_sent_at) : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                    <td className="px-4 py-3"><PreviewButton doc={doc} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {previewDoc && isAdmin && <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  )
}

function PreviewModal({ doc, onClose }: { doc: Document; onClose: () => void }) {
  const [checking, setChecking] = useState(false)
  const [missing, setMissing] = useState<string[] | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)

  const email = useMemo(
    () => buildOrderEmail({ docNumber: doc.number, confirmUrl: PREVIEW_CONFIRM_URL }),
    [doc.number],
  )
  const contactMissing = !doc.contact_name?.trim() || !doc.contact_email?.trim()
  const attachment = `Objednavka-${doc.number.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`
  const pdfUrl = `/api/pdf?id=${encodeURIComponent(doc.id)}`

  const checkPdf = async () => {
    setChecking(true)
    setCheckError(null)
    setMissing(null)
    try {
      const res = await fetch(pdfUrl)
      if (!res.ok) throw new Error(`PDF se nepodařilo vytvořit (${res.status})`)
      const header = res.headers.get('X-Terms-Missing')
      await res.arrayBuffer() // obsah zahodíme
      setMissing(header ? header.split(',').map((k) => k.trim()).filter(Boolean) : [])
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : String(e))
    } finally {
      setChecking(false)
    }
  }

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex gap-3 text-sm py-1.5 border-b border-gray-100">
      <div className="w-28 shrink-0 text-gray-500">{label}</div>
      <div className="min-w-0 break-words text-[#111111]">{value}</div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-[#111111]">Náhled e-mailu – {doc.number}</h2>
          <button onClick={onClose} aria-label="Zavřít" className="text-gray-400 hover:text-[#111111] text-xl leading-none">×</button>
        </div>

        {row('Komu', contactMissing
          ? <><span>{doc.contact_name?.trim() || <Missing />}</span> {'<'}{doc.contact_email?.trim() || <Missing />}{'>'}</>
          : `${doc.contact_name} <${doc.contact_email}>`)}
        {row('Od', 'Miloš Serbus <objednavky@v-h-s.cz>')}
        {row('Odpovědi na', 'info@v-h-s.cz')}
        {row('Předmět', email.subject)}

        <iframe
          title="Náhled těla e-mailu"
          sandbox=""
          srcDoc={email.html}
          className="w-full h-[480px] border border-gray-200 rounded-lg mt-3"
        />
        <p className="text-xs text-gray-400 mt-1">Tlačítko v náhledu vede na ukázkovou adresu, odkaz se vytvoří při odeslání.</p>

        {row('Příloha', <>{attachment} · <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-[#F04E12] hover:underline">Zobrazit PDF</a></>)}

        {contactMissing && (
          <div className="mt-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">
            Chybí kontaktní osoba nebo e-mail, doplňte je v objednávce nebo u klienta.{' '}
            <Link href={`/documents/${doc.id}`} className="underline font-medium">Otevřít objednávku</Link>
          </div>
        )}

        <div className="mt-3">
          <button
            onClick={checkPdf}
            disabled={checking}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 hover:border-[#F04E12] hover:text-[#F04E12] disabled:opacity-50 transition-colors"
          >
            {checking ? 'Kontroluji…' : 'Zkontrolovat PDF'}
          </button>
          {checkError && <div className="mt-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{checkError}</div>}
          {missing && missing.length > 0 && (
            <div className="mt-2 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm p-3">
              <p className="font-medium mb-1">V PDF chybí:</p>
              <ul className="list-disc pl-5">
                {missing.map((k) => <li key={k}>{missingLabel(k)}</li>)}
              </ul>
            </div>
          )}
          {missing && missing.length === 0 && (
            <div className="mt-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm p-3">Nic nechybí</div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button disabled title="Zapne se v dalším kroku" className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-400 cursor-not-allowed">
            Odeslat e-mailem
          </button>
          <button disabled title="Zapne se v dalším kroku" className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-400 cursor-not-allowed">
            Odeslat sám (odkaz a text)
          </button>
          <span className="self-center text-xs text-gray-400">Zapne se v dalším kroku</span>
        </div>
      </div>
    </div>
  )
}
