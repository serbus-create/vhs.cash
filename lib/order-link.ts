// Pouze server: tokeny odkazů k potvrzení objednávky. Plain token se neukládá, jen jeho hash.
import { createHash, randomBytes } from 'crypto'

export const LINK_VALID_DAYS = 30

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex')

export const newToken = (): string => randomBytes(32).toString('base64url')
