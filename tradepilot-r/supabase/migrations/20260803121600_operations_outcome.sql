-- BUILD 018 — Operations: el desenlace como hecho de dominio
--
-- BUILD 016B cerró **quién puede escribir**. Verificado sobre Postgres real,
-- no cerró **qué es un desenlace válido**: por la única puerta que quedaba —la
-- RPC, expuesta por PostgREST a cualquier sesión autenticada— se podía cerrar
-- una Operación con `r_final = 99` sin un solo parcial que lo sostuviera,
-- `pnl_amount = 999999` sin relación con `risk_amount × r_final`, y
-- `closure_reason = BREAK_EVEN` con `r_final = 5`.
--
-- ============================================================
-- LA FRONTERA, Y LO QUE NO GARANTIZA
--
-- **PostgreSQL no vuelve a calcular R_final.** Valida la coherencia
-- estructural y económica del desenlace que llega por la única vía de dominio.
--
-- Esto **no demuestra** que el `r_final` recibido sea el que produciría el
-- Quant Engine: un valor coherente pero incorrecto sigue siendo aceptable para
-- la base. La autoridad de la fórmula
--
--     R_final = Σ p_i·RR_i + (100% − Σ p_i)·R_cierre_resto
--
-- es, en exclusiva, `packages/quant-engine`. Aquí no hay ninguna segunda
-- implementación de ella, y no debe haberla nunca.
--
-- La única comprobación económica es una **comparación con tolerancia**:
--
--     abs(pnl_amount − risk_amount × r_final) ≤ 0.0001
--
-- La tolerancia no es cosmética. El kernel decimal redondea con
-- ROUND_HALF_EVEN y `round()` de PostgreSQL redondea half-up: en el empate
-- exacto divergen (`round(2.5,0)` da 3 aquí y 2 allí). La discrepancia máxima
-- por redondeo a 4 decimales es medio ulp (0.00005), así que 0.0001 es
-- estrictamente mayor que cualquier divergencia legítima y ridículamente menor
-- que cualquier falsificación útil. Escrita como igualdad exacta, esta
-- comprobación rechazaría cierres correctos.
--
-- ============================================================
-- POR QUÉ EN TRIGGERS Y NO EN LAS RPC
--
-- Mismo razonamiento que 016B: un trigger alcanza toda vía de escritura —las
-- dos RPC de hoy, cualquiera de mañana, y cualquier rol que salte RLS—;
-- una comprobación dentro de una RPC alcanza una sola. Además evita que
-- `aplicar_cierre_operacion` y `aplicar_edicion_operacion` tengan dos copias
-- de la misma coherencia divergiendo con el tiempo.
--
-- ============================================================
-- FUERA DE ALCANCE
--
-- H6 (`accounts.current_capital` escribible) sigue siendo deuda de Funding
-- Management. Importa aquí más que en ningún otro build: `risk_amount` se
-- congela al nacer como Capital_en_ese_instante × Riesgo%, y 016B lo hizo
-- inmutable — luego **un capital corrupto produce Operaciones con riesgo
-- corrupto de forma permanente e incorregible**. 018 no lo toca.
--
-- Tampoco se toca `UNIQUE (trade_id, sequence)`: ya existe desde BUILD 004
-- (`20260803120500`, líneas 159 y 169). Lo que 018 añade es la prueba directa
-- y la traducción de su `unique_violation` a un error de dominio.

-- ============================================================
-- 1 · Idempotencia del cierre.
--
-- El cierre no tenía clave, a diferencia de `registrar_operacion` y
-- `abrir_operacion_desde_intencion`. Dos envíos simultáneos producían **dos
-- `trade_pnl` sobre la misma Operación**, duplicando el efecto en capital.
--
-- La columna es de desenlace, no de identidad: nace al cerrar. Pero una vez
-- escrita es inmutable, porque reescribirla permitiría replicar el cierre.
-- ============================================================
alter table public.trades
  add column closure_idempotency_key uuid;

comment on column public.trades.closure_idempotency_key is
  'Clave de idempotencia del acto de cierre. Nula mientras la Operación está Abierta. Una repetición exacta con la misma clave devuelve la Operación sin escribir nada; cualquier otra combinación es un segundo cierre y se rechaza.';

-- ============================================================
-- 2 · `time_in_market_sec` — derivado, nunca aportado.
--
-- La columna existía desde BUILD 004 y **nadie la escribía jamás**. No es un
-- dato del usuario: es una resta entre dos timestamps que la Operación ya
-- tiene. Al derivarla en un trigger que reescribe siempre, no puede
-- falsificarse por separado —ninguna RPC la acepta como parámetro y cualquier
-- valor que llegue se descarta— y queda coherente sola en el cierre inicial y
-- en cualquier corrección que mueva `closed_at`. `opened_at` es identidad
-- inmutable desde 016B, así que el único lado móvil es el del cierre.
-- ============================================================
create or replace function public.derive_trade_time_in_market() returns trigger
language plpgsql as $$
begin
  new.time_in_market_sec := case
    when new.closed_at is null then null
    else extract(epoch from (new.closed_at - new.opened_at))::int
  end;
  return new;
end;
$$;

create trigger on_trade_derive_time_in_market
  before insert or update on public.trades
  for each row execute function public.derive_trade_time_in_market();

-- ============================================================
-- 3 · Coherencia del desenlace.
--
-- Se dispara sólo cuando la fila resultante está Cerrada. Todo lo que
-- comprueba tiene fundamento escrito en las validaciones del propio Quant
-- Engine (`packages/quant-engine/src/core/r-final.ts`), y ninguna de ellas es
-- la fórmula.
--
-- **Las reglas de `closure_reason` son exactamente cuatro, y dos de ellas son
-- deliberadamente permisivas.** El modelo de cuatro ramas de
-- `calcularRCierreResto` y los cuatro valores del catálogo **no son
-- biyectivos**, y el corpus no permite cerrar esa brecha sin inventar
-- semántica:
--
--   · **NO se exige `STOP_LOSS` ⟹ sin parciales.** Un parcial a 1R seguido de
--     un stop en el original es un escenario legítimo y frecuente. Exigirlo
--     lo haría irregistrable.
--   · **NO se exige `BREAK_EVEN` ⟹ `r_final = 0`.** La fuente de verdad de
--     R_final sigue siendo Quant Engine, que puede producir otro valor con la
--     evidencia existente.
--
-- Quien lea esto en el futuro: estas dos ausencias no son un olvido. Son una
-- decisión tomada tras demostrar que el corpus no las sostiene.
-- ============================================================
create or replace function public.enforce_trade_outcome_coherence() returns trigger
language plpgsql as $$
declare
  v_k integer;
  v_sum_pct numeric(7,2);
  v_max_rr numeric(8,4);
  v_max_seq integer;
begin
  if new.status is distinct from 'closed' then
    return new;
  end if;

  -- Un desenlace no existe a medias.
  if new.r_final is null or new.pnl_amount is null
     or new.r_max is null or new.closure_reason is null or new.closed_at is null then
    raise exception 'OPERATIONS_ERROR:INCOMPLETE_OUTCOME:una Operación Cerrada exige r_final, pnl_amount, r_max, closure_reason y closed_at';
  end if;

  -- Coherencia económica. Comparación con tolerancia, nunca una segunda
  -- implementación de la fórmula (ver cabecera).
  if abs(new.pnl_amount - new.risk_amount * new.r_final) > 0.0001 then
    raise exception 'OPERATIONS_ERROR:INCOHERENT_PNL:pnl_amount (%) no corresponde a risk_amount (%) × r_final (%)',
      new.pnl_amount, new.risk_amount, new.r_final;
  end if;

  -- El peor caso posible es el stop completo.
  if new.r_final < -1 then
    raise exception 'OPERATIONS_ERROR:OUTCOME_OUT_OF_RANGE:r_final (%) no puede ser menor que -1', new.r_final;
  end if;

  -- No se materializa más R del que el precio llegó a alcanzar.
  if new.r_final > new.r_max then
    raise exception 'OPERATIONS_ERROR:OUTCOME_EXCEEDS_R_MAX:r_final (%) no puede superar r_max (%)', new.r_final, new.r_max;
  end if;

  if new.cierre_manual_rr is not null and new.cierre_manual_rr > new.r_max then
    raise exception 'OPERATIONS_ERROR:OUTCOME_EXCEEDS_R_MAX:cierre_manual_rr (%) no puede superar r_max (%)', new.cierre_manual_rr, new.r_max;
  end if;

  select count(*), coalesce(sum(pct_close), 0), coalesce(max(rr_level), 0), coalesce(max(sequence), 0)
    into v_k, v_sum_pct, v_max_rr, v_max_seq
    from public.trade_partials_executed where trade_id = new.id;

  if v_sum_pct > 100 then
    raise exception 'OPERATIONS_ERROR:PARTIALS_EXCEED_100_PCT:la suma de pct_close de los parciales ejecutados es %', v_sum_pct;
  end if;

  if v_k > 0 then
    -- `r_max` debe sostener toda la evidencia registrada: un parcial ejecutado
    -- a un nivel que el precio nunca alcanzó es un estado imposible.
    if v_max_rr > new.r_max then
      raise exception 'OPERATIONS_ERROR:INCONSISTENT_TRIGGER_STATE:hay un parcial ejecutado a rr_level % pero r_max es %', v_max_rr, new.r_max;
    end if;
    -- Secuencia consecutiva desde 1: con el UNIQUE (trade_id, sequence) de
    -- BUILD 004, que el máximo coincida con el conteo lo garantiza.
    if v_max_seq <> v_k then
      raise exception 'OPERATIONS_ERROR:INVALID_PARTIAL_SEQUENCE:las secuencias de los % parciales ejecutados no son consecutivas desde 1 (máximo %)', v_k, v_max_seq;
    end if;
    if exists (
      select 1 from (
        select rr_level, lag(rr_level) over (order by sequence) as anterior
        from public.trade_partials_executed where trade_id = new.id
      ) t where t.anterior is not null and t.rr_level <= t.anterior
    ) then
      raise exception 'OPERATIONS_ERROR:INVALID_PARTIAL_SEQUENCE:rr_level debe ser estrictamente creciente por sequence';
    end if;
  end if;

  -- Las cuatro reglas de closure_reason. Ni una más.
  if new.closure_reason = 'MANUAL_CLOSE' then
    if new.cierre_manual_rr is null then
      raise exception 'OPERATIONS_ERROR:INCOHERENT_CLOSURE_REASON:MANUAL_CLOSE exige cierre_manual_rr';
    end if;

  elsif new.closure_reason = 'TAKE_PROFIT_FULL' then
    if new.r_max < new.rr_objective then
      raise exception 'OPERATIONS_ERROR:INCOHERENT_CLOSURE_REASON:TAKE_PROFIT_FULL exige r_max (%) >= rr_objective (%)', new.r_max, new.rr_objective;
    end if;
    if new.cierre_manual_rr is not null then
      raise exception 'OPERATIONS_ERROR:INCOHERENT_CLOSURE_REASON:TAKE_PROFIT_FULL no admite cierre_manual_rr — el resto lo determina el objetivo';
    end if;

  elsif new.closure_reason = 'BREAK_EVEN' then
    -- Sin parciales, el motor congelado produciría -1 (rama del stop
    -- original), no 0. Un cierre a 0R sin parciales se representa como
    -- MANUAL_CLOSE con cierre_manual_rr = 0.
    if v_k = 0 then
      raise exception 'OPERATIONS_ERROR:INCOHERENT_CLOSURE_REASON:BREAK_EVEN exige al menos un parcial ejecutado — un cierre a 0R sin parciales se registra como MANUAL_CLOSE con cierre_manual_rr = 0';
    end if;
    if new.cierre_manual_rr is not null then
      raise exception 'OPERATIONS_ERROR:INCOHERENT_CLOSURE_REASON:BREAK_EVEN no admite cierre_manual_rr';
    end if;

  end if;
  -- STOP_LOSS: sin restricción adicional, deliberadamente (ver cabecera).

  return new;
end;
$$;

-- El nombre importa: los triggers del mismo momento se disparan en orden
-- alfabético, y `on_trade_derive_time_in_market` < `on_trade_write_invariants`
-- < `on_trade_write_outcome_coherence`. Primero se deriva, luego se comprueba
-- la identidad (016B/017), y por último la coherencia del desenlace.
create trigger on_trade_write_outcome_coherence
  before insert or update on public.trades
  for each row execute function public.enforce_trade_outcome_coherence();

-- ============================================================
-- 4 · La clave de idempotencia del cierre es inmutable una vez escrita.
--
-- Se extiende la misma función que extendieron 017 y 016B, en vez de añadir un
-- cuarto guardián sobre `trades`. El orden interno se conserva intacto: los
-- hechos heredados de una Intención siguen comprobándose antes que la
-- identidad, para que una Operación vinculada conserve su error específico y
-- el contrato de 017 no cambie.
-- ============================================================
create or replace function public.enforce_trade_invariants() returns trigger
language plpgsql as $$
declare
  v_executed_count integer;
  v_vinculada boolean;
begin
  if new.account_id <> old.account_id then
    raise exception 'OPERATIONS_ERROR:IMMUTABLE_ACCOUNT_ID:account_id no puede editarse — registra una Operación distinta';
  end if;

  -- BUILD 017: los hechos que la Operación heredó de su Intención.
  select exists (
    select 1 from public.management_intent_destinations d
    where d.trade_id = old.id and d.state = 'materialized'
  ) into v_vinculada;

  if v_vinculada then
    if new.management_plan_id is distinct from old.management_plan_id
       or new.rr_objective    is distinct from old.rr_objective
       or new.be_trigger      is distinct from old.be_trigger
       or new.risk_pct        is distinct from old.risk_pct
       or new.side            is distinct from old.side
       or new.instrument_key  is distinct from old.instrument_key
       or new.symbol          is distinct from old.symbol then
      raise exception 'OPERATIONS_ERROR:IMMUTABLE_INHERITED_FACT:una Operación nacida de una Intención no puede contradecir la decisión que la originó — el desenlace de su destino es terminal y no podría reflejar la corrección';
    end if;
  end if;

  -- BUILD 016B: la identidad de CUALQUIER Operación, vinculada o no.
  if new.user_id            is distinct from old.user_id
     or new.symbol          is distinct from old.symbol
     or new.instrument_key  is distinct from old.instrument_key
     or new.side            is distinct from old.side
     or new.opened_at       is distinct from old.opened_at
     or new.risk_pct        is distinct from old.risk_pct
     or new.risk_amount     is distinct from old.risk_amount
     or new.management_plan_id is distinct from old.management_plan_id
     or new.rr_objective    is distinct from old.rr_objective
     or new.be_trigger      is distinct from old.be_trigger
     or new.source          is distinct from old.source
     or new.external_ref    is distinct from old.external_ref
     or new.idempotency_key is distinct from old.idempotency_key
     or new.created_at      is distinct from old.created_at then
    raise exception 'OPERATIONS_ERROR:IMMUTABLE_IDENTITY_FACT:la identidad de una Operación se fija al nacer y no se corrige — el desenlace sí, la identidad nunca';
  end if;

  -- BUILD 018: reescribir la clave del cierre permitiría replicarlo.
  if old.closure_idempotency_key is not null
     and new.closure_idempotency_key is distinct from old.closure_idempotency_key then
    raise exception 'OPERATIONS_ERROR:IMMUTABLE_CLOSURE_KEY:la clave de idempotencia del cierre no se reescribe';
  end if;

  if old.status = new.status then
    return new;
  end if;

  if old.status = 'cancelled' then
    raise exception 'OPERATIONS_ERROR:INVALID_STATE_TRANSITION:%:%:Cancelada es un estado terminal', old.status, new.status;
  end if;

  if old.status = 'open' and new.status = 'closed' then
    return new; -- cerrarOperacion
  end if;

  if old.status = 'open' and new.status = 'cancelled' then
    select count(*) into v_executed_count from public.trade_partials_executed where trade_id = new.id;
    if v_executed_count > 0 then
      raise exception 'OPERATIONS_ERROR:INVALID_STATE_TRANSITION:%:%:cancelación simple solo permitida sin parciales ejecutados (% ejecutados)', old.status, new.status, v_executed_count;
    end if;
    return new; -- cancelación simple
  end if;

  if old.status = 'closed' and new.status = 'cancelled' then
    return new; -- cancelación "fantasma", con reversión de capital gestionada aparte
  end if;

  raise exception 'OPERATIONS_ERROR:INVALID_STATE_TRANSITION:%:%:transición no permitida', old.status, new.status;
end;
$$;
