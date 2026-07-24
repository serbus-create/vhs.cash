-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid references auth.users on delete cascade primary key,
  email      text,
  full_name  text,
  created_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"   on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- ─── clients ─────────────────────────────────────────────────────────────────
create table if not exists public.clients (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references auth.users on delete cascade not null,
  name       text not null,
  ico        text,
  dic        text,
  address    text,
  city       text,
  zip        text,
  email      text,
  phone      text,
  created_at timestamp with time zone default now()
);

alter table public.clients enable row level security;

create policy "Users manage own clients" on public.clients for all using (auth.uid() = user_id);

-- ─── documents ───────────────────────────────────────────────────────────────
create table if not exists public.documents (
  id                uuid default uuid_generate_v4() primary key,
  user_id           uuid references auth.users on delete cascade not null,
  client_id         uuid references public.clients on delete set null,
  type              text not null check (type in ('faktura','nabidka','objednavka')),
  number            text not null,
  subject           text,
  issue_date        date not null,
  due_date          date,
  variable_symbol   text,
  status            text not null default 'draft' check (status in ('draft','sent','paid','cancelled')),
  total_without_vat numeric(12,2) default 0,
  total_with_vat    numeric(12,2) default 0,
  created_at        timestamp with time zone default now()
);

alter table public.documents enable row level security;

create policy "Users manage own documents" on public.documents for all using (auth.uid() = user_id);

-- ─── document_items ──────────────────────────────────────────────────────────
create table if not exists public.document_items (
  id          uuid default uuid_generate_v4() primary key,
  document_id uuid references public.documents on delete cascade not null,
  description text not null,
  quantity    numeric(12,3) not null default 1,
  unit_price  numeric(12,2) not null default 0,
  vat_rate    numeric(5,2)  not null default 21
);

alter table public.document_items enable row level security;

create policy "Users manage items via documents"
  on public.document_items for all
  using (
    document_id in (
      select id from public.documents where user_id = auth.uid()
    )
  );

-- ─── auto-create profile on signup ───────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
