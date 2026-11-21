# 07 — Estrategia de pruebas y QA

## 1. Niveles

| Nivel | Herramienta | Qué cubre | Dónde corre |
|-------|-------------|-----------|-------------|
| Base de datos | **pgTAP** (`supabase test db`) | RLS, privilegios, triggers, máquina de estados, invariantes contables | GitHub Actions con Supabase local |
| Storage / API | **Vitest** + `supabase-js` con usuarios de prueba reales del stack local | Aislamiento de archivos, URLs firmadas, Route Handlers | GitHub Actions |
| Unitarias | **Vitest** | Fórmulas, conversión de divisas, redondeo, cálculo de R, parsers, validación Zod de salidas de IA | GitHub Actions |
| Extracción | **Vitest** + `MockExtractor` + imágenes **sintéticas** | Que datos sin evidencia se descarten, duplicados, emparejamiento | GitHub Actions (sin llamar a proveedores reales) |
| E2E | **Playwright** (Chromium, escritorio y móvil emulado) | Flujos completos: invitación, alta de cuenta, payout, revisión de documento, dashboard | GitHub Actions |
| Seguridad estática | Supabase Security Advisors, `npm audit`, escaneo de secretos (gitleaks) | Tablas sin RLS, funciones inseguras, dependencias, claves filtradas | GitHub Actions |

**Datos de prueba:** siempre sintéticos (usuarios `alice@test.local`, `bob@test.local`, `owner@test.local`). Nunca datos reales sin tu autorización.

## 2. Cómo se simula a un usuario en pgTAP

```sql
begin;
select plan(3);
-- actuar como Bob
set local role authenticated;
set local request.jwt.claims = '{"sub":"<bob-uuid>","role":"authenticated"}';

select is_empty($$ select * from accounts where owner_id = '<alice-uuid>' $$,
  'Bob no ve cuentas de Alice');
select throws_ok($$ update accounts set notes='x' where id = '<cuenta-alice>' $$ ... );  -- o 0 filas afectadas
select throws_ok($$ insert into trades(account_id, ...) values ('<cuenta-alice>', ...) $$,
  '23503', null, 'Bob no puede vincular una operación a la cuenta de Alice (FK compuesta)');
select * from finish();
rollback;
```

## 3. Matriz de pruebas de aislamiento (obligatoria para CADA tabla privada)

Para cada tabla privada `X` y usuarios A (dueño) y B (otro), incluido B = `platform_owner`:

| # | Caso | Esperado |
|---|------|----------|
| 1 | B hace `select` de filas de A | 0 filas |
| 2 | B hace `update` de filas de A | 0 filas afectadas |
| 3 | B hace `delete` de filas de A | 0 filas / denegado |
| 4 | B inserta fila con `owner_id = A` | Error RLS |
| 5 | A cambia `owner_id` de su fila a B | Error (privilegio de columna / trigger / WITH CHECK) |
| 6 | B inserta fila hija que referencia un padre de A | Error FK compuesta |
| 7 | `anon` hace cualquier operación | Denegado |
| 8 | B llama a cada RPC/vista de estadísticas | Solo devuelve datos de B |

**Prueba de cobertura automática** (evita olvidar una tabla nueva):

```sql
-- Falla si alguna tabla de 'public' no tiene RLS activado y forzado
select is_empty($$
  select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and (not c.relrowsecurity or not c.relforcerowsecurity)
$$, 'Todas las tablas públicas tienen RLS forzado');

-- Falla si alguna vista de 'public' no es security_invoker
-- Falla si alguna función SECURITY DEFINER está en un esquema expuesto
-- Falla si existe una vista materializada en 'public'
```

## 3 bis. Suite de ataque con identificadores conocidos (mejora obligatoria 4)

Supuesto pesimista: **Bob conoce todos los UUID de Alice** (cuentas, movimientos, payouts, operaciones, documentos, rutas de Storage,
exportaciones). La suite crea los datos de Alice, se los pasa a Bob y verifica que cada intento falla. Se ejecuta como pgTAP (BD)
y como Vitest con `supabase-js` autenticado como Bob (API/Storage real del stack local).

| # | Ataque de Bob con el ID de Alice | Resultado exigido |
|---|----------------------------------|-------------------|
| A1 | `select * from <tabla> where id = '<id-alice>'` (para **cada** tabla privada, generado automáticamente desde el catálogo) | 0 filas |
| A2 | `update <tabla> set … where id = '<id-alice>'` | 0 filas afectadas; los datos de Alice no cambian (se verifica después como Alice) |
| A3 | `delete from <tabla> where id = '<id-alice>'` | 0 filas / excepción; la fila sigue existiendo |
| A4 | `insert` con `owner_id = '<uid-alice>'` | Error RLS (`42501`) |
| A5 | Crear hijo (operación, payout, movimiento, documento vinculado, opción) que referencia el padre de Alice | Error FK (`23503`) |
| A6 | Cada RPC llamada con IDs de Alice (`rectify_transaction`, `void_transaction`, `change_account_status`, `confirm_document`, `register_payout_received`, `revert_import`, `update_trade`…) | Error "no encontrado"; ninguna fila de Alice cambia; nada nuevo en `record_changes` de Alice |
| A7 | `stats_*` y vistas: comparar el resultado con y sin datos de Alice en la BD | Idéntico (los datos de Alice no influyen en los números de Bob) |
| A8 | `storage.download('documents', '<uid-alice>/<doc>.jpg')` | Denegado |
| A9 | `createSignedUrl` sobre una ruta de Alice | Denegado |
| A10 | `upload` a `<uid-alice>/…` y sobrescritura de un objeto de Alice | Denegado |
| A11 | Descarga de `<uid-alice>/exports/<job>.xlsx` y `select` en `export_jobs` de Alice | Denegado / 0 filas |
| A12 | Exportar con filtros manipulados (`owner_id`, `firm_id` de una empresa privada de Alice) | El archivo solo contiene filas de Bob (se parsea el CSV/XLSX generado y se comprueba cada fila) |
| A13 | Leer `record_changes`, `audit_log`, `document_extractions` de Alice por `record_id` | 0 filas |
| A14 | Bob es `platform_owner` y repite A1–A13 | Mismos resultados: el rol no da acceso a datos privados |
| A15 | Peticiones a Route Handlers con IDs de Alice en la URL o el cuerpo (`/api/documents/<id-alice>/extract`, `/confirm`, `/export`) | 404 genérico; el proveedor de IA **no** recibe ninguna llamada (verificado con el mock) |
| A16 | Llamadas con `anon` (sin sesión) y con JWT caducado o manipulado | Denegado |

La lista de tablas para A1–A5 se **genera desde `information_schema`**. Así, una tabla nueva sin cubrir hace fallar la prueba ("tabla privada sin caso de ataque").

## 3 ter. Auditoría financiera (mejora obligatoria 1)

| Caso | Esperado |
|------|----------|
| Alta de movimiento, payout u operación | Fila en `record_changes` (`insert`) con usuario, fecha y motivo |
| Rectificar un importe con `rectify_transaction` | Original anulado + nuevo con `replaces_transaction_id`; `record_changes` con valor anterior, valor nuevo, motivo y usuario; totales correctos |
| Anular sin motivo | Excepción; nada cambia |
| `update transactions set amount = …` directo | Denegado (privilegio de columna) |
| UPDATE que llega a la tabla sin `proppilot.change_reason` (simulando un fallo de código) | El trigger lanza excepción y se hace rollback |
| `delete` en `transactions`, `payouts`, `trades` y `record_changes` | Denegado para `authenticated` |
| `update`/`delete` en `record_changes` | Denegado |
| Revertir una importación | Todas las operaciones del lote anuladas + un `record_changes` por fila |
| Diff | `old_values`/`new_values` contienen solo las columnas cambiadas y sus valores exactos |

## 3 quater. Duplicados (mejora obligatoria 3)

| Caso | Esperado |
|------|----------|
| Subir el mismo archivo dos veces | Bloqueado por sha256 |
| Misma captura recomprimida | Aviso de casi-duplicado |
| Dos facturas distintas con el mismo nº de factura y empresa | Segunda bloqueada |
| Misma compra sin nº de factura (mismo importe y fecha ±2 días) | Aviso; solo se guarda con motivo, que queda auditado |
| `confirm_document` dos veces (secuencial y concurrente) | Un solo movimiento |
| Dos documentos distintos del mismo payout | Un solo `payout_receipt` |
| Reimportar el mismo CSV | 0 operaciones nuevas, todas reportadas como duplicadas |
| CSV con solapamiento parcial | Solo se importan las nuevas |
| `MockExtractor` devuelve los mismos datos para dos imágenes distintas del mismo justificante | El segundo movimiento choca con `dedupe_key` |
| Reintento de red con el mismo `client_request_id` | Idempotente |

## 3 quinquies. Exportación (mejora obligatoria 2)

| Caso | Esperado |
|------|----------|
| Exportar CSV y XLSX de cada conjunto | Columnas y tipos correctos; los totales del archivo coinciden con `stats_finance` |
| Celda con `=HYPERLINK(...)` procedente del OCR | Escapada en CSV y XLSX |
| ZIP de documentos | Solo objetos `uid/`; `manifest.csv` con un sha256 por archivo que coincide con el contenido |
| Archivo exportado pasadas 24 h | Borrado y URL inválida |
| Exportación con dos usuarios con datos | Cero filas ajenas (A12) |

## 4. Storage

| Caso | Esperado |
|------|----------|
| B descarga `alice-uuid/doc.jpg` | 403/404 |
| B genera URL firmada de un objeto de A | Denegado |
| B sube a `alice-uuid/...` | Denegado |
| A sobrescribe o borra su propio justificante | Denegado (no hay UPDATE/DELETE) |
| URL firmada usada tras 60 s | Caducada |
| Subida de 20 MB o `.exe` | Rechazada por el bucket |
| `documents.storage_path` con prefijo de otro usuario | Rechazado por CHECK |

## 5. Invitaciones

| Caso | Esperado |
|------|----------|
| Registro sin token | Rechazado |
| Token válido | Usuario creado, invitación `accepted` |
| Mismo token segunda vez | Rechazado |
| Dos registros simultáneos con el mismo token | Exactamente uno tiene éxito |
| Token caducado / revocado | Rechazado, mensaje genérico |
| Token vinculado a email X usado con email Y | Rechazado |
| Miembro crea invitación | Denegado |
| Miembro lee tabla `invitations` | 0 filas |
| Búsqueda del token en claro en BD y logs | No aparece |
| Usuario sin verificar email inicia sesión | Denegado |
| Usuario intenta insertarse en `platform_roles` | Denegado |

## 6. Auditoría de estados

| Caso | Esperado |
|------|----------|
| `update accounts set status = ...` directo | Denegado (privilegio de columna) |
| Insertar historial con transición inválida (p. ej. `refunded → funded_active`) | Error del trigger |
| Transición válida | Fila de historial con `changed_by = auth.uid()` y `accounts.status` actualizado |
| `update`/`delete` sobre `account_status_history` | Denegado |
| `burned` sin motivo | Error |

## 7. Integridad contable

| Caso | Esperado |
|------|----------|
| Dos `payout_receipt` para el mismo payout | Error índice único |
| Dos compras con el mismo `dedupe_key` | Error |
| Modificar `amount` de un movimiento | Denegado (trigger de inmutabilidad) |
| Anular movimiento | Desaparece de los totales, sigue visible en historial |
| Actualizar `fx_rates` | `amount_eur` de movimientos existentes no cambia |
| Confirmar dos veces el mismo documento | Segunda vez rechazada |
| Payout `requested`/`approved` | No suma en ingresos reales |
| Invariante `B = Σ amount_eur × direction` | Se cumple para todos los datasets de prueba |

## 8. Cálculos financieros (golden datasets)

Conjuntos de datos sintéticos con resultados calculados a mano y documentados en el propio test:

1. **Ejemplo del doc 06 §3** (4 evaluaciones, 2 resets, 2 funded) → coste por funded 500,00 €, tasa 33,3 %.
2. **Multidivisa:** compras en USD con distintos tipos BCE + payout con importe real bancario en EUR → totales EUR exactos al céntimo.
3. **Comisiones de payout** en sus dos modalidades (neto / bruto + `bank_fee`) → mismo beneficio neto.
4. **Denominadores cero:** usuario sin gastos → ROI "—"; sin pérdidas → profit factor "—".
5. **Redondeo:** sumas de 1 000 movimientos con céntimos → sin deriva (comparación con `decimal.js`).
6. **Trading:** operaciones long/short, con y sin stop, break-even → win rate, PF, R medio esperados.
7. **Por empresa:** suma de filas por empresa + "No atribuido" = total.

Cada fórmula se verifica en **SQL y en la implementación de referencia TS**; ambas deben coincidir.

## 9. E2E y responsive

- Flujos en viewport de escritorio (1440×900) y móvil (iPhone 14 / Pixel 7 emulados).
- Comprobación de que no hay scroll horizontal, navegación inferior visible en móvil, formularios usables con teclado numérico.
- Accesibilidad automática con `@axe-core/playwright` (contraste del tema oscuro incluido).

## 10. Puertas de calidad en CI (no se fusiona nada si falla)

1. Typecheck (`tsc --noEmit`, modo estricto) y lint.
2. Migraciones aplicadas desde cero sobre BD vacía.
3. pgTAP completo (incluida la prueba de cobertura RLS).
4. Vitest (unitarias, storage, extracción con mock).
5. Playwright E2E.
6. Security Advisors sin errores, gitleaks sin hallazgos, `npm audit` sin vulnerabilidades altas.
7. Revisión de migraciones: cualquier `drop`, `truncate`, `delete` o `alter ... type` requiere etiqueta de aprobación explícita.
8. Suite de ataque A1–A16 y prueba de cobertura "toda tabla privada tiene casos de ataque".
9. Ensayo de restauración (trimestral y antes de producción): ver doc 11 §4.3.

## 11. Reglas de empresas

| Caso | Esperado |
|------|----------|
| Regla `candidate` o `verified` sin URL o fecha de consulta | Rechazada por CHECK |
| Regla `verified` sin captura ni verificador | Rechazada |
| Cuenta LucidFlex 25K Rithmic | Solo resuelve reglas de ese producto; ninguna de LucidPro ni de otro tamaño |
| Cuenta comprada antes y después de una fecha de corte | Cada una resuelve su versión |
| Cálculos y alertas con reglas no `verified` | No se usan |
