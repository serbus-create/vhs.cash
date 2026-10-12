-- Diagnostika (jen čtení) pro funkci "podmínky spolupráce k objednávce".
-- Spouštěj po jednotlivých dotazech v Supabase SQL editoru a výsledky pošli.

-- (1) CHECK constrainty na documents a clients
SELECT conrelid::regclass AS tabulka,
       conname            AS nazev,
       pg_get_constraintdef(oid) AS definice
FROM pg_constraint
WHERE contype = 'c'
  AND conrelid IN ('public.documents'::regclass, 'public.clients'::regclass)
ORDER BY 1, 2;

-- (2) Sloupce documents a clients
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('documents', 'clients')
ORDER BY table_name, ordinal_position;

-- (3) RLS politiky na documents a clients
SELECT tablename, policyname, cmd, roles, qual AS using_expr, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('documents', 'clients')
ORDER BY tablename, policyname;

-- (4) Existuje už tabulka terms_templates?
SELECT to_regclass('public.terms_templates') AS terms_templates_existuje;
