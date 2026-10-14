// Podmínky spolupráce: text šablony s proměnnými {{takto}}.
// Znění odpovídá dokumentu "Podmínky spolupráce" (záložka "Šablona s proměnnými").
// NEUPRAVOVAT ručně bez změny verze a bez kontroly právníkem.

export interface TermsClause {
  id: string
  text: string
}

export interface TermsArticle {
  number: number
  title: string
  clauses: TermsClause[]
}

export const TERMS_TEMPLATE_VERSION = '1.1'

export const TERMS_TITLE = 'Podmínky spolupráce'

export const TERMS_ARTICLES: TermsArticle[] = [
  {
    number: 1,
    title: 'Strany a potvrzení objednávky',
    clauses: [
      {
        id: '1.1',
        text: 'Tyto podmínky upravují spolupráci mezi dodavatelem a klientem. Dodavatel: {{dodavatel_identifikace}}. Klient: {{klient_identifikace}}. Platí pro všechny objednávky klienta, které na ně odkazují nebo ke kterým jsou přiloženy.',
      },
      {
        id: '1.2',
        text: 'Obě strany jednají při své podnikatelské činnosti. Klient prohlašuje, že objednává v rámci svého podnikání a že osoba, která objednávku potvrzuje, je k tomu oprávněna.',
      },
      {
        id: '1.3',
        text: 'Potvrzením (kliknutím na odkaz v e-mailu, podpisem nebo e-mailovou odpovědí) klient souhlasí s těmito podmínkami a s objednávkou, je-li k nim přiložena. Dodavatel uloží záznam o potvrzení (čas, jméno, e-mail a znění podmínek) jako doklad o uzavření zakázky. Odkaz je platný {{platnost_odkazu}} dnů.',
      },
      {
        id: '1.4',
        text: 'Při rozporu mezi objednávkou a těmito podmínkami má přednost objednávka. Obchodní podmínky klienta se nepoužijí.',
      },
      {
        id: '1.5',
        text: 'Za klienta jedná a schvaluje kontaktní osoba uvedená v objednávce nebo při potvrzení těchto podmínek. Dodavatel se může spolehnout na její pokyny.',
      },
      {
        id: '1.6',
        text: 'Objednávku, její změny, schválení návrhů a převzetí díla lze učinit elektronicky: e-mailem z adresy kontaktní osoby uvedené v objednávce nebo při potvrzení podmínek, nebo potvrzením kliknutím na odkaz zaslaný na tuto adresu. Takto učiněná jednání jsou pro obě strany závazná.',
      },
    ],
  },
  {
    number: 2,
    title: 'Rozsah a nadstandardní úpravy',
    clauses: [
      {
        id: '2.1',
        text: 'Objednávkou je objednávka vystavená dodavatelem, nebo písemné zadání klienta (například e-mail) potvrzené dodavatelem. Rozsah určují položky a popis v objednávce. Je-li v objednávce pevná cena, je v ní zahrnut tento počet kol připomínek: {{kola_pripominek}}.',
      },
      {
        id: '2.2',
        text: 'Nadstandardní úpravou je vše nad rámec objednávky, včetně dalších kol připomínek a změn schváleného návrhu. Dodavatel ji provede až poté, co klient e-mailem odsouhlasí odhad ceny.',
      },
      {
        id: '2.3',
        text: 'Nadstandardní úpravy se účtují podle hodinové sazby uvedené v objednávce, jinak podle sazby, kterou dodavatel sdělí e-mailem před zahájením úprav. Sazba je bez DPH a účtuje se po {{min_jednotka_minut}} minutách. Stejnou sazbou se účtuje veškerá práce, je-li cena v objednávce určena hodinovou sazbou. Mohou posunout termíny.',
      },
      {
        id: '2.4',
        text: 'Dodavatel může zapojit subdodavatele a odpovídá za ně jako za sebe.',
      },
    ],
  },
  {
    number: 3,
    title: 'Podklady, termíny a ochrana kapacity',
    clauses: [
      {
        id: '3.1',
        text: 'Termín je rezervací kapacity dodavatele. Práce začnou až po připsání zálohy, je-li v objednávce požadována, a po dodání všech potřebných podkladů (texty, obrázky, loga, přístupy) v použitelné podobě. Klient odpovídá za to, že k podkladům má potřebná práva.',
      },
      {
        id: '3.2',
        text: 'Dodá-li klient podklady, schválení nebo odpověď později, posune se termín plnění nejméně o dobu zpoždění. Je-li zpoždění delší než {{kapacita_dny}} pracovních dnů, dodavatel práce přeplánuje podle své volné kapacity a nový termín sdělí do 2 pracovních dnů od dodání podkladů. Za přeplánování dodavatel účtuje poplatek {{preplanovani_procent}} % z ceny dosud neodevzdané části plnění, u práce účtované hodinovou sazbou ve výši 2 hodin práce, a vyúčtuje ho při obnovení prací. Totéž platí, požádá-li klient o odložení nebo pozastavení prací.',
      },
      {
        id: '3.3',
        text: 'Klient se k předloženému návrhu vyjádří do {{lhuta_schvaleni}} pracovních dnů. Pokud se nevyjádří, návrh se považuje za schválený. Po schválení jsou zásadní změny zadání nadstandardní úpravou.',
      },
      {
        id: '3.4',
        text: 'Neposkytne-li klient nutnou součinnost déle než {{nesoucinnost_dny}} dnů, může dodavatel zakázku uzavřít. Uzavření se posuzuje jako ukončení zakázky klientem podle čl. 9.1, tedy včetně odstupného. Poplatek podle čl. 3.2 se při uzavření neúčtuje. Obnovení prací po uzavření je nová zakázka podle volné kapacity dodavatele. Vyžaduje novou zálohu a zaplacené odstupné se na cenu nové zakázky započte.',
      },
    ],
  },
  {
    number: 4,
    title: 'Zkrácení termínu',
    clauses: [
      {
        id: '4.1',
        text: 'Klient může požádat o dřívější termín, než byl dohodnut. Dodavatel zkrácení přijme podle své kapacity a potvrdí e-mailem. Do potvrzení platí původní termín.',
      },
      {
        id: '4.2',
        text: 'Za přednostní zpracování se k ceně dosud neodevzdané části plnění (u hodinové sazby k ceně přednostně odpracovaných hodin) připočítá příplatek: při zkrácení o {{express_hranice_dny}} pracovních dnů a méně {{express_priplatek_1}} %, při zkrácení o více než {{express_hranice_dny}} pracovních dnů {{express_priplatek_2}} %.',
      },
    ],
  },
  {
    number: 5,
    title: 'Cena a platby',
    clauses: [
      {
        id: '5.1',
        text: 'Cena je uvedena v objednávce bez DPH, buď jako pevná částka, nebo jako hodinová sazba, podle které se cena určí z odpracovaného času. Není-li v objednávce uvedena ani částka, ani sazba, určí se cena z odpracovaného času podle hodinové sazby z čl. 2.3. Odhad, je-li uveden, je jen orientační. Hrozí-li, že skutečná cena odhad výrazně překročí, upozorní dodavatel klienta dřív, než k tomu dojde. DPH se připočte, je-li dodavatel plátcem.',
      },
      {
        id: '5.2',
        text: 'Cena nezahrnuje náklady třetích stran, například licence šablon, fonty, stock fotografie, domény, hosting nebo tisk, pokud objednávka neříká jinak.',
      },
      {
        id: '5.3',
        text: 'Výše zálohy je uvedena v objednávce. Není-li uvedena jinak, činí záloha {{zaloha_procent}} % pevné ceny ({{zaloha_castka}} Kč). Záloha je splatná do {{zaloha_splatnost}} dnů od doručení zálohové faktury a práce začnou po jejím připsání na účet dodavatele. U hodinové sazby a u zakázky bez ceny se záloha nevyžaduje, pokud objednávka neříká jinak.',
      },
      {
        id: '5.4',
        text: 'Zbytek ceny, u hodinové sazby cenu za odpracovaný čas, dodavatel vyfakturuje po předání díla, nebo podle platebního kalendáře v objednávce. U hodinové sazby na požádání doloží rozpis odpracovaných hodin. Faktura se vystaví i tehdy, když klient převzetí ještě nepotvrdil. Splatnost je {{splatnost_dny}} dnů od doručení faktury.',
      },
      {
        id: '5.5',
        text: 'Platba je uhrazena dnem připsání na účet dodavatele. Klient nesmí jednostranně započíst své pohledávky proti pohledávkám dodavatele.',
      },
    ],
  },
  {
    number: 6,
    title: 'Prodlení s platbou',
    clauses: [
      {
        id: '6.1',
        text: 'Při prodlení klienta s platbou zasílá dodavatel e-mailové upomínky {{upominka_1}}., {{upominka_2}}., {{upominka_3}}. a {{upominka_4}}. den po splatnosti. Upomínka {{upominka_1}}. den je přátelské upozornění bez následků. Každá další upomínka uvádí dlužné částky a jejich právní základ.',
      },
      {
        id: '6.2',
        text: 'Není-li faktura uhrazena ani do {{upominka_2}}. dne po splatnosti, vzniká dodavateli nárok na smluvní pokutu {{poplatek_1}} Kč. Není-li dlužná částka uhrazena ani do {{upominka_3}}. dne po splatnosti, zvyšuje se smluvní pokuta o dalších {{poplatek_2}} Kč, tedy na celkem {{poplatek_celkem}} Kč.',
      },
      {
        id: '6.3',
        text: 'Není-li dlužná částka uhrazena ani do {{upominka_4}}. dne po splatnosti, vzniká dodavateli nárok i na zákonnou paušální náhradu nákladů spojených s uplatněním pohledávky podle § 3 nařízení vlády č. 351/2013 Sb., nyní {{zakonna_nahrada}} Kč za každou fakturu. Je-li dlužná částka uhrazena dříve, dodavatel ji neuplatní.',
      },
      {
        id: '6.4',
        text: 'Od {{upominka_4}}. dne po splatnosti klient navíc platí smluvní pokutu {{pokuta_prodleni}} % z dlužné částky faktury (bez smluvních pokut a náhrad) za každý den prodlení. Pokuta nahrazuje zákonný úrok z prodlení a je splatná do {{splatnost_dny}} dnů od vyúčtování. Zaplacením smluvních pokut není dotčen nárok dodavatele na náhradu škody.',
      },
      {
        id: '6.5',
        text: 'Je-li klient v prodlení déle než {{pozastaveni_dny}} dnů, může dodavatel pozastavit práce i předání výstupů. Od {{upominka_4}}. dne po splatnosti je pozastaví vždy. Termíny se o dobu pozastavení prodlužují. Je-li klient v prodlení déle než {{odstoupeni_dny}} dnů, může dodavatel od zakázky odstoupit a vyúčtovat provedené práce.',
      },
      {
        id: '6.6',
        text: 'Není-li dlužná částka včetně smluvních pokut a náhrady uhrazena do {{predani_dny}}. dne po splatnosti, předá dodavatel pohledávku právnímu zástupci k předžalobní výzvě a vymáhání. Klient hradí i skutečné náklady vymáhání, zejména právního zastoupení a soudní poplatky, přesahující zákonnou paušální náhradu, doloží-li je dodavatel.',
      },
      {
        id: '6.7',
        text: 'Smluvní pokuty a náhradu dodavatel vyúčtuje samostatným dokladem, který není fakturou. Doklad je splatný do {{splatnost_dny}} dnů od doručení a platí se samostatně pod vlastním variabilním symbolem.',
      },
    ],
  },
  {
    number: 7,
    title: 'Práva k dílu',
    clauses: [
      {
        id: '7.1',
        text: 'Až do úplného zaplacení ceny díla zůstávají všechna práva k dílu u dodavatele. Do té doby klient výstupy smí použít jen k činnostem nezbytným pro jejich schválení a testování. Nesmí je užít, zveřejnit, upravit ani předat třetí osobě.',
      },
      {
        id: '7.2',
        text: 'Licence se poskytuje s odkládací podmínkou úplného zaplacení ceny díla a vzniká jeho zaplacením. Není-li v objednávce uvedeno jinak, je výhradní, pro celý svět, na dobu trvání majetkových práv a pro vlastní účely klienta.',
      },
      {
        id: '7.3',
        text: 'Dodavatel si ponechává práva k nevybraným návrhům a ke svému know-how, nástrojům a šablonám. Komponenty třetích stran se řídí jejich licencemi.',
      },
      {
        id: '7.4',
        text: 'Zdrojové soubory (například PSD, AI nebo zdrojový kód) se předávají, jen pokud to uvádí objednávka. Dodavatel smí zakázku uvádět ve svém portfoliu, pokud objednávka nestanoví jinak.',
      },
    ],
  },
  {
    number: 8,
    title: 'Předání, vady a odpovědnost',
    clauses: [
      {
        id: '8.1',
        text: 'Výstupy jsou předány jejich zpřístupněním klientovi. Klient je posoudí do {{lhuta_prevzeti}} pracovních dnů a případné vady konkrétně písemně vytkne, jinak se považují za převzaté.',
      },
      {
        id: '8.2',
        text: 'Plnění je řádné, odpovídá-li objednávce a schváleným návrhům. Subjektivní estetické názory po schválení návrhu nejsou vadou.',
      },
      {
        id: '8.3',
        text: 'Záruka trvá {{zaruka_mesice}} měsíců od převzetí. Nevztahuje se na vady způsobené zásahem klienta nebo třetí osoby nebo změnou prostředí. Vady klient reklamuje e-mailem a dodavatel oprávněnou vadu odstraní do {{oprava_dny}} pracovních dnů od doručení reklamace.',
      },
      {
        id: '8.4',
        text: 'Odpovědnost dodavatele za škodu je omezena na cenu dané zakázky, kromě škody způsobené úmyslně nebo z hrubé nedbalosti.',
      },
    ],
  },
  {
    number: 9,
    title: 'Ukončení a závěrečná ustanovení',
    clauses: [
      {
        id: '9.1',
        text: 'Klient může zakázku kdykoli ukončit bez udání důvodu, ale jen za těchto podmínek: zaplatí cenu provedených prací, rozpracovaných částí v poměrné výši a vynaložených nákladů třetích stran a zaplatí odstupné {{storno_procent}} % z ceny dosud nerealizované části zakázky (cena zakázky snížená o cenu provedených a rozpracovaných prací). U práce účtované hodinovou sazbou se odstupné neúčtuje. Ukončení je účinné až zaplacením těchto částek. Zaplacená záloha se započte, případný přeplatek dodavatel vrátí do 14 dnů na účet, z něhož byla záloha zaplacena. Ukončí-li klient zakázku bez zaplacení odstupného, platí dodavateli smluvní pokutu ve výši odstupného. Tím není dotčen nárok dodavatele na cenu provedených prací ani na náhradu škody.',
      },
      {
        id: '9.2',
        text: 'Termíny se prodlužují i při vyšší moci nebo nemoci dodavatele. Dodavatel to klientovi oznámí.',
      },
      {
        id: '9.3',
        text: 'Komunikace probíhá e-mailem. Dodavatel odpoví na e-mail nebo telefonický dotaz klienta nejpozději do {{odpoved_hodiny}} hodin. Lhůta se nepočítá o víkendech, státních svátcích a po dobu oznámené dovolené nebo nemoci dodavatele. Odpovědí se rozumí potvrzení přijetí a sdělení dalšího postupu, ne vyřešení požadavku. Opožděná odpověď nezakládá právo klienta na odstoupení ani na smluvní pokutu, pokud nečinnost nepřesáhne 10 pracovních dnů od písemné urgence. Lhůty klienta se o dobu prodlení posouvají. E-mail se považuje za doručený následující pracovní den po odeslání. Obě strany zachovají mlčenlivost o skutečnostech, které se o sobě dozvědí.',
      },
      {
        id: '9.4',
        text: 'Spory se řeší nejprve dohodou, poté u {{prislusny_soud}}. Rozhodné je české právo.',
      },
    ],
  },
]
