# 07 · SEGURIDAD Y CREDENCIALES

> Dos partes: **(A)** el modelo de seguridad que ya existe y está verificado, y
> **(B)** la política de credenciales de proveedores, que es **análisis y
> propuesta — todavía sin implementar**.

---

# A · Lo que ya existe y está verificado

## A.1 Modelo de tres capas

| Capa | Responde a | Dónde |
|---|---|---|
| `GRANT` / `RLS` | quién puede **intentarlo** | políticas por tabla |
| `SECURITY DEFINER` | la autoridad de las operaciones **legítimas** | RPC del dominio |
| `TRIGGER` | qué estado es **válido** | triggers de inmutabilidad y estado |
| `audit_log` | el registro de las **correcciones** | tabla inmutable |

Son capas **independientes**: verificado que los triggers de inmutabilidad
saltan incluso ejecutando como propietario, cuando RLS ya no protege.

## A.2 Auditoría de privilegios

De las 12 funciones `SECURITY DEFINER` ejecutables por `authenticated`:
- **9 validan `auth.uid()`** explícitamente.
- **3 son funciones de trigger**, imposibles de invocar directamente
  (comprobado: *«trigger functions can only be called as triggers»*).

`crear_operacion_nucleo` tiene el `EXECUTE` **revocado** a `public` y
`authenticated`: era una tercera puerta de creación de operaciones y se cerró.

## A.3 Ataques verificados

Batería ejecutada contra PostgreSQL real, como rol `authenticated`:

| Ataque | Resultado |
|---|---|
| Mutar el Plan tras decidir y materializar | congelado respetado ✅ |
| Materializar dos veces | sin duplicado ✅ |
| Reescribir una Intención emitida | denegado ✅ |
| `UPDATE` / `DELETE` de evidencia de parciales | denegado ✅ |
| `INSERT` directo en `trades` | denegado ✅ |
| Llamada directa al núcleo de creación | denegado ✅ |
| Transiciones ilegales de estado | denegadas ✅ |
| Acceder a destino y cuenta de otro usuario | denegado ✅ |
| Reenviar la misma petición (intención y operación) | sin duplicado ✅ |

**10/10.**

## A.4 Dos trampas al escribir tests de seguridad

1. **El superusuario y el propietario están exentos de RLS.** Una suite
   conectada como `postgres` "pasa" comprobaciones de aislamiento que en
   realidad están rotas. Hay que conectarse como `authenticated`.
2. **RLS deniega en silencio** (0 filas), no con excepción. Un test que espere
   una excepción da un falso negativo. Hay que comprobar **el valor**, no la
   excepción.

## A.5 Secretos hoy

Lo único que existe es `apps/web/.env.local` con dos variables, y **ambas son
públicas por diseño**:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Todo lo que empieza por `NEXT_PUBLIC_` **se incrusta en el bundle del navegador**.
No es un almacén de secretos: es configuración pública.

`service_role` **nunca** se lee, ni se escribe, ni se muestra. El lanzador de
Windows lo evita explícitamente.

---

# B · Política de credenciales de proveedores — PROPUESTA

> Nada de esto está implementado. Es el análisis pedido antes de construir.

## B.1 Regla fundamental

> ## 🔒 LAS IAs NO RECIBEN CREDENCIALES REALES. NUNCA.

Ni en el prompt, ni en un fichero, ni "solo para probar", ni ofuscadas.

**Nunca a una IA**: API keys · API secrets · tokens OAuth · refresh tokens ·
contraseñas · cookies · identificadores de sesión · claves `service_role`.

**Nunca en**: el código fuente · el frontend · git · ficheros de ejemplo ·
mensajes de commit · logs · capturas de pantalla · mensajes de error.

### Qué SÍ puede conocer una IA

| Puede conocer | No puede conocer |
|---|---|
| El **nombre** de la plataforma y su versión | Cualquier credencial |
| La **forma** de las credenciales (`API key` + `secret`, OAuth…) | Su valor |
| El **formato** de los datos (cabeceras CSV, esquema JSON) | Datos reales de la cuenta |
| El identificador de cuenta **enmascarado** (`****4821`) | El identificador completo |
| La documentación pública del proveedor | Endpoints privados con token incrustado |
| Datos **sintéticos** o anonimizados | Un export real sin anonimizar |

**Corolario**: una IA debe poder escribir un conector completo sin ver jamás un
secreto. Si un diseño exige lo contrario, el diseño está mal.

## B.2 Dónde vivirían los secretos

**Propuesta: Supabase Vault (`pgsodium`)**, con cifrado en reposo dentro de la
misma base de datos. Está **comentado** en `supabase/config.toml` (`[db.vault]`)
y habría que habilitarlo.

Por qué Vault y no las alternativas:

| Opción | Veredicto |
|---|---|
| `NEXT_PUBLIC_*` | ❌ Es publicar la clave |
| Tabla normal con RLS | ❌ Si el navegador la lee con la clave anónima, está expuesta |
| Variables de entorno del servidor | 🟡 Vale para un secreto global, **no** para N credenciales por usuario y cuenta |
| **Supabase Vault** | ✅ Cifrado en reposo, por fila, en la base que ya existe |

## B.3 Quién podría leerlo

El mismo patrón que ya se usa para `crear_operacion_nucleo`:

```
authenticated          → SIN acceso de lectura al secreto. Ni SELECT.
RPC SECURITY DEFINER   → único camino; descifra y usa, nunca devuelve
proceso de conector    → recibe el secreto en memoria, nunca lo persiste ni lo registra
```

El usuario **escribe** la credencial (una vez) y **nunca puede volver a leerla**.
Solo puede sustituirla o revocarla. Si necesita verla, está en el proveedor.

## B.4 Cómo la usaría un conector

```
Conector  →  RPC SECURITY DEFINER  →  Vault (descifra)
                     │
                     └─ devuelve el RESULTADO de la llamada, nunca el secreto
```

Regla: **el secreto no cruza nunca una frontera de serialización.** Ni a una
Server Action, ni a un Server Component, ni a una respuesta HTTP.

## B.5 Cómo evitar que llegue al frontend

1. Jamás en una variable `NEXT_PUBLIC_*`.
2. Jamás como valor de retorno de una RPC.
3. Jamás en un campo de formulario rellenado con el valor existente — un campo
   de credencial se muestra **vacío** y con una marca «configurada el <fecha>».
4. El tipo que representa una cuenta conectada en el frontend **no tiene campo
   para el secreto**. Lo que no existe en el tipo no se filtra.

## B.6 Cómo evitar que aparezca en logs

- Hoy el proyecto tiene **2 llamadas a `console.*` en toda la aplicación** y
  ninguna librería de logging. Eso es una ventaja de partida: hay que decidir el
  registro **antes** de que haya algo que registrar.
- Cuando se añada: lista de campos a enmascarar **por omisión** (denegar por
  defecto, no permitir por defecto).
- Nunca registrar el `raw_payload` de un conector sin filtrar: puede contener
  cabeceras de autenticación.
- Ya existe un precedente correcto en el proyecto: `detalleTecnico(error)`
  separa el mensaje para el usuario del detalle para el registro, y el crudo de
  PostgreSQL no llega a pantalla.

## B.7 Rotación y revocación

**Rotación**: escribir la nueva credencial crea una fila nueva y marca la
anterior como superada. Nunca un `UPDATE` destructivo: si la nueva falla, hay
que poder volver.

**Revocación**: marcar la credencial como revocada **y** desactivar la cuenta
conectada. Una credencial revocada no se borra inmediatamente — se conserva el
rastro de que existió y cuándo dejó de valer, coherente con cómo este proyecto
trata el historial.

**Caducidad**: los `refresh_token` de OAuth caducan. Haría falta registrar
`expires_at` y una política de renovación. Esto **exige un proceso servidor que
hoy no existe**.

## B.8 Qué falta para implementar esto

| Pieza | Estado |
|---|---|
| Habilitar Vault en `config.toml` | 🔴 comentado |
| Tabla de credenciales por cuenta conectada | 🔴 |
| RPC `SECURITY DEFINER` de escritura y uso | 🔴 |
| Proceso servidor donde corra un conector | 🔴 **no existe ninguno** |
| Política de enmascarado en logs | 🔴 |

> ⚠️ El punto 4 es el más subestimado: hoy **no hay backend de larga duración**.
> El backend es PostgreSQL + Server Actions. Sin un worker o una Edge Function,
> no hay dónde ejecutar polling, renovación de tokens ni reconexión.
