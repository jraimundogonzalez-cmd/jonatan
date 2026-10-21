# Importar operaciones cerradas desde Excel

Guía de la **fase 1** del importador de la «Lista de comercio» (`.xlsx`).

> TradePilot **no ejecuta órdenes** (I17). El importador solo lee el Excel que tú
> exportas y guarda sus filas como evidencia. No se conecta a ninguna plataforma.

---

## 1. Antes de nada: poner la base al día (sin borrar datos)

El importador necesita dos tablas y cuatro funciones nuevas en tu base local. No
modifican ninguna tabla existente.

La primera vez, sigue la guía [`COMPROBAR-INSTALACION-WINDOWS.md`](./COMPROBAR-INSTALACION-WINDOWS.md),
que incluye proteger tu trabajo en Git y el diagnóstico. En resumen:

1. Doble clic en **`Diagnosticar_TradePilot.bat`** (solo lee). Si no dice
   **LISTA PARA ACTUALIZAR**, para aquí.
2. Doble clic en **`Actualizar_TradePilot.bat`**. Él solo:
   - repite el diagnóstico de solo lectura y **se niega a seguir** si tu base
     tiene migraciones u objetos que esta versión no conoce, si le falta algo
     que su historial dice tener o si no tiene ninguna Cuenta;
   - te pide confirmación;
   - hace una **copia de seguridad completa** en la carpeta `respaldos` y
     **verifica el fichero que queda en tu disco** (se lee entero y tiene las
     mismas filas por tabla que la base);
   - aplica **solo** las migraciones pendientes y reinstala las funciones;
   - vuelve a contar las filas: tienen que seguir siendo las mismas.
3. Tiene que terminar con `Actualizacion terminada. Tus datos siguen ahi.`

> ⚠️ **Nunca uses `supabase db reset`**: borra la base entera. Si el actualizador
> se para con un error, no intentes arreglarlo así: copia el mensaje y pide ayuda.

Para hacer solo una copia de seguridad, sin actualizar nada:
**`Copia_de_seguridad_TradePilot.bat`**.

> Qué está verificado y qué no: tabla final de
> [`COMPROBAR-INSTALACION-WINDOWS.md`](./COMPROBAR-INSTALACION-WINDOWS.md).
> **En tu PC está sin verificar** hasta que lo ejecutes.

**Volver atrás.** Si algo saliera mal, la copia permite recuperar los datos.
Restaurar sobre una base de Supabase toca también sus esquemas internos
(`auth`, `storage`…), así que no lo hagas a ciegas: pídelo y se prepara un
procedimiento guiado sobre esa copia.

---

## 2. Hacer una importación de prueba

1. Arranca la aplicación (`Abrir_TradePilot.bat` o `npm run dev --workspace=@tradepilot/web`).
2. En la barra lateral, entra en **Importar**. También se llega desde el
   detalle de una Cuenta → **Importaciones** → *Importar Excel*.
3. Elige la **Cuenta de destino**.
4. Elige la **zona horaria** en la que tu plataforma muestra las horas. No hay
   valor por defecto a propósito. Todas las importaciones de una Cuenta tienen
   que usar la misma zona.
5. Elige el archivo `.xlsx` exportado desde «Lista de comercio».
6. Pulsa **Previsualizar**. Todavía no se guarda nada.
7. Revisa:
   - si el archivo trae varias cuentas, elige cuál corresponde a esta Cuenta;
   - la primera vez, marca la casilla que confirma que la cuenta del archivo es
     esta Cuenta (después ya no se admitirán archivos de otra cuenta en ella);
   - el resumen (nuevas, en revisión, ya importadas, de otra cuenta, inválidas);
   - las filas **Requiere revisión**: solo se guardan si las marcas en «Aceptar».
8. **Confirmar importación** o **Cancelar**. Cancelar no guarda nada.
9. Verás el resumen del lote: filas guardadas y filas no guardadas con su motivo.

**Prueba de idempotencia:** vuelve a importar el mismo archivo. La vista previa
debe mostrar todas las filas como «Ya importada» y no deja confirmar.

---

## 3. Qué hace y qué no hace esta fase

| Hace | No hace |
|---|---|
| Guarda cada fila del Excel tal cual, con todas sus columnas originales | Crear Operaciones de TradePilot a partir de las filas |
| Conserva P&L bruto y neto exactos, sin redondeo | Restar comisiones o deducir nada de la diferencia bruto − neto |
| Guarda la hora original y su conversión a UTC con la zona que declaras | Calcular R, riesgo, stop, objetivo, MAE/MFE ni asignar estrategias |
| Comprueba que el bruto cuadra con los precios (MNQ, NQ, MES, ES) y marca para revisión si no | Corregir un importe del archivo |
| Evita duplicados al reimportar | Agrupar filas en posiciones |
| Registra cada lote para auditoría | Conectarse a la plataforma, sincronizar ni ejecutar órdenes |

---

## 4. Pendiente de verificar con un archivo real

El importador se ha probado con **archivos generados** que imitan el esquema
conocido, no con una exportación real. Al importar tu primer archivo, comprueba:

- [ ] **Zona horaria**: que la hora que ves en la vista previa es la que
      muestra la plataforma para esa operación.
- [ ] **Formato de celdas**: que las fechas y los números se leen sin filas
      inválidas (el archivo puede traer fechas como texto o como fecha de Excel;
      ambos están soportados).
- [ ] **Convención de `Side`**: que `BUY` significa entrada larga. El
      importador lo comprueba con el signo del bruto en MNQ/NQ/MES/ES y marca
      para revisión si no cuadra.
- [ ] **Cantidades negativas**: si aparecen, van a revisión. Hace falta saber
      qué significan en esta plataforma antes de usarlas.
- [ ] **Filas idénticas**: si el archivo trae filas exactamente iguales, van a
      revisión; decide si son ejecuciones reales distintas.
- [ ] **Cabecera**: que los nombres de columna coinciden exactamente con
      `Account; Symbol; Contract; Entry Date; Entry Price; Exit Date; Exit Price; Side; Quantity; Gross P/L; Net P/L`.

---

## Apéndice — el mismo procedimiento a mano

Solo si `Actualizar_TradePilot.bat` no pudiera ejecutarse. Es una versión
manual anterior: la verificación de abajo usa `sh` y `awk` **dentro** del
contenedor, que no están garantizados en la imagen de Supabase. Los scripts de
Windows ya no dependen de ellos.

### A. Copia de seguridad verificada

Tu base local tiene datos reales (tus cuentas y operaciones). Haz la copia
**antes** de aplicar la actualización. Todos los comandos se ejecutan en
PowerShell, en la carpeta `tradepilot-r`, con Supabase arrancado.

El contenedor de la base se llama `supabase_db_tradepilot-r` (sale de
`project_id` en `supabase/config.toml`). Compruébalo:

```powershell
docker ps --filter "name=supabase_db_tradepilot-r" --format "{{.Names}}  {{.Status}}"
```

**1.1 · Hacer la copia** (formato propio de PostgreSQL, completa):

```powershell
docker exec supabase_db_tradepilot-r pg_dump -U postgres -d postgres -Fc -f /tmp/respaldo.dump
docker cp supabase_db_tradepilot-r:/tmp/respaldo.dump .\respaldo-tradepilot.dump
```

Guarda `respaldo-tradepilot.dump` fuera de la carpeta del proyecto. **No lo
subas a git ni lo compartas**: contiene tus datos.

**1.2 · Verificar la copia.** El script cuenta, tabla a tabla, las filas de la
base viva y las que hay dentro de la copia. Solo lee; no restaura ni escribe:

```powershell
docker cp .\scripts\respaldo\verificar-respaldo.sh supabase_db_tradepilot-r:/tmp/verificar-respaldo.sh
docker exec supabase_db_tradepilot-r sh /tmp/verificar-respaldo.sh /tmp/respaldo.dump
```

Tiene que terminar con `COPIA VERIFICADA: todos los recuentos coinciden.` Si
dice `LA COPIA NO COINCIDE`, **para aquí** y no apliques la actualización.

> Verificado al escribir esta guía, contra un PostgreSQL de pruebas: con una
> copia correcta los ocho recuentos coinciden; con una copia vacía el script
> falla; y si se añade una Cuenta después de copiar, detecta la diferencia.
> **En tu máquina está sin verificar** hasta que lo ejecutes: no se ha podido
> probar dentro del contenedor de Supabase.

**Volver atrás.** Si algo saliera mal, la copia permite recuperar los datos.
Restaurar sobre una base de Supabase toca también sus esquemas internos
(`auth`, `storage`…), así que no lo hagas a ciegas: pídelo y se prepara un
procedimiento guiado sobre esta misma copia.


### B. Aplicar la actualización SIN borrar datos

> ⚠️ **No uses `supabase db reset`.** Borra la base entera. Tampoco borres
> volúmenes de Docker.

La actualización añade **dos tablas nuevas** y **cuatro funciones nuevas**. No
modifica ninguna tabla existente.

**2.1 · Ver qué migraciones faltan:**

```powershell
supabase migration list --local
```

Debe aparecer `20261018120000` como pendiente (sin fecha en la columna local).

**2.2 · Aplicar solo las migraciones pendientes** (no borra nada):

```powershell
supabase migration up --local
```

**2.3 · Instalar las funciones del importador.** Las funciones de TradePilot no
son migraciones: `supabase start` solo las instala cuando crea la base. En una
base con datos se aplican así:

```powershell
docker cp .\supabase\functions\sql\imports.sql supabase_db_tradepilot-r:/tmp/imports.sql
docker exec supabase_db_tradepilot-r psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/imports.sql
```

(Se copia el fichero al contenedor en vez de pasarlo por tubería: PowerShell
5.1 convierte las tildes en `?` al enviar texto a otro programa.)

**2.4 · Comprobar:**

```powershell
docker exec supabase_db_tradepilot-r psql -U postgres -d postgres -At -c "select string_agg(proname, ', ' order by proname) from pg_proc where proname in ('consultar_importacion_previa','confirmar_importacion','listar_lotes_importacion','obtener_lote_importacion')"
docker exec supabase_db_tradepilot-r psql -U postgres -d postgres -At -c "select count(*) from public.accounts"
```

La primera línea debe listar las cuatro funciones. La segunda, el mismo número
de cuentas que antes (vuelve a ejecutar el recuento del paso 1.2 si quieres
comprobarlo todo).
