-- MVP 0.1 — Funding Management: Cuentas (implementation/mvp-0.1.md §7)
-- Esquema ya corregido por SPEC-003 (sin account_rules).
--
-- Nota: la invariante "cuenta personal nunca tiene profit split" NO se declara
-- como CHECK — Postgres no permite sub-SELECT dentro de un CHECK constraint
-- (hallazgo de Challenge Mode ya documentado en mvp-0.1.md §14.2). Se aplica
-- como trigger BEFORE INSERT/UPDATE más abajo (validate_account_profit_split).

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prop_firm_id uuid not null references public.prop_firms(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  currency char(3) not null default 'USD',

  initial_capital numeric(18,4) not null check (initial_capital > 0),
  current_capital numeric(18,4) not null,  -- derivado, nunca editado directo (§7.1) — mantenido por trigger
  peak_capital numeric(18,4) not null,     -- derivado, nunca editado directo — greatest() no es expresión pura de fila, no puede ser "generated always as"

  status text not null default 'live'
    check (status in ('challenge', 'funded', 'live', 'paused', 'terminated', 'merged')),

  profit_split_pct numeric(5,2)
    check (profit_split_pct is null or (profit_split_pct >= 0 and profit_split_pct <= 100)),
  rule_profile_snapshot_id uuid, -- nullable, sin uso hasta Rule Engine (Capa 3)

  created_at timestamptz not null default now()
);

alter table public.accounts enable row level security;

create policy "accounts_owner_rw" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index accounts_user_idx on public.accounts(user_id);
create index accounts_prop_firm_idx on public.accounts(prop_firm_id);

-- Invariante: cuenta personal nunca tiene profit split (18 §3, is_personal excluye profit_split).
-- Trigger, no CHECK: Postgres no permite sub-SELECT en un CHECK constraint.
create or replace function public.validate_account_profit_split()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.profit_split_pct is not null and exists (
    select 1 from public.prop_firms pf where pf.id = new.prop_firm_id and pf.is_personal = true
  ) then
    raise exception 'PERSONAL_ACCOUNT_CANNOT_USE_PROFIT_SPLIT';
  end if;
  return new;
end;
$$;

create trigger validate_profit_split
  before insert or update on public.accounts
  for each row execute function public.validate_account_profit_split();
