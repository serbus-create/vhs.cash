// Adresa QR obrázku pro e-mail (veřejný endpoint /api/qr-code, stejný jako u stávajících upomínek).
export interface QrProfile {
  name: string | null
  iban: string | null
  swift: string | null
}

export function buildReminderQrUrl(args: {
  baseUrl: string
  profile: QrProfile | null
  amount: number
  currency: string
  number: string
  variableSymbol: string | null
}): string | null {
  const { profile } = args
  if (!profile?.iban || args.amount <= 0) return null
  const params = new URLSearchParams({
    iban: profile.iban,
    amount: String(args.amount),
    currency: args.currency,
    number: args.number,
    ...(args.variableSymbol ? { vs: args.variableSymbol } : {}),
    ...(profile.swift ? { swift: profile.swift } : {}),
    ...(profile.name ? { name: profile.name } : {}),
  })
  return `${args.baseUrl.replace(/\/$/, '')}/api/qr-code?${params.toString()}`
}
