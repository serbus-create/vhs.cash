const fmtDateTime = (v: string | null | undefined) =>
  v ? new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Prague' }).format(new Date(v)) : '—'

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col sm:flex-row sm:gap-4 py-2 border-b border-gray-100 last:border-0">
    <dt className="sm:w-40 shrink-0 text-sm text-gray-500">{label}</dt>
    <dd className="text-sm text-[#111111] break-words">{children}</dd>
  </div>
)

export default function ThankYou({
  number,
  token,
  details,
}: {
  number: string
  token: string
  details?: { name?: string | null; role?: string | null; confirmedAt?: string | null }
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 mb-3" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-[#111111] mb-1">Děkujeme za potvrzení</h1>
      <p className="text-[#111111] mb-1">Přejeme hezký den. V následujících chvílích se Vám budeme hned věnovat.</p>
      <p className="text-sm text-gray-500 mb-4">Objednávka č. {number}</p>
      {details && (
        <dl>
          <Row label="Potvrdil(a)">{details.name}</Row>
          <Row label="Funkce">{details.role}</Row>
          <Row label="Čas potvrzení">{fmtDateTime(details.confirmedAt)}</Row>
        </dl>
      )}
      <a
        href={`/api/potvrzeni/${encodeURIComponent(token)}/pdf`}
        className="mt-5 inline-block w-full sm:w-auto text-center px-5 py-3 rounded-lg text-base font-semibold bg-[#F04E12] text-white hover:bg-[#d9430f]"
      >
        Stáhnout PDF
      </a>
    </div>
  )
}
