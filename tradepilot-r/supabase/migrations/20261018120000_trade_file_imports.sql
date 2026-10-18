-- Importación de ficheros de operaciones cerradas — fase 1.
--
-- Migración ADITIVA: crea dos tablas nuevas y no altera ninguna existente. No
-- toca `trades`, `accounts` ni ningún dato ya guardado.
--
-- ============================================================
-- POR QUÉ NO SE ESCRIBE EN `trades`
--
-- Una fila de un fichero de operaciones cerradas no es todavía una Operación
-- de TradePilot:
--   · `trades` exige `risk_pct`, `risk_amount` y un Plan (`rr_objective`,
--     `be_trigger`). El fichero no trae ninguno: habría que inventarlos.
--   · El desenlace de una Operación sin parciales y sin cierre manual vale
--     −1R por la fórmula congelada (04_TRADING_MODEL.md §3). Importar las
--     pérdidas así sería forzarlas todas a −1R.
--   · Varias filas pueden ser partes de una misma posición. No hay regla
--     validada para agruparlas.
-- Así que esta fase guarda la EVIDENCIA ORIGINAL, separada de las Operaciones.
-- Reconstruir Operaciones a partir de ella es una fase posterior, y pasará por
-- las RPC del dominio (DEC-007), no por aquí.
--
-- ============================================================
-- POR QUÉ NO BASTA EL ÍNDICE `trades(account_id, source, external_ref)`
--
-- Ese índice (DEC-005) es la deduplicación correcta para una operación con un
-- identificador externo estable. Este fichero no exporta ninguno, y vive en
-- `trades`, donde por lo anterior no se puede escribir. Se reproduce la MISMA
-- forma de clave —(cuenta, conector, identidad)— sobre la tabla de evidencia,
-- con una identidad derivada de los datos de la fila (ver
-- packages/connectors/src/huella.ts) en lugar de un identificador inventado.
--
-- ============================================================
-- INVARIANTES QUE SE MANTIENEN
--   · I17 — nada de esto ejecuta ni envía órdenes.
--   · I10 — la base no conoce la plataforma: `source` es solo el id del
--     conector, un texto.
--   · I5  — importes y precios en `numeric` SIN escala fija: se guardan con
--     exactamente las cifras que traía el fichero, sin redondeo.
--   · Evidencia inmutable — ni las filas ni los lotes admiten UPDATE/DELETE.

-- ============================================================
-- 1 · Lote de importación: quién importó qué fichero, cuándo y con qué
--     resultado. Un lote se registra aunque no aporte ninguna fila nueva (una
--     reimportación completa queda auditada como "todo duplicado").
-- ============================================================
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,

  source text not null check (source ~ '^[a-z0-9_]{1,64}$'),
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  -- Zona IANA en la que el usuario declaró que están escritas las horas.
  source_timezone text not null check (char_length(source_timezone) between 1 and 64),
  -- Identificador de cuenta tal como aparece en el fichero.
  external_account_ref text not null check (char_length(trim(external_account_ref)) between 1 and 128),

  rows_total integer not null check (rows_total >= 0),
  rows_imported integer not null check (rows_imported >= 0),
  rows_review_accepted integer not null check (rows_review_accepted >= 0),
  rows_duplicate integer not null check (rows_duplicate >= 0),
  rows_review_skipped integer not null check (rows_review_skipped >= 0),
  rows_other_account integer not null check (rows_other_account >= 0),
  rows_invalid integer not null check (rows_invalid >= 0),
  -- Detalle por fila de lo que NO se guardó (inválidas con sus errores,
  -- revisiones no aceptadas…). Lo declara el importador; es informativo.
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),

  created_at timestamptz not null default now(),

  check (rows_review_accepted <= rows_imported)
);

create index import_batches_account_idx on public.import_batches(account_id, source, created_at desc);

-- ============================================================
-- 2 · Filas importadas: la evidencia original, una fila del fichero = una fila
--     aquí. Nunca se agrupan ni se reinterpretan.
-- ============================================================
create table public.imported_trade_rows (
  id uuid primary key default gen_random_uuid(),
  -- DEFERRABLE: las filas se insertan antes que su lote, para que el lote nazca
  -- ya con los recuentos definitivos y no haya que actualizarlo (es inmutable).
  batch_id uuid not null references public.import_batches(id) on delete cascade deferrable initially deferred,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  source text not null check (source ~ '^[a-z0-9_]{1,64}$'),

  -- Identidad de la fila (packages/connectors/src/huella.ts).
  dedup_key text not null check (dedup_key ~ '^[0-9a-f]{64}$'),
  match_key text not null check (match_key ~ '^[0-9a-f]{64}$'),
  occurrence integer not null check (occurrence >= 1),
  row_number integer not null check (row_number >= 1),

  external_account_ref text not null check (char_length(trim(external_account_ref)) between 1 and 128),
  symbol text not null check (char_length(trim(symbol)) > 0),
  contract text not null check (char_length(trim(contract)) > 0),

  -- La hora TAL COMO VENÍA (reloj, sin zona) y su conversión explícita con la
  -- zona declarada en el lote. Si la zona resultara ser otra, el texto original
  -- permite rehacer la conversión sin pérdida.
  entry_local text not null check (entry_local ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$'),
  exit_local text not null check (exit_local ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$'),
  entry_at timestamptz not null,
  exit_at timestamptz not null,

  entry_price numeric not null check (entry_price > 0),
  exit_price numeric not null check (exit_price > 0),
  -- Tal como lo escribe el fichero. No se traduce a long/short aquí.
  side text not null check (side in ('BUY', 'SELL')),
  -- Con signo si el fichero lo trae con signo; nunca 0.
  quantity numeric not null check (quantity <> 0),
  -- Bruto y neto, ambos tal cual. No se deriva ninguna comisión de su resta.
  gross_pnl numeric not null,
  net_pnl numeric not null,

  -- Motivos por los que la fila exigió aceptación expresa (vacío si ninguno).
  review_reasons text[] not null default '{}',
  -- Todas las columnas originales como texto, incluidas las desconocidas.
  raw jsonb not null check (jsonb_typeof(raw) = 'object'),

  created_at timestamptz not null default now(),

  check (exit_at >= entry_at)
);

-- La protección contra importar dos veces la misma fila.
create unique index imported_trade_rows_dedup_idx
  on public.imported_trade_rows(account_id, source, dedup_key);
-- Búsqueda de "misma operación con otros importes" para la revisión.
create index imported_trade_rows_match_idx
  on public.imported_trade_rows(account_id, source, match_key);
create index imported_trade_rows_batch_idx
  on public.imported_trade_rows(batch_id, row_number);

-- ============================================================
-- 3 · Inmutabilidad: la evidencia no se reescribe ni se borra.
--
-- Igual que `trades` (BUILD 016B, `reject_trade_delete`), el borrado está
-- rechazado también en cascada: una Cuenta con evidencia importada no puede
-- borrarse por accidente arrastrándola.
-- ============================================================
create or replace function public.reject_import_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'IMPORT_ERROR:IMMUTABLE_EVIDENCE:% no admite %: la evidencia importada no se reescribe ni se borra',
    TG_TABLE_NAME, TG_OP;
end;
$$;

create trigger import_batches_immutable
  before update or delete on public.import_batches
  for each row execute function public.reject_import_mutation();

create trigger imported_trade_rows_immutable
  before update or delete on public.imported_trade_rows
  for each row execute function public.reject_import_mutation();

-- ============================================================
-- 4 · Superficie: lectura por el propietario; escritura solo por la RPC
--     `confirmar_importacion` (SECURITY DEFINER, supabase/functions/sql/imports.sql).
-- ============================================================
alter table public.import_batches enable row level security;
alter table public.imported_trade_rows enable row level security;

create policy import_batches_owner_read on public.import_batches
  for select using (auth.uid() = user_id);
create policy imported_trade_rows_owner_read on public.imported_trade_rows
  for select using (auth.uid() = user_id);

revoke insert, update, delete, truncate on public.import_batches from public;
revoke insert, update, delete, truncate on public.imported_trade_rows from public;
do $$
declare
  r text;
begin
  -- `anon` existe en Supabase y no en el entorno de tests SQL; se revoca solo
  -- donde existe.
  foreach r in array array['authenticated', 'anon'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke insert, update, delete, truncate on public.import_batches from %I', r);
      execute format('revoke insert, update, delete, truncate on public.imported_trade_rows from %I', r);
    end if;
  end loop;
end $$;
