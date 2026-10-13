// Otisk (SHA-256) textu podmínek. Používá Node crypto, proto jen na serveru
// (API route, server komponenta), ne v komponentě s 'use client'.

import { createHash } from 'crypto'

export function termsHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}
