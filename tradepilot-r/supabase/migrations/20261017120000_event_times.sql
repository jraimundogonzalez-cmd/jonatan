-- ============================================================
-- BUILD 024 — Fechas y horas de los hechos, separadas de cuándo se registran
--
-- Hasta aquí la interfaz enviaba siempre `now()` como hora de entrada, de cada
-- parcial y del cierre: registrar una operación después de hacerla dejaba la
-- hora equivocada. Ahora el trader declara la hora real del hecho. Para que esa
-- hora no se confunda con el momento en que se tecleó, cada hecho conserva
-- también su hora de REGISTRO:
--
--   hecho                     hora del hecho      hora de registro
--   ----------------------    ----------------    ----------------------------
--   apertura                  trades.opened_at    trades.created_at (ya existía)
--   parcial ejecutado         executed_at         recorded_at        (nueva)
--   cierre                    trades.closed_at    closure_recorded_at (nueva)
--
-- LO QUE ESTE BUILD NO CAMBIA (DEC-013 sigue abierta):
--   · `risk_amount` se sigue calculando UNA vez, en `crear_operacion_nucleo`,
--     con el capital vigente en el momento de REGISTRAR. Una hora de entrada
--     pasada no busca el capital de entonces ni recalcula nada.
--   · Nada de lo que hay aquí lee ni escribe `risk_pct`, `risk_amount`,
--     `r_final`, `pnl_amount` ni el capital de la Cuenta.
--
-- Las filas anteriores a este BUILD quedan con hora de registro NULA: no se
-- sabe cuándo se registraron, y un valor inventado sería un hecho falso.
-- ============================================================

-- ── 1 · Hora de registro del parcial ────────────────────────────────────────
-- ADD COLUMN sin default deja NULL en lo existente; el default se fija después
-- para que sólo las filas nuevas reciban `now()`. ALTER no dispara el trigger
-- de inmutabilidad de la evidencia (es DDL, no UPDATE).
alter table public.trade_partials_executed
  add column recorded_at timestamptz;
alter table public.trade_partials_executed
  alter column recorded_at set default now();

comment on column public.trade_partials_executed.recorded_at is
  'Cuándo se REGISTRÓ el parcial en TradePilot. Distinto de executed_at, que es cuándo ocurrió en el mercado. NULL en parciales anteriores a BUILD 024.';

-- ── 2 · Hora de registro del cierre ─────────────────────────────────────────
alter table public.trades
  add column closure_recorded_at timestamptz;

comment on column public.trades.closure_recorded_at is
  'Cuándo se REGISTRÓ el cierre en TradePilot (lo fija un trigger, nunca el cliente). Distinto de closed_at, que es cuándo se cerró en el mercado. Una corrección posterior del desenlace no lo mueve. NULL en cierres anteriores a BUILD 024.';

create or replace function public.trades_derive_closure_recorded_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    -- Ninguna vía de alta crea una Operación ya cerrada; si alguna llegara a
    -- hacerlo, el registro del cierre es el de su alta.
    new.closure_recorded_at := case when new.status = 'closed' then now() else null end;
    return new;
  end if;

  if old.closure_recorded_at is not null then
    -- Se fija una vez y no se reescribe: corregir el desenlace no cambia
    -- cuándo se registró el cierre original.
    new.closure_recorded_at := old.closure_recorded_at;
  elsif old.status = 'open' and new.status = 'closed' then
    new.closure_recorded_at := now();
  else
    new.closure_recorded_at := old.closure_recorded_at;
  end if;
  return new;
end;
$$;

-- `on_trade_derive_c…` < `on_trade_derive_t…`: los triggers del mismo momento
-- se disparan en orden alfabético; derivar va antes de comprobar.
create trigger on_trade_derive_closure_recorded_at
  before insert or update on public.trades
  for each row execute function public.trades_derive_closure_recorded_at();

-- ── 3 · Orden cronológico de los hechos ─────────────────────────────────────
-- Tolerancia de 5 minutos hacia el futuro: absorbe la diferencia de reloj entre
-- el navegador y el servidor, nunca un hecho que todavía no ha ocurrido.

create or replace function public.trades_enforce_chronology()
returns trigger language plpgsql set search_path = public as $$
declare
  v_ultimo_parcial timestamptz;
begin
  if tg_op = 'INSERT' and new.opened_at > now() + interval '5 minutes' then
    raise exception 'OPERATIONS_ERROR:EVENT_IN_FUTURE:opened_at (%) es posterior al momento actual', new.opened_at;
  end if;

  if new.closed_at is not null
     and (tg_op = 'INSERT' or new.closed_at is distinct from old.closed_at) then
    if new.closed_at < new.opened_at then
      raise exception 'OPERATIONS_ERROR:CHRONOLOGY_VIOLATION:closed_at (%) es anterior a opened_at (%)', new.closed_at, new.opened_at;
    end if;
    if new.closed_at > now() + interval '5 minutes' then
      raise exception 'OPERATIONS_ERROR:EVENT_IN_FUTURE:closed_at (%) es posterior al momento actual', new.closed_at;
    end if;
    select max(executed_at) into v_ultimo_parcial
      from public.trade_partials_executed where trade_id = new.id;
    if v_ultimo_parcial is not null and new.closed_at < v_ultimo_parcial then
      raise exception 'OPERATIONS_ERROR:CHRONOLOGY_VIOLATION:closed_at (%) es anterior al último parcial ejecutado (%)', new.closed_at, v_ultimo_parcial;
    end if;
  end if;

  return new;
end;
$$;

-- `on_trade_write_c…` se dispara antes que `…_invariants` y `…_outcome_coherence`.
create trigger on_trade_write_chronology
  before insert or update on public.trades
  for each row execute function public.trades_enforce_chronology();

create or replace function public.trade_partials_enforce_chronology()
returns trigger language plpgsql set search_path = public as $$
declare
  v_opened_at timestamptz;
  v_anterior timestamptz;
begin
  select opened_at into v_opened_at from public.trades where id = new.trade_id;

  if v_opened_at is not null and new.executed_at < v_opened_at then
    raise exception 'OPERATIONS_ERROR:CHRONOLOGY_VIOLATION:el parcial % (%) es anterior a la apertura (%)', new.sequence, new.executed_at, v_opened_at;
  end if;

  if new.executed_at > now() + interval '5 minutes' then
    raise exception 'OPERATIONS_ERROR:EVENT_IN_FUTURE:el parcial % (%) es posterior al momento actual', new.sequence, new.executed_at;
  end if;

  select max(executed_at) into v_anterior
    from public.trade_partials_executed
   where trade_id = new.trade_id and sequence < new.sequence;
  if v_anterior is not null and new.executed_at < v_anterior then
    raise exception 'OPERATIONS_ERROR:CHRONOLOGY_VIOLATION:el parcial % (%) es anterior al parcial previo (%)', new.sequence, new.executed_at, v_anterior;
  end if;

  return new;
end;
$$;

create trigger on_partial_executed_insert_chronology
  before insert on public.trade_partials_executed
  for each row execute function public.trade_partials_enforce_chronology();
