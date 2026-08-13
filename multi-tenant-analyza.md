# VHS Cash → Multi-tenant: Architektura a návrh

---

## BLOK 1: Kompletní seznam míst v appce, která by musela znát `workspace_id`

---

### Databázové tabulky

#### `profiles`
Aktuální stav: tabulka je 1:1 s `auth.users`, má sloupec `role` (hodnoty `admin` / `accountant`). Role je globální — neváže se na žádnou firmu ani skupinu uživatelů.

Co se musí změnit:
- Sloupec `role` se odstraní — role přejde do nové tabulky `workspace_members`
- Přidá se `is_super_admin boolean DEFAULT false` — globální flag mimo workspace strukturu
- Samotná tabulka `profiles` žádný `workspace_id` nedostane, protože profil patří uživateli, ne workspace

#### `company_profiles`
Aktuální stav: každý záznam má `user_id` (FK na `auth.users`). Milošovy dva profily (goodveritas s.r.o. a Petr Janošťák OSVČ) mají `user_id = Milošovo UUID`.

Co se musí změnit:
- Přibude sloupec `workspace_id` (FK na novou tabulku `workspaces`)
- `user_id` zůstane jako metadata "kdo záznam vytvořil", ale přestane řídit přístup přes RLS

#### `clients`
Aktuální stav: každý klient má `user_id`. Klienti jsou Milošovi — žádné sdílení.

Co se musí změnit:
- Přibude `workspace_id`
- `user_id` zůstane jako "vytvořil"

#### `documents`
Aktuální stav: každý dokument má `user_id`. Čísla faktur se generují dotazem přes `user_id`.

Co se musí změnit:
- Přibude `workspace_id`
- `user_id` zůstane jako "vytvořil" — při více adminech ve workspace bude vidět, kdo fakturu udělal
- Číslování faktur musí přejít z dotazu přes `user_id` na dotaz přes `workspace_id`

#### `document_items`
Aktuální stav: vazba jen na `document_id`, žádný přímý `user_id`.

Co se musí změnit: **nic** — izolace je zajištěna přes `documents`, které `workspace_id` dostanou. RLS politika pro `document_items` se přepíše tak, aby šla přes JOIN na `documents`.

#### `reminders`
Aktuální stav: vazba jen na `document_id`, žádný přímý `user_id`.

Co se musí změnit: **nic** — stejná logika jako `document_items`.

#### Nové tabulky (nutné přidat)

- `workspaces` — nosná entita celého multi-tenant modelu, viz Blok 2
- `workspace_members` — vazba uživatel ↔ workspace ↔ role, viz Blok 2

---

### RLS politiky — aktuální stav a co je špatně

#### `profiles`
- `Users can view own profile` → SELECT kde `auth.uid() = id` — **zůstane beze změny**
- `Users can update own profile` → UPDATE kde `auth.uid() = id` — **zůstane beze změny**

#### `clients`
- `Users manage own clients` → ALL kde `auth.uid() = user_id` — musí se přepsat na workspace check

#### `documents`
- `Users manage own documents` → ALL kde `auth.uid() = user_id` — musí se přepsat
- `Accountants can view all documents` → SELECT kde `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'accountant')` — **KRITICKÝ PROBLÉM**: tato politika vrátí TRUE pro Evelinu bez ohledu na workspace. Jakmile přibude Jakubův workspace, Evelina uvidí i jeho faktury. Tuto politiku je třeba opravit ještě před spuštěním druhého workspace.

#### `document_items`
- `Users manage items via documents` → ALL kde `document_id IN (SELECT id FROM documents WHERE user_id = auth.uid())` — musí se přepsat
- `Accountants can view all document items` → stejný globální problém jako výše

#### `company_profiles`
- `Users manage own company profiles` → ALL kde `auth.uid() = user_id` — musí se přepsat
- `Accountants can view all company profiles` → stejný globální problém

#### `reminders`
- `Users manage own reminders` → ALL kde `document_id IN (SELECT id FROM documents WHERE user_id = auth.uid())` — musí se přepsat
- `Accountants can view all reminders` → stejný globální problém

**Celková bilance**: 4 "accountant" politiky jsou globální a musí se přepsat. 5 "owner" politik musí přejít z `user_id` na `workspace_id` check. Politiky pro `profiles` zůstanou.

---

### API routes

#### Routes, které čtou nebo zapisují data a musí se stát workspace-aware

**`GET /api/pdf?id=`**
Čte: `documents` (s items), `clients`, `company_profiles`. Přístup probíhá přes Supabase klienta s RLS — pokud bude RLS správně workspace-scoped, route sama o sobě nepotřebuje explicitní workspace logiku. Ale musí ověřit, že dokument s daným `id` patří do workspace přihlášeného uživatele.

**`POST /api/reminders`**
Čte: `documents`, `company_profiles` (pro IBAN, bank_account). Zapisuje: `reminders`. Aktuálně kontroluje `profiles.role = 'admin'` — tato kontrola musí přejít na `workspace_members.role = 'admin'` pro daný workspace. Zároveň musí ověřit, že dokument patří do workspace volajícího.

**`POST /api/uctarna`**
Stejná situace jako `/api/reminders` — čte `documents`, `company_profiles`, generuje PDF jako přílohu. Role check musí přejít na workspace-scoped.

**`GET /api/podklady/list?yearMonth=YYYY-MM`**
Čte Google Drive — dotáže se na složku `YYYY-MM` uvnitř kořenové Drive složky. Aktuálně kořenová složka je z env proměnné `GOOGLE_DRIVE_FOLDER_ID`. Po přechodu musí route nejdřív zjistit, jaký Drive folder patří aktuálnímu workspace (dotaz do `workspaces.drive_folder_id`), a pak teprve listovat soubory.

**`POST /api/podklady/upload`**
Nahrává soubor do Drive. Stejný problém — musí znát workspace-specific Drive folder.

**`GET /api/podklady/download?fileId=`**
Stahuje soubor z Drive. Tady je záludnost: route dostane jen `fileId` — nemá jak ověřit, že soubor patří do workspace volajícího uživatele (Drive API to přímo neví). Buď se to řeší důvěrou (fileId znáš jen pokud jsi ho viděl v listingu), nebo se metadata fileId ukládají do DB s vazbou na workspace. Pro první verzi je "trust-based" přístup pravděpodobně dostačující.

**`DELETE /api/podklady/delete?fileId=`**
Stejná situace jako download.

**`GET /api/admin/backfill-exchange-rates`**
Admin utilita. Podle průzkumu kódu nemá explicitní role/auth check — to je bezpečnostní díra nezávisle na multi-tenancy. Po přechodu by měla vyžadovat `is_super_admin = true`.

#### Routes, které workspace nepotřebují

- `GET /api/ares/[ico]` — veřejný lookup ARES, žádná uživatelská data
- `GET /api/exchange-rate/[date]` — veřejný, kurz ČNB
- `GET /api/vies/[country]/[vat]` — veřejný, VIES validace
- `GET /api/qr-code` — veřejný, generování QR

---

### Číselné řady dokumentů

Aktuální logika (v `app/(protected)/documents/new/page.tsx`, řádky ~79–117):

Pro faktury: `SELECT number FROM documents WHERE user_id = ? AND type = 'faktura' AND number LIKE 'FA-{YEAR}-%'`
- Z vrácených čísel se extrahuje numerická část
- Filtruje se podle company profile type: OSVČ dostane 1xxx (1001–1999), s.r.o. dostane 2xxx (2001–2999)
- Výsledek: `MAX(existujících) + 1`, nebo `rangeStart + 1` pro první fakturu

Pro nabídky a objednávky: COUNT dokladů v daném roce + 1.

**Co se musí změnit**: Dotaz přejde z `WHERE user_id = ?` na `WHERE workspace_id = ?`. Tím pádem jsou číselné řady přirozeně separátní pro každý workspace — FA-2026-1001 v Jakubově workspace je zcela nezávislé od FA-2026-1001 v Milošově.

**Otevřená otázka**: Jakub bude mít jeden firemní profil. Jaký `profile_type` bude mít? Pokud bude mít jen s.r.o., bude automaticky číslovat od 2001. Pokud bude mít OSVČ, od 1001. Pokud chceš pro jeho workspace jiný rozsah (třeba 3xxx pro s.r.o.), to by obnášelo úpravu logiky — není to automatické.

---

### Google Drive integrace

Aktuální stav (`lib/google-drive.ts`):
- Service account credentials z env (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`)
- Kořenová složka z env: `GOOGLE_DRIVE_FOLDER_ID`
- Struktura: `root/{YYYY-MM}/soubory`
- Sdílená složka pro celou appku — žádná separace per user

Co se musí změnit:
- Každý workspace potřebuje vlastní kořenovou Drive složku
- `drive_folder_id` se přesune z env proměnné do DB sloupce `workspaces.drive_folder_id`
- Před každým Drive voláním API route přečte `workspaces.drive_folder_id` pro aktuální workspace
- `lib/google-drive.ts` funkce jako `getOrCreateMonthFolder` dostanou `rootFolderId` jako parametr místo toho, aby ho četly z env

Fyzicky: pro Jakubův workspace se na Google Drive vytvoří nová složka (nebo Shared Drive), její ID se uloží do DB při zakládání workspace. Milošova stávající složka zůstane — jen se její ID přesune z env do DB.

---

### PDF generování

`lib/pdf/generate.ts` čte `documents` (s items), `clients`, `company_profiles` — vše přes Supabase klienta s RLS. Pokud RLS bude správně workspace-scoped, PDF generování samo o sobě **nepotřebuje** žádnou extra workspace logiku. Dědí izolaci z RLS.

Výjimka: QR kód v PDF se generuje z IBAN + částka + variabilní symbol — to jsou čistě data z dokumentu, žádný workspace kontext.

---

### E-mailové šablony a odesílání

`lib/reminder-email.ts` a `lib/uctarna-email.ts` jsou čistě presentační vrstvy — dostanou data jako parametry a vyrenderují HTML. Samy o sobě jsou **workspace-agnostické**.

Co workspace ovlivňuje:

**Odesílací adresy**: dnes hardcoded `upominka@v-h-s.cz` a `uctarna@v-h-s.cz`. Pokud Jakubův workspace bude posílat e-maily, budou odcházet ze stejných adres. To může nebo nemusí být problém — záleží na dohodě s Jakubem. Pokud bude potřeba oddělená adresa, `workspaces` tabulka může mít volitelné sloupce `email_from_reminders` a `email_from_uctarna`. Ale to vyžaduje ověření dalšího senderu v Resend.

**Reply-to**: dnes `info@v-h-s.cz` — stejný problém.

**Obsah e-mailů**: obsahuje platební údaje (IBAN, číslo faktury, VS) — to jsou data z dokumentu/firemního profilu, workspace-aware přes RLS.

---

## BLOK 2: Navržený datový model

---

### Nová tabulka `workspaces`

```
workspaces
─────────────────────────────────────────────────────────
id                    uuid          PK, DEFAULT gen_random_uuid()
name                  text          NOT NULL
                                    (zobrazovaný název, např. "Miloš Serbus")
drive_folder_id       text          NULLABLE
                                    (Google Drive root folder ID pro tento workspace)
email_from_reminders  text          NULLABLE
                                    (odesílatel upomínek, fallback na hardcoded vhs.cz)
email_from_uctarna    text          NULLABLE
                                    (odesílatel pro účtárnu, fallback na hardcoded vhs.cz)
created_at            timestamptz   NOT NULL DEFAULT NOW()
```

Záměrně minimalistická. Bez `slug`, bez URL routingu — workspace se pozná z přihlášení, ne z URL. Pokud v budoucnu přibyde víc nastavení, lze přidat sloupce.

---

### Nová tabulka `workspace_members`

```
workspace_members
─────────────────────────────────────────────────────────
id                    uuid          PK, DEFAULT gen_random_uuid()
workspace_id          uuid          NOT NULL, FK → workspaces(id) ON DELETE CASCADE
user_id               uuid          NOT NULL, FK → auth.users(id) ON DELETE CASCADE
role                  text          NOT NULL, CHECK IN ('admin', 'accountant')
invited_by            uuid          NULLABLE, FK → auth.users(id)
joined_at             timestamptz   NULLABLE
                                    (NULL = pozvánka odeslána, ale ještě nepřijata)
created_at            timestamptz   NOT NULL DEFAULT NOW()

UNIQUE (workspace_id, user_id)
```

Tato tabulka nahrazuje `profiles.role`. Role je nyní vždy vázána na konkrétní workspace.

---

### Změny ve stávajících tabulkách

#### `profiles` — přidání jednoho sloupce, odebrání jednoho

Přidá se:
```
is_super_admin        boolean       NOT NULL DEFAULT false
```

Odstraní se:
```
role                  text          (přesouvá se do workspace_members)
```

Trigger `handle_new_user()` se upraví — při vytvoření nového `profiles` záznamu nastaví `is_super_admin = false` (nebo spoléhá na DEFAULT).

#### `company_profiles` — přidání workspace_id

Přidá se:
```
workspace_id          uuid          NOT NULL, FK → workspaces(id)
```

`user_id` zůstane jako metadata (kdo vytvořil), ale přestane řídit přístup přes RLS. Firemní profil patří workspace, ne jednotlivci.

#### `clients` — přidání workspace_id

Přidá se:
```
workspace_id          uuid          NOT NULL, FK → workspaces(id)
```

Stejná logika — klienti patří workspace.

#### `documents` — přidání workspace_id

Přidá se:
```
workspace_id          uuid          NOT NULL, FK → workspaces(id)
```

`user_id` zůstane jako "kdo fakturu vytvořil" — užitečné ve workspace s více adminy.

#### `document_items` — beze změny

#### `reminders` — beze změny

---

### Jak se řeší `super_admin`

`is_super_admin = true` v tabulce `profiles` je globální flag, který existuje zcela mimo workspace strukturu. Miloš ho bude mít nastavený na true. Nikdo jiný.

Přístupová logika pro super_admina:
- Miloš je zároveň normální člen svého workspace (je v `workspace_members` jako admin) — tohle je doporučený přístup
- Navíc má `is_super_admin = true`, díky čemuž RLS politiky mu umožní vidět data z jakéhokoli workspace
- Super_admin dashboard (`/admin/workspaces`) je viditelný jen uživatelům s `is_super_admin = true`
- `is_super_admin` se nikdy nevystavuje jako editovatelné pole v appce — mění se jen přímým SQL příkazem v Supabase

---

### Pomocné SQL funkce pro RLS

Tyto funkce se vytvoří jednou a pak se používají ve všech politikách. `SECURITY DEFINER` umožní funkcím číst `profiles` a `workspace_members` i pod RLS.

```sql
CREATE OR REPLACE FUNCTION is_workspace_member(ws_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION is_workspace_admin(ws_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id
      AND user_id = auth.uid()
      AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM profiles WHERE id = auth.uid()),
    false
  )
$$;
```

---

### Konkrétní příklad přepsané RLS politiky — před a po

#### `documents` — SELECT (číst dokumenty)

**Před (dnes):**

Politika 1 — vlastník:
```sql
CREATE POLICY "Users manage own documents"
ON documents FOR ALL
USING (auth.uid() = user_id);
```

Politika 2 — účetní (globální, chybná):
```sql
CREATE POLICY "Accountants can view all documents"
ON documents FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'accountant'
  )
);
```

**Po (nový model):**

Politika 1 — čtení pro všechny členy workspace (admin i accountant):
```sql
CREATE POLICY "Workspace members can view documents"
ON documents FOR SELECT
USING (
  is_workspace_member(workspace_id) OR is_super_admin()
);
```

Politika 2 — zápis jen pro adminy workspace:
```sql
CREATE POLICY "Workspace admins can manage documents"
ON documents FOR ALL
USING (
  is_workspace_admin(workspace_id) OR is_super_admin()
)
WITH CHECK (
  is_workspace_admin(workspace_id) OR is_super_admin()
);
```

**Co se změnilo a proč**:
- Accountant nyní vidí jen dokumenty svého workspace — protože `is_workspace_member` vrátí true jen pro workspace, kde je členem
- Super_admin vidí vše — výjimka přes `is_super_admin()`
- Zápis je podmíněn rolí `admin` v daném workspace — accountant nemůže zapisovat
- Dvě separátní politiky místo jedné kombinované — přehlednost a správnost

#### `document_items` — SELECT (přes JOIN na documents)

**Před:**
```sql
CREATE POLICY "Users manage items via documents"
ON document_items FOR ALL
USING (
  document_id IN (
    SELECT id FROM documents WHERE user_id = auth.uid()
  )
);
```

**Po:**
```sql
CREATE POLICY "Workspace members can view document items"
ON document_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM documents d
    WHERE d.id = document_id
      AND (is_workspace_member(d.workspace_id) OR is_super_admin())
  )
);

CREATE POLICY "Workspace admins can manage document items"
ON document_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM documents d
    WHERE d.id = document_id
      AND (is_workspace_admin(d.workspace_id) OR is_super_admin())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM documents d
    WHERE d.id = document_id
      AND (is_workspace_admin(d.workspace_id) OR is_super_admin())
  )
);
```

---

## BLOK 3: Migrační postup pro převod stávajících dat

---

### Princip migrace

Cílem je přiřadit všechna existující data (company_profiles, clients, documents a přes ně document_items a reminders) do nového workspace pro Miloše. Data se nemění, nemažou, nepřepisují — jen se ke každému záznamu přidá `workspace_id`. Migrace probíhá ve fázích, kde každá fáze je bezpečná i při přerušení.

---

### Fáze 0 — Záloha (povinná, před čímkoliv jiným)

Exportuješ kompletní pg_dump z Supabase. Uložíš ho mimo server (lokálně nebo S3). Bez tohoto kroku nic dalšího nezačínáš.

Jak: v Supabase dashboardu → Project Settings → Database → Backups (nebo přes `pg_dump` CLI s connection stringem ze Supabase).

---

### Fáze 1 — Vytvoření nových tabulek (nedestruktivní, production-safe)

Vytvoříš tabulky `workspaces` a `workspace_members`. Žádná existující data se nemění. RLS politiky se nemění. Appka funguje beze změny, protože nové tabulky zatím nic nepoužívá.

Co přesně vznikne:
- Tabulka `workspaces` (prázdná)
- Tabulka `workspace_members` (prázdná)
- Sloupec `is_super_admin` v `profiles` (přidáš sloupec, ale `role` ještě necháváš — poběží obojí souběžně)

Po nasazení: ověříš v Supabase dashboardu, že tabulky existují. Nic dalšího.

---

### Fáze 2 — Přidání `workspace_id` jako nullable sloupce (nedestruktivní, production-safe)

Do tabulek `company_profiles`, `clients`, `documents` přidáš sloupec `workspace_id uuid NULLABLE` — bez NOT NULL constraintu, bez FK enforcement zatím.

```sql
ALTER TABLE company_profiles ADD COLUMN workspace_id uuid;
ALTER TABLE clients ADD COLUMN workspace_id uuid;
ALTER TABLE documents ADD COLUMN workspace_id uuid;
```

Existující záznamy mají `workspace_id = NULL`. Stará RLS politika (`user_id = auth.uid()`) stále platí — appka funguje beze změny.

Po nasazení: ověříš, že sloupce existují, že data jsou nedotčená, že appka funguje normálně.

---

### Fáze 3 — Vytvoření Milošova workspace a členství

V Supabase SQL editoru (nebo jako migraci) spustíš toto. **Důležité**: UUID pro workspace si vygeneruješ předem, abys ho mohl použít v následujícím kroku konzistentně.

```sql
-- Nový workspace
INSERT INTO workspaces (id, name, drive_folder_id)
VALUES (
  '<<milův-workspace-uuid>>',
  'Miloš Serbus',
  '<<aktuální hodnota GOOGLE_DRIVE_FOLDER_ID z env>>'
);

-- Miloš jako admin workspace
INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
VALUES (
  '<<milův-workspace-uuid>>',
  '<<Milošovo auth.users UUID>>',
  'admin',
  NOW()
);

-- Evelina jako accountant workspace
INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
VALUES (
  '<<milův-workspace-uuid>>',
  '<<Evelinino auth.users UUID>>',
  'accountant',
  NOW()
);
```

Jak zjistíš UUID uživatelů: v Supabase → Authentication → Users, nebo `SELECT id, email FROM auth.users`.

Po tomto kroku: workspace existuje, ale žádná data na něj ještě neukazují. Appka stále funguje přes starou RLS.

---

### Fáze 4 — Přiřazení workspace_id ke všem existujícím datům (klíčový krok)

Toto je atomická operace — musí proběhnout celá, nebo vůbec. Spouštíš jako jednu transakci.

```sql
BEGIN;

UPDATE company_profiles
SET workspace_id = '<<milův-workspace-uuid>>'
WHERE workspace_id IS NULL;

UPDATE clients
SET workspace_id = '<<milův-workspace-uuid>>'
WHERE workspace_id IS NULL;

UPDATE documents
SET workspace_id = '<<milův-workspace-uuid>>'
WHERE workspace_id IS NULL;

-- Ověření před commitem
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM company_profiles WHERE workspace_id IS NULL) THEN
    RAISE EXCEPTION 'CHYBA: Zůstaly NULL záznamy v company_profiles';
  END IF;
  IF EXISTS (SELECT 1 FROM clients WHERE workspace_id IS NULL) THEN
    RAISE EXCEPTION 'CHYBA: Zůstaly NULL záznamy v clients';
  END IF;
  IF EXISTS (SELECT 1 FROM documents WHERE workspace_id IS NULL) THEN
    RAISE EXCEPTION 'CHYBA: Zůstaly NULL záznamy v documents';
  END IF;
END $$;

COMMIT;
```

Pokud EXCEPTION nastane, transakce se rollbackuje — žádná data se nezmění. Bezpečné.

Po commitu:
- Spočítáš záznamy: `SELECT COUNT(*) FROM documents` musí souhlasit s `SELECT COUNT(*) FROM documents WHERE workspace_id = '<<milův-workspace-uuid>>'`
- Totéž pro `clients` a `company_profiles`

---

### Fáze 5 — Aktivace NOT NULL constraintů a FK

Teď když jsou všechna data vyplněná, zpevníš schéma:

```sql
ALTER TABLE company_profiles
  ALTER COLUMN workspace_id SET NOT NULL,
  ADD CONSTRAINT fk_company_profiles_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id);

ALTER TABLE clients
  ALTER COLUMN workspace_id SET NOT NULL,
  ADD CONSTRAINT fk_clients_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id);

ALTER TABLE documents
  ALTER COLUMN workspace_id SET NOT NULL,
  ADD CONSTRAINT fk_documents_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
```

Pokud by se ALTER TABLE NOT NULL SET pokusil aplikovat na NULL hodnotu, selže — to je správné chování. Ale protože Fáze 4 proběhla a ověřila, že žádné NULL nezbývají, tohle by mělo projít.

---

### Fáze 6 — Přepsání RLS politik a nasazení nového kódu (koordinovaný krok)

Toto je přechodový moment, kde musí migrace DB a deployment aplikace proběhnout koordinovaně. Pokud se stavy rozejdou:
- Nová RLS + starý kód: dotazy neobsahují workspace kontext → vrátí prázdná data nebo selžou
- Starý kód + nová RLS (workspace_id sloupce naplněné): může fungovat přechodně, pokud stará RLS stále platí

Nejbezpečnější přístup: nasadit migraci a kód současně, v co nejkratším okně, mimo pracovní dobu.

Co testovat po Fázi 6:
- Přihlásit se jako Miloš → musí vidět všechny dokumenty, klienty, firemní profily
- Přihlásit se jako Evelina → musí vidět (jen číst) stejná data, nic jiného
- Vytvořit nový dokument jako Miloš → musí fungovat, číslo musí navázat na stávající řadu
- Pokusit se vytvořit dokument jako Evelina → musí dostat 403
- Ověřit, že Google Drive (Podklady) stále funguje — Milošova složka je stávající, ID je v DB

---

### Fáze 7 — Nastavení `is_super_admin` pro Miloše

```sql
UPDATE profiles
SET is_super_admin = true
WHERE id = '<<Milošovo auth.users UUID>>';
```

Tohle lze udělat kdykoli po Fázi 1 (kdy sloupec existuje). Doporučuji až po Fázi 6, kdy je nový kód nasazený a super_admin funkcionalita má smysl.

---

### Fáze 8 — Odstranění starého sloupce `role` z `profiles`

Po ověření, že nový kód nikde nečte `profiles.role` (všechny checks jsou přes `workspace_members.role`):

```sql
ALTER TABLE profiles DROP COLUMN role;
```

Tohle je poslední krok, nejdéle odložitelný. Dokud ho neprovedeš, stará RLS politika pro "accountants" může stále existovat (jako safety net), ale nová logika ji ignoruje.

---

## BLOK 4: Proces založení nového workspace pro Jakuba

---

### Kdo zakládá workspace

Pouze Miloš (super_admin). V appce bude dostupná sekce `/admin/workspaces` (nebo tlačítko v nastavení) viditelná výhradně uživatelům s `is_super_admin = true`. Jakub nemůže sám zaregistrovat workspace — není veřejná registrace.

---

### Krok 1: Miloš vyplní základní údaje workspace

Ve formuláři zadá:
- Název workspace (zobrazovaný název, např. "Jakub Novák")
- Google Drive folder ID (volitelně — Miloš si předem připraví složku na Drive a zkopíruje ID)
- E-mail pro odesílání upomínek a faktur (volitelně, fallback na výchozí vhs.cz adresy)

Systém vytvoří záznam v `workspaces`.

---

### Krok 2: Miloš pozve Jakuba jako admin

V tom samém nebo navazujícím formuláři zadá Jakubův e-mail a roli `admin`. Systém:
1. Zavolá Supabase Auth Admin API — odešle pozvánkový e-mail Jakubovi
2. Vytvoří záznam v `workspace_members` s `joined_at = NULL` (čeká na přijetí)

Jakub dostane e-mail s odkazem. Klikne, nastaví si heslo (nebo je přihlášen přes magic link). Po přihlášení appka detekuje, že přišel přes invite, a vyplní `joined_at` v `workspace_members`.

---

### Krok 3: Jakub si vytvoří firemní profil

Jakub je přihlášen jako admin svého workspace. V Nastavení → Firemní profily vytvoří nový profil:
- Název firmy, IČO, DIČ, adresa
- Bankovní účet, IBAN, SWIFT
- Typ profilu (s.r.o. nebo OSVČ)

Nový firemní profil se uloží s `workspace_id = Jakubův workspace`. Číselná řada faktur pro jeho workspace začne od 1001 (OSVČ) nebo 2001 (s.r.o.) — automaticky, bez konfliktu s Milošovými.

---

### Krok 4: Jakub případně pozve svoji účetní

Jako admin svého workspace může Jakub sám pozvat další uživatele s rolí `accountant`. Postup je stejný jako v Kroku 2 — formulář, e-mail, pozvánka. Miloš do tohoto procesu nemusí zasahovat.

---

### Co Miloš vidí ze super_admin pohledu

V `/admin/workspaces` Miloš vidí:
- Seznam všech workspaců (ID, název, datum vytvoření)
- Pro každý workspace: seznam členů (email, role, joined_at)
- Tlačítko "Vytvořit nový workspace" a "Pozvat uživatele do workspace"
- Přímý přístup k datům daného workspace pro supportní účely (díky super_admin RLS bypass)

---

### Kdo může zvát koho

| Roli zve | Kdo může pozvat |
|---|---|
| admin nového workspace | jen super_admin (Miloš) |
| accountant do workspace | admin toho workspace NEBO super_admin |

---

## BLOK 5: Návrh pozvánkového a registračního flow

---

### Výchozí princip — žádná veřejná registrace

Appka nezpřístupní registrační formulář. Nový uživatel se do systému dostane výhradně přes pozvánkový odkaz vázaný na konkrétní workspace a roli. Pozvánku může odeslat super_admin (Miloš) nebo admin konkrétního workspace.

---

### Doporučený mechanismus: Supabase `inviteUserByEmail`

Supabase Auth má pro tento účel built-in metodu v Admin API. Je to nejjednodušší cesta — nevyžaduješ psát vlastní token logiku, vlastní e-mail šablonu pro pozvánky ani vlastní expiraci linků.

#### Jak to funguje technicky

**Krok 1 — Odeslání pozvánky (server-side)**

Nová protected route, například `POST /api/admin/invite-user`. Volá ji Miloš nebo workspace admin z UI.

Route:
1. Ověří, že volající je super_admin nebo admin daného workspace (jinak 403)
2. Zavolá Supabase Admin API s `service_role` klíčem:

```
supabaseAdmin.auth.admin.inviteUserByEmail(email, {
  data: {
    workspace_id: '...',
    workspace_role: 'admin'   // nebo 'accountant'
  }
})
```

Tato `data` se uloží jako `user_metadata` v auth záznamu — dostupná po přihlášení.

3. Vytvoří záznam v `workspace_members` s `joined_at = NULL` (pozvánka odeslána, čeká na přijetí)

**Krok 2 — Přijmutí pozvánky (uživatel klikne na link)**

Supabase odešle e-mail s magic linkem. Po kliknutí:
- Uživatel je přesměrován na callback URL appky (například `/auth/callback?type=invite`)
- Appka přečte session a `user.user_metadata` (workspace_id, workspace_role)
- Vyplní `joined_at = NOW()` v existujícím záznamu `workspace_members`
- Přesměruje na dashboard nebo onboarding stránku

**Krok 3 — Nastavení hesla (volitelné)**

Po přijetí magic linku je uživatel přihlášen přes dočasný token. Může si nastavit trvalé heslo v nastavení účtu. Bez nastavení hesla se příště přihlásí přes "Zapomenuté heslo" / magic link znovu.

---

### Co to obnáší za práci navíc oproti dnešnímu ručnímu zakládání

| Věc | Dnes (ruční) | S invite flow |
|---|---|---|
| Vytvoření uživatele | Miloš jde do Supabase, klikne, vyplní | Miloš klikne v appce, zadá e-mail |
| Přiřazení role | Miloš ručně píše SQL do workspace_members | Automaticky při odeslání pozvánky |
| Nastavení hesla | Miloš sdílí dočasné heslo přes jiný kanál | Uživatel si nastaví sám po kliknutí na link |
| Práce pro Miloše | ~10 minut per uživatel | ~30 sekund per uživatel |
| Audit kdo pozval koho | Žádný | `invited_by` v workspace_members |

Práce navíc pro implementaci:
- Jedna nová API route pro odeslání pozvánky (`POST /api/admin/invite-user`)
- Úprava auth callback route (`/auth/callback`) aby zpracovala `type=invite` a vyplnila `joined_at`
- UI formulář "Pozvat uživatele" v admin sekci
- Volitelně: přizpůsobení pozvánkového e-mailu v Supabase dashboard (Branding sekce)

---

### Speciální případ: uživatel, který v Supabase Auth už existuje

`inviteUserByEmail` vytvoří nového auth uživatele a pošle mu invite link. Pokud uživatel s daným e-mailem v Supabase Auth **už existuje**, Supabase API vrátí chybu.

Řešení: invite route nejdřív zkontroluje, jestli uživatel s daným e-mailem existuje:
- Pokud ne → normálně invite
- Pokud ano → přidá ho přímo do `workspace_members` (bez odesílání e-mailu) a případně ho upozorní jinak

---

### Alternativní mechanismy (pro srovnání, nedoporučuji)

**Vlastní invitation token v DB**: vytvoříš tabulku `invitations` s UUID tokenem, expirací a rolí. Uživatel dostane odkaz s tokenem, klikne, vytvoří si účet. Flexibilnější, ale mnohem více vlastního kódu.

**Magic link bez hesla**: uživatel se vždy přihlašuje přes magic link (bez hesla). Jednodušší pro uživatele, ale závisí na přístupu k e-mailu při každém přihlášení — nevhodné pro každodenní pracovní nástroj.

---

## BLOK 6: Rizika a věci, na které myslet

---

### Kritická rizika (mohou způsobit únik dat nebo nefunkčnost)

#### 1. Accountant RLS je dnes globální — MUSÍ se opravit před přidáním druhého workspace

Tohle je existující bezpečnostní problém, který se projeví okamžitě po přidání Jakubova workspace. Evelina (accountant Milošova workspace) má dnes politiku "vidí VŠECHNY dokumenty v DB". To funguje jen proto, že dnes existuje jen jeden "tenant". Jakmile přibude druhý workspace, Evelina uvidí Jakubovy faktury.

**Akce**: opravu těchto čtyř politik (documents, document_items, company_profiles, reminders) je třeba nasadit jako samostatný fix ještě před celou migrací. Lze to udělat bez narušení stávající funkčnosti, protože Miloš je zároveň admin i de-facto vlastník všech dat.

#### 2. Přepnutí RLS + nasazení kódu musí být koordinované

Moment přechodu ze staré RLS (user_id) na novou (workspace_id) je kritický. Pokud se stavy rozejdou:
- Nová RLS + starý kód: dotazy neobsahují workspace kontext → vrátí prázdná data nebo selžou
- Starý kód + nová RLS (workspace_id sloupce naplněné): může fungovat přechodně, pokud stará RLS stále platí

Nejbezpečnější přístup: nasadit migrace a kód současně, v co nejkratším okně, mimo pracovní dobu.

#### 3. Google Drive — aktuální env var se stane zastaralou

Po přesunu `drive_folder_id` do DB: pokud env proměnná `GOOGLE_DRIVE_FOLDER_ID` zůstane v kódu jako fallback a někdo zapomene aktualizovat DB, Drive routes budou číst z env místo z DB — tj. všichni budou sdílet Milošovu složku.

**Akce**: po migraci Fáze 3 (kdy je drive_folder_id vloženo do workspaces tabulky) je třeba env fallback z kódu odstranit, ne jen přidat DB lookup.

---

### Střední rizika (mohou způsobit regresi nebo zmatení)

#### 4. Číslování faktur — ověření správnosti po migraci

Po přechodu dotazů z `user_id` na `workspace_id` musí generátor čísel vrátit stejný výsledek jako dřív — tj. pro Milošův workspace musí vidět stávající čísla a navázat správně. Pokud by dotaz vracel 0 existujících čísel (například chybou v parametru workspace_id), příští faktura by dostala číslo 1001 nebo 2001 — kolize se stávajícími.

**Akce**: po Fázi 6 vytvořit testovací fakturu (draft, neodeslat) a ověřit, že dostane správné příští číslo v řadě.

#### 5. Workspace kontext v Next.js — kdy ho načítat

Každá server-side route potřebuje vědět, do jakého workspace přihlášený uživatel patří. Způsoby:

a) Každá route provede `SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() LIMIT 1` — jednoduché, ale extra DB round-trip na každý request

b) Workspace ID se uloží do JWT claims (Supabase custom claims) — načtení bez DB dotazu, ale aktualizace claims po změně workspace je komplikovanější

Pro začátek doporučuji variantu a) — jednoduchá, správná, snadno debugovatelná. Optimalizace až pokud se ukáže jako bottleneck.

#### 6. Milošova role ve dvou systémech najednou

Miloš je super_admin (globální flag) + admin svého workspace (v workspace_members). Kód musí být konzistentní v tom, který check se kdy použije:
- Pro přístup k datům: workspace membership check (Miloš jako admin workspace)
- Pro super_admin funkce (/admin/workspaces, zakládání nových workspaců): is_super_admin check
- Pro RLS bypass: is_super_admin check jako OR podmínka

Nesmí nastat situace, kdy RLS bypass přes is_super_admin obejde logiku, která by jinak správně zamítla přístup z aplikační vrstvy.

#### 7. Jaký firemní profil bude mít Jakub a jak bude číslovat

Aktuální číslování závisí na `profile_type` (OSVČ → 1xxx, s.r.o. → 2xxx). Jakub bude mít jiné IČO/DIČ — ale jaký typ? Pokud s.r.o., začne od FA-2026-2001 ve svém workspace. To je v pořádku — je to jiný workspace. Ale pokud bys v budoucnu chtěl pro různé workspace typy různé rozsahy (třeba Jakub 3xxx), musela by se číslující logika rozšířit o workspace-level konfiguraci. Navrhuji rozhodnout předem.

#### 8. E-mailové adresy odesílatele

Upomínky a faktury budou chodit z `upominka@v-h-s.cz` resp. `uctarna@v-h-s.cz` i pro Jakubův workspace. Záleží na dohodě s Jakubem — může mu to vadit (faktury z jiné domény), nebo ne. Pokud bude potřeba oddělená adresa, je třeba:
- Přidat doménu nebo e-mail do Resend jako ověřený sender
- Naplnit `email_from_reminders` a `email_from_uctarna` v `workspaces` tabulce pro Jakubův workspace
- Upravit API routes aby tyto hodnoty četly z DB

#### 9. `/api/admin/backfill-exchange-rates` nemá auth check

Tato route je admin utilita a podle průzkumu kódu nemá viditelný role check. Kdokoli, kdo zná URL, by ji mohl zavolat. Po přechodu na multi-tenant by měla vyžadovat `is_super_admin = true`. Toto je bug nezávislý na multi-tenancy — doporučuji opravit i bez ohledu na celou migraci.

---

### Menší záludnosti (nečekané komplikace)

#### 10. `profiles` trigger musí znát nový sloupec

Trigger `handle_new_user()` se spustí při každé registraci a vytvoří řádek v `profiles`. Po přidání sloupce `is_super_admin` musí trigger buď explicitně nastavit `is_super_admin = false`, nebo spoléhat na DEFAULT. Pokud to trigger nenastaví a DEFAULT chybí, nový uživatel bude mít NULL → funkce `is_super_admin()` musí vracet `COALESCE(..., false)`, nikoliv jen holou hodnotu.

#### 11. Supabase invite + uživatel, který už existuje

Popsáno v Bloku 5. Pro Jakuba to pravděpodobně nenastane, ale pro budoucí uživatele — pokud by měl účet v jiném Supabase projektu nebo byl dřív manuálně vytvořen — `inviteUserByEmail` vrátí chybu. Route musí tento případ ošetřit.

#### 12. `is_super_admin` nemá UI ochranu

Flag lze nastavit pouze přes SQL. V appce nikdy nevystavuj `is_super_admin` jako editovatelné pole. Ale: kdokoli s přístupem k Supabase SQL editoru (nebo s `service_role` klíčem) může tento flag nastavit. Pro appku v tomto rozsahu je to akceptovatelné riziko — jen věz o něm a nedávej přístup k Supabase nikomu jinému.

#### 13. RLS pro `workspace_members` samotnou

Tabulka `workspace_members` také potřebuje RLS. Jinak by uživatel mohl dotazem zjistit, kteří další uživatelé existují v systému (porušení izolace). Návrh:
- Člen vidí jen workspace_members záznamy pro svůj vlastní workspace
- Super_admin vidí vše
- INSERT/UPDATE/DELETE povoleno jen adminovi daného workspace a super_adminovi

#### 14. Podklady (Google Drive) — ověření, že soubor patří do správného workspace

`DELETE /api/podklady/delete?fileId=` dostane jen `fileId`. Appka nemá způsob jak přes Drive API ověřit, že soubor patří do workspace volajícího uživatele. Teoreticky by admin jednoho workspace mohl smazat soubor z Drive složky druhého workspace, pokud by znal jeho `fileId`.

Toto je hraniční případ — `fileId` zná jen ten, kdo ho viděl v listingu (a listing je workspace-scoped). Pro první verzi je to přijatelné riziko. Pokud by se to chtělo ošetřit, ukládala by se metadata souborů (fileId, workspace_id) do DB pomocné tabulky.

---

### Souhrn priorit před spuštěním

| Priorita | Věc |
|---|---|
| **Kritická, udělat nejdřív** | Opravit globální accountant RLS politiky (4 politiky) |
| **Kritická** | Koordinovaný deploy RLS + kód v Fázi 6 |
| **Kritická** | Záloha před každou fází |
| **Důležitá** | Přidat auth check do `/api/admin/backfill-exchange-rates` |
| **Důležitá** | Rozhodnout o číslování pro Jakubův workspace (jaký profile_type) |
| **Důležitá** | Rozhodnout o e-mailových adresách pro Jakubův workspace |
| **Doporučená** | Vytvořit Drive složku pro Jakuba předem, mít ID připravené |
| **Doporučená** | Přizpůsobit invite e-mail šablonu v Supabase |
