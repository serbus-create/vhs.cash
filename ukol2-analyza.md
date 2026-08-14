# ÚKOL 2: Analýza vlastní číselné řady faktur per profil

## 1. Jak dnes funguje generateNumber

Logika je v `documents/new/page.tsx:84–122`. Formát čísla faktury je **`FA-{rok}-{seq}`**, kde `seq` je 4místné číslo.

Pro faktury (`type === 'faktura'`) se sekvence řídí typem profilu:
- profil s `profile_type === 'sro'` → rozsah **2001–2999** (`rangeStart = 2000`)
- jakýkoliv jiný profil (tedy OSVČ) → rozsah **1001–1999** (`rangeStart = 1000`)

Algoritmus načte **všechny faktury workspace** z aktuálního roku formátu `FA-{rok}-%`, parsuje třetí segment (`split('-')[2]`), filtruje jen čísla patřící do rozsahu daného profilu, vezme maximum a přičte 1. Pokud v rozsahu nic není, začne od `rangeStart + 1`.

**Poznámka po ÚKOLU 1:** Nový dynamický filtr profilu přestal záviset na `profile_type`, ale `generateNumber` stále závisí na `profile_type === 'sro'`. Tato logika je tedy nyní vnitřně nekonzistentní s filtrováním — ale na funkcionalitě číslování to zatím nic nemění, protože `companyProfiles` stále drží `profile_type`.

---

## 2. Návrh nového sloupce

**Sloupec:** `invoice_number_series integer not null default 1`

Navrhuji `integer`, ne `text`. Důvod: sekvence je číslo, ze kterého se počítá rozsah. Appka pak generuje čísla jako `rangeStart = (profile.invoice_number_series - 1) * 1000`, tedy:
- série `1` → rozsah 1001–1999 (dnešní OSVČ)
- série `2` → rozsah 2001–2999 (dnešní s.r.o.)
- série `3` → rozsah 3001–3999 (budoucí třetí profil)

**Proč integer a ne text prefix?** Text prefix jako `"1"` nebo `"2"` by komplikoval parsování — číslo faktury by muselo vždy začínat prefixem profilu, ale dnes formát je `FA-2026-1042` a třetí segment se parsuje jako celé číslo. S integerem stačí jeden nový sloupec, logika v `generateNumber` se změní minimálně.

**Výchozí hodnoty pro existující profily:**

| Profil | Dnešní chování | `invoice_number_series` |
|--------|---------------|------------------------|
| Petr Janošťák OSVČ | rangeStart = 1000, faktury FA-2026-1001… | **1** |
| goodveritas s.r.o. | rangeStart = 2000, faktury FA-2026-2001… | **2** |

Číslování **navazuje bez přerušení** — série 1 pokračuje od posledního maxima v rozsahu 1001–1999, série 2 od maxima v 2001–2999. Žádná historická faktura se nepřečísluje.

**Výchozí hodnota pro nově vytvářený profil:**  
`invoice_number_series DEFAULT 1` na úrovni DB. V UI při vytváření profilu zobrazit pole „Číselná řada" s hodnotou `1`, ale doporučit uživateli zvolit číslo, které ještě nikdo v workspace nepoužívá. Appka může nabídnout `max(invoice_number_series) + 1` ze stávajících profilů.

---

## 3. Rizika kolize s historickými fakturami

**Riziko 1 — explicitní přiřazení série existujícím profilům je nutné přes migraci.**  
Pokud by se sloupec přidal s `DEFAULT 1` a zapomnělo se na UPDATE existujících profilů, oba profily by dostaly sérii `1` a příští faktura s.r.o. by dostala číslo z rozsahu 1xxx — kolize s OSVČ fakturami.  
→ Migrace musí obsahovat `UPDATE company_profiles SET invoice_number_series = 2 WHERE profile_type = 'sro'` (nebo filtrovat podle jména, pokud profile_type přestane být spolehlivý).

**Riziko 2 — parsování historických čísel.**  
Stávající algoritmus parsuje `number.split('-')[2]` a filtruje podle rozsahu `rangeStart..rangeStart+1000`. Po přechodu to musí fungovat stejně: série 1 = rozsah 1001–1999, série 2 = 2001–2999. Pokud by existovala faktura FA-2026-1047 (OSVČ) a nový profil dostane sérii 1, algoritmus správně najde max a navazuje. **Nezlomí se nic, pokud mapování série→rozsah zůstane konzistentní.**

**Riziko 3 — unique constraint na sérii v rámci workspace.**  
Doporučuji `UNIQUE(workspace_id, invoice_number_series)` — zabrání tomu, aby dva profily sdílely rozsah a generovaly kolidující čísla. Bez tohoto constraintu může admin omylem přiřadit stejnou sérii dvěma profilům a FA-2026-1042 vznikne dvakrát.  
→ Constraint přidat, ale ošetřit chybu v UI: „Tato číselná řada je v workspace již použita."

**Riziko 4 — faktury vytvořené před migrací nemají `company_profile_id`.**  
Tyto faktury nemají v DB `company_profile_id` a jejich čísla leží v rozsahu 1xxx nebo 2xxx. Nový algoritmus je najde správně, protože filtruje podle `number.split('-')[2]` a rozsahu — nezávisí na `company_profile_id`. Bezproblémové.

---

## Shrnutí doporučeného postupu

1. `ALTER TABLE company_profiles ADD COLUMN invoice_number_series integer NOT NULL DEFAULT 1`
2. `ADD CONSTRAINT company_profiles_series_unique UNIQUE (workspace_id, invoice_number_series)`
3. `UPDATE company_profiles SET invoice_number_series = 2 WHERE profile_type = 'sro'`
4. V `generateNumber` nahradit `profile?.profile_type === 'sro' ? 2000 : 1000` za `(profile?.invoice_number_series ?? 1) * 1000`
5. V UI při tvorbě profilu nabídnout pole „Číselná řada (číslo)" s automatickým návrhem `max + 1`
