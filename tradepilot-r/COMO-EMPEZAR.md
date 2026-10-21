# Cómo empezar a usar TradePilot

Esta guía es para **usarlo**, no para desarrollarlo. No hace falta leer código.

---

## 0. Descargar el proyecto a tu ordenador

Sólo la primera vez. Abre el terminal y escribe:

```bash
git clone https://github.com/jraimundogonzalez-cmd/jonatan.git
cd jonatan
git checkout claude/tradepilot-r-position-manager-mwbovl
cd tradepilot-r
```

Esa última carpeta, `tradepilot-r`, es desde donde se ejecuta todo lo demás.

> **Mientras no se fusione**, el actualizador seguro, la copia de seguridad, los accesos
> directos y el importador están en la rama `claude/ecstatic-planck-tg10r0`, no en la de
> arriba. Si ya tienes el proyecto descargado, antes de cambiar de rama mira que no
> tengas trabajo sin guardar: `git status` debe decir *nothing to commit*.

---

## 1. Qué necesitas antes de empezar

| Necesitas | Para qué | Cómo saber si lo tienes |
|---|---|---|
| **Node.js 20 o superior** | Ejecutar la aplicación | `node -v` en el terminal |
| **Docker Desktop** abierto | Ejecutar la base de datos y el login | El icono de la ballena en la barra |
| **Supabase CLI** | Levantar la base de datos | `supabase --version` |

Si te falta Docker: descárgalo en <https://docker.com>, instálalo y **ábrelo** (tiene que
estar en marcha, no sólo instalado).
Si te falta la CLI de Supabase: `npm install -g supabase`.

---

## 2. Arrancar — la forma fácil (Windows)

Dentro de la carpeta `tradepilot-r` hay siete archivos de doble clic:

| Archivo | Qué hace | Cuándo |
|---|---|---|
| **`Abrir_TradePilot.bat`** | Arranca todo y abre el navegador | Cada día |
| **`Cerrar_TradePilot.bat`** | Lo apaga. Tus datos se conservan | Cada día, al terminar |
| **`Copia_de_seguridad_TradePilot.bat`** | Copia verificada de tus datos en la carpeta `respaldos` | Cuando quieras (p. ej. cada semana) |
| **`Probar_copia_de_seguridad_TradePilot.bat`** | Restaura la última copia en una base temporal y comprueba que está entera | De vez en cuando |
| **`Diagnosticar_TradePilot.bat`** | Compara tu base con lo que espera esta versión. **Solo lee** | Siempre antes de actualizar |
| **`Actualizar_TradePilot.bat`** | Pone la base al día **sin borrar datos**; hace una copia antes | Solo después de descargar una versión nueva |
| **`Crear_accesos_directos.bat`** | Pone Abrir, Cerrar, Copia, Diagnosticar y Actualizar en tu Escritorio | Una vez (y si mueves la carpeta) |

**Recomendado la primera vez:** doble clic en `Crear_accesos_directos.bat`. A partir de
ahí usas TradePilot desde el Escritorio, sin buscar carpetas ni abrir terminales.

**Doble clic en `Abrir_TradePilot.bat`.** Él solo comprueba que tienes lo necesario,
levanta la base de datos, escribe la configuración, arranca la web y te abre el navegador
en <http://127.0.0.1:3000>.

La primera vez tarda varios minutos (descarga la base de datos). Las siguientes, menos de uno.

**No cierres la ventana negra** mientras uses TradePilot: ahí es donde está funcionando.

Si te falta algo (Node, Docker o la herramienta de Supabase), el propio lanzador te lo dice
en castellano y se para. No rompe nada.

Para apagar: doble clic en **`Cerrar_TradePilot.bat`**. Tus datos se conservan.

---

## 2-bis. Arrancar a mano (Mac, Linux, o si prefieres el terminal)

Abre un terminal **en la carpeta `tradepilot-r`** del proyecto.

### La primera vez

```bash
npm install
```

Tarda unos minutos. Sólo hace falta una vez.

### Cada vez que quieras usar TradePilot

**Terminal 1 — la base de datos:**

```bash
supabase start
```

La primera vez descarga bastante y puede tardar. Cuando termina, escribe unas líneas
con `API URL`, `anon key` y otras. **No cierres este terminal.**

Copia el valor de `anon key`: lo necesitas en el paso siguiente.

**Crea el fichero de configuración** (sólo la primera vez). En `tradepilot-r/apps/web`
crea un archivo llamado `.env.local` con estas dos líneas, pegando tu `anon key`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=pega-aquí-el-anon-key-que-te-dio-supabase-start
```

**Comprueba que la base tiene todo**: la primera vez, `supabase start` crea la base
con el esquema completo. Si la aplicación avisa de que falta algo, ponla al día con el
actualizador, que no borra datos (en Mac o Linux, con PowerShell instalado):

```bash
pwsh scripts/windows/actualizar.ps1
```

**Terminal 2 — la aplicación:**

```bash
npm run dev --workspace=@tradepilot/web
```

### Abrir

Navega a **<http://127.0.0.1:3000>** en Chrome, Firefox o Safari. Cualquiera vale.

> **Usa `127.0.0.1`, no `localhost`.** El servidor se ata solo a `127.0.0.1`
> (por seguridad: así no llega nadie de tu red local). `localhost` puede
> resolverse primero a `::1`, donde no escucha nadie. Con la dirección
> explícita no hay ambigüedad.
>
> Si antes entrabas por `localhost:3000`, el navegador trata las dos como
> sitios distintos: tendrás que **volver a iniciar sesión** una vez. No se
> pierde ningún dato.

> `localhost` y `127.0.0.1` son la misma máquina, pero el navegador las trata como sitios
> distintos y la sesión se guarda en una de las dos. Los dos funcionan; **elige uno y
> quédate con él**. El lanzador abre siempre `localhost`.

---

## 2-ter. Actualizar a una versión nueva del proyecto

1. Descarga la versión nueva (con `git pull` en la carpeta del proyecto, o un ZIP nuevo).
   Si usas un ZIP en otra carpeta, **copia antes tu carpeta `respaldos`** a un sitio seguro.
2. Doble clic en **`Abrir_TradePilot.bat`**. Con tu base existente no le aplica ningún
   cambio. Si avisa de que la base **no está al día**, es lo esperado: sigue.
3. Doble clic en **`Diagnosticar_TradePilot.bat`** (solo lee). Solo si dice
   **LISTA PARA ACTUALIZAR**, sigue. Si dice **BLOQUEADA**, para y envía el informe de la
   carpeta `diagnosticos`. La primera vez, sigue la guía completa:
   [`COMPROBAR-INSTALACION-WINDOWS.md`](./COMPROBAR-INSTALACION-WINDOWS.md).
4. Doble clic en **`Actualizar_TradePilot.bat`** (la base tiene que seguir en marcha; no
   uses `Cerrar_TradePilot.bat` antes). Hace una copia de seguridad verificada, aplica solo
   lo que falta y comprueba que siguen todas tus filas. Si algo no cuadra, se para y te lo
   dice sin tocar nada más.
5. Vuelve a abrir TradePilot con **`Abrir_TradePilot.bat`**.

Tus datos no viven en la carpeta del proyecto: viven en la base de datos de Docker, que
se identifica por el nombre del proyecto (`tradepilot-r`) y no por la carpeta. Borrar o
cambiar la carpeta no los borra.

> ### ⛔ Lo que nunca debes hacer
> - **`supabase db reset`** — borra todas tus cuentas y operaciones.
> - **`supabase stop --no-backup`** — borra la base al apagar.
> - **Borrar volúmenes** en Docker Desktop (pestaña *Volumes*) o con `docker volume rm`.
> - **Borrar la carpeta `respaldos`** — son tus copias de seguridad.
>
> Si alguna vez una pantalla o un mensaje te propone una de estas cosas, no lo hagas y
> pide ayuda. Ningún archivo de TradePilot las ejecuta.

---

## 3. Entrar

**No hay usuarios de prueba y no hay contraseñas.** Te creas la cuenta tú, con tu correo,
la primera vez que entras. Es el mismo formulario para entrar y para darse de alta.

1. En <http://127.0.0.1:3000> escribe tu correo (vale cualquiera, no sale de tu ordenador).
2. Pulsa **Enviar enlace de acceso**.
3. Abre **<http://127.0.0.1:54324>** — es el buzón de correo local que trae Supabase.
4. Verás el mensaje «Entrar en TradePilot». Ábrelo y pulsa el enlace.
5. Ya estás dentro.

El enlace caduca en una hora y sólo sirve una vez. Si se te pasa, pide otro.

---

## 4. Tu primer recorrido

Diez minutos de principio a fin.

### 1 · Crear tu primera Cuenta
Verás «Todavía no tienes ninguna Cuenta». Pulsa **Nueva Cuenta**.
Elige **Capital propio** (si operas tu dinero) o **Prop firm** (si es una empresa de fondeo).
Si eliges Prop firm, escribe su nombre (FTMO, FundedNext…) y pulsa **Crear**.
Después: nombre de la cuenta, capital inicial y moneda → **Crear cuenta**.

### 2 · Abrir una Operación
Entra en la cuenta → **Operaciones** → **Nueva Operación**.
Datos: **símbolo** (MNQ), **lado**, **fecha y hora de entrada** (por defecto, ahora),
**riesgo %** (1.00) y **objetivo RR** (3.0000). Pulsa **Abrir Operación**.

Si pones una hora de entrada pasada, verás el aviso «Operación registrada a posteriori»:
el riesgo en dinero se calcula con el capital que la cuenta tiene **ahora**, no con el
que tenía a esa hora. Es el comportamiento actual mientras la decisión DEC-013 siga abierta.

Fíjate en «Riesgo»: TradePilot congela ahí el importe que arriesgas, calculado sobre tu
capital **en ese instante**. Ese número no vuelve a cambiar nunca.

### 3 · Registrar un parcial
En la Operación, abajo, «Registrar parcial ejecutado».
Nivel de R = `1.0000`, % cerrado = `50.00`, y la fecha y hora del parcial → **Registrar parcial**.
Repite con `2.0000` y `25.00`.

### 4 · Ver tu R realizado
Arriba aparece **Realizado hasta ahora**: `+1.0000 R`, con 75 % cerrado y 25 % abierto.
Eso es lo que ya te has llevado. Todavía no es tu resultado final.

### 5 · Cerrar
**Cerrar Operación** → motivo **Break-even**, fecha y hora de cierre → **Previsualizar resultado**.
Verás de dónde sale el R, parcial a parcial. Si te cuadra, **Confirmar cierre**.

### 6 · Ver tu R acumulado
Vuelve a la Cuenta. Arriba, **Resultado acumulado** en R. Súmalo a mano si quieres:
es exactamente la suma de los R de tus operaciones cerradas.

### 7 · Corregir un desenlace
En una Operación cerrada → **Corregir desenlace**. Cambia lo que haga falta y pulsa
**Ver qué va a cambiar**: te dice el R de antes, el de después, la diferencia y cuánto
se moverá tu capital. Sólo entonces puedes confirmar.

### 8 · Cancelar una Operación abierta por error
Abre una Operación y pulsa **Cancelar Operación**. Escribe el motivo y marca la casilla.
Queda como Cancelada: no cuenta como operación cerrada, no tiene resultado y no toca tu
capital.

---

## 5. Si algo va mal

| Lo que ves | Qué pasa | Qué hacer |
|---|---|---|
| El navegador no carga nada | La aplicación no está arrancada | Mira la ventana negra del lanzador |
| «Failed to fetch» o pantallas vacías | La base de datos no está arrancada | Mira el Terminal 1, o `supabase start` |
| El enlace del correo no te deja entrar | Falta la plantilla de correo | Comprueba que existe `supabase/templates/magic-link.html` y reinicia con `supabase stop && supabase start` |
| No llega ningún correo | El buzón local | Ábrelo en <http://127.0.0.1:54324> |
| Entras y no ves tus datos | Has mezclado `localhost` y `127.0.0.1` | Quédate siempre con `127.0.0.1:3000` |
| El lanzador dice que la base **no está al día** | Has descargado una versión nueva | Cierra y ejecuta `Actualizar_TradePilot.bat` (no borra nada) |
| El actualizador se para con «migraciones que este código NO conoce» | Tu base tiene trabajo que esta versión no trae | No sigas: pide ayuda. Ese trabajo hay que recuperarlo |

---

## 6. Qué puedes hacer hoy y qué no

**Puedes**: crear cuentas y empresas, registrar el capital y sus movimientos, abrir
operaciones, registrar parciales, ver el R realizado y el porcentaje abierto, cerrar con
previsualización, ver el R acumulado de la cuenta, corregir un desenlace viendo antes su
impacto, cancelar una operación abierta por error, anotar, y leer el historial de cambios.

**En pruebas**: importar el Excel de operaciones cerradas de tu plataforma (menú
**Importar**). Guarda las filas del archivo tal cual; todavía no las convierte en
Operaciones. Está probado solo con archivos de ejemplo: guía en
[`IMPORTAR-OPERACIONES.md`](./IMPORTAR-OPERACIONES.md).

**Todavía no**: estadísticas y gráficas, optimizador, motor de reglas, simulación, diario
con IA, planes de gestión reutilizables desde la interfaz, ni conexión automática con el
bróker. Nada de eso está construido — no es que esté escondido.

---

## Alternativa para Linux sin Docker

Si no puedes usar Docker, `scripts/alpha/` levanta los mismos servicios de Supabase como
procesos nativos. Necesita PostgreSQL y Go instalados:

```bash
scripts/alpha/binarios.sh    # una vez: descarga PostgREST y compila Auth
scripts/alpha/start.sh       # cada vez
```

Ahí el buzón de correo es el fichero `/tmp/tpalpha/buzon.txt` en lugar de una web.
Detalles en `scripts/alpha/README.md`.
