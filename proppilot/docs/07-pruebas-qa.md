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
