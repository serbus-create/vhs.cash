import type { RenderResult } from './render'

/** Platný snapshot podmínek (JSON ve tvaru RenderResult) nebo null. */
export function parseSnapshot(raw: string | null | undefined): RenderResult | null {
  if (!raw) return null
  try {
    const r = JSON.parse(raw)
    if (
      r && typeof r.title === 'string' && Array.isArray(r.articles) &&
      r.articles.every(
        (a: any) => a && typeof a.title === 'string' && Array.isArray(a.clauses) &&
          a.clauses.every((c: any) => c && typeof c.id === 'string' && typeof c.text === 'string'),
      )
    ) return r as RenderResult
  } catch {}
  return null
}
