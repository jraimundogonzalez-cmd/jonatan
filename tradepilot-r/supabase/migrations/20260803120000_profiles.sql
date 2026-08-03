-- MVP 0.1 — Identity (implementation/mvp-0.1.md §7)
-- profiles: una fila por usuario de auth.users, creada automáticamente por trigger.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  default_risk_pct numeric(5,2) not null default 1.00,
  optimizer_lambda numeric(4,2) not null default 0.25, -- sin uso hasta Optimizer (Capa 6), columna barata, no se difiere
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_owner_rw" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
