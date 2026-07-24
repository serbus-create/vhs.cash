alter table public.company_profiles
  add column if not exists vat_payer boolean not null default true;
