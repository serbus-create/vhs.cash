'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[0-9 +()\-]+$/

const inputCls =
  'w-full px-3 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#F04E12] focus:border-transparent'

export default function ConfirmForm({
  token,
  initialName,
  initialEmail,
  consentLabel,
}: {
  token: string
  initialName: string
  initialEmail: string
  consentLabel: string
}) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [role, setRole] = useState('')
  const [email, setEmail] = useState(initialEmail)
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validate = (): string | null => {
    if (!name.trim()) return 'Vyplňte jméno a příjmení.'
    if (!role.trim()) return 'Vyplňte funkci.'
    if (!EMAIL_RE.test(email.trim())) return 'Vyplňte platný e-mail.'
    if (phone.trim() && !PHONE_RE.test(phone.trim())) return 'Telefon smí obsahovat jen číslice, mezery, +, závorky a pomlčky.'
    if (!consent) return 'Pro potvrzení je nutný souhlas.'
    return null
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/potvrzeni/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, role, email, phone, consent }),
      })
      const b = await res.json().catch(() => ({}))
      if (res.ok) {
        // archiv a e-maily dokončí server, výsledek klientovi neukazujeme
        fetch(`/api/potvrzeni/${encodeURIComponent(token)}/finalize`, { method: 'POST', keepalive: true }).catch(() => {})
        router.refresh()
        return // tlačítko zůstane vypnuté, stránka se obnoví do stavu potvrzeno
      }
      setError(b.error ?? 'Potvrzení se nezdařilo, zkuste to prosím znovu.')
      // 409/410/404 mění stav stránky, obnovíme ji
      if ([404, 409, 410].includes(res.status)) router.refresh()
    } catch {
      setError('Potvrzení se nezdařilo, zkontrolujte připojení a zkuste to znovu.')
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="c-name" className="block text-sm font-medium text-[#111111] mb-1">Jméno a příjmení</label>
        <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" required className={inputCls} />
      </div>
      <div>
        <label htmlFor="c-role" className="block text-sm font-medium text-[#111111] mb-1">Funkce</label>
        <input id="c-role" value={role} onChange={(e) => setRole(e.target.value)} maxLength={120} placeholder="například jednatel, oprávněná osoba" required className={inputCls} />
      </div>
      <div>
        <label htmlFor="c-email" className="block text-sm font-medium text-[#111111] mb-1">E-mail</label>
        <input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} autoComplete="email" required className={inputCls} />
      </div>
      <div>
        <label htmlFor="c-phone" className="block text-sm font-medium text-[#111111] mb-1">Telefon <span className="text-gray-400 font-normal">(nepovinné)</span></label>
        <input id="c-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} autoComplete="tel" className={inputCls} />
      </div>

      <label className="flex items-start gap-3 text-sm text-[#111111] cursor-pointer">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#F04E12]" />
        <span>{consentLabel}</span>
      </label>

      {error && <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{error}</div>}

      <div>
        <button
          type="submit"
          disabled={busy}
          className="w-full py-3.5 rounded-lg text-base font-semibold bg-[#F04E12] text-white hover:bg-[#d9430f] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {busy ? 'Potvrzuji…' : 'Potvrdit objednávku'}
        </button>
        <p className="text-xs text-gray-500 mt-2">
          Při potvrzení se uloží čas, IP adresa, Vaše údaje a znění podmínek jako doklad o uzavření zakázky.
        </p>
      </div>
    </form>
  )
}
