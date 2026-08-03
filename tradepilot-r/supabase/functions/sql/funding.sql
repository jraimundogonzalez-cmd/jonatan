-- MVP 0.1 — API pública de Funding Management (implementation/mvp-0.1.md §8)
--
-- Convención de errores: toda función de negocio que falla por una regla de
-- dominio (no una constraint de esquema no catalogada) lanza una excepción
-- con el formato "FUNDING_ERROR:<CODE>:<detalle>" — apps/web/lib/api/funding.ts
-- la parsea a un `FundingError` tipado. Un error de Postgres que no siga este
-- formato (constraint violation no prevista, error de RLS) se traduce en el
-- cliente a `{ code: "UNKNOWN", detail }` — nunca se descarta en silencio
-- (Trust Layer, SPEC-014: nunca ocultar un error propio).
--
-- Hallazgo de seguridad (Challenge Mode sobre el código, no solo sobre el
-- diseño): una FOREIGN KEY en Postgres valida existencia contra la tabla
-- completa, sin aplicar RLS — sin una comprobación explícita de propiedad,
-- un usuario podría crear una Cuenta referenciando el prop_firm_id de OTRO
-- usuario (bypass de aislamiento multi-tenant vía FK, no vía RLS). Por eso
-- `crear_cuenta` valida explícitamente `user_id = auth.uid()` sobre la
-- Empresa antes de insertar, y no confía en que la FK sea suficiente.

-- ============================================================
-- crear_empresa
-- ============================================================
create or replace function public.crear_empresa(
  p_name text,
  p_is_personal boolean default false
)
returns public.prop_firms
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.prop_firms;
begin
  if trim(coalesce(p_name, '')) = '' then
    raise exception 'FUNDING_ERROR:VALIDATION_ERROR:name:el nombre de la Empresa no puede estar vacío';
  end if;

  insert into public.prop_firms (user_id, name, is_personal)
  values (auth.uid(), p_name, p_is_personal)
  returning * into v_row;

  return v_row;
end;
$$;

-- ============================================================
-- crear_cuenta
-- Atómico: INSERT accounts + INSERT account_capital_events(event_type='initial')
-- en la misma transacción de función (implementation/mvp-0.1.md §9).
-- ============================================================
create or replace function public.crear_cuenta(
  p_prop_firm_id uuid,
  p_name text,
  p_initial_capital text,
  p_currency text default 'USD',
  p_profit_split_pct text default null
)
returns public.accounts
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_prop_firm_exists boolean;
  v_initial_capital numeric(18,4);
  v_profit_split numeric(5,2);
  v_account public.accounts;
begin
  select exists(
    select 1 from public.prop_firms where id = p_prop_firm_id and user_id = auth.uid()
  ) into v_prop_firm_exists;

  if not v_prop_firm_exists then
    raise exception 'FUNDING_ERROR:PROP_FIRM_NOT_FOUND:no existe una Empresa % del usuario actual', p_prop_firm_id;
  end if;

  if trim(coalesce(p_name, '')) = '' then
    raise exception 'FUNDING_ERROR:VALIDATION_ERROR:name:el nombre de la Cuenta no puede estar vacío';
  end if;

  begin
    v_initial_capital := p_initial_capital::numeric(18,4);
  exception when others then
    raise exception 'FUNDING_ERROR:INVALID_INITIAL_CAPITAL:"%" no es un número válido', p_initial_capital;
  end;

  if v_initial_capital <= 0 then
    raise exception 'FUNDING_ERROR:INVALID_INITIAL_CAPITAL:initial_capital debe ser > 0 (recibido %)', p_initial_capital;
  end if;

  if p_profit_split_pct is not null then
    begin
      v_profit_split := p_profit_split_pct::numeric(5,2);
    exception when others then
      raise exception 'FUNDING_ERROR:VALIDATION_ERROR:profit_split_pct:"%" no es un número válido', p_profit_split_pct;
    end;
  end if;

  begin
    insert into public.accounts (
      user_id, prop_firm_id, name, currency,
      initial_capital, current_capital, peak_capital, profit_split_pct
    ) values (
      auth.uid(), p_prop_firm_id, p_name, upper(p_currency),
      v_initial_capital, v_initial_capital, v_initial_capital, v_profit_split
    )
    returning * into v_account;
  exception
    when others then
      if sqlerrm = 'PERSONAL_ACCOUNT_CANNOT_USE_PROFIT_SPLIT' then
        raise exception 'FUNDING_ERROR:PERSONAL_ACCOUNT_CANNOT_USE_PROFIT_SPLIT:%', sqlerrm;
      end if;
      raise; -- constraint no catalogada: se propaga, el cliente la envuelve en UNKNOWN
  end;

  insert into public.account_capital_events (account_id, event_type, amount, note)
  values (v_account.id, 'initial', v_initial_capital, 'Capital inicial de la Cuenta');
  -- on_capital_event_recompute vuelve a fijar current_capital/peak_capital al mismo valor (idempotente).

  select * into v_account from public.accounts where id = v_account.id;
  return v_account;
end;
$$;

-- ============================================================
-- listar_empresas
--
-- Hallazgo de implementación: mvp-0.1.md §8 no incluía ninguna función de
-- lectura de Empresas — sin ella, el enrutado de onboarding (¿el usuario ya
-- tiene una Empresa?) y el formulario de Nueva Cuenta (¿a qué Empresa la
-- asocio?) no tenían forma de leerlas sin una consulta directa desde el
-- componente, justo lo que §6.3 prohíbe. Se añade siguiendo la misma
-- convención que el resto del catálogo.
-- ============================================================
create or replace function public.listar_empresas()
returns setof public.prop_firms
language sql
security invoker
set search_path = public
as $$
  select * from public.prop_firms
  where user_id = auth.uid()
  order by created_at asc;
$$;

-- ============================================================
-- listar_cuentas
-- ============================================================
create or replace function public.listar_cuentas()
returns setof public.accounts
language sql
security invoker
set search_path = public
as $$
  select * from public.accounts
  where user_id = auth.uid()
  order by created_at desc;
$$;

-- ============================================================
-- obtener_cuenta
-- ============================================================
create or replace function public.obtener_cuenta(p_id uuid)
returns public.accounts
language sql
security invoker
set search_path = public
as $$
  select * from public.accounts
  where id = p_id and user_id = auth.uid();
$$;

-- ============================================================
-- registrar_evento_capital
--
-- 'initial' está reservado a crear_cuenta (se dispara exactamente una vez,
-- atado a la creación de la Cuenta) — hallazgo de implementación: sin esta
-- restricción, un usuario podría llamar a esta función con
-- event_type='initial' y duplicar el evento fundacional de la Cuenta.
-- `amount` puede ser negativo (withdrawal, adjustment a la baja) — a
-- diferencia de `initial_capital` en crear_cuenta, aquí solo se valida que
-- sea un número parseable, nunca su signo.
-- ============================================================
create or replace function public.registrar_evento_capital(
  p_account_id uuid,
  p_event_type text,
  p_amount text,
  p_note text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owns boolean;
  v_amount numeric(18,4);
begin
  select exists(
    select 1 from public.accounts where id = p_account_id and user_id = auth.uid()
  ) into v_owns;

  if not v_owns then
    raise exception 'FUNDING_ERROR:ACCOUNT_NOT_FOUND:no existe una Cuenta % del usuario actual', p_account_id;
  end if;

  if p_event_type = 'initial' then
    raise exception 'FUNDING_ERROR:VALIDATION_ERROR:event_type:"initial" solo puede crearse a través de crear_cuenta';
  end if;

  begin
    v_amount := p_amount::numeric(18,4);
  exception when others then
    raise exception 'FUNDING_ERROR:INVALID_AMOUNT:"%" no es un número válido', p_amount;
  end;

  insert into public.account_capital_events (account_id, event_type, amount, note)
  values (p_account_id, p_event_type, v_amount, p_note);
end;
$$;

-- ============================================================
-- listar_eventos_capital
--
-- Hallazgo de implementación: mvp-0.1.md §8 no incluía ninguna función de
-- lectura del ledger — sin ella, la pantalla de Detalle de Cuenta (que
-- necesita mostrar el historial de eventos) no tenía forma de leerlo sin
-- una consulta directa desde el componente, justo lo que §6.3 prohíbe.
-- Se añade siguiendo la misma convención que el resto del catálogo (RPC,
-- nunca `.from()` directo desde el cliente).
-- ============================================================
create or replace function public.listar_eventos_capital(p_account_id uuid)
returns setof public.account_capital_events
language sql
security invoker
set search_path = public
as $$
  select e.* from public.account_capital_events e
  join public.accounts a on a.id = e.account_id
  where e.account_id = p_account_id and a.user_id = auth.uid()
  order by e.occurred_at desc;
$$;
