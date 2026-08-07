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
-- FUERA DE ALCANCE (BUILD 009): caducidad (B6), contratos de lectura (B7),
-- reclamación (B8), desenlace (B9). Esta función solo crea.
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
