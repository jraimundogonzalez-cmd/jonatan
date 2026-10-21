# 08 · INTEGRACIONES DE PROVEEDOR

> **Plantilla.** Se copia la sección §2 una vez por cada cuenta/plataforma que se
> contrate y se rellena con datos **verificados en la documentación oficial del
> proveedor**, no supuestos.
>
> 🔒 **Aquí no se escribe ninguna credencial.** Ni enteras, ni parciales, ni "de
> prueba". Ver `07_SECURITY.md`.

---

## 1. Cómo se usa

1. Antes de contratar: rellenar los campos marcados **[PRE-COMPRA]**. Son los
   que deciden si la integración es siquiera posible.
2. Al contratar: rellenar el resto.
3. Con la ficha completa se decide el modo de ingesta y se escribe el conector.

**Si un campo no se conoce, se deja como `PENDIENTE`.** No se rellena con una
suposición: una suposición escrita se convierte en un hecho falso tres semanas
después.

---

## 2. Ficha — plantilla en blanco

```
### Proveedor: PENDIENTE

| Campo | Valor | Notas |
|---|---|---|
| Provider (empresa de fondeo)        | PENDIENTE |  |
| Platform                            | PENDIENTE | [PRE-COMPRA] determina todo lo demás |
| Version / build                     | PENDIENTE | [PRE-COMPRA] |
| Environment                         | PENDIENTE | demo / real — nunca mezclar en el mismo diario |
| Authentication                      | PENDIENTE | API key+secret / OAuth2 / usuario+contraseña / token |
| Read-only access                    | PENDIENTE | [PRE-COMPRA] ¿existe credencial de SOLO LECTURA? |
| ¿Permiten acceso programático?      | PENDIENTE | [PRE-COMPRA] ¿consta POR ESCRITO en sus términos? |
| API (REST)                          | PENDIENTE | base URL pública + límites de tasa |
| WebSocket                           | PENDIENTE | ¿existe? ¿qué emite? |
| Webhook                             | PENDIENTE | ¿saliente desde el proveedor? ¿se puede configurar? |
| Polling                             | PENDIENTE | intervalo mínimo permitido |
| Historical export                   | PENDIENTE | [PRE-COMPRA] CSV/XLSX — la RED DE SEGURIDAD |
| Timezone del servidor               | PENDIENTE | declarada por el proveedor, no deducida |
| Currency de la cuenta               | PENDIENTE |  |
| Account identifier                  | PENDIENTE | formato y estabilidad en el tiempo |
| Identificador de posición/operación | PENDIENTE | será `external_ref`; sin él no hay deduplicación |
| Symbol format                       | PENDIENTE | ej. "EURUSD", "EUR/USD", "EURUSD.r" |
| Contract/unit specification         | PENDIENTE | tamaño de contrato, valor de pip, dígitos |
| Comisiones y tasas                  | PENDIENTE | ¿se reportan por operación? NUNCA asumir cero |
| Restrictions                        | PENDIENTE | límites de tasa, prohibiciones, bloqueo por uso de API |
| Official documentation              | PENDIENTE | URL pública |
| Connector id propuesto              | PENDIENTE | valor que irá en `trades.source` |
| Ingestion mode elegido              | PENDIENTE | file_import / api_poll / webhook / manual_entry |
| Connector status                    | NO INICIADO | NO INICIADO / EN DISEÑO / EN DESARROLLO / ACTIVO |
| Credenciales almacenadas en         | PENDIENTE | nunca el valor, solo DÓNDE viven |
```

---

## 3. Preguntas [PRE-COMPRA] — hacerlas ANTES de pagar

Estas cuatro deciden si la integración es posible. Las prop firms normalmente
**no** exponen API propia: la expone la plataforma, y muchas firmas restringen o
prohíben el acceso programático en sus términos de servicio.

1. **¿Qué plataforma exacta y qué versión?**
   Determina qué conector hay que escribir y si ya existe documentación pública.

2. **¿Permiten acceso programático / lectura por API? ¿Consta por escrito?**
   Si lo prohíben sus términos, usar la API puede costar la cuenta. Esto no se
   asume: se pregunta y se guarda la respuesta.

3. **¿Ofrecen credenciales de solo lectura?**
   TradePilot no ejecuta (I17). Una credencial con permiso de trading es un
   riesgo innecesario. Si solo existe esa, hay que declararlo como riesgo
   aceptado conscientemente.

4. **¿Hay exportación de histórico en fichero?**
   **Esta es la red de seguridad.** `file_import` ya está contemplado en el
   contrato de conectores, no necesita credenciales ni proceso servidor, y es
   con diferencia el camino más corto a una primera integración real.

---

## 4. Qué entregar para que se pueda escribir el conector

Para cada proveedor, además de la ficha:

- **Un export real anonimizado** (o sintético) con las **cabeceras** y varias
  filas: formato de fechas, de símbolos, de números y separadores decimales.
- **La documentación pública** del endpoint o del formato.
- **La zona horaria** declarada por el proveedor.
- La **especificación de contrato/unidad** de los instrumentos que se operen.

🔒 Antes de compartir cualquier export: quitar números de cuenta completos,
nombres y cualquier token. Un identificador enmascarado (`****4821`) es
suficiente para diseñar.

---

## 5. Registro de proveedores

| # | Proveedor | Plataforma | Connector id | Estado |
|---|---|---|---|---|
| — | *(ninguno todavía)* | — | — | — |
