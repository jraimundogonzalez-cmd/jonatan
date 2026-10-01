-- Validación de Rule Engine (BUILD 006B) contra Postgres real, como el rol
-- "authenticated". Cubre: append-only de evaluaciones, inmutabilidad del
-- Snapshot, idempotencia por evento, emisión de ReglaIncumplida solo en modo
-- enforced, la frontera de propiedad de `compliance_flag` (Rule Engine NO lo
-- escribe; Funding Management sí, con compare-and-set), y aislamiento RLS.
--
-- UUIDs bbbb.../cccc... — distintos de los de 01-04.

\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('bbbbbbbb-1111-1111-1111-111111111111', 'trader-k@test.local'),
  ('cccccccc-1111-1111-1111-111111111111', 'trader-l@test.local')
on conflict (id) do nothing;

-- La Library es catálogo global: se siembra como superusuario (no hay
-- política de INSERT para `authenticated`, por diseño).
reset role;
insert into public.rule_definitions (key, version, name, archetype, category, scope, parameter_schema, archetype_version)
values
  ('static_drawdown', 1, 'Static Drawdown', 'static_threshold', 'compliance', 'account_state', '{}'::jsonb, 'static_threshold.v1'),
  ('profit_target', 1, 'Profit Target', 'progress_to_target', 'compliance', 'account_state', '{}'::jsonb, 'progress_to_target.v1');

set role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-1111-1111-1111-111111111111', false);

select crear_empresa('Personal', true);
select id as firm_k_id from public.prop_firms where user_id = 'bbbbbbbb-1111-1111-1111-111111111111' \gset
select id as cuenta_k_id from crear_cuenta(
  :'firm_k_id'::uuid, 'Cuenta K', '10000.0000', 'USD', null
) \gset

\echo '--- [1] compliance_flag arranca en unknown con secuencia 0 ---'
select compliance_flag, compliance_flag_event_sequence from public.accounts where id = :'cuenta_k_id';

\echo '--- [2] crear Rule Profile + Instance, y congelar el Snapshot ---'
insert into public.rule_profiles (prop_firm_id, name) values (:'firm_k_id'::uuid, 'Perfil K') returning id as profile_k_id \gset
insert into public.rule_instances (rule_profile_id, rule_definition_id, parameters, mode)
values (
  :'profile_k_id'::uuid,
  (select id from public.rule_definitions where key = 'static_drawdown' and version = 1),
  '{"input":"drawdown_restante_pct","operator":"gte","threshold":"2.0000"}'::jsonb,
  'enforced'
);
insert into public.rule_profile_snapshots (source_rule_profile_id, frozen_instances)
select :'profile_k_id'::uuid, jsonb_agg(jsonb_build_object(
  'definition', jsonb_build_object('key', d.key, 'version', d.version, 'archetype', d.archetype,
                                   'archetype_version', d.archetype_version, 'scope', d.scope),
  'parameters', i.parameters, 'mode', i.mode))
from public.rule_instances i join public.rule_definitions d on d.id = i.rule_definition_id
where i.rule_profile_id = :'profile_k_id'::uuid
returning id as snapshot_k_id \gset

update public.accounts set rule_profile_snapshot_id = :'snapshot_k_id'::uuid where id = :'cuenta_k_id';
select count(*) as snapshot_vigente from rule_engine_obtener_snapshot(:'cuenta_k_id'::uuid);

\echo '--- [3] INMUTABILIDAD del Snapshot, capa 1 (RLS): sin política de UPDATE — esperado: UPDATE 0 ---'
\set ON_ERROR_STOP off
update public.rule_profile_snapshots set frozen_instances = '[]'::jsonb where id = :'snapshot_k_id'::uuid;
\set ON_ERROR_STOP on

\echo '--- [4] persistir una pasada: 1 compliant + 1 violated(enforced) — esperado: persisted=t, 2 insertadas ---'
select * from rule_engine_persistir_evaluacion(
  :'cuenta_k_id'::uuid,
  'eeeeeeee-1111-1111-1111-111111111111'::uuid,
  jsonb_build_array(
    jsonb_build_object('rule_profile_snapshot_id', :'snapshot_k_id', 'rule_definition_key','static_drawdown',
      'rule_definition_version',1,'archetype_version','static_threshold.v1','mode','enforced',
      'verdict','compliant','margin','3.2600','triggering_event_sequence',10,
      'evaluation_context', jsonb_build_object('archetype','static_threshold')),
    jsonb_build_object('rule_profile_snapshot_id', :'snapshot_k_id', 'rule_definition_key','profit_target',
      'rule_definition_version',1,'archetype_version','progress_to_target.v1','mode','enforced',
      'verdict','violated','margin','-500.0000','triggering_event_sequence',10,
      'evaluation_context', jsonb_build_object('archetype','progress_to_target'))
  )
);

\echo '--- [5] IDEMPOTENCIA: reprocesar el mismo event_id — esperado: persisted=f, 0 insertadas ---'
select * from rule_engine_persistir_evaluacion(
  :'cuenta_k_id'::uuid, 'eeeeeeee-1111-1111-1111-111111111111'::uuid,
  jsonb_build_array(jsonb_build_object('rule_profile_snapshot_id', :'snapshot_k_id',
    'rule_definition_key','static_drawdown','rule_definition_version',1,
    'archetype_version','static_threshold.v1','mode','enforced','verdict','compliant',
    'margin','3.2600','triggering_event_sequence',10,'evaluation_context','{}'::jsonb))
);
select count(*) as evaluaciones_totales from public.rule_evaluations where account_id = :'cuenta_k_id';

\echo '--- [6] ReglaIncumplida emitida solo por el veredicto violated — esperado: 1 ---'
select count(*) as reglas_incumplidas from public.domain_events
  where account_id = :'cuenta_k_id' and event_type = 'ReglaIncumplida';

\echo '--- [7] FRONTERA DE PROPIEDAD: Funding Management actualizó el caché — esperado: violated / 10 ---'
select compliance_flag, compliance_flag_event_sequence from public.accounts where id = :'cuenta_k_id';

\echo '--- [8] COMPARE-AND-SET: una llegada TARDÍA (secuencia 5 < 10) no sobrescribe el caché ---'
\echo '        Ojo: la evaluación tardía SÍ se audita y SÍ emite ReglaIncumplida (es violated'
\echo '        en modo enforced); lo único que no puede hacer es retroceder el caché. Por eso'
\echo '        el total de eventos pasa a 2 — y por eso [9] se mide por regla, no por total.'
select * from rule_engine_persistir_evaluacion(
  :'cuenta_k_id'::uuid, 'ffffffff-1111-1111-1111-111111111111'::uuid,
  jsonb_build_array(jsonb_build_object('rule_profile_snapshot_id', :'snapshot_k_id',
    'rule_definition_key','profit_target','rule_definition_version',1,
    'archetype_version','progress_to_target.v1','mode','enforced','verdict','violated',
    'margin','-900.0000','triggering_event_sequence',5,'evaluation_context','{}'::jsonb))
);
select compliance_flag_event_sequence as sigue_en_10 from public.accounts where id = :'cuenta_k_id';

\echo '--- [9] modo shadow: se AUDITA pero NO emite ReglaIncumplida ---'
\echo '        Se mide por regla, no por total: `static_drawdown` solo ha sido evaluada'
\echo '        como compliant ([4]) y como violated-en-shadow (aquí). Si el modo shadow'
\echo '        filtrase un incumplimiento, este contador sería 1.'
select * from rule_engine_persistir_evaluacion(
  :'cuenta_k_id'::uuid, 'aaaaaaaa-2222-2222-2222-222222222222'::uuid,
  jsonb_build_array(jsonb_build_object('rule_profile_snapshot_id', :'snapshot_k_id',
    'rule_definition_key','static_drawdown','rule_definition_version',1,
    'archetype_version','static_threshold.v1','mode','shadow','verdict','violated',
    'margin','-1.0000','triggering_event_sequence',20,'evaluation_context','{}'::jsonb))
);
select
  (select count(*) from public.domain_events
     where account_id = :'cuenta_k_id' and event_type = 'ReglaIncumplida'
       and payload->>'rule_definition_key' = 'static_drawdown') as eventos_de_la_regla_shadow_esperado_0,
  (select count(*) from public.rule_evaluations
     where account_id = :'cuenta_k_id' and mode = 'shadow') as evaluaciones_shadow_auditadas_esperado_1,
  (select count(*) from public.domain_events
     where account_id = :'cuenta_k_id' and event_type = 'ReglaIncumplida') as total_esperado_2_las_dos_de_profit_target;

\echo '--- [10] APPEND-ONLY, capa 1 (RLS): sin política de UPDATE/DELETE — esperado: UPDATE 0 / DELETE 0 ---'
\set ON_ERROR_STOP off
update public.rule_evaluations set verdict = 'compliant' where account_id = :'cuenta_k_id';
delete from public.rule_evaluations where account_id = :'cuenta_k_id';
\set ON_ERROR_STOP on

\echo '--- [10b] APPEND-ONLY, capa 2 (trigger): defensa frente a un rol que SALTA RLS ---'
\echo '        Hallazgo metodológico de BUILD 003 aplicado: RLS no protege a un superusuario'
\echo '        ni a un service_role, así que la inmutabilidad no puede depender solo de ella.'
reset role;
\set ON_ERROR_STOP off
update public.rule_evaluations set verdict = 'compliant' where account_id = :'cuenta_k_id';
delete from public.rule_evaluations where account_id = :'cuenta_k_id';
update public.rule_profile_snapshots set frozen_instances = '[]'::jsonb where id = :'snapshot_k_id'::uuid;
\set ON_ERROR_STOP on
set role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-1111-1111-1111-111111111111', false);

\echo '--- [11] última evaluación por regla (lectura O(1) del semáforo) — esperado: 2 filas ---'
select count(*) as reglas_con_veredicto from rule_engine_ultimas_evaluaciones(:'cuenta_k_id'::uuid);

select set_config('request.jwt.claim.sub', 'cccccccc-1111-1111-1111-111111111111', false);

\echo '--- [12] RLS: L no ve evaluaciones de K — esperado: 0 ---'
select count(*) as evaluaciones_visibles_para_l from public.rule_evaluations where account_id = :'cuenta_k_id';

\echo '--- [13] RLS: L no ve el Snapshot ni el Perfil de K — esperado: 0 y 0 ---'
select
  (select count(*) from public.rule_profile_snapshots where id = :'snapshot_k_id') as snapshots,
  (select count(*) from public.rule_profiles where id = :'profile_k_id') as perfiles;

\echo '--- [14] La Library SÍ es legible por cualquier autenticado (catálogo global) — esperado: 2 ---'
select count(*) as definiciones_visibles from public.rule_definitions;

\echo '--- [15] RLS: L no puede escribir una evaluación sobre la Cuenta de K — esperado: ERROR ---'
\set ON_ERROR_STOP off
select rule_engine_persistir_evaluacion(
  :'cuenta_k_id'::uuid, 'dddddddd-3333-3333-3333-333333333333'::uuid,
  jsonb_build_array(jsonb_build_object('rule_profile_snapshot_id', :'snapshot_k_id',
    'rule_definition_key','static_drawdown','rule_definition_version',1,
    'archetype_version','static_threshold.v1','mode','enforced','verdict','violated',
    'margin','0','triggering_event_sequence',99,'evaluation_context','{}'::jsonb))
);
\set ON_ERROR_STOP on

reset role;
