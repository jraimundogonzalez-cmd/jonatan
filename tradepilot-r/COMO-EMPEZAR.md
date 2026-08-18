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

Dentro de la carpeta `tradepilot-r` hay dos archivos:

| Archivo | Qué hace |
|---|---|
| **`Abrir_TradePilot.bat`** | Doble clic y arranca todo |
| **`Cerrar_TradePilot.bat`** | Doble clic y lo apaga |

**Doble clic en `Abrir_TradePilot.bat`.** Él solo comprueba que tienes lo necesario,
levanta la base de datos, escribe la configuración, arranca la web y te abre el navegador
en <http://localhost:3000>.

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

**Aplica el esquema de TradePilot** (sólo la primera vez, o cuando cambie):

```bash
supabase db reset
```

**Terminal 2 — la aplicación:**

```bash
npm run dev --workspace=@tradepilot/web
```

### Abrir

Navega a **<http://localhost:3000>** en Chrome, Firefox o Safari. Cualquiera vale.

> `localhost` y `127.0.0.1` son la misma máquina, pero el navegador las trata como sitios
> distintos y la sesión se guarda en una de las dos. Los dos funcionan; **elige uno y
> quédate con él**. El lanzador abre siempre `localhost`.

---

## 3. Entrar

**No hay usuarios de prueba y no hay contraseñas.** Te creas la cuenta tú, con tu correo,
la primera vez que entras. Es el mismo formulario para entrar y para darse de alta.

1. En <http://localhost:3000> escribe tu correo (vale cualquiera, no sale de tu ordenador).
2. Pulsa **Entrar**.
3. Abre **<http://localhost:54324>** — es el buzón de correo local que trae Supabase.
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
Tres datos: **símbolo** (EURUSD), **riesgo %** (1.00) y **objetivo RR** (3.0000).
Pulsa **Abrir Operación**.

Fíjate en «Riesgo»: TradePilot congela ahí el importe que arriesgas, calculado sobre tu
capital **en ese instante**. Ese número no vuelve a cambiar nunca.

### 3 · Registrar un parcial
En la Operación, abajo, «Registrar parcial ejecutado».
Nivel de R = `1.0000`, % cerrado = `50.00` → **Registrar parcial**.
Repite con `2.0000` y `25.00`.

### 4 · Ver tu R realizado
Arriba aparece **Realizado hasta ahora**: `+1.0000 R`, con 75 % cerrado y 25 % abierto.
Eso es lo que ya te has llevado. Todavía no es tu resultado final.

### 5 · Cerrar
**Cerrar Operación** → motivo **Break-even** → **Previsualizar resultado**.
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
| No llega ningún correo | El buzón local | Ábrelo en <http://localhost:54324> |
| Entras y no ves tus datos | Has mezclado `localhost` y `127.0.0.1` | Quédate siempre con `localhost:3000` |

---

## 6. Qué puedes hacer hoy y qué no

**Puedes**: crear cuentas y empresas, registrar el capital y sus movimientos, abrir
operaciones, registrar parciales, ver el R realizado y el porcentaje abierto, cerrar con
previsualización, ver el R acumulado de la cuenta, corregir un desenlace viendo antes su
impacto, cancelar una operación abierta por error, anotar, y leer el historial de cambios.

**Todavía no**: estadísticas y gráficas, optimizador, motor de reglas, simulación, diario
con IA, planes de gestión reutilizables desde la interfaz, e importación desde el bróker.
Nada de eso está construido — no es que esté escondido.

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
