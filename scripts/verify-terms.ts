// Kontrola modulu podmínek spolupráce. Spuštění: npx tsx scripts/verify-terms.ts
// Skript nic nezapisuje do databáze. Uloží ukázkové znění do terms-review.txt.

import { writeFileSync } from 'fs'
import { TERMS_ARTICLES, TERMS_TEMPLATE_VERSION } from '../lib/terms/template'
import { TERMS_DEFAULTS, TERMS_REQUIRED_VARIABLES } from '../lib/terms/defaults'
import { extractVariables, renderTerms, renderTermsToText, MISSING_PLACEHOLDER } from '../lib/terms/render'
import { buildPartyIdentification } from '../lib/terms/parties'
import { termsHash } from '../lib/terms/hash'

let failures = 0
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? 'OK  ' : 'CHYBA'} ${name}${detail ? ' ' + detail : ''}`)
  if (!ok) failures += 1
}

// 1. Struktura: jedinečná čísla článků a ustanovení
const ids = TERMS_ARTICLES.flatMap((a) => a.clauses.map((c) => c.id))
check('ID ustanovení jsou jedinečná', new Set(ids).size === ids.length, `(${ids.length} ustanovení)`)
check(
  'Čísla článků jdou po sobě',
  TERMS_ARTICLES.every((a, i) => a.number === i + 1),
)
check(
  'ID ustanovení odpovídá číslu článku',
  TERMS_ARTICLES.every((a) => a.clauses.every((c, i) => c.id === `${a.number}.${i + 1}`)),
)

// 2. Odkazy na jiné články ("čl. 9.1") musí existovat
const refs = new Set<string>()
for (const a of TERMS_ARTICLES) {
  for (const c of a.clauses) {
    for (const m of Array.from(c.text.matchAll(/čl\. (\d+\.\d+)/g))) refs.add(m[1])
  }
}
const brokenRefs = Array.from(refs).filter((r) => !ids.includes(r))
check('Odkazy na články existují', brokenRefs.length === 0, `(${Array.from(refs).join(', ')})`)

// 3. Každá proměnná v šabloně má výchozí hodnotu, nebo je mezi povinnými
const variables = extractVariables()
const required = new Set<string>(TERMS_REQUIRED_VARIABLES)
const orphan = variables.filter((v) => !(v in TERMS_DEFAULTS) && !required.has(v))
check('Všechny proměnné mají výchozí hodnotu nebo jsou povinné', orphan.length === 0, orphan.join(', '))
const unusedDefaults = Object.keys(TERMS_DEFAULTS).filter((k) => !variables.includes(k))
check('Výchozí hodnoty bez proměnné v textu nejsou', unusedDefaults.length === 0, unusedDefaults.join(', '))
check('Šablona používá 26 proměnných', variables.length === 26, `(${variables.length})`)

// 4. Identifikace stran
const dodavatel = buildPartyIdentification({
  name: 'goodveritas s.r.o.',
  address: 'Ukázková 1',
  zip: '370 01',
  city: 'České Budějovice',
  ico: '19759584',
  dic: 'CZ19759584',
  profile_type: 'sro',
  spisova_znacka: 'C 00000 u Krajského soudu v Českých Budějovicích',
  represented_by: 'Ukázková Osoba, jednatelem',
})
check('Firma: identifikace bez chybějících údajů', dodavatel.missing.length === 0, dodavatel.text)

const klientOsvc = buildPartyIdentification({
  name: 'Jan Ukázkový',
  address: 'Zkušební 5',
  zip: '110 00',
  city: 'Praha',
  ico: '12345678',
  entity_type: 'osvc',
})
check('OSVČ: identifikace bez chybějících údajů', klientOsvc.missing.length === 0, klientOsvc.text)

const chybejici = buildPartyIdentification({ name: 'Bez Údajů s.r.o.', entity_type: 'firma' })
check(
  'Chybějící údaje se hlásí',
  ['address', 'ico', 'spisova_znacka', 'represented_by'].every((f) => chybejici.missing.includes(f)),
  `(${chybejici.missing.join(', ')})`,
)

// 5. Plné vykreslení bez chybějících hodnot
const values = {
  dodavatel_identifikace: dodavatel.text,
  klient_identifikace: klientOsvc.text,
  zaloha_castka: '12 000',
}
const full = renderTerms(values)
const fullText = renderTermsToText(full)
check('Plné vykreslení nemá chybějící proměnné', full.missing.length === 0, full.missing.join(', '))
check('Ve vykresleném textu nezůstalo {{', !fullText.includes('{{'))
check('Ve vykresleném textu není [DOPLNIT]', !fullText.includes(MISSING_PLACEHOLDER))
check('Klientský text neobsahuje slovo verze', !/verz/i.test(fullText))
check('Žádná zadaná hodnota není nepoužitá', full.unused.length === 0, full.unused.join(', '))
check('Záloha 40 % a částka v čl. 5.3', fullText.includes('výchozí je 40 % pevné ceny (12 000 Kč)'))
check('Čl. 2.3 nemá číslo sazby a odkazuje na objednávku', fullText.includes('hodinové sazby uvedené v objednávce, jinak podle sazby, kterou dodavatel sdělí e-mailem'))

// 6. Bez zálohové částky (hodinová sazba) se závorka vypustí a nic nechybí
const hourly = renderTerms({ ...values, zaloha_castka: '' })
const hourlyText = renderTermsToText(hourly)
check('Bez částky zálohy se závorka vypustí', hourlyText.includes('výchozí je 40 % pevné ceny. Je splatná'))
check('Bez částky zálohy nic nechybí', hourly.missing.length === 0)

// 7. Chybějící povinné hodnoty se hlásí
const bare = renderTerms({})
check(
  'Prázdné hodnoty hlásí povinné proměnné',
  ['dodavatel_identifikace', 'klient_identifikace'].every((v) => bare.missing.includes(v)),
  `(${bare.missing.join(', ')})`,
)
check('Přebití výchozí hodnoty funguje', renderTermsToText(renderTerms({ ...values, zaloha_procent: '30' })).includes('výchozí je 30 %'))
check('Překlep v názvu proměnné se ohlásí', renderTerms({ ...values, zalohaa_procent: '30' }).unused.includes('zalohaa_procent'))

// 8. Otisk je stálý a závisí na textu
const h1 = termsHash(fullText)
const h2 = termsHash(fullText)
const h3 = termsHash(fullText + ' ')
check('Otisk je stálý a citlivý na změnu textu', h1 === h2 && h1 !== h3 && h1.length === 64)

writeFileSync('terms-review.txt', fullText, 'utf8')
console.log(`\nVerze šablony ${TERMS_TEMPLATE_VERSION}, otisk ukázky ${h1.slice(0, 16)}...`)
console.log(`Ukázka uložena do terms-review.txt (${fullText.length} znaků).`)

if (failures > 0) {
  console.log(`\n${failures} kontrol selhalo.`)
  process.exit(1)
}
console.log('\nVšechny kontroly prošly.')
