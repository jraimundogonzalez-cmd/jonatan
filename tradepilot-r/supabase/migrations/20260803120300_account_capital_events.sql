-- MVP 0.1 — Ledger de capital (implementation/mvp-0.1.md §7, §15 §3.1, SPEC-003 §6.2)
-- Append-only: nunca se edita ni se borra un evento ya insertado.

create table public.account_capital_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  event_type text not null check (event_type in ('initial', 'deposit', 'withdrawal', 'payout', 'reset', 'adjustment')),
  amount numeric(18,4) not null, -- con signo
  occurred_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

alter table public.account_capital_events enable row level security;

create policy "capital_events_owner_rw" on public.account_capital_events
  for all using (
    exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  );

create index capital_events_account_idx on public.account_capital_events(account_id, occurred_at);

-- Append-only: rechaza cualquier UPDATE/DELETE sobre un evento ya insertado.
create or replace function public.reject_capital_event_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'account_capital_events es append-only — no se permite UPDATE/DELETE';
end;
$$;

create trigger reject_capital_event_update
  before update or delete on public.account_capital_events
  for each row execute function public.reject_capital_event_mutation();

-- Trigger de recálculo de capital: current_capital = Σ(amount), peak_capital = máximo histórico.
-- No es "generated always as" porque greatest() sobre el histórico no es una expresión pura de la fila actual.
create or replace function public.recompute_account_capital()
returns trigger language plpgsql set search_path = public as $$
declare
  v_total numeric(18,4);
begin
  select coalesce(sum(amount), 0) into v_total
  from public.account_capital_events
  where account_id = new.account_id;

  update public.accounts
  set current_capital = v_total,
      peak_capital = greatest(peak_capital, v_total)
  where id = new.account_id;

  return new;
end;
$$;

create trigger on_capital_event_recompute
  after insert on public.account_capital_events
  for each row execute function public.recompute_account_capital();
