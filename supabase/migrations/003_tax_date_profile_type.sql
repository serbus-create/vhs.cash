-- ─── profile_type on company_profiles ────────────────────────────────────────
alter table public.company_profiles
  add column if not exists profile_type text not null default 'sro'
  check (profile_type in ('sro', 'osvč'));

-- ─── tax_date (DUZP) on documents ────────────────────────────────────────────
alter table public.documents
  add column if not exists tax_date date;
