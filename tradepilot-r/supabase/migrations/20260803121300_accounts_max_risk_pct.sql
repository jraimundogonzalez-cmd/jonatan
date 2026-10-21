-- BUILD 014 / B4 — Funding Management: tope de riesgo por Cuenta
--
-- Decisión A4 del fundador (BUILD 007): "Cualquier límite máximo de riesgo
-- por cuenta pertenece al dominio. Debe aplicarse al construir la intención y
-- debe quedar completamente explicado y registrado."
--
-- El **valor** del tope es configuración de la Cuenta, y por tanto propiedad
-- de Funding Management. La Intención solo registra que se aplicó y por qué
-- (`risk_cap_applied` / `risk_cap_reason`, BUILD 010) — nunca el valor, o
-- habría dos lugares de verdad para el mismo dato.
--
-- **Alcance de este build (B4 de BUILD 009): solo el dato.** Ninguna
-- validación de negocio se construye aquí: quién calcula la transformación de
-- riesgo y quién la juzga contra este tope deben ser módulos distintos
-- (regla 14 / I13), y ambos pertenecen a B5.
--
-- Estrictamente aditivo:
--   · valor por defecto NULL — ninguna Cuenta existente cambia de comportamiento;
--   · sin reescritura de tabla: `add column` nullable y sin defecto es una
--     operación de solo metadatos desde PG11;
--   · ningún cálculo del sistema lo lee todavía;
--   · Quant Engine, Risk Engine, Rule Engine, Operations y el Event Backbone
--     quedan intactos — ninguna de sus funciones referencia esta columna.
--
-- Los contratos de lectura de Funding no necesitan cambio: `listar_cuentas`
-- y `obtener_cuenta` devuelven `setof public.accounts` / `public.accounts`
-- con `select *`, de modo que exponen la columna nueva automáticamente. Es la
-- misma propiedad por la que `event_sequence` (BUILD 006A) fluyó sin tocar
-- `listar_eventos_pendientes`.

alter table public.accounts
  add column max_risk_pct numeric(5,2)
    check (max_risk_pct is null or (max_risk_pct > 0 and max_risk_pct <= 100));

-- Misma forma exacta que `profit_split_pct`, el otro porcentaje opcional de
-- esta tabla: `numeric(5,2)`, nullable, con rango comprobado solo cuando hay
-- valor. La única diferencia es el límite inferior — `profit_split_pct` admite
-- 0 (un reparto del 0% es concebible), pero un tope de riesgo de 0% no sería
-- un límite sino una prohibición total, y ninguna Operación podría cumplirlo
-- porque `trades.risk_pct` exige `> 0`.
comment on column public.accounts.max_risk_pct is
  'Riesgo máximo admitido por Operación en esta Cuenta, en %. NULL = sin tope configurado. Su aplicación corresponde a la construcción de una Intención (A4), nunca a esta tabla: aquí solo vive el valor.';
