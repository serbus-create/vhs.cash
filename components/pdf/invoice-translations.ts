export type Lang = 'cs' | 'sk' | 'de' | 'pl'

export interface InvoiceTranslations {
  // Document titles
  faktura: string
  nabidka: string
  objednavka: string
  // Header meta labels
  cislo: string
  datumVystaveni: string
  datumSplatnosti: string
  varSymbol: string
  duzp: string
  // Party block headings
  dodavatel: string
  odberatel: string
  zadavatel: string
  objednatel: string
  // Registration identifiers
  ico: string
  dic: string
  // Subject prefix
  predmet: string
  // Table column headers
  colNum: string
  colPopis: string
  colPocet: string
  colCenaks: string
  colDph: string
  colCelkem: string
  // Notes
  neniPlatceDph: string
  // Totals section
  zakladDph: string
  dph: string
  celkemKUhrade: string
  // Long text blocks
  note: string
  penalty: string
  // Payment box
  platebniUdaje: string
  cisloUctu: string
  variabilniSymbol: string
  splatnost: string
  kUhradeCelkem: string
  qrPlatba: string
  vcDph: string
  // Footer
  kontaktniUdaje: string
  supplierCountry: string
}

const cs: InvoiceTranslations = {
  faktura: 'Faktura',
  nabidka: 'Cenová nabídka',
  objednavka: 'Objednávka',
  cislo: 'Číslo',
  datumVystaveni: 'Datum vystavení',
  datumSplatnosti: 'Datum splatnosti',
  varSymbol: 'Var. symbol',
  duzp: 'DUZP',
  dodavatel: 'Dodavatel',
  odberatel: 'Odběratel',
  zadavatel: 'Zadavatel',
  objednatel: 'Objednatel',
  ico: 'IČO',
  dic: 'DIČ',
  predmet: 'Objednávka',
  colNum: '#',
  colPopis: 'Popis',
  colPocet: 'Počet',
  colCenaks: 'Cena/ks',
  colDph: 'DPH',
  colCelkem: 'Celkem',
  neniPlatceDph: 'Nejsem plátce DPH',
  zakladDph: 'Základ DPH',
  dph: 'DPH',
  celkemKUhrade: 'Celkem k úhradě',
  note: 'Fakturujeme Vám za dodané zboží či služby. Děkujeme za Vámi projevenou důvěru a těšíme se na další projekty.',
  penalty: 'Při zpožděné úhradě Vám budeme účtovat penále ve výši 0,05 % z dlužné částky za každý započatý den prodlení. Při prodlení nad 21 dnů se sazba zvyšuje na 0,1 %.',
  platebniUdaje: 'Platební údaje',
  cisloUctu: 'Číslo účtu',
  variabilniSymbol: 'Variabilní symbol',
  splatnost: 'Splatnost',
  kUhradeCelkem: 'K úhradě celkem',
  qrPlatba: 'QR Platba',
  vcDph: 'vč. DPH',
  kontaktniUdaje: 'Kontaktní údaje',
  supplierCountry: 'Česká republika',
}

const sk: InvoiceTranslations = {
  faktura: 'Faktúra',
  nabidka: 'Cenová ponuka',
  objednavka: 'Objednávka',
  cislo: 'Číslo',
  datumVystaveni: 'Dátum vystavenia',
  datumSplatnosti: 'Dátum splatnosti',
  varSymbol: 'Var. symbol',
  duzp: 'DÚZP',
  dodavatel: 'Dodávateľ',
  odberatel: 'Odberateľ',
  zadavatel: 'Zadávateľ',
  objednatel: 'Objednávateľ',
  ico: 'IČO',
  dic: 'DIČ',
  predmet: 'Predmet',
  colNum: '#',
  colPopis: 'Popis',
  colPocet: 'Počet',
  colCenaks: 'Cena/ks',
  colDph: 'DPH',
  colCelkem: 'Celkom',
  neniPlatceDph: 'Nie som platiteľ DPH',
  zakladDph: 'Základ DPH',
  dph: 'DPH',
  celkemKUhrade: 'Celkom k úhrade',
  note: 'Fakturujeme Vám za dodaný tovar alebo služby. Ďakujeme za prejavenú dôveru a tešíme sa na ďalšie projekty.',
  penalty: 'Pri oneskorenom uhradení Vám budeme účtovať penále vo výške 0,05 % z dlžnej sumy za každý začatý deň omeškania. Pri omeškaní nad 21 dní sa sadzba zvyšuje na 0,1 %.',
  platebniUdaje: 'Platobné údaje',
  cisloUctu: 'Číslo účtu',
  variabilniSymbol: 'Variabilný symbol',
  splatnost: 'Splatnosť',
  kUhradeCelkem: 'K úhrade celkom',
  qrPlatba: 'QR Platba',
  vcDph: 'vr. DPH',
  kontaktniUdaje: 'Kontaktné údaje',
  supplierCountry: 'Česká republika',
}

const de: InvoiceTranslations = {
  faktura: 'Rechnung',
  nabidka: 'Angebot',
  objednavka: 'Bestellung',
  cislo: 'Nr.',
  datumVystaveni: 'Ausstellungsdatum',
  datumSplatnosti: 'Fälligkeitsdatum',
  varSymbol: 'Verwendungszweck',
  duzp: 'Leistungsdatum',
  dodavatel: 'Lieferant',
  odberatel: 'Empfänger',
  zadavatel: 'Auftraggeber',
  objednatel: 'Besteller',
  ico: 'Reg.-Nr.',
  dic: 'USt-IdNr.',
  predmet: 'Betreff',
  colNum: '#',
  colPopis: 'Beschreibung',
  colPocet: 'Menge',
  colCenaks: 'Einzelpreis',
  colDph: 'MwSt.',
  colCelkem: 'Gesamt',
  neniPlatceDph: 'Nicht mehrwertsteuerpflichtig',
  zakladDph: 'Nettobetrag',
  dph: 'MwSt.',
  celkemKUhrade: 'Gesamtbetrag',
  note: 'Wir stellen Ihnen die gelieferten Waren und Dienstleistungen in Rechnung. Vielen Dank für Ihr Vertrauen – wir freuen uns auf weitere gemeinsame Projekte.',
  penalty: 'Bei verspäteter Zahlung berechnen wir eine Verzugspauschale von 0,05 % des ausstehenden Betrags pro angefangenem Verzugstag. Bei einem Verzug von über 21 Tagen erhöht sich der Satz auf 0,1 %.',
  platebniUdaje: 'Zahlungsinformationen',
  cisloUctu: 'Kontonummer',
  variabilniSymbol: 'Verwendungszweck',
  splatnost: 'Fälligkeit',
  kUhradeCelkem: 'Gesamtbetrag',
  qrPlatba: 'QR-Zahlung',
  vcDph: 'inkl. MwSt.',
  kontaktniUdaje: 'Kontaktdaten',
  supplierCountry: 'Tschechische Republik',
}

const pl: InvoiceTranslations = {
  faktura: 'Faktura',
  nabidka: 'Oferta cenowa',
  objednavka: 'Zamówienie',
  cislo: 'Nr',
  datumVystaveni: 'Data wystawienia',
  datumSplatnosti: 'Termin płatności',
  varSymbol: 'Symbol',
  duzp: 'Data sprzedaży',
  dodavatel: 'Dostawca',
  odberatel: 'Odbiorca',
  zadavatel: 'Zleceniodawca',
  objednatel: 'Zamawiający',
  ico: 'Nr rej.',
  dic: 'NIP',
  predmet: 'Przedmiot',
  colNum: '#',
  colPopis: 'Opis',
  colPocet: 'Ilość',
  colCenaks: 'Cena jedn.',
  colDph: 'VAT',
  colCelkem: 'Razem',
  neniPlatceDph: 'Nie jestem płatnikiem VAT',
  zakladDph: 'Podstawa VAT',
  dph: 'VAT',
  celkemKUhrade: 'Razem do zapłaty',
  note: 'Wystawiamy Państwu fakturę za dostarczone towary lub usługi. Dziękujemy za okazane zaufanie i liczymy na dalszą współpracę.',
  penalty: 'W przypadku opóźnienia płatności naliczamy odsetki w wysokości 0,05 % kwoty należnej za każdy rozpoczęty dzień zwłoki. W przypadku opóźnienia powyżej 21 dni stawka wzrasta do 0,1 %.',
  platebniUdaje: 'Dane płatnicze',
  cisloUctu: 'Numer konta',
  variabilniSymbol: 'Tytuł przelewu',
  splatnost: 'Termin płatności',
  kUhradeCelkem: 'Do zapłaty',
  qrPlatba: 'Płatność QR',
  vcDph: 'z VAT',
  kontaktniUdaje: 'Dane kontaktowe',
  supplierCountry: 'Republika Czeska',
}

export const TRANSLATIONS: Record<Lang, InvoiceTranslations> = { cs, sk, de, pl }

export function getLang(clientCountry: string | null | undefined): Lang {
  switch (clientCountry) {
    case 'SK': return 'sk'
    case 'AT':
    case 'DE': return 'de'
    case 'PL': return 'pl'
    default: return 'cs'
  }
}

export function getLocale(clientCountry: string | null | undefined): string {
  switch (clientCountry) {
    case 'SK': return 'sk-SK'
    case 'AT': return 'de-AT'
    case 'DE': return 'de-DE'
    case 'PL': return 'pl-PL'
    default: return 'cs-CZ'
  }
}
