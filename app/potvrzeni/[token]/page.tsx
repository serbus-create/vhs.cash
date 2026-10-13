import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrderByToken, isLinkExpired, markExpired, consentText } from '@/lib/public-order'
import { loadOrderPdfInput } from '@/lib/pdf/generate-order'
import { orderPaymentLines, orderDepositAmountText, orderPricing } from '@/lib/order-summary'
import { parseSnapshot } from '@/lib/terms/snapshot'
import ConfirmForm from './confirm-form'
import ThankYou from './thank-you'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Potvrzení objednávky',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
}

const MSG_INVALID = 'Odkaz není platný nebo byl nahrazen novým. Požádejte prosím dodavatele o nový odkaz.'
const MSG_EXPIRED = 'Platnost odkazu vypršela. Požádejte prosím dodavatele o nový odkaz.'

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="h-1 bg-[#F04E12]" />
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/vhs-logo-black.png" alt="vhs." className="h-10 w-auto mb-6" />
        {children}
      </div>
    </main>
  )
}

function Notice({ title, text }: { title?: string; text: string }) {
  return (
    <Shell>
      <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
        {title && <h1 className="text-xl font-bold text-[#111111] mb-2">{title}</h1>}
        <p className="text-[#111111]">{text}</p>
      </div>
    </Shell>
  )
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col sm:flex-row sm:gap-4 py-2 border-b border-gray-100 last:border-0">
    <dt className="sm:w-40 shrink-0 text-sm text-gray-500">{label}</dt>
    <dd className="text-sm text-[#111111] break-words">{children}</dd>
  </div>
)

export default async function PotvrzeniPage({ params }: { params: { token: string } }) {
  const token = params.token
  const admin = createAdminClient()

  const row = await findOrderByToken(admin, token)
  if (!row || !['sent', 'confirmed', 'expired'].includes(row.status)) return <Notice text={MSG_INVALID} />

  if (row.status === 'expired') return <Notice text={MSG_EXPIRED} />
  if (row.status === 'sent' && isLinkExpired(row)) {
    await markExpired(admin, token)
    return <Notice text={MSG_EXPIRED} />
  }

  let input
  try {
    input = await loadOrderPdfInput(admin, row.id)
  } catch {
    return <Notice text={MSG_INVALID} />
  }
  const { doc, client, companyProfile } = input
  const confirmed = doc.status === 'confirmed'

  // Potvrzeno: jen děkovná stránka s údaji potvrzení
  if (confirmed) {
    return (
      <Shell>
        <ThankYou
          number={doc.number}
          token={token}
          details={{ name: doc.confirmed_by_name, role: doc.confirmed_by_role, confirmedAt: doc.confirmed_at }}
        />
      </Shell>
    )
  }

  // Stav sent a platný odkaz
  const snapshot = parseSnapshot(doc.terms_snapshot)
  const pricing = orderPricing(doc, client, companyProfile)
  const payment = orderPaymentLines(doc, client, companyProfile, orderDepositAmountText(doc, client, companyProfile))
  const tv = doc.terms_values ?? {}

  return (
    <Shell>
      <h1 className="text-2xl font-bold text-[#111111] mb-1">Potvrzení objednávky</h1>
      <p className="text-sm text-gray-500 mb-5">Zkontrolujte prosím objednávku a podmínky a potvrďte je.</p>

      <section className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mb-4">
        <h2 className="text-lg font-bold text-[#111111] mb-2">Shrnutí objednávky</h2>
        <dl>
          <Row label="Číslo objednávky">{doc.number}</Row>
          <Row label="Datum vystavení">{fmtDate(doc.issue_date)}</Row>
          {doc.subject && <Row label="Předmět zakázky">{doc.subject}</Row>}
          <Row label="Termín">{(tv.termin_text ?? '').trim() || 'dle dohody'}</Row>
          <Row label="Dodavatel">{companyProfile?.name ?? '—'}</Row>
          <Row label="Klient">{client?.name ?? '—'}</Row>
        </dl>

        <h3 className="text-sm font-semibold text-[#111111] mt-4 mb-1">Položky</h3>
        <ul className="divide-y divide-gray-100 border-t border-b border-gray-100">
          {doc.document_items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 py-2 text-sm">
              <span className="text-[#111111] break-words min-w-0">{item.description}</span>
              <span className="text-gray-500 whitespace-nowrap">{item.quantity} ks</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 rounded-lg bg-[#FFF3EF] border-l-4 border-[#F04E12] p-3 space-y-1">
          <p className="text-sm font-semibold text-[#111111]">Cena a platba</p>
          {payment.price.map((l, i) => (
            <p key={i} className="text-sm text-[#111111]">{l.text}{l.missing}</p>
          ))}
          <p className="text-sm text-[#111111]">{payment.deposit.text}</p>
          {payment.rezim === 'pevna' && !pricing.supplierIsVatPayer && (
            <p className="text-xs text-gray-500">Dodavatel není plátcem DPH.</p>
          )}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mb-4">
        <h2 className="text-lg font-bold text-[#111111] mb-3">{snapshot ? snapshot.title : 'Podmínky spolupráce'}</h2>
        {snapshot ? (
          <div className="space-y-5">
            {snapshot.articles.map((a) => (
              <div key={a.number}>
                <h3 className="text-base font-semibold text-[#111111] mb-2">{a.number}. {a.title}</h3>
                <ol className="space-y-2">
                  {a.clauses.map((c) => (
                    <li key={c.id} className="flex gap-2 text-sm text-gray-800 leading-relaxed">
                      <span className="font-semibold text-[#111111] shrink-0">{c.id}</span>
                      <span className="min-w-0 break-words">{c.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        ) : (
          <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">
            Podmínky se nepodařilo načíst, kontaktujte dodavatele
          </div>
        )}
      </section>

      {snapshot && (
        <section className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mb-4">
          <h2 className="text-lg font-bold text-[#111111] mb-3">Potvrzení</h2>
          <ConfirmForm
            token={token}
            number={doc.number}
            initialName={doc.contact_name ?? ''}
            initialEmail={doc.contact_email ?? ''}
            consentLabel={consentText(doc.number)}
          />
        </section>
      )}

      <a
        href={`/api/potvrzeni/${encodeURIComponent(token)}/pdf`}
        className="inline-block text-sm text-[#F04E12] hover:underline"
      >
        Stáhnout PDF
      </a>
    </Shell>
  )
}
