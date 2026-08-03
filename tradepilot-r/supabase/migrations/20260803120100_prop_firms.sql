-- MVP 0.1 — Funding Management: Empresas (implementation/mvp-0.1.md §7)

create table public.prop_firms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  is_personal boolean not null default false,
  color text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.prop_firms enable row level security;

create policy "prop_firms_owner_rw" on public.prop_firms
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index prop_firms_user_idx on public.prop_firms(user_id);
