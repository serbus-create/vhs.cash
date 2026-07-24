-- ─── company_profiles ────────────────────────────────────────────────────────
create table if not exists public.company_profiles (
  id           uuid default uuid_generate_v4() primary key,
  user_id      uuid references auth.users on delete cascade not null,
  name         text not null,
  ico          text,
  dic          text,
  address      text,
  city         text,
  zip          text,
  email        text,
  phone        text,
  bank_account text,
  iban         text,
  swift        text,
  is_default   boolean not null default false,
  created_at   timestamp with time zone default now()
);

alter table public.company_profiles enable row level security;

create policy "Users manage own company profiles"
  on public.company_profiles for all
  using (auth.uid() = user_id);

-- ─── link documents to a company profile ─────────────────────────────────────
alter table public.documents
  add column if not exists company_profile_id uuid references public.company_profiles on delete set null;
