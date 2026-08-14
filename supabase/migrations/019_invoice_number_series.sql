-- ─── invoice_number_series on company_profiles ───────────────────────────────
-- Každý firemní profil má vlastní číselnou řadu faktur (integer).
-- Série 1 → rozsah 1001–1999, série 2 → 2001–2999, atd.
-- Pořadí kroků je záměrné: constraint přichází až po UPDATE existujících profilů.

-- 1. Přidat sloupec s výchozí hodnotou 1 pro všechny existující profily
alter table public.company_profiles
  add column if not exists invoice_number_series integer not null default 1;

-- 2. Existující s.r.o. profily dostanou sérii 2 (navazuje na rozsah 2001–2999)
update public.company_profiles
  set invoice_number_series = 2
  where profile_type = 'sro';

-- 3. Unique constraint: v rámci workspace nesmí mít dva profily stejnou sérii
alter table public.company_profiles
  add constraint company_profiles_series_unique
  unique (workspace_id, invoice_number_series);
