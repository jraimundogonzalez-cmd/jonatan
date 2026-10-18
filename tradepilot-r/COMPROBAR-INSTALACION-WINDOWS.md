# Comprobar tu instalación de Windows antes de actualizar

Esta guía es para **comprobar sin cambiar nada** y decidir si tu base de datos
se puede actualizar. Sigue los pasos en orden. Si alguno no da lo esperado,
**para ahí** y envía el informe que se indica.

> Nada de esta guía borra datos ni ejecuta `supabase db reset`. Los pasos 1 a 5
> solo leen. El paso 6 (actualizar) es el único que cambia la base, y solo se
> hace si el diagnóstico dice **LISTA PARA ACTUALIZAR**.

---

## 0. Lo que tienes que saber antes

- Tus datos viven en el volumen de Docker `supabase_db_tradepilot-r`, no en la
  carpeta del proyecto. Cambiar de rama o de carpeta no los toca.
- Verificado en el código fuente de la CLI de Supabase: `supabase start`, con
  tu volumen ya existente, **no aplica migraciones ni datos iniciales** («Starting
  database from backup»). Abrir TradePilot con el código nuevo no cambia la
  base. Sí crearía una base **nueva y vacía** si el volumen no existiera; por
  eso el diagnóstico bloquea si no encuentra ninguna Cuenta.
- Ninguno de los scripts necesita herramientas de Linux: solo Docker,
  la CLI de Supabase y Windows PowerShell 5.1, que viene con Windows.

---

## 1. Proteger tu trabajo en Git (solo lectura)

Abre PowerShell en la carpeta `tradepilot-r` de tu ordenador y ejecuta:

```powershell
git status
git branch --show-current
git log --oneline -5
git stash list
```

| Si ves | Qué significa | Qué hacer |
|---|---|---|
| `nothing to commit, working tree clean` | No hay trabajo sin guardar | Sigue |
| Ficheros modificados o «Untracked files» | Hay trabajo local | **Para.** Copia la carpeta entera a otro sitio y envía la salida |
| Commits que no reconoces en `git log` (p. ej. `6a9d03a`, `c70f927`) | Puede ser el trabajo de ejecuciones | **Para.** Ejecuta `git push origin HEAD:refs/heads/rescate-ejecuciones` y avisa |

Busca también ese trabajo en otras ramas locales:

```powershell
git branch -a
git log --all --oneline | Select-String "6a9d03a|c70f927|ejecuci|estrateg"
git cat-file -t 6a9d03a
```

Si `git cat-file` responde `commit`, **ese trabajo está en tu PC**: publícalo
con `git push origin 6a9d03a:refs/heads/claude/tradepilot-r-ejecuciones` antes
de seguir.

---

## 2. Cambiar a la versión que trae los scripts (no toca la base)

Solo si el paso 1 salió limpio:

```powershell
git fetch origin
git checkout claude/ecstatic-planck-tg10r0
git pull
```

---

## 3. Arrancar la base (si no lo está)

Doble clic en **`Abrir_TradePilot.bat`**. Con tu volumen existente no aplica
cambios a la base. Cuando abra el navegador, puedes dejarlo abierto o cerrar
solo la ventana de la web; la base sigue en marcha.

Si el lanzador dice que la base **no está al día**, es lo esperado en este
punto: **no** actualices todavía.

---

## 4. Copia de seguridad verificada (solo lee la base)

Doble clic en **`Copia_de_seguridad_TradePilot.bat`**. Tiene que terminar con:

```
[OK] Copia de seguridad terminada y verificada.
```

La copia queda en `tradepilot-r\respaldos\`. Copia ese fichero también a un
USB o a otra carpeta fuera del proyecto.

**Opcional, recomendado la primera vez:** doble clic en
**`Probar_copia_de_seguridad_TradePilot.bat`**. Restaura la copia en una base
temporal (`tp_prueba_restauracion_...`), compara las filas tabla a tabla y
borra solo esa base temporal. Debe terminar con
`La copia se restaura entera: N tablas con las mismas filas.`

---

## 5. Diagnóstico (solo lectura)

Doble clic en **`Diagnosticar_TradePilot.bat`**. Compara tu base con lo que
espera esta versión: historial de migraciones, tablas, columnas, funciones,
triggers, políticas e índices. Todas las consultas van en modo solo lectura.
Deja un informe en `tradepilot-r\diagnosticos\`.

| Veredicto | Qué hacer |
|---|---|
| **LISTA PARA ACTUALIZAR** | Puedes pasar al paso 6 |
| **BLOQUEADA** | **No actualices.** Envía el informe de `diagnosticos\` |

Motivos de bloqueo, y qué significan:

- *Migración que esta versión no conoce* o *tabla/columna/función que esta
  versión no crea* → tu base tiene trabajo que no está en el repositorio (muy
  probablemente el de ejecuciones). Hay que recuperarlo antes de actualizar.
- *Falta X, que debería haber creado la migración Y* → tu base no coincide con
  su propio historial. Hay que entender por qué.
- *Esta base no tiene ninguna Cuenta* → puede que no sea tu base real.

---

## 6. Actualizar (solo si el paso 5 dijo LISTA)

1. La base tiene que estar en marcha (paso 3). Cierra solo la ventana negra de
   la web si está abierta; **no** uses `Cerrar_TradePilot.bat`, que para también
   la base.
2. Doble clic en **`Actualizar_TradePilot.bat`**. Repite el diagnóstico (y se
   niega si algo bloquea), pide confirmación, hace **otra** copia verificada,
   aplica solo lo pendiente y vuelve a contar las filas.
3. Tiene que terminar con `Actualizacion terminada. Tus datos siguen ahi.`
4. Ejecuta otra vez **`Diagnosticar_TradePilot.bat`**: debe decir LISTA con
   0 pendientes y 0 objetos que faltan.

---

## 7. Si una actualización falla

1. **No ejecutes `supabase db reset`** ni borres nada en Docker Desktop.
2. Lee el mensaje: el actualizador dice si llegó a cambiar algo y dónde está la
   copia de antes del cambio.
3. Cómo falla, y qué queda:
   - Antes de la copia (diagnóstico, Docker, confirmación) → **no se cambió
     nada**.
   - En la migración → la CLI aplica cada migración y su registro en el
     historial como **un único lote, todo o nada** (verificado en su código
     fuente; no ejecutado con la CLI real). La base queda como estaba antes de
     esa migración.
   - En las funciones → cada fichero va en **una sola transacción**; si falla,
     ese fichero se deshace entero. Las funciones no tocan filas.
4. Ejecuta **`Diagnosticar_TradePilot.bat`** y envía el informe junto con el
   mensaje de error.
5. Restaurar la copia sobre tu base **no se hace a ciegas**: toca también los
   esquemas internos de Supabase. Con el informe se prepara un procedimiento
   guiado. Mientras tanto, la copia está a salvo en `respaldos\`.

---

## 8. Uso diario (después)

Doble clic en **`Crear_accesos_directos.bat`** una vez. En el Escritorio
tendrás: Abrir, Cerrar, Copia de seguridad, Diagnosticar y Actualizar.

---

## Qué está comprobado y qué no

| Comprobado aquí (entorno Linux aislado) | Sin comprobar en tu PC |
|---|---|
| Lógica de diagnóstico, copia, verificación, restauración y actualización, con PostgreSQL 16 real y `docker`/`supabase` **simulados**, sobre una base con el esquema anterior y datos | Windows PowerShell 5.1 ejecutándolos de verdad |
| Que no usan ningún programa del contenedor salvo `psql`, `pg_dump` y `pg_restore` | Docker Desktop y la CLI real de Supabase |
| Comandos, parámetros y tipos de PowerShell frente al perfil oficial de Windows PowerShell 5.1, y su sintaxis con PSScriptAnalyzer | Los `.bat` (no hay `cmd.exe` en el entorno de pruebas) |
| Que el diagnóstico es de solo lectura (PostgreSQL rechaza escrituras) | Los accesos directos del Escritorio |
| Comportamiento de `supabase start`, `migration up` y `stop`, leyendo su código fuente | El contenedor real de Supabase (PostgreSQL 17) |
