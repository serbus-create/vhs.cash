// Sestavení identifikace dodavatele a klienta pro podmínky spolupráce.
// Text je stejný pro firmu i OSVČ, liší se jen identifikace stran.

export type PartyKind = 'firma' | 'osvc' | 'neurceno'

// Volné vstupní pole. Pasuje na řádek firemního profilu (dodavatel)
// i klienta (clients), nepovinná pole mohou chybět.
export interface PartyInput {
  name: string
  ico?: string | null
  dic?: string | null
  address?: string | null
  city?: string | null
  zip?: string | null
  // dodavatel: company_profiles.profile_type ('sro' | 'osvč')
  profile_type?: string | null
  // klient: clients.entity_type ('firma' | 'osvc')
  entity_type?: string | null
  // jen firma (s.r.o.)
  spisova_znacka?: string | null
  represented_by?: string | null
}

export interface PartyIdentification {
  text: string
  kind: PartyKind
  // názvy polí, která chybí a v textu se tedy neukážou
  missing: string[]
}

function clean(value: string | null | undefined): string {
  return (value ?? '').trim()
}

export function partyKind(party: PartyInput): PartyKind {
  const profileType = clean(party.profile_type).toLowerCase()
  if (profileType === 'sro') return 'firma'
  if (profileType === 'osvč' || profileType === 'osvc') return 'osvc'

  const entityType = clean(party.entity_type).toLowerCase()
  if (entityType === 'firma') return 'firma'
  if (entityType === 'osvc') return 'osvc'

  return 'neurceno'
}

function formatAddress(party: PartyInput): string {
  const street = clean(party.address)
  const zipCity = [clean(party.zip), clean(party.city)].filter(Boolean).join(' ')
  return [street, zipCity].filter(Boolean).join(', ')
}

export function buildPartyIdentification(party: PartyInput): PartyIdentification {
  const kind = partyKind(party)
  const missing: string[] = []
  const parts: string[] = []

  const name = clean(party.name)
  if (name) parts.push(name)
  else missing.push('name')

  const address = formatAddress(party)
  if (address) {
    if (kind === 'firma') parts.push(`se sídlem ${address}`)
    else if (kind === 'osvc') parts.push(`místo podnikání ${address}`)
    else parts.push(`se sídlem nebo místem podnikání ${address}`)
  } else {
    missing.push('address')
  }

  const ico = clean(party.ico)
  if (ico) parts.push(`IČO ${ico}`)
  else missing.push('ico')

  const dic = clean(party.dic)
  if (dic) parts.push(`DIČ ${dic}`)

  if (kind === 'firma') {
    const sz = clean(party.spisova_znacka)
    if (sz) parts.push(`zapsaná v obchodním rejstříku, spisová značka ${sz}`)
    else missing.push('spisova_znacka')

    const rep = clean(party.represented_by)
    if (rep) parts.push(`zastoupená ${rep}`)
    else missing.push('represented_by')
  }

  if (kind === 'osvc') {
    parts.push('fyzická osoba podnikající na základě živnostenského oprávnění')
  }

  return { text: parts.join(', '), kind, missing }
}
