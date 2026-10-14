// Kontrola modulu podmínek spolupráce. Spuštění: npx tsx scripts/verify-terms.ts
// Skript nic nezapisuje do databáze. Uloží ukázkové znění do terms-review.txt.

import { writeFileSync } from 'fs'
import { TERMS_ARTICLES, TERMS_TEMPLATE_VERSION } from '../lib/terms/template'
import { TERMS_DEFAULTS, TERMS_REQUIRED_VARIABLES } from '../lib/terms/defaults'
import { extractVariables, renderTerms, renderTermsToText, MISSING_PLACEHOLDER } from '../lib/terms/render'
import { buildPartyIdentification } from '../lib/terms/parties'
import { termsHash } from '../lib/terms/hash'
import { readEffectiveTerms } from '../lib/terms/effective'

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
check('Šablona používá 34 proměnných', variables.length === 34, `(${variables.length})`)

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
check('Záloha 40 % a částka v čl. 5.3', fullText.includes('činí záloha 40 % pevné ceny (12 000 Kč). Záloha je splatná do 7 dnů od doručení zálohové faktury'))
check('Čl. 2.3 nemá číslo sazby a odkazuje na objednávku', fullText.includes('hodinové sazby uvedené v objednávce, jinak podle sazby, kterou dodavatel sdělí e-mailem'))

// 6. Bez zálohové částky (hodinová sazba) se závorka vypustí a nic nechybí
const hourly = renderTerms({ ...values, zaloha_castka: '' })
const hourlyText = renderTermsToText(hourly)
check('Bez částky zálohy se závorka vypustí', hourlyText.includes('činí záloha 40 % pevné ceny. Záloha je splatná'))
check('Bez částky zálohy nic nechybí', hourly.missing.length === 0)

// 7. Chybějící povinné hodnoty se hlásí
const bare = renderTerms({})
check(
  'Prázdné hodnoty hlásí povinné proměnné',
  ['dodavatel_identifikace', 'klient_identifikace'].every((v) => bare.missing.includes(v)),
  `(${bare.missing.join(', ')})`,
)
check('Přebití výchozí hodnoty funguje', renderTermsToText(renderTerms({ ...values, zaloha_procent: '30' })).includes('činí záloha 30 %'))
check('Překlep v názvu proměnné se ohlásí', renderTerms({ ...values, zalohaa_procent: '30' }).unused.includes('zalohaa_procent'))

// 9. Čl. 6: harmonogram upomínek, pokuty a vyúčtování
check('Čl. 6.1 uvádí upomínky 1., 8., 15. a 22. den', fullText.includes('upomínky 1., 8., 15. a 22. den po splatnosti'))
check('Čl. 6.2 uvádí pokuty 500 a 1 000 Kč, celkem 1 500 Kč', fullText.includes('smluvní pokutu 500 Kč') && fullText.includes('o dalších 1 000 Kč, tedy na celkem 1 500 Kč'))
check('Čl. 6.3 uvádí zákonnou náhradu 1 200 Kč od 22. dne', fullText.includes('ani do 22. dne po splatnosti, vzniká dodavateli nárok i na zákonnou paušální náhradu') && fullText.includes('nyní 1 200 Kč za každou fakturu'))
check('Čl. 6.4 denní pokuta 0,1 % od 22. dne', fullText.includes('Od 22. dne po splatnosti klient navíc platí smluvní pokutu 0,1 %'))
check('Čl. 6.6 předání právníkovi po 30. dni', fullText.includes('do 30. dne po splatnosti, předá dodavatel pohledávku právnímu zástupci'))
check('Čl. 6.7 vyúčtování není faktura', fullText.includes('vyúčtuje samostatným dokladem, který není fakturou'))
check('Staré znění čl. 6.2 je pryč', !fullText.includes('upomínky 7, 15 a 22'))
check('Verze šablony je 1.1', TERMS_TEMPLATE_VERSION === '1.1')

// 8. Otisk je stálý a závisí na textu
const h1 = termsHash(fullText)
const h2 = termsHash(fullText)
const h3 = termsHash(fullText + ' ')
check('Otisk je stálý a citlivý na změnu textu', h1 === h2 && h1 !== h3 && h1.length === 64)

// 9. Efektivní hodnoty podmínek (lib/terms/effective.ts)
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const defEff = readEffectiveTerms(null)
check('Efektivní: výchozí dny [1,8,15,22,30]', same(defEff.reminderDays, [1, 8, 15, 22, 30]))
check(
  'Efektivní: výchozí částky a pokuta',
  defEff.fee1 === 500 && defEff.fee2 === 1000 && defEff.feeTotal === 1500 && defEff.statutoryFee === 1200 && defEff.dailyPenaltyPercent === 0.1,
)
check('Efektivní: chybějící terms_effective = výchozí', same(readEffectiveTerms({ cena_rezim: 'pevna' }), defEff))
const overridden = readEffectiveTerms({ terms_effective: JSON.stringify({ ...TERMS_DEFAULTS, poplatek_1: '300', terms_version: '1.1' }) })
check('Efektivní: přepsání fee1 na "300"', overridden.fee1 === 300 && overridden.fee2 === 1000 && overridden.version === '1.1')
const spaced = readEffectiveTerms({
  terms_effective: JSON.stringify({ ...TERMS_DEFAULTS, zakonna_nahrada: '1\u00a0200', poplatek_2: '2 000', pokuta_prodleni: '0,25' }),
})
check('Efektivní: "1 200" (i nezlomitelná mezera) a "0,25"', spaced.statutoryFee === 1200 && spaced.fee2 === 2000 && spaced.dailyPenaltyPercent === 0.25)
const broken = readEffectiveTerms({ terms_effective: JSON.stringify({ ...TERMS_DEFAULTS, poplatek_1: 'abc', upominka_2: '' }) })
check('Efektivní: neplatné číslo = výchozí hodnota pole', broken.fee1 === 500 && broken.reminderDays[1] === 8)
check('Efektivní: poškozený JSON = výchozí', same(readEffectiveTerms({ terms_effective: '{není json' }), defEff))
check('Efektivní: klíč terms_effective se nevykresluje', !extractVariables().includes('terms_effective'))

writeFileSync('terms-review.txt', fullText, 'utf8')
console.log(`\nVerze šablony ${TERMS_TEMPLATE_VERSION}, otisk ukázky ${h1.slice(0, 16)}...`)
console.log(`Ukázka uložena do terms-review.txt (${fullText.length} znaků).`)

if (failures > 0) {
  console.log(`\n${failures} kontrol selhalo.`)
  process.exit(1)
}
console.log('\nVšechny kontroly prošly.')
