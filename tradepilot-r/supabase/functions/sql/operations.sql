-- BUILD 004 — API pública de Operations Engine + Management Plans
-- (SPEC-002, 21.5 §3.4, 21 §3, implementation/mvp-0.1.md §6.3).
--
-- Convención de errores: "OPERATIONS_ERROR:<CODE>:<detalle>", misma
-- disciplina que funding.sql ("FUNDING_ERROR:...") — un cliente que no
-- reconoce el formato lo trata como UNKNOWN, nunca lo descarta en silencio.
--
-- Hallazgo de seguridad reutilizado de funding.sql: una FOREIGN KEY valida
-- existencia contra la tabla completa, sin aplicar RLS — toda función de
-- aquí que referencia una entidad de otro usuario (una Cuenta, un Plan
-- guardado) comprueba `user_id = auth.uid()` explícitamente antes de usarla,
-- nunca confía en que la FK sea suficiente (mismo bypass de aislamiento que
-- crear_cuenta ya cerró en BUILD 001).
--
-- Ninguna función de este archivo calcula R_final/pnl_amount — eso solo
-- ocurre en @tradepilot/risk-engine (TypeScript), vía cerrar_operacion/
-- editar_operacion desde packages/operations-engine. Todo lo de aquí es
-- capital-neutral y estructural: abrir, registrar parciales, cancelar sin
-- reversión, y el catálogo de lectura (SPEC-002 §1.4 punto 1).

-- ============================================================
-- validate_planned_partials — validación compartida de la "forma" de un
-- array de parciales planificados (SPEC-001 §3.4 / SPEC-002 §2.4: sequence
-- única, RR_1 < RR_2 < ... < RR_n, Σ p_i ≤ 100). Un único punto de
-- validación reutilizado por crear_plan_gestion, editar_plan_gestion y
-- registrar_operacion — evita tres copias de la misma regla divergiendo con
-- el tiempo.
-- ============================================================
create or replace function public.validate_planned_partials(p_partials jsonb)
returns void
language plpgsql
as $$
declare
  v_count integer;
  v_total_pct numeric(7,2);
  v_prev_rr numeric(8,4) := null;
  v_seen_sequences smallint[] := '{}';
  r record;
begin
  select jsonb_array_length(p_partials) into v_count;
  if v_count > 5 then
    raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:partials:máximo 5 parciales planificados (recibidos %)', v_count;
  end if;

  select coalesce(sum((elem->>'pct_close')::numeric), 0) into v_total_pct
  from jsonb_array_elements(p_partials) elem;
  if v_total_pct > 100 then
    raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:partials:la suma de pct_close no puede superar 100 (recibido %)', v_total_pct;
  end if;

  for r in
    select (elem->>'sequence')::smallint as sequence, (elem->>'rr_level')::numeric(8,4) as rr_level
    from jsonb_array_elements(p_partials) elem
    order by (elem->>'sequence')::smallint
  loop
    if r.sequence < 1 or r.sequence > 5 then
      raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:partials:sequence % fuera de rango (1..5)', r.sequence;
    end if;
    if r.sequence = any(v_seen_sequences) then
      raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:partials:sequence % duplicada', r.sequence;
    end if;
    v_seen_sequences := array_append(v_seen_sequences, r.sequence);

    if v_prev_rr is not null and r.rr_level <= v_prev_rr then
      raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:partials:rr_level debe ser estrictamente creciente por sequence (% después de %)', r.rr_level, v_prev_rr;
    end if;
    v_prev_rr := r.rr_level;
  end loop;
end;
$$;

-- ============================================================
-- crear_plan_gestion
-- ============================================================
create or replace function public.crear_plan_gestion(
  p_name text default null,
  p_rr_objective text default null,
  p_be_trigger text default 'NONE',
  p_condiciones_ejecucion text default null,
  p_etiqueta_riesgo text default null,
  p_lambda_risk_aversion text default null,
  p_partials jsonb default '[]'::jsonb
)
returns public.management_plans
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_rr_objective numeric(8,4);
  v_lambda numeric(6,4);
  v_plan public.management_plans;
  r record;
begin
  begin
    v_rr_objective := p_rr_objective::numeric(8,4);
  exception when others then
    raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:rr_objective:"%" no es un número válido', p_rr_objective;
  end;
  if v_rr_objective <= 0 then
    raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:rr_objective:debe ser > 0 (recibido %)', p_rr_objective;
  end if;

  if p_be_trigger not in ('NONE','AFTER_NTH_PARTIAL','CUSTOM_LEVEL') then
    raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:be_trigger:"%" no es un valor reconocido', p_be_trigger;
  end if;

  if p_lambda_risk_aversion is not null then
    begin
      v_lambda := p_lambda_risk_aversion::numeric(6,4);
    exception when others then
      raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:lambda_risk_aversion:"%" no es un número válido', p_lambda_risk_aversion;
    end;
  end if;

  perform public.validate_planned_partials(p_partials);

  insert into public.management_plans (
    user_id, name, rr_objective, be_trigger, condiciones_ejecucion, etiqueta_riesgo, lambda_risk_aversion
  ) values (
    auth.uid(), nullif(trim(coalesce(p_name, '')), ''), v_rr_objective, p_be_trigger,
    p_condiciones_ejecucion, p_etiqueta_riesgo, v_lambda
  )
  returning * into v_plan;

  for r in select * from jsonb_to_recordset(p_partials) as x(sequence smallint, rr_level text, pct_close text)
  loop
    insert into public.management_plan_partials (plan_id, sequence, rr_level, pct_close)
    values (v_plan.id, r.sequence, r.rr_level::numeric(8,4), r.pct_close::numeric(5,2));
  end loop;

  return v_plan;
end;
$$;

-- ============================================================
-- editar_plan_gestion — reemplaza los parciales completos (delete+insert),
-- nunca afecta a Operaciones ya registradas (patrón Snapshot, regla 13):
-- estas son las próximas Operaciones que elijan este Plan las que ven el
-- cambio, nunca las que ya lo usaron.
-- ============================================================
create or replace function public.editar_plan_gestion(
  p_id uuid,
  p_name text default null,
  p_rr_objective text default null,
  p_be_trigger text default 'NONE',
  p_condiciones_ejecucion text default null,
  p_etiqueta_riesgo text default null,
  p_lambda_risk_aversion text default null,
  p_partials jsonb default '[]'::jsonb
)
returns public.management_plans
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_rr_objective numeric(8,4);
  v_lambda numeric(6,4);
  v_plan public.management_plans;
  r record;
begin
  select * into v_plan from public.management_plans where id = p_id and user_id = auth.uid();
  if not found then
    raise exception 'OPERATIONS_ERROR:PLAN_NOT_FOUND:no existe un Plan de Gestión % del usuario actual', p_id;
  end if;
  if v_plan.status = 'archived' then
    raise exception 'OPERATIONS_ERROR:PLAN_ARCHIVED:un Plan archivado no puede editarse';
  end if;

  begin
    v_rr_objective := p_rr_objective::numeric(8,4);
  exception when others then
    raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:rr_objective:"%" no es un número válido', p_rr_objective;
  end;
  if v_rr_objective <= 0 then
    raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:rr_objective:debe ser > 0 (recibido %)', p_rr_objective;
  end if;

  if p_be_trigger not in ('NONE','AFTER_NTH_PARTIAL','CUSTOM_LEVEL') then
    raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:be_trigger:"%" no es un valor reconocido', p_be_trigger;
  end if;

  if p_lambda_risk_aversion is not null then
    begin
      v_lambda := p_lambda_risk_aversion::numeric(6,4);
    exception when others then
      raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:lambda_risk_aversion:"%" no es un número válido', p_lambda_risk_aversion;
    end;
  end if;

  perform public.validate_planned_partials(p_partials);

  update public.management_plans set
    name = nullif(trim(coalesce(p_name, '')), ''),
    rr_objective = v_rr_objective,
    be_trigger = p_be_trigger,
    condiciones_ejecucion = p_condiciones_ejecucion,
    etiqueta_riesgo = p_etiqueta_riesgo,
    lambda_risk_aversion = v_lambda,
    updated_at = now()
  where id = p_id
  returning * into v_plan;

  delete from public.management_plan_partials where plan_id = p_id;
  for r in select * from jsonb_to_recordset(p_partials) as x(sequence smallint, rr_level text, pct_close text)
  loop
    insert into public.management_plan_partials (plan_id, sequence, rr_level, pct_close)
    values (p_id, r.sequence, r.rr_level::numeric(8,4), r.pct_close::numeric(5,2));
  end loop;

  return v_plan;
end;
$$;

-- ============================================================
-- archivar_plan_gestion — nunca se borra un Plan (15 §3.4, nunca se borra un
-- registro financiero/histórico) ni siquiera si nunca lo usó ninguna
-- Operación; archivar es la única forma de "retirarlo" del catálogo activo.
-- ============================================================
create or replace function public.archivar_plan_gestion(p_id uuid)
returns public.management_plans
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_plan public.management_plans;
begin
  update public.management_plans
  set status = 'archived', updated_at = now()
  where id = p_id and user_id = auth.uid()
  returning * into v_plan;

  if not found then
    raise exception 'OPERATIONS_ERROR:PLAN_NOT_FOUND:no existe un Plan de Gestión % del usuario actual', p_id;
  end if;

  return v_plan;
end;
$$;

-- ============================================================
-- listar_planes_gestion — solo los reutilizables (21.5 §3.4: "un Plan
-- anónimo no aparece como reutilizable en la lista de planes guardados").
-- ============================================================
create or replace function public.listar_planes_gestion()
returns setof public.management_plans
language sql
security invoker
set search_path = public
as $$
  select * from public.management_plans
  where user_id = auth.uid() and status = 'active' and name is not null
  order by updated_at desc;
$$;

create or replace function public.obtener_plan_gestion(p_id uuid)
returns public.management_plans
language sql
security invoker
set search_path = public
as $$
  select * from public.management_plans
  where id = p_id and user_id = auth.uid();
$$;

create or replace function public.listar_parciales_plan_gestion(p_plan_id uuid)
returns setof public.management_plan_partials
language sql
security invoker
set search_path = public
as $$
  select mpp.* from public.management_plan_partials mpp
  join public.management_plans mp on mp.id = mpp.plan_id
  where mpp.plan_id = p_plan_id and mp.user_id = auth.uid()
  order by mpp.sequence asc;
$$;

-- ============================================================
-- registrar_operacion — capital-neutral (abrir una posición no mueve
-- capital, SPEC-002 §2.3). Resuelve el Plan de Gestión: reutiliza uno
-- guardado (p_management_plan_id) o congela uno anónimo nuevo con los
-- campos recibidos (I11: "toda Operación ejecuta exactamente un Plan, con o
-- sin nombre — nunca cero"). Idempotente: un reintento con la misma
-- (account_id, idempotency_key) devuelve la fila ya creada, nunca duplica.
--
-- Nota de concurrencia aceptada: si dos peticiones con la MISMA
-- idempotency_key llegan genuinamente en paralelo (no en reintento
-- secuencial), ambas pueden pasar la comprobación inicial antes de que
-- cualquiera confirme — el índice único sobre trades resuelve la carrera de
-- todos modos (una de las dos gana, la otra cae en el `exception` de abajo y
-- devuelve la fila ganadora), pero si el camino era el de Plan anónimo,
-- la transacción perdedora puede dejar un `management_plans` anónimo
-- huérfano ya comprometido (nunca aparece en listar_planes_gestion, no
-- afecta a ningún cálculo ni a capital) — deuda aceptada, de bajo impacto,
-- documentada aquí en vez de una reconciliación compensatoria que ninguna
-- demanda real justifica todavía.
-- ============================================================
-- ============================================================
-- crear_operacion_nucleo — BUILD 017.
--
-- **Única implementación del nacimiento de una Operación.** Extraída de
-- `registrar_operacion` sin cambiar una coma de su comportamiento observable,
-- para que la ruta desde una Intención (`abrir_operacion_desde_intencion`,
-- management_intent.sql) no tenga que duplicar el `INSERT` ni —sobre todo— la
-- fórmula de `risk_amount`. Dos fórmulas iguales hoy son dos fórmulas
-- distintas dentro de un año.
--
-- **No resuelve nada: recibe un contexto ya resuelto.** No consulta
-- `management_plans`, no valida `side` ni `rr_objective`, no decide parciales.
-- Quien llama decide de dónde salen esos valores —del Plan vivo, de un Plan
-- anónimo recién creado, o del `frozen_plan` de un destino de Intención— y el
-- núcleo se limita a calcular el riesgo en euros e insertar. Es lo que permite
-- que la ruta de Intención sea, estructuralmente, incapaz de leer el Plan vivo:
-- nunca le pasa un identificador que el núcleo pueda seguir.
--
-- Comprueba la propiedad de la Cuenta por su cuenta, aunque todos sus
-- llamantes ya lo hayan hecho: bajo `SECURITY DEFINER` no queda ninguna otra
-- protección, y una función que sólo es segura si se la llama bien no es
-- segura.
-- ============================================================
create or replace function public.crear_operacion_nucleo(
  p_account_id uuid,
  p_symbol text,
  p_instrument_key text,
  p_side text,
  p_opened_at timestamptz,
  p_risk_pct numeric,
  p_management_plan_id uuid,
  p_rr_objective numeric,
  p_be_trigger text,
  p_planned_partials jsonb,
  p_idempotency_key uuid,
  p_source text,
  p_external_ref text
)
returns public.trades
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_account public.accounts;
  v_risk_amount numeric(18,4);
  v_trade public.trades;
  r record;
begin
  select * into v_account from public.accounts where id = p_account_id and user_id = auth.uid();
  if not found then
    raise exception 'OPERATIONS_ERROR:ACCOUNT_NOT_FOUND:no existe una Cuenta % del usuario actual', p_account_id;
  end if;

  -- Invariante 3 (SPEC-002 §2.5): risk_amount se calcula y persiste una sola
  -- vez, Capital_en_ese_instante × Riesgo%, nunca se recalcula después.
  -- **Este es el único sitio del sistema donde vive esta fórmula.**
  v_risk_amount := round(v_account.current_capital * p_risk_pct / 100, 4);

  begin
    insert into public.trades (
      user_id, account_id, symbol, instrument_key, side, opened_at,
      risk_pct, risk_amount, management_plan_id, rr_objective, be_trigger,
      idempotency_key, source, external_ref
    ) values (
      auth.uid(), p_account_id, p_symbol, p_instrument_key, p_side, p_opened_at,
      p_risk_pct, v_risk_amount, p_management_plan_id, p_rr_objective, p_be_trigger,
      p_idempotency_key, coalesce(p_source, 'manual'), p_external_ref
    )
    returning * into v_trade;
  exception when unique_violation then
    -- Carrera genuina de reintentos simultáneos con la misma idempotency_key
    -- — la fila ganadora ya está comprometida, se devuelve.
    select * into v_trade from public.trades
      where account_id = p_account_id and idempotency_key = p_idempotency_key;
    return v_trade;
  end;

  for r in select * from jsonb_to_recordset(coalesce(p_planned_partials, '[]'::jsonb))
                        as x(sequence smallint, rr_level text, pct_close text)
  loop
    insert into public.trade_partials_planned (trade_id, sequence, rr_level, pct_close)
    values (v_trade.id, r.sequence, r.rr_level::numeric(8,4), r.pct_close::numeric(5,2));
  end loop;

  return v_trade;
end;
$$;

-- BUILD 016B — el núcleo deja de ser público.
--
-- Se verificó que `authenticated` podía invocarlo directamente y crear una
-- Operación sin pasar por ninguna de las dos vías legítimas: era una tercera
-- puerta. Cerrar el INSERT directo sobre `trades` sin cerrar ésta no habría
-- cerrado nada.
--
-- La revocación va **aquí y no en la migración** porque `alter default
-- privileges` concede EXECUTE a cada función nueva en el momento de crearla, y
-- este fichero se ejecuta después de las migraciones: revocar antes no serviría
-- de nada. Se revoca también a `public`, a quien Postgres concede EXECUTE por
-- defecto en toda función nueva.
--
-- Sus dos únicos llamantes son `registrar_operacion` y
-- `abrir_operacion_desde_intencion`, ambos `SECURITY DEFINER`: se ejecutan con
-- los privilegios del propietario y conservan el acceso.
revoke execute on function public.crear_operacion_nucleo(
  uuid, text, text, text, timestamptz, numeric, uuid, numeric, text, jsonb, uuid, text, text
) from public, authenticated;

create or replace function public.registrar_operacion(
  p_account_id uuid,
  p_symbol text,
  p_side text,
  p_opened_at timestamptz,
  p_risk_pct text,
  p_idempotency_key uuid default null,
  p_management_plan_id uuid default null,
  p_rr_objective text default null,
  p_be_trigger text default 'NONE',
  p_partials jsonb default '[]'::jsonb,
  p_source text default 'manual',
  p_external_ref text default null
)
returns public.trades
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.accounts;
  v_existing public.trades;
  v_risk_pct numeric(5,2);
  v_plan public.management_plans;
  v_rr_objective numeric(8,4);
  v_be_trigger text;
  v_planned_partials jsonb;
  v_trade public.trades;
  r record;
begin
  if p_idempotency_key is not null then
    select * into v_existing from public.trades
      where account_id = p_account_id and idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
    end if;
  end if;

  select * into v_account from public.accounts where id = p_account_id and user_id = auth.uid();
  if not found then
    raise exception 'OPERATIONS_ERROR:ACCOUNT_NOT_FOUND:no existe una Cuenta % del usuario actual', p_account_id;
  end if;

  if p_side not in ('long','short') then
    raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:side:"%" no es un valor reconocido', p_side;
  end if;

  begin
    v_risk_pct := p_risk_pct::numeric(5,2);
  exception when others then
    raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:risk_pct:"%" no es un número válido', p_risk_pct;
  end;
  if v_risk_pct <= 0 then
    raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:risk_pct:debe ser > 0 (recibido %)', p_risk_pct;
  end if;

  -- `risk_amount` lo calcula `crear_operacion_nucleo` (BUILD 017): la fórmula
  -- vive en un único sitio del sistema.

  if p_management_plan_id is not null then
    select * into v_plan from public.management_plans where id = p_management_plan_id and user_id = auth.uid();
    if not found then
      raise exception 'OPERATIONS_ERROR:PLAN_NOT_FOUND:no existe un Plan de Gestión % del usuario actual', p_management_plan_id;
    end if;
    v_rr_objective := v_plan.rr_objective;
    v_be_trigger := v_plan.be_trigger;
  else
    begin
      v_rr_objective := p_rr_objective::numeric(8,4);
    exception when others then
      raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:rr_objective:"%" no es un número válido', p_rr_objective;
    end;
    if v_rr_objective <= 0 then
      raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:rr_objective:debe ser > 0 (recibido %)', p_rr_objective;
    end if;
    if p_be_trigger not in ('NONE','AFTER_NTH_PARTIAL','CUSTOM_LEVEL') then
      raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:be_trigger:"%" no es un valor reconocido', p_be_trigger;
    end if;
    perform public.validate_planned_partials(p_partials);

    insert into public.management_plans (user_id, name, rr_objective, be_trigger)
    values (auth.uid(), null, v_rr_objective, p_be_trigger)
    returning * into v_plan;

    for r in select * from jsonb_to_recordset(p_partials) as x(sequence smallint, rr_level text, pct_close text)
    loop
      insert into public.management_plan_partials (plan_id, sequence, rr_level, pct_close)
      values (v_plan.id, r.sequence, r.rr_level::numeric(8,4), r.pct_close::numeric(5,2));
    end loop;

    v_be_trigger := p_be_trigger;
  end if;

  -- Los parciales planificados se normalizan a la misma forma en ambas ramas
  -- para que el núcleo no tenga que saber de dónde vienen: del Plan guardado
  -- (que ya los tiene en su tabla) o del parámetro recibido (ya validado por
  -- `validate_planned_partials` más arriba).
  if p_management_plan_id is not null then
    select coalesce(jsonb_agg(
             jsonb_build_object('sequence', mpp.sequence,
                                'rr_level', mpp.rr_level::text,
                                'pct_close', mpp.pct_close::text)
             order by mpp.sequence), '[]'::jsonb)
      into v_planned_partials
      from public.management_plan_partials mpp where mpp.plan_id = v_plan.id;
  else
    v_planned_partials := coalesce(p_partials, '[]'::jsonb);
  end if;

  -- Camino único de creación (BUILD 017). `registrar_operacion` resuelve el
  -- contexto —Plan vivo o Plan anónimo— y el núcleo lo materializa. Ninguna
  -- Operación del sistema nace por otra vía.
  v_trade := public.crear_operacion_nucleo(
    p_account_id       => p_account_id,
    p_symbol           => p_symbol,
    -- Sin Intención no hay identidad canónica: la resolución
    -- `símbolo nativo → instrument_key` pertenece a SPEC-008, no a este build.
    p_instrument_key   => null,
    p_side             => p_side,
    p_opened_at        => p_opened_at,
    p_risk_pct         => v_risk_pct,
    p_management_plan_id => v_plan.id,
    p_rr_objective     => v_rr_objective,
    p_be_trigger       => v_be_trigger,
    p_planned_partials => v_planned_partials,
    p_idempotency_key  => p_idempotency_key,
    p_source           => p_source,
    p_external_ref     => p_external_ref
  );

  return v_trade;
end;
$$;

-- ============================================================
-- registrar_parcial_ejecutado — capital-neutral (SPEC-002 §2.3/§4.3). No
-- valida r_max contra rr_level aquí: r_max solo se conoce al cerrar
-- (CierreInput, SPEC-002 §7) — esa coherencia ya la valida Quant Engine
-- dentro de calcularRFinal (INCONSISTENT_TRIGGER_STATE, SPEC-001 §3.3)
-- cuando cerrarOperacion invoca a Risk Engine; repetirla aquí sería la
-- misma regla en dos sitios divergiendo con el tiempo.
-- ============================================================
create or replace function public.registrar_parcial_ejecutado(
  p_trade_id uuid,
  p_sequence integer,
  p_rr_level text,
  p_pct_close text,
  p_executed_at timestamptz
)
returns public.trade_partials_executed
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trade public.trades;
  v_rr_level numeric(8,4);
  v_pct_close numeric(5,2);
  v_row public.trade_partials_executed;
  v_already_pct numeric(7,2);
begin
  -- BUILD 018: `for update` ANTES de cualquier comprobación de estado. Sin él,
  -- dos sesiones simultáneas evalúan el estado sobre su propia instantánea y
  -- ambas escriben. En READ COMMITTED, la sesión que espera relee la versión
  -- más reciente al liberarse el bloqueo, así que ve el resultado de la
  -- ganadora. `trades` es el punto único de serialización del ciclo de vida de
  -- la Operación: al no haber un segundo objeto que bloquear, no hay orden de
  -- adquisición que respetar ni interbloqueo posible.
  select * into v_trade from public.trades
    where id = p_trade_id and user_id = auth.uid()
    for update;
  if not found then
    raise exception 'OPERATIONS_ERROR:TRADE_NOT_FOUND:no existe una Operación % del usuario actual', p_trade_id;
  end if;
  if v_trade.status <> 'open' then
    raise exception 'OPERATIONS_ERROR:INVALID_STATE_TRANSITION:%:open:solo una Operación Abierta admite parciales ejecutados', v_trade.status;
  end if;

  if p_sequence < 1 or p_sequence > 5 then
    raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:sequence:% fuera de rango (1..5)', p_sequence;
  end if;

  begin
    v_rr_level := p_rr_level::numeric(8,4);
    v_pct_close := p_pct_close::numeric(5,2);
  exception when others then
    raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:rr_level/pct_close:valor numérico inválido';
  end;
  if v_pct_close <= 0 or v_pct_close > 100 then
    raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:pct_close:debe estar entre 0 y 100 (recibido %)', p_pct_close;
  end if;

  select coalesce(sum(pct_close), 0) into v_already_pct from public.trade_partials_executed where trade_id = p_trade_id;
  if v_already_pct + v_pct_close > 100 then
    raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:pct_close:la suma de parciales ejecutados superaría 100%% (% + %)', v_already_pct, v_pct_close;
  end if;

  -- BUILD 018 — `UNIQUE (trade_id, sequence)` existe desde BUILD 004
  -- (20260803120500). Lo que faltaba era traducir su violación a un error de
  -- dominio: hasta aquí escapaba el mensaje interno de Postgres, que un cliente
  -- no puede reconocer. La secuencia forma parte del contrato matemático y no
  -- debe depender de que el Quant Engine detecte el duplicado al cerrar —
  -- detectarlo entonces dejaría además la Operación **imposible de cerrar**.
  begin
    insert into public.trade_partials_executed (trade_id, sequence, rr_level, pct_close, executed_at)
    values (p_trade_id, p_sequence, v_rr_level, v_pct_close, p_executed_at)
    returning * into v_row;
  exception when unique_violation then
    raise exception 'OPERATIONS_ERROR:DUPLICATE_PARTIAL_SEQUENCE:ya existe un parcial ejecutado con sequence % en esta Operación', p_sequence;
  end;

  return v_row;
end;
$$;

-- ============================================================
-- cancelar_operacion — cancelación simple (Abierta, 0 parciales
-- ejecutados). El trigger on_trade_write_invariants valida la transición y
-- la condición de "0 parciales" — esta función nunca duplica esa lógica,
-- solo aporta el motivo obligatorio (SPEC-002 §5.4).
-- ============================================================
create or replace function public.cancelar_operacion(p_trade_id uuid, p_motivo text)
returns public.trades
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trade public.trades;
begin
  if trim(coalesce(p_motivo, '')) = '' then
    raise exception 'OPERATIONS_ERROR:CANCELLATION_REQUIRES_REASON:se requiere un motivo de cancelación';
  end if;

  -- BUILD 018: `for update` ANTES de cualquier comprobación de estado. Sin él,
  -- dos sesiones simultáneas evalúan el estado sobre su propia instantánea y
  -- ambas escriben. En READ COMMITTED, la sesión que espera relee la versión
  -- más reciente al liberarse el bloqueo, así que ve el resultado de la
  -- ganadora. `trades` es el punto único de serialización del ciclo de vida de
  -- la Operación: al no haber un segundo objeto que bloquear, no hay orden de
  -- adquisición que respetar ni interbloqueo posible.
  select * into v_trade from public.trades
    where id = p_trade_id and user_id = auth.uid()
    for update;
  if not found then
    raise exception 'OPERATIONS_ERROR:TRADE_NOT_FOUND:no existe una Operación % del usuario actual', p_trade_id;
  end if;
  if v_trade.status = 'closed' then
    raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:status:usa cancelar_operacion_fantasma para revertir una Operación ya cerrada';
  end if;

  update public.trades
  set status = 'cancelled', cancellation_reason = p_motivo
  where id = p_trade_id
  returning * into v_trade;

  return v_trade;
end;
$$;

-- ============================================================
-- cancelar_operacion_fantasma — Cerrada → Cancelada con reversión de
-- capital (SPEC-002 §5.4: "la única acción destructiva de todo este
-- componente sobre datos ya usados para calcular capital real"). Exige
-- p_confirmacion=true explícito — nunca un valor por defecto que un cliente
-- descuidado pueda dejar pasar sin querer, "nunca un botón de un solo
-- toque". La reversión reutiliza el mismo trigger de recálculo de capital
-- que ya existe (recompute_account_capital, BUILD 001) — cero fórmulas
-- nuevas, un evento 'trade_pnl' con el signo invertido.
-- ============================================================
create or replace function public.cancelar_operacion_fantasma(
  p_trade_id uuid,
  p_motivo text,
  p_confirmacion boolean default false
)
returns public.trades
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trade public.trades;
begin
  if trim(coalesce(p_motivo, '')) = '' then
    raise exception 'OPERATIONS_ERROR:CANCELLATION_REQUIRES_REASON:se requiere un motivo de cancelación';
  end if;
  if not p_confirmacion then
    raise exception 'OPERATIONS_ERROR:CONFIRMATION_REQUIRED:revertir una Operación cerrada exige confirmación explícita';
  end if;

  -- BUILD 018: `for update` ANTES de cualquier comprobación de estado. Sin él,
  -- dos sesiones simultáneas evalúan el estado sobre su propia instantánea y
  -- ambas escriben. En READ COMMITTED, la sesión que espera relee la versión
  -- más reciente al liberarse el bloqueo, así que ve el resultado de la
  -- ganadora. `trades` es el punto único de serialización del ciclo de vida de
  -- la Operación: al no haber un segundo objeto que bloquear, no hay orden de
  -- adquisición que respetar ni interbloqueo posible.
  select * into v_trade from public.trades
    where id = p_trade_id and user_id = auth.uid()
    for update;
  if not found then
    raise exception 'OPERATIONS_ERROR:TRADE_NOT_FOUND:no existe una Operación % del usuario actual', p_trade_id;
  end if;
  if v_trade.status <> 'closed' then
    raise exception 'OPERATIONS_ERROR:INVALID_STATE_TRANSITION:%:cancelled:solo una Operación Cerrada admite reversión "fantasma" — usa cancelar_operacion', v_trade.status;
  end if;

  if v_trade.pnl_amount is not null and v_trade.pnl_amount <> 0 then
    insert into public.account_capital_events (account_id, event_type, amount, trade_id, note)
    values (v_trade.account_id, 'trade_pnl', -v_trade.pnl_amount, v_trade.id, 'Reversión por cancelación: ' || p_motivo);
  end if;

  update public.trades
  set status = 'cancelled', cancellation_reason = p_motivo
  where id = p_trade_id
  returning * into v_trade;

  return v_trade;
end;
$$;

-- ============================================================
-- aplicar_cierre_operacion — invocada por packages/operations-engine
-- DESPUÉS de que Risk Engine ya calculó r_final/pnl_amount (vía Quant
-- Engine). Nunca calcula nada — solo persiste el resultado ya calculado y
-- mueve capital reutilizando el trigger existente (SPEC-002 §4.1).
-- ============================================================
-- BUILD 018 — dos parámetros nuevos, ambos al final y con `default null`, de
-- modo que ninguna llamada existente se rompe.
--
-- **`p_expected_partials` — el testigo de la evidencia.** Es el número de
-- parciales ejecutados que el llamante usó para calcular `r_final`. Existe
-- porque `for update` **no basta** aquí: el cálculo ocurre en
-- `OperationsEngineService`, en una transacción anterior y distinta, así que
-- entre la lectura de los parciales y esta llamada hay una ventana en la que
-- otra sesión puede insertar uno. El bloqueo serializa la escritura, no una
-- lectura que ya ocurrió. Sin este testigo, `R_final` puede persistirse sobre
-- evidencia que ya no existe tal como se leyó.
--
-- Un contador basta, y es demostrable gracias a BUILD 016B: los parciales
-- ejecutados son inmutables e imborrables, y `UNIQUE (trade_id, sequence)`
-- impide reutilizar una posición — luego la única mutación posible del
-- conjunto es la inserción, y toda inserción cambia el contador. Detecta el
-- 100 % de los cambios posibles. No es una fórmula ni una segunda fuente de
-- verdad: es control optimista sobre una precondición, el mismo patrón que
-- Risk Engine usa con `version`.
--
-- `null` significa "no verifico", y existe **sólo** por compatibilidad con las
-- llamadas históricas. La ruta de producción (`OperationsEngineService`) lo
-- envía siempre.
create or replace function public.aplicar_cierre_operacion(
  p_trade_id uuid,
  p_closed_at timestamptz,
  p_closure_reason text,
  p_cierre_manual_rr text,
  p_r_max text,
  p_r_final text,
  p_pnl_amount text,
  p_expected_partials integer default null,
  p_idempotency_key uuid default null
)
returns public.trades
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trade public.trades;
  v_partials integer;
begin
  -- BUILD 018: `for update` ANTES de cualquier comprobación de estado. Sin él,
  -- dos sesiones simultáneas evalúan el estado sobre su propia instantánea y
  -- ambas escriben. En READ COMMITTED, la sesión que espera relee la versión
  -- más reciente al liberarse el bloqueo, así que ve el resultado de la
  -- ganadora. `trades` es el punto único de serialización del ciclo de vida de
  -- la Operación: al no haber un segundo objeto que bloquear, no hay orden de
  -- adquisición que respetar ni interbloqueo posible.
  select * into v_trade from public.trades
    where id = p_trade_id and user_id = auth.uid()
    for update;
  if not found then
    raise exception 'OPERATIONS_ERROR:TRADE_NOT_FOUND:no existe una Operación % del usuario actual', p_trade_id;
  end if;
  -- Idempotencia. Una repetición **exacta** de la misma clave devuelve la
  -- Operación sin escribir nada —ni desenlace, ni evento de capital—; cualquier
  -- otra combinación es un segundo cierre y se rechaza. De esta única regla
  -- salen los cinco casos posibles: sin clave luego con clave, con clave A dos
  -- veces, y con clave A luego B.
  if v_trade.status = 'closed'
     and p_idempotency_key is not null
     and v_trade.closure_idempotency_key = p_idempotency_key then
    return v_trade;
  end if;

  if v_trade.status <> 'open' then
    raise exception 'OPERATIONS_ERROR:INVALID_STATE_TRANSITION:%:closed:solo una Operación Abierta puede cerrarse', v_trade.status;
  end if;

  -- El testigo de la evidencia, comprobado **bajo el bloqueo**: si otra sesión
  -- insertó un parcial entre el cálculo y esta llamada, el desenlace que llega
  -- se calculó sobre una evidencia que ya no es la vigente.
  if p_expected_partials is not null then
    select count(*) into v_partials from public.trade_partials_executed where trade_id = p_trade_id;
    if v_partials <> p_expected_partials then
      raise exception 'OPERATIONS_ERROR:EVIDENCE_CHANGED:los parciales ejecutados cambiaron durante el cierre (esperados %, actuales %) — recalcula y reintenta',
        p_expected_partials, v_partials;
    end if;
  end if;

  if p_closure_reason not in ('STOP_LOSS','BREAK_EVEN','TAKE_PROFIT_FULL','MANUAL_CLOSE') then
    raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:closure_reason:"%" no es un valor reconocido', p_closure_reason;
  end if;
  if p_closure_reason = 'MANUAL_CLOSE' and p_cierre_manual_rr is null then
    raise exception 'OPERATIONS_ERROR:VALIDATION_ERROR:cierre_manual_rr:obligatorio cuando closure_reason=MANUAL_CLOSE';
  end if;

  update public.trades set
    closed_at = p_closed_at,
    closure_reason = p_closure_reason,
    cierre_manual_rr = p_cierre_manual_rr::numeric(8,4),
    r_max = p_r_max::numeric(8,4),
    r_final = p_r_final::numeric(8,4),
    pnl_amount = p_pnl_amount::numeric(18,4),
    status = 'closed',
    closure_idempotency_key = p_idempotency_key
  where id = p_trade_id
  returning * into v_trade;

  insert into public.account_capital_events (account_id, event_type, amount, trade_id, note)
  values (v_trade.account_id, 'trade_pnl', v_trade.pnl_amount, v_trade.id, 'Cierre de Operación ' || v_trade.symbol);

  return v_trade;
end;
$$;

-- ============================================================
-- aplicar_edicion_operacion — invocada por packages/operations-engine.
-- `status` nunca aparece en el SET — FORBIDDEN_STATUS_EDIT por construcción
-- (SPEC-002 §5.6), no por una comprobación en tiempo de ejecución que
-- alguien podría olvidar añadir. Todo campo no informado (`null`) conserva
-- su valor actual vía `coalesce` — limitación conocida: no permite borrar
-- explícitamente un campo opcional a NULL (p.ej. vaciar `comments`), no
-- pedido todavía, se documenta en vez de resolverse por adelantado.
-- El delta de pnl_amount (nuevo − viejo) es el único capital que se mueve —
-- nunca dos eventos (uno de reversión y otro de reaplicación), un único
-- evento con el neto ya es capital-correcto y más simple de leer en el
-- ledger.
--
-- Hallazgo real de esta build (BUILD 004 Challenge Mode): una primera
-- versión insertaba `p_risk_amount` en mitad de esta lista — cualquier
-- llamador posicional (nunca el adaptador TypeScript, que siempre llama con
-- notación con nombre vía supabase-js/PostgREST, pero sí el propio script de
-- validación SQL de `supabase/tests/`) desplazaba silenciosamente todos los
-- argumentos posteriores una posición, escribiendo el valor correcto en la
-- columna equivocada sin ningún error de Postgres. Regla desde ahora: todo
-- parámetro nuevo de esta función se añade siempre al final, nunca en medio
-- — y toda llamada SQL de prueba en este repositorio usa notación con
-- nombre (`p_x => valor`), nunca posicional, precisamente para no depender
-- de un orden que puede cambiar.
-- ============================================================
create or replace function public.aplicar_edicion_operacion(
  p_trade_id uuid,
  p_symbol text default null,
  p_side text default null,
  p_opened_at timestamptz default null,
  p_risk_pct text default null,
  p_rr_objective text default null,
  p_be_trigger text default null,
  p_r_max text default null,
  p_closure_reason text default null,
  p_cierre_manual_rr text default null,
  p_r_final text default null,
  p_pnl_amount text default null,
  p_notes text default null,
  p_comments text default null,
  p_risk_amount text default null
)
returns public.trades
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trade public.trades;
  v_old_pnl numeric(18,4);
  v_new_pnl numeric(18,4);
  v_delta numeric(18,4);
begin
  -- BUILD 018: `for update` ANTES de cualquier comprobación de estado. Sin él,
  -- dos sesiones simultáneas evalúan el estado sobre su propia instantánea y
  -- ambas escriben. En READ COMMITTED, la sesión que espera relee la versión
  -- más reciente al liberarse el bloqueo, así que ve el resultado de la
  -- ganadora. `trades` es el punto único de serialización del ciclo de vida de
  -- la Operación: al no haber un segundo objeto que bloquear, no hay orden de
  -- adquisición que respetar ni interbloqueo posible.
  select * into v_trade from public.trades
    where id = p_trade_id and user_id = auth.uid()
    for update;
  if not found then
    raise exception 'OPERATIONS_ERROR:TRADE_NOT_FOUND:no existe una Operación % del usuario actual', p_trade_id;
  end if;

  -- BUILD 018 — rechazo tipado y anticipado de los hechos de identidad.
  --
  -- BUILD 016B los hizo inmutables por trigger, y el trigger sigue siendo la
  -- frontera real: esto es **diagnóstico**, no seguridad. Sin ello, quien pase
  -- `p_risk_amount` recibe un error genérico que no le dice qué campo tocó.
  --
  -- La firma **no cambia**: los parámetros se conservan por compatibilidad
  -- histórica (la cabecera de la suite 03 documenta un fallo real causado por
  -- reordenar parámetros de esta misma función). Contrato SQL y superficie de
  -- aplicación son cosas distintas: en TypeScript sí desaparecen.
  if p_symbol is not null then
    raise exception 'OPERATIONS_ERROR:IMMUTABLE_IDENTITY_FACT:symbol:la identidad de una Operación se fija al nacer y no se corrige';
  end if;
  if p_side is not null then
    raise exception 'OPERATIONS_ERROR:IMMUTABLE_IDENTITY_FACT:side:la identidad de una Operación se fija al nacer y no se corrige';
  end if;
  if p_opened_at is not null then
    raise exception 'OPERATIONS_ERROR:IMMUTABLE_IDENTITY_FACT:opened_at:la identidad de una Operación se fija al nacer y no se corrige';
  end if;
  if p_risk_pct is not null then
    raise exception 'OPERATIONS_ERROR:IMMUTABLE_IDENTITY_FACT:risk_pct:la identidad de una Operación se fija al nacer y no se corrige';
  end if;
  if p_risk_amount is not null then
    raise exception 'OPERATIONS_ERROR:IMMUTABLE_IDENTITY_FACT:risk_amount:se calcula una sola vez al nacer, Capital_en_ese_instante × Riesgo%% (SPEC-002 §2.5)';
  end if;
  if p_rr_objective is not null then
    raise exception 'OPERATIONS_ERROR:IMMUTABLE_IDENTITY_FACT:rr_objective:la identidad de una Operación se fija al nacer y no se corrige';
  end if;
  if p_be_trigger is not null then
    raise exception 'OPERATIONS_ERROR:IMMUTABLE_IDENTITY_FACT:be_trigger:la identidad de una Operación se fija al nacer y no se corrige';
  end if;

  v_old_pnl := coalesce(v_trade.pnl_amount, 0);

  update public.trades set
    symbol = coalesce(p_symbol, symbol),
    side = coalesce(p_side, side),
    opened_at = coalesce(p_opened_at, opened_at),
    risk_pct = coalesce(p_risk_pct::numeric(5,2), risk_pct),
    risk_amount = coalesce(p_risk_amount::numeric(18,4), risk_amount),
    rr_objective = coalesce(p_rr_objective::numeric(8,4), rr_objective),
    be_trigger = coalesce(p_be_trigger, be_trigger),
    r_max = coalesce(p_r_max::numeric(8,4), r_max),
    closure_reason = coalesce(p_closure_reason, closure_reason),
    cierre_manual_rr = coalesce(p_cierre_manual_rr::numeric(8,4), cierre_manual_rr),
    r_final = coalesce(p_r_final::numeric(8,4), r_final),
    pnl_amount = coalesce(p_pnl_amount::numeric(18,4), pnl_amount),
    notes = coalesce(p_notes, notes),
    comments = coalesce(p_comments, comments)
  where id = p_trade_id
  returning * into v_trade;

  v_new_pnl := coalesce(v_trade.pnl_amount, 0);
  v_delta := v_new_pnl - v_old_pnl;
  if v_delta <> 0 and v_trade.status = 'closed' then
    insert into public.account_capital_events (account_id, event_type, amount, trade_id, note)
    values (v_trade.account_id, 'trade_pnl', v_delta, v_trade.id, 'Ajuste por edición de Operación ' || v_trade.symbol);
  end if;

  return v_trade;
end;
$$;

-- ============================================================
-- Catálogo de lectura
-- ============================================================
create or replace function public.obtener_operacion(p_id uuid)
returns public.trades
language sql
security invoker
set search_path = public
as $$
  select * from public.trades where id = p_id and user_id = auth.uid();
$$;

create or replace function public.listar_operaciones(p_account_id uuid)
returns setof public.trades
language sql
security invoker
set search_path = public
as $$
  select t.* from public.trades t
  join public.accounts a on a.id = t.account_id
  where t.account_id = p_account_id and a.user_id = auth.uid()
  order by t.opened_at desc;
$$;

create or replace function public.listar_parciales_planificados(p_trade_id uuid)
returns setof public.trade_partials_planned
language sql
security invoker
set search_path = public
as $$
  select tpp.* from public.trade_partials_planned tpp
  join public.trades t on t.id = tpp.trade_id
  where tpp.trade_id = p_trade_id and t.user_id = auth.uid()
  order by tpp.sequence asc;
$$;

create or replace function public.listar_parciales_ejecutados(p_trade_id uuid)
returns setof public.trade_partials_executed
language sql
security invoker
set search_path = public
as $$
  select tpe.* from public.trade_partials_executed tpe
  join public.trades t on t.id = tpe.trade_id
  where tpe.trade_id = p_trade_id and t.user_id = auth.uid()
  order by tpe.sequence asc;
$$;

-- Muestra vigente de R_final por Cuenta — excluye Canceladas (invariante 4,
-- SPEC-002 §2.5: "una Operación Cancelada nunca cuenta en ninguna
-- estadística agregada"). Usada por packages/operations-engine para
-- reconstruir el acumulador de Risk Engine tras una edición
-- (procesarOperacionEditada, BUILD 003) — Risk Engine documenta
-- explícitamente que nunca lee `trades` directamente, es Operations Engine
-- quien se la entrega (packages/risk-engine/src/domain/events.ts).
create or replace function public.listar_r_final_vigente_por_cuenta(p_account_id uuid)
returns table(r_final numeric(8,4))
language sql
security invoker
set search_path = public
as $$
  select t.r_final from public.trades t
  join public.accounts a on a.id = t.account_id
  where t.account_id = p_account_id and a.user_id = auth.uid()
    and t.status = 'closed' and t.r_final is not null
  order by t.closed_at asc;
$$;
