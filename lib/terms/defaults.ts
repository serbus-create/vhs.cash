// Výchozí hodnoty proměnných v podmínkách spolupráce.
// Návrh hodnot je z dokumentu "Podmínky spolupráce", schvaluje je právník.
// Hodnoty jsou řetězce, protože se dosazují přímo do textu.

export type TermsValues = Record<string, string>

export const TERMS_DEFAULTS: TermsValues = {
  verze_podminek: '1.0',
  platnost_odkazu: '30',
  kola_pripominek: '2',
  min_jednotka_minut: '30',
  kapacita_dny: '5',
  preplanovani_procent: '10',
  lhuta_schvaleni: '5',
  nesoucinnost_dny: '30',
  express_hranice_dny: '5',
  express_priplatek_1: '25',
  express_priplatek_2: '50',
  zaloha_procent: '40',
  zaloha_splatnost: '7',
  splatnost_dny: '7',
  zakonna_nahrada: '1 200',
  pokuta_prodleni: '0,1',
  pozastaveni_dny: '7',
  odstoupeni_dny: '30',
  lhuta_prevzeti: '5',
  zaruka_mesice: '12',
  oprava_dny: '10',
  storno_procent: '20',
  odpoved_hodiny: '48',
  prislusny_soud: 'soudu podle sídla nebo místa podnikání dodavatele',
}

// Proměnné, které nemají výchozí hodnotu a musí je dodat objednávka nebo nastavení.
// - hodinova_sazba: sazba v Kč bez DPH (každý klient může mít jinou)
// - zaloha_castka: částka zálohy v Kč (počítá se z ceny, u hodinové sazby může být prázdná)
// - dodavatel_identifikace a klient_identifikace: skládají se funkcí buildPartyIdentification
export const TERMS_REQUIRED_VARIABLES = [
  'hodinova_sazba',
  'zaloha_castka',
  'dodavatel_identifikace',
  'klient_identifikace',
] as const
