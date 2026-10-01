-- BUILD 015 / B5 — Management Intent: creación atómica del Aggregate Root
-- (BUILD 007 A4/A8, BUILD 008, esquema congelado en BUILD 010/011/013).
--
-- Convención de errores: "INTENT_ERROR:<CODE>:<detalle>", la misma disciplina
-- de funding.sql ("FUNDING_ERROR:...") y operations.sql ("OPERATIONS_ERROR:...").
-- Continúa el catálogo que abrió BUILD 011 (IMMUTABLE_INTENT, TERMINAL_STATE,
-- INVALID_STATE_TRANSITION).
--
-- **Único punto de escritura del agregado.** BUILD 010 dejó las dos tablas con
-- políticas RLS de SOLO LECTURA a propósito: no existe ninguna vía de INSERT
-- desde la aplicación, luego esta función es la única forma de crear una
-- Intención. Es el mismo patrón que `audit_log` (20260803120500 §trades_audit).
--
-- ============================================================
-- SEGURIDAD — qué deja de protegerme al ser SECURITY DEFINER
--
-- Al ejecutarse con los privilegios del propietario (superusuario en Supabase),
-- Postgres **exime de RLS a todas las sentencias de dentro** sin excepción — el
-- mismo hallazgo que documenta `supabase/tests/00_local_test_setup.sql`. Todo
-- lo que RLS garantizaba fuera de aquí hay que volver a garantizarlo a mano:
--
--   · `management_intents_owner_read` / `management_intent_destinations_owner_read`
--     → dejan de filtrar: la Intención se escribe siempre con `user_id =
--       auth.uid()`, nunca con un id recibido por parámetro (no existe tal
--       parámetro, deliberadamente).
--   · `accounts_owner_rw` → deja de filtrar: **cada** Cuenta destino se busca
--     con `id = ... and user_id = auth.uid()`. Una FK valida existencia contra
--     la tabla entera, sin RLS — el mismo bypass que `crear_cuenta` cerró en
--     BUILD 001 y que operations.sql documenta en su cabecera.
--   · `management_plans_owner_rw` → deja de filtrar: el Plan que se congela se
--     busca igual, `id = ... and user_id = auth.uid()`.
--   · La política de INSERT de `domain_events` (BUILD 012B) → deja de filtrar
--     para el trigger de B3, que se dispara dentro de esta transacción. No hay
--     riesgo: ese trigger escribe `new.user_id`, que es el `auth.uid()` que
--     esta función acaba de fijar.
--   · `auth.uid()` **nulo** → sin comprobación explícita, `user_id = null` no
--     casaría con ninguna fila y el fallo llegaría como un NOT NULL crudo. Se
--     comprueba lo primero de todo: un llamador sin sesión nunca escribe.
--
-- `set search_path = public` es obligatorio en toda función SECURITY DEFINER:
-- sin él, un llamador puede anteponer un esquema propio y secuestrar cualquier
-- nombre no cualificado. Mismo criterio que los tres SECURITY DEFINER que ya
-- existen en el repositorio.
--
-- ============================================================
-- EL TOPE DE RIESGO (A4) — por qué se recorta y se explica, y no se rechaza
--
-- A4: "Cualquier límite máximo de riesgo por cuenta pertenece al dominio. Debe
-- aplicarse al construir la intención y debe quedar completamente explicado y
-- registrado."
--
-- El diseño previo de BUILD 008 §2 decía "si excede: se rechaza la
-- construcción; **nunca se recorta en silencio**". Lo que esa frase prohíbe es
-- el **silencio**, no el recorte — y BUILD 010 congeló exactamente el
-- mecanismo que hace el silencio imposible por construcción:
--
--     constraint management_intent_destinations_cap_explained
--       check (risk_cap_applied = false or risk_cap_reason is not null)
--
-- Bajo semántica de rechazo puro, `risk_cap_applied` no podría ser `true`
-- jamás y esas dos columnas estarían muertas el día que nacieron. Se recorta,
-- se marca y se explica: es la única lectura que deja vivas las columnas
-- congeladas, la que respeta la prohibición literal (nada ocurre en silencio) y
-- la que cumple A4 al pie ("aplicarse ... y quedar registrado"). Y respeta I14:
-- un tope mal configurado nunca impide al trader registrar su decisión.
--
-- ============================================================
-- I13 / regla 14 (Calcular ≠ Juzgar) — dónde está la frontera
--
-- "Ningún módulo que calcule una magnitud de riesgo es el mismo que la juzga
-- contra un límite" (23 §I13). Aquí:
--
--   · **Calcula** el llamador: resuelve su transformación ("0.5× la máster")
--     hasta un `risk_pct` concreto y lo entrega como dato. Esta función no
--     interpreta `risk_transformation` ni deriva ningún número de ella — la
--     trata como texto opaco que solo guarda.
--   · **Juzga** esta función: compara ese `risk_pct` contra
--     `accounts.max_risk_pct` y registra el veredicto.
--
-- Es el mismo reparto que `registrar_operacion`, que recibe `p_risk_pct` ya
-- resuelto y nunca lo calcula.
--
-- ============================================================
-- DÓNDE VIVE EL RIESGO RESUELTO
--
-- BUILD 010 no creó una columna escalar para el riesgo por destino, y su
-- comentario sobre `risk_transformation` dice que esa columna lleva "la forma
-- de la decisión de riesgo, **no su resultado**". Eso **no** prohíbe registrar
-- el resultado: prohíbe *sustituir* la forma por un escalar, que es lo que
-- haría perder la explicabilidad ("0.5× la máster" y "riesgo propio 0.5%"
-- producen el mismo número siendo decisiones distintas). La auditoría de BUILD
-- 008 §3 ya lo dejó dicho: el escalar "sobrevive **como registro de la
-- decisión**, no como insumo de cálculo".
--
-- Luego la forma declarada se conserva intacta y el dominio le añade dos claves
-- reservadas — lo pedido y lo resuelto — dejando el par completo legible:
--
--   {"kind":"ratio","operand":"0.5000",            <- lo que declaró el llamador
--    "requested_risk_pct":"2.00",                   <- lo que pidió
--    "resolved_risk_pct":"1.00"}                    <- lo que sobrevive al tope
--
-- Las dos claves reservadas las escribe **siempre** el dominio: si el llamador
-- las trae, la construcción se rechaza. Sin eso, un cliente podría declarar un
-- riesgo resuelto distinto del que esta función juzgó.
--
-- Todo número dentro de los dos jsonb viaja como **cadena** ('1.00', nunca
-- 1.0), exactamente como exige BUILD 010: un número jsonb atravesaría
-- `JSON.parse` como float y violaría I5.
--
-- ============================================================
-- FUERA DE ALCANCE de ESTA función: caducidad (B6), desenlace `rejected` /
-- `discarded` (B9). La reclamación (B8) y los contratos de lectura mínimos
-- (B7) viven más abajo, en BUILD 017. Esta función solo crea.
-- ============================================================
create or replace function public.crear_intencion_de_gestion(
  p_side text,
  p_instrument_key text,
  p_decided_at timestamptz,
  p_valid_until timestamptz,
  p_destinations jsonb,
  p_valid_from timestamptz default null,
  p_idempotency_key uuid default null
)
returns public.management_intents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_existing public.management_intents;
  v_intent public.management_intents;
  v_instrument_key text;
  v_valid_from timestamptz;
  v_seen_accounts uuid[] := '{}';
  v_account_id uuid;
  v_plan_id uuid;
  v_account public.accounts;
  v_plan public.management_plans;
  v_frozen_plan jsonb;
  v_transformation jsonb;
  v_requested numeric(5,2);
  v_resolved numeric(5,2);
  v_cap_applied boolean;
  v_cap_reason text;
  r record;
begin
  -- ---------- 0. Identidad. Lo primero, siempre. ----------
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'INTENT_ERROR:NOT_AUTHENTICATED:una Intención pertenece a un Usuario y no hay sesión';
  end if;

  -- ---------- 1. Idempotencia ----------
  -- Antes de cualquier trabajo: un reintento de red sobre "Confirmar" no debe
  -- ni siquiera releer Cuentas. Mismo patrón exacto que `registrar_operacion`,
  -- con el ámbito que corresponde al agregado — el Usuario, no la Cuenta,
  -- porque una Intención abarca N Cuentas (BUILD 010).
  if p_idempotency_key is not null then
    select * into v_existing from public.management_intents
      where user_id = v_user_id and idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
    end if;
  end if;

  -- ---------- 2. Cabecera ----------
  if p_side not in ('long','short') then
    raise exception 'INTENT_ERROR:VALIDATION_ERROR:side:"%" no es un valor reconocido', p_side;
  end if;

  v_instrument_key := trim(coalesce(p_instrument_key, ''));
  if v_instrument_key = '' then
    raise exception 'INTENT_ERROR:VALIDATION_ERROR:instrument_key:obligatorio en forma canónica';
  end if;

  if p_decided_at is null then
    raise exception 'INTENT_ERROR:VALIDATION_ERROR:decided_at:obligatorio — es el instante de la confirmación humana';
  end if;

  -- La ventana por defecto arranca en la decisión misma. `valid_until` nunca
  -- tiene defecto: una decisión sin caducidad podría materializarse mañana.
  v_valid_from := coalesce(p_valid_from, p_decided_at);
  if p_valid_until is null then
    raise exception 'INTENT_ERROR:VALIDATION_ERROR:valid_until:obligatorio — una Intención sin caducidad no existe';
  end if;
  if p_valid_until <= v_valid_from then
    raise exception 'INTENT_ERROR:INVALID_WINDOW:valid_until (%) debe ser posterior a valid_from (%)',
      p_valid_until, v_valid_from;
  end if;

  -- ---------- 3. Al menos un destino ----------
  -- Una decisión de gestión dirigida a cero Cuentas no es una decisión. Se
  -- comprueba aquí y no con un CHECK diferido porque el CHECK tendría que
  -- vivir en `management_intents`, que no conoce a sus destinos.
  if p_destinations is null or jsonb_typeof(p_destinations) <> 'array' then
    raise exception 'INTENT_ERROR:VALIDATION_ERROR:destinations:debe ser un array jsonb';
  end if;
  if jsonb_array_length(p_destinations) = 0 then
    raise exception 'INTENT_ERROR:NO_DESTINATIONS:una Intención se dirige al menos a una Cuenta';
  end if;

  -- ---------- 4. La Intención ----------
  -- `contract_version` no es parámetro a propósito: es una propiedad del
  -- contrato que escribe esta función, no un dato del llamador. Su defecto
  -- vive en la tabla (BUILD 010) y solo cambia cuando cambie esta función.
  --
  -- El trigger `on_management_intent_insert_emit_event` (BUILD 013) emite aquí
  -- dentro. Nada que hacer: el evento nace y muere con esta transacción.
  begin
    insert into public.management_intents (
      user_id, decided_at, side, instrument_key, valid_from, valid_until, idempotency_key
    ) values (
      v_user_id, p_decided_at, p_side, v_instrument_key, v_valid_from, p_valid_until, p_idempotency_key
    )
    returning * into v_intent;
  exception when unique_violation then
    -- Carrera genuina: dos peticiones simultáneas con la misma clave pasaron
    -- ambas la comprobación del punto 1 antes de que ninguna confirmara. El
    -- índice único resuelve el empate; la perdedora devuelve la fila ganadora.
    -- A diferencia de `registrar_operacion`, aquí no queda ningún residuo
    -- huérfano: esta función solo LEE Planes, nunca crea ninguno.
    select * into v_existing from public.management_intents
      where user_id = v_user_id and idempotency_key = p_idempotency_key;
    return v_existing;
  end;

  -- ---------- 5. Los destinos ----------
  for r in
    select elem, pos from jsonb_array_elements(p_destinations) with ordinality as t(elem, pos)
  loop
    -- 5.1 Cuenta destino, comprobada contra el Usuario. Nunca contra la FK.
    begin
      v_account_id := nullif(r.elem->>'account_id', '')::uuid;
    exception when others then
      raise exception 'INTENT_ERROR:VALIDATION_ERROR:destinations[%].account_id:"%" no es un uuid válido',
        r.pos, r.elem->>'account_id';
    end;
    if v_account_id is null then
      raise exception 'INTENT_ERROR:VALIDATION_ERROR:destinations[%].account_id:obligatorio', r.pos;
    end if;

    select * into v_account from public.accounts
      where id = v_account_id and user_id = v_user_id;
    if not found then
      -- Mismo mensaje exista o no la Cuenta: distinguir "no es tuya" de "no
      -- existe" filtraría la existencia de Cuentas ajenas.
      raise exception 'INTENT_ERROR:ACCOUNT_NOT_FOUND:no existe una Cuenta % del usuario actual', v_account_id;
    end if;

    -- 5.2 MI-6: una pareja (Intención, Cuenta) tiene como máximo un destino.
    -- El UNIQUE de BUILD 010 también lo atraparía, pero como violación cruda;
    -- aquí sale con el código del catálogo y el índice del elemento culpable.
    if v_account_id = any(v_seen_accounts) then
      raise exception 'INTENT_ERROR:DUPLICATE_DESTINATION:destinations[%]:la Cuenta % ya tiene destino en esta Intención',
        r.pos, v_account_id;
    end if;
    v_seen_accounts := array_append(v_seen_accounts, v_account_id);

    -- 5.3 Congelado del Plan (regla 13). Se congela **exactamente el mismo
    -- subconjunto** que `trades` snapshota de un Plan: `rr_objective`,
    -- `be_trigger` y los parciales planificados. `condiciones_ejecucion` y
    -- `etiqueta_riesgo` quedan fuera por la misma razón que BUILD 004 los dejó
    -- fuera del PlanSnapshot de `trades` — son metadata descriptiva que no
    -- participa en ningún cálculo de R_final.
    --
    -- `plan_id` viaja como referencia trazable, nunca como FK (BUILD 010:
    -- borrar un Plan jamás queda bloqueado por una Intención).
    begin
      v_plan_id := nullif(r.elem->>'management_plan_id', '')::uuid;
    exception when others then
      raise exception 'INTENT_ERROR:VALIDATION_ERROR:destinations[%].management_plan_id:"%" no es un uuid válido',
        r.pos, r.elem->>'management_plan_id';
    end;
    if v_plan_id is null then
      raise exception 'INTENT_ERROR:VALIDATION_ERROR:destinations[%].management_plan_id:obligatorio — I11: toda Operación ejecuta exactamente un Plan',
        r.pos;
    end if;

    select * into v_plan from public.management_plans
      where id = v_plan_id and user_id = v_user_id;
    if not found then
      raise exception 'INTENT_ERROR:PLAN_NOT_FOUND:no existe un Plan de Gestión % del usuario actual', v_plan_id;
    end if;

    v_frozen_plan := jsonb_build_object(
      'plan_id',      v_plan.id,
      'rr_objective', v_plan.rr_objective::text,
      'be_trigger',   v_plan.be_trigger,
      'partials', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'sequence',  mpp.sequence::text,
            'rr_level',  mpp.rr_level::text,
            'pct_close', mpp.pct_close::text
          ) order by mpp.sequence
        )
        from public.management_plan_partials mpp where mpp.plan_id = v_plan.id
      ), '[]'::jsonb)
    );

    -- 5.4 La forma declarada de la decisión de riesgo. Opaca para el dominio.
    v_transformation := r.elem->'risk_transformation';
    if v_transformation is null or jsonb_typeof(v_transformation) <> 'object' then
      raise exception 'INTENT_ERROR:VALIDATION_ERROR:destinations[%].risk_transformation:debe ser un objeto jsonb', r.pos;
    end if;
    if v_transformation ? 'requested_risk_pct' or v_transformation ? 'resolved_risk_pct' then
      raise exception 'INTENT_ERROR:VALIDATION_ERROR:destinations[%].risk_transformation:requested_risk_pct/resolved_risk_pct las escribe el dominio, nunca el llamador',
        r.pos;
    end if;

    -- 5.5 El riesgo pedido, ya resuelto por quien lo calculó (I13).
    begin
      v_requested := (r.elem->>'risk_pct')::numeric(5,2);
    exception when others then
      raise exception 'INTENT_ERROR:VALIDATION_ERROR:destinations[%].risk_pct:"%" no es un número válido',
        r.pos, r.elem->>'risk_pct';
    end;
    if v_requested is null then
      raise exception 'INTENT_ERROR:VALIDATION_ERROR:destinations[%].risk_pct:obligatorio', r.pos;
    end if;
    -- Mismo rango que `trades.risk_pct` (> 0) y que `accounts.max_risk_pct`
    -- (≤ 100): un destino que no pudiera convertirse en Operación no sirve.
    if v_requested <= 0 or v_requested > 100 then
      raise exception 'INTENT_ERROR:VALIDATION_ERROR:destinations[%].risk_pct:debe estar en (0, 100] (recibido %)',
        r.pos, r.elem->>'risk_pct';
    end if;

    -- 5.6 El juicio contra el tope de la Cuenta (A4). Recorta y explica.
    if v_account.max_risk_pct is not null and v_requested > v_account.max_risk_pct then
      v_resolved    := v_account.max_risk_pct;
      v_cap_applied := true;
      v_cap_reason  := format(
        'riesgo solicitado %s%% recortado al tope de la Cuenta "%s" (%s%%)',
        v_requested::text, v_account.name, v_account.max_risk_pct::text);
    else
      v_resolved    := v_requested;
      v_cap_applied := false;
      v_cap_reason  := null;
    end if;

    insert into public.management_intent_destinations (
      intent_id, account_id, frozen_plan, risk_transformation, risk_cap_applied, risk_cap_reason
    ) values (
      v_intent.id, v_account_id, v_frozen_plan,
      v_transformation || jsonb_build_object(
        'requested_risk_pct', v_requested::text,
        'resolved_risk_pct',  v_resolved::text
      ),
      v_cap_applied, v_cap_reason
    );
  end loop;

  return v_intent;
end;
$$;

comment on function public.crear_intencion_de_gestion(text, text, timestamptz, timestamptz, jsonb, timestamptz, uuid) is
  'Única vía de escritura del agregado Management Intent. Crea la Intención y todos sus destinos en una sola transacción: o existe entera, o no existe. Al ser SECURITY DEFINER comprueba a mano toda propiedad que RLS deja de garantizar.';

-- ============================================================
-- BUILD 017 / B8 — abrir_operacion_desde_intencion.
--
-- **El camino que faltaba.** Hasta este build, `crear_intencion_de_gestion`
-- escribía una decisión que nadie consumía: verificado sobre Postgres real,
-- tras `registrar_operacion` el destino seguía `pending` con `trade_id` nulo.
-- La estructura del vínculo existía desde B1 (`trade_id`, el `CHECK` que lo ata
-- al estado, el índice parcial) y la máquina de estados desde B2. Sólo faltaba
-- quién puede escribirla.
--
-- **Fuente única de verdad.** La función no acepta ni Cuenta, ni Plan, ni
-- riesgo, ni lado, ni instrumento: todo eso ya lo declara el destino y lo que
-- no se recibe no puede contradecirse. Es el mismo mecanismo con el que
-- `crear_intencion_de_gestion` rechaza `requested_risk_pct`/`resolved_risk_pct`
-- cuando llegan del llamante — las escribe el dominio, nunca el llamador.
--
-- **El Plan vivo no puede sustituir al snapshot**, y no por disciplina sino por
-- construcción: esta función nunca pasa un identificador de Plan que el núcleo
-- pueda seguir; pasa los valores ya congelados. `management_plan_id` viaja como
-- linaje (I11), no como puntero a leer.
--
-- **Atomicidad total.** Creación de la Operación y transiciones
-- `pending → sent → materialized` ocurren en la misma transacción. No existe la
-- transición directa `pending → materialized` (B2), así que el paso por `sent`
-- es obligatorio: existe dentro de la transacción y nadie lo observa fuera.
--
-- **No emite ningún evento.** El desenlace de un destino sigue sin consumidor y
-- BUILD 008 §7 lo dejó deliberadamente fuera: emitir sin consumidor es la
-- sobreingeniería que 31 (TPOS) obliga a evitar. La Operación sí emite
-- `OperacionRegistrada` por el trigger de siempre, sin cambios.
-- ============================================================
create or replace function public.abrir_operacion_desde_intencion(
  p_destination_id uuid,
  p_opened_at timestamptz,
  p_idempotency_key uuid default null
)
returns public.trades
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_dest public.management_intent_destinations;
  v_intent public.management_intents;
  v_trade public.trades;
  v_plan_id uuid;
  v_risk_pct numeric(5,2);
  v_partials jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'INTENT_ERROR:NOT_AUTHENTICATED:abrir una Operación desde una Intención exige sesión';
  end if;

  if p_opened_at is null then
    raise exception 'INTENT_ERROR:VALIDATION_ERROR:opened_at:obligatorio — es el instante en que la Operación existió';
  end if;

  -- Propiedad y existencia en una sola consulta. Mismo mensaje exista o no el
  -- destino ajeno: distinguirlos filtraría la existencia de Intenciones de
  -- otros usuarios.
  select d.* into v_dest
    from public.management_intent_destinations d
    join public.management_intents i on i.id = d.intent_id
   where d.id = p_destination_id and i.user_id = v_user_id;
  if not found then
    raise exception 'INTENT_ERROR:DESTINATION_NOT_FOUND:no existe un destino % del usuario actual', p_destination_id;
  end if;

  select * into v_intent from public.management_intents where id = v_dest.intent_id;

  -- Red de idempotencia que no depende de que el llamante recuerde su clave:
  -- un destino ya materializado **es** su propia respuesta.
  if v_dest.state = 'materialized' then
    select * into v_trade from public.trades where id = v_dest.trade_id;
    return v_trade;
  end if;

  if v_dest.state in ('rejected','expired','discarded') then
    raise exception 'INTENT_ERROR:TERMINAL_STATE:%:un desenlace alcanzado no se reabre', v_dest.state;
  end if;

  -- Ventana de vigencia. Se comprueba aquí, en la reclamación, y no como un
  -- estado almacenado: `pending` no es terminal, de modo que la transición
  -- `pending → expired` de B6 seguirá siendo legal sobre estos mismos datos el
  -- día que se construya. Aplazar no destruye información.
  if p_opened_at < v_intent.valid_from or p_opened_at >= v_intent.valid_until then
    raise exception 'INTENT_ERROR:OUT_OF_WINDOW:opened_at (%) fuera de la ventana de la Intención [%, %)',
      p_opened_at, v_intent.valid_from, v_intent.valid_until;
  end if;

  -- Todo lo que sigue sale del congelado. Ni una lectura del Plan vivo.
  v_plan_id  := (v_dest.frozen_plan->>'plan_id')::uuid;
  v_risk_pct := (v_dest.risk_transformation->>'resolved_risk_pct')::numeric(5,2);
  v_partials := coalesce(v_dest.frozen_plan->'partials', '[]'::jsonb);

  -- El Plan congelado conserva su identidad aunque esté archivado (archivar no
  -- borra), pero un borrado directo dejaría el linaje sin destino: `trades`
  -- sí lleva FK a `management_plans`, a diferencia del destino, que
  -- deliberadamente no la lleva.
  if not exists (select 1 from public.management_plans where id = v_plan_id) then
    raise exception 'INTENT_ERROR:PLAN_NOT_FOUND:el Plan de Gestión % congelado en este destino ya no existe', v_plan_id;
  end if;

  -- `pending → sent`: la orden sale. Obligatorio por la máquina de estados de
  -- B2, que no admite el salto directo a `materialized`.
  if v_dest.state = 'pending' then
    update public.management_intent_destinations set state = 'sent' where id = v_dest.id;
  end if;

  -- Camino único de creación (BUILD 017). El mismo núcleo que usa
  -- `registrar_operacion`: una sola fórmula de risk_amount en todo el sistema.
  v_trade := public.crear_operacion_nucleo(
    p_account_id         => v_dest.account_id,
    -- Sin conector no hay símbolo nativo que resolver: en la ruta manual la
    -- forma canónica decidida por el trader es el único dato de instrumento en
    -- juego. `instrument_key` guarda esa identidad de forma explícita; `symbol`
    -- la acompaña porque la columna es obligatoria. No se colapsan: el día que
    -- exista un conector, `symbol` llevará el símbolo nativo y esta columna
    -- seguirá llevando la clave canónica.
    p_symbol             => v_intent.instrument_key,
    p_instrument_key     => v_intent.instrument_key,
    p_side               => v_intent.side,
    p_opened_at          => p_opened_at,
    p_risk_pct           => v_risk_pct,
    p_management_plan_id => v_plan_id,
    p_rr_objective       => (v_dest.frozen_plan->>'rr_objective')::numeric(8,4),
    p_be_trigger         => v_dest.frozen_plan->>'be_trigger',
    p_planned_partials   => v_partials,
    p_idempotency_key    => p_idempotency_key,
    p_source             => 'manual',
    p_external_ref       => null
  );

  -- `sent → materialized`: estado y enlace se escriben juntos, como exige el
  -- CHECK de B1.
  update public.management_intent_destinations
     set state = 'materialized', trade_id = v_trade.id
   where id = v_dest.id;

  return v_trade;
end;
$$;

comment on function public.abrir_operacion_desde_intencion(uuid, timestamptz, uuid) is
  'Única vía por la que una Intención se convierte en Operación. Crea la Operación desde el Plan congelado del destino y lo transiciona pending→sent→materialized en una sola transacción. No acepta Cuenta, Plan, riesgo, lado ni instrumento: todo eso lo declara el destino.';

-- ============================================================
-- BUILD 017 / B7-mín — contratos de lectura.
--
-- Lo mínimo para que una Intención pueda verse y para poder elegir desde qué
-- destino abrir. `SECURITY INVOKER` a propósito: las políticas RLS de lectura
-- de B1 ya resuelven la propiedad, y una función DEFINER aquí sería poder sin
-- necesidad.
--
-- `caducada` se **deriva**, no se almacena: `pending` con la ventana vencida.
-- B6 materializará esa misma verdad como estado el día que exista; hasta
-- entonces, calcularla en lectura no pierde ninguna información.
-- ============================================================
create or replace function public.listar_intenciones()
returns table (
  id uuid,
  decided_at timestamptz,
  side text,
  instrument_key text,
  valid_from timestamptz,
  valid_until timestamptz,
  contract_version int,
  destinos jsonb
)
language sql
security invoker
set search_path = public, pg_temp
as $$
  select i.id, i.decided_at, i.side, i.instrument_key, i.valid_from, i.valid_until,
         i.contract_version,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'destination_id', d.id,
                    'account_id', d.account_id,
                    'state', d.state,
                    'trade_id', d.trade_id,
                    'risk_pct', d.risk_transformation->>'resolved_risk_pct',
                    'risk_cap_applied', d.risk_cap_applied,
                    'risk_cap_reason', d.risk_cap_reason,
                    'frozen_plan', d.frozen_plan,
                    'caducada', (d.state = 'pending' and i.valid_until <= now())
                  ) order by d.created_at)
             from public.management_intent_destinations d where d.intent_id = i.id
         ), '[]'::jsonb)
    from public.management_intents i
   where i.user_id = auth.uid()
   order by i.decided_at desc;
$$;

create or replace function public.obtener_intencion(p_id uuid)
returns table (
  id uuid,
  decided_at timestamptz,
  side text,
  instrument_key text,
  valid_from timestamptz,
  valid_until timestamptz,
  contract_version int,
  destinos jsonb
)
language sql
security invoker
set search_path = public, pg_temp
as $$
  select * from public.listar_intenciones() t where t.id = p_id;
$$;

-- Destinos que todavía pueden convertirse en Operación: `pending` y dentro de
-- su ventana. Es lo que una pantalla necesita para ofrecer "abrir desde esta
-- decisión" sin ofrecer nunca algo que la RPC vaya a rechazar.
create or replace function public.listar_destinos_disponibles(p_account_id uuid default null)
returns table (
  destination_id uuid,
  intent_id uuid,
  account_id uuid,
  side text,
  instrument_key text,
  decided_at timestamptz,
  valid_until timestamptz,
  risk_pct text,
  risk_cap_applied boolean,
  risk_cap_reason text,
  frozen_plan jsonb
)
language sql
security invoker
set search_path = public, pg_temp
as $$
  select d.id, i.id, d.account_id, i.side, i.instrument_key, i.decided_at, i.valid_until,
         d.risk_transformation->>'resolved_risk_pct',
         d.risk_cap_applied, d.risk_cap_reason, d.frozen_plan
    from public.management_intent_destinations d
    join public.management_intents i on i.id = d.intent_id
   where i.user_id = auth.uid()
     and d.state = 'pending'
     and now() >= i.valid_from and now() < i.valid_until
     and (p_account_id is null or d.account_id = p_account_id)
   order by i.decided_at desc;
$$;
