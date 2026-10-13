import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashToken } from '@/lib/order-link'
import { findOrderByToken, isLinkExpired, markExpired, consentText, NO_STORE } from '@/lib/public-order'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[0-9 +()\-]+$/
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/

const MSG_INVALID = 'Odkaz není platný nebo byl nahrazen novým. Požádejte prosím dodavatele o nový odkaz.'
const MSG_EXPIRED = 'Platnost odkazu vypršela. Požádejte prosím dodavatele o nový odkaz.'
const MSG_DONE = 'Objednávka už byla potvrzena.'

const clientIp = (req: NextRequest): string | null => {
  const first = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = first || req.headers.get('x-real-ip')?.trim() || null
  return ip ? ip.slice(0, 64) : null
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const length = Number(req.headers.get('content-length') ?? 0)
    if (length > 10_000) return json({ error: 'Požadavek je příliš velký.' }, 413)

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Neplatný požadavek.' }, 400)
    }
    if (!body || typeof body !== 'object') return json({ error: 'Neplatný požadavek.' }, 400)

    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
    const name = str(body.name)
    const role = str(body.role)
    const email = str(body.email)
    const phone = str(body.phone)

    if (!name || name.length > 120 || CONTROL_RE.test(name)) return json({ error: 'Vyplňte jméno a příjmení (nejvýše 120 znaků).' }, 400)
    if (!role || role.length > 120 || CONTROL_RE.test(role)) return json({ error: 'Vyplňte funkci (nejvýše 120 znaků).' }, 400)
    if (!email || email.length > 200 || !EMAIL_RE.test(email) || CONTROL_RE.test(email)) return json({ error: 'Vyplňte platný e-mail.' }, 400)
    if (phone && (phone.length > 40 || !PHONE_RE.test(phone))) return json({ error: 'Telefon smí obsahovat číslice, mezery, +, závorky a pomlčky (nejvýše 40 znaků).' }, 400)
    if (body.consent !== true) return json({ error: 'Pro potvrzení je nutný souhlas.' }, 400)

    const admin = createAdminClient()
    const row = await findOrderByToken(admin, params.token)
    if (!row) return json({ error: MSG_INVALID }, 404)
    if (row.status === 'confirmed') return json({ error: MSG_DONE }, 409)
    if (row.status === 'expired') return json({ error: MSG_EXPIRED }, 410)
    if (row.status !== 'sent') return json({ error: MSG_INVALID }, 404)
    if (isLinkExpired(row)) {
      await markExpired(admin, params.token)
      return json({ error: MSG_EXPIRED }, 410)
    }

    const nowIso = new Date().toISOString()
    // Údaje souhlasu se ukládají do terms_values stejnou aktualizací jako samotné potvrzení;
    // ostatní klíče zůstávají (objednávka je ve stavu sent zamčená, hodnoty se mezi načtením a zápisem nemění).
    const termsValues = { ...(row.terms_values ?? {}), consent_text: consentText(row.number), consent_at: nowIso }

    const { data, error } = await admin
      .from('documents')
      .update({
        status: 'confirmed',
        confirmed_at: nowIso,
        confirmed_by_name: name,
        confirmed_by_role: role,
        confirmed_by_email: email,
        confirmed_by_phone: phone || null,
        confirmed_ip: clientIp(req),
        confirmed_user_agent: req.headers.get('user-agent')?.slice(0, 300) || null,
        terms_values: termsValues,
      })
      .eq('confirm_token_hash', hashToken(params.token))
      .eq('type', 'objednavka')
      .eq('status', 'sent')
      .is('confirmed_at', null)
      .gt('terms_expires_at', nowIso)
      .select('id')
    if (error) return json({ error: 'Potvrzení se nezdařilo, zkuste to prosím znovu.' }, 500)

    if (!data || data.length === 0) {
      // nic se nezměnilo: zjistíme důvod
      const now = await findOrderByToken(admin, params.token)
      if (!now) return json({ error: MSG_INVALID }, 404)
      if (now.status === 'confirmed' || now.confirmed_at) return json({ error: MSG_DONE }, 409)
      if (now.status === 'expired' || (now.status === 'sent' && isLinkExpired(now))) {
        if (now.status === 'sent') await markExpired(admin, params.token)
        return json({ error: MSG_EXPIRED }, 410)
      }
      return json({ error: MSG_INVALID }, 404)
    }

    return json({ ok: true })
  } catch {
    return json({ error: 'Potvrzení se nezdařilo, zkuste to prosím znovu.' }, 500)
  }
}
