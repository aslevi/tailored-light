-- Leads from the try-on: texts to Dana and swatch-kit orders.
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('text','swatches')),
  name text,
  phone text,
  email text,
  address text,
  look jsonb,
  status text not null default 'new' check (status in ('new','contacted','ordered','lost'))
);
alter table public.leads enable row level security;
-- The public site may only add leads; nobody can read them with the browser key.
create policy "site can insert leads" on public.leads for insert to anon with check (
  kind in ('text','swatches') and status = 'new' and coalesce(length(phone),0) <= 20
);
