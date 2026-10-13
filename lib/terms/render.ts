// Dosazení proměnných do textu podmínek spolupráce.
// Čistá logika bez závislostí, použitelná na serveru i v prohlížeči.

import { TERMS_ARTICLES, TERMS_TITLE, type TermsArticle } from './template'
import { TERMS_DEFAULTS, type TermsValues } from './defaults'

const VARIABLE_PATTERN = /\{\{([a-z0-9_]+)\}\}/g

// Text, který se ukáže, když proměnná chybí. Chybějící hodnoty se vždy hlásí v `missing`.
export const MISSING_PLACEHOLDER = '[DOPLNIT]'

// U objednávky bez pevné ceny nemá smysl uvádět částku zálohy. Je-li zaloha_castka
// prázdná, vypustí se z čl. 5.3 závorka " ({{zaloha_castka}} Kč)".
const DEPOSIT_PARENTHESIS = ' ({{zaloha_castka}} Kč)'

export interface RenderedClause {
  id: string
  text: string
}

export interface RenderedArticle {
  number: number
  title: string
  clauses: RenderedClause[]
}

export interface RenderResult {
  title: string
  articles: RenderedArticle[]
  // proměnné, které šablona používá a hodnota chybí (ukázaly se jako [DOPLNIT])
  missing: string[]
  // zadané hodnoty, které šablona nepoužívá (pravděpodobně překlep v názvu)
  unused: string[]
}

export function extractVariables(articles: TermsArticle[] = TERMS_ARTICLES): string[] {
  const found = new Set<string>()
  for (const article of articles) {
    for (const clause of article.clauses) {
      for (const match of Array.from(clause.text.matchAll(VARIABLE_PATTERN))) {
        found.add(match[1])
      }
    }
  }
  return Array.from(found)
}

function hasValue(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

export function renderTerms(
  values: TermsValues = {},
  articles: TermsArticle[] = TERMS_ARTICLES,
): RenderResult {
  const merged: TermsValues = { ...TERMS_DEFAULTS, ...values }
  const used = new Set<string>()
  const missing = new Set<string>()

  const renderedArticles: RenderedArticle[] = articles.map((article) => ({
    number: article.number,
    title: article.title,
    clauses: article.clauses.map((clause) => {
      let source = clause.text
      if (!hasValue(merged.zaloha_castka)) {
        source = source.split(DEPOSIT_PARENTHESIS).join('')
      }
      const text = source.replace(VARIABLE_PATTERN, (_whole, name: string) => {
        used.add(name)
        const value = merged[name]
        if (hasValue(value)) return value.trim()
        missing.add(name)
        return MISSING_PLACEHOLDER
      })
      return { id: clause.id, text }
    }),
  }))

  const templateVariables = new Set(extractVariables(articles))
  const unused = Object.keys(values).filter((key) => !templateVariables.has(key))

  return {
    title: TERMS_TITLE,
    articles: renderedArticles,
    missing: Array.from(missing),
    unused,
  }
}

// Celé podmínky jako prostý text. Slouží k uložení snapshotu a k výpočtu otisku.
export function renderTermsToText(result: RenderResult): string {
  const lines: string[] = [result.title, '']
  for (const article of result.articles) {
    lines.push(`${article.number}. ${article.title}`)
    for (const clause of article.clauses) {
      lines.push(`${clause.id} ${clause.text}`)
    }
    lines.push('')
  }
  return lines.join('\n').trimEnd() + '\n'
}

// Formát čísla do textu podle češtiny, například 1200 -> "1 200".
export function formatCzNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('cs-CZ', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}
