@echo off
setlocal enabledelayedexpansion

REM ===================================================================
REM  TradePilot - lanzador de DESARROLLO para Windows.
REM
REM  QUE ES: una comodidad para probar TradePilot en tu ordenador. NO es el
REM  producto. TradePilot es y sera una aplicacion WEB: el usuario final
REM  entrara por su navegador a una direccion de internet, sin instalar nada.
REM
REM  QUE HACE: comprueba que tienes lo necesario, levanta la base de datos
REM  local (Supabase), escribe la configuracion que la web necesita, arranca
REM  la web y te abre el navegador.
REM
REM  QUE NO HACE: no toca la base de datos de dominio, no crea usuarios, no
REM  inventa claves, y nunca escribe ni muestra la clave de administracion
REM  (service_role).
REM ===================================================================

if /i "%~1"=="--esperar-y-abrir" goto esperar_y_abrir

cd /d "%~dp0"

REM  La ruta de este archivo se guarda una sola vez y se reutiliza mas abajo
REM  a traves de !TP_YO!. Asi el valor se sustituye al ejecutar y no al
REM  parsear, que es lo unico que sobrevive a una ruta con parentesis.
set "TP_YO=%~f0"

echo.
echo   ================================================
echo      TradePilot - arrancando entorno local
echo   ================================================
echo.

REM --- 1. Estamos donde debemos? -------------------------------------
REM  Aqui NO se usan bloques `( ... )` a proposito. cmd.exe lee el bloque
REM  entero y sustituye los %VAR% al parsearlo, antes de ejecutar nada: si la
REM  ruta del proyecto trae parentesis, como cuando Windows renombra a
REM  "carpeta 1 entre parentesis" un ZIP descargado dos veces, esos parentesis
REM  entran en la expresion ya parseada y la descuadran. Fallaba aunque el
REM  `if` fuese falso y el cuerpo no llegase a ejecutarse nunca.
REM
REM  Y se usa !CD! en vez de %CD%: la expansion retardada sustituye el valor
REM  DESPUES de parsear la linea, asi que ni parentesis ni espacios ni `&` de
REM  la ruta se reinterpretan como sintaxis.
if exist "package.json" goto hay_package_json
echo   [X] No encuentro "package.json" en esta carpeta:
echo       !CD!
echo.
echo   Este archivo tiene que estar dentro de la carpeta "tradepilot-r".
goto fin_error
:hay_package_json
if exist "apps\web\package.json" goto hay_apps_web
echo   [X] Esta carpeta no parece la de TradePilot: falta "apps\web".
goto fin_error
:hay_apps_web
echo   [OK] Carpeta del proyecto: !CD!

REM --- 2. El puerto 3000 tiene que estar libre -------------------------
REM  Si ya hay algo escuchando ahi, Next.js NO falla: se pasa solo al 3001.
REM  Eso rompe el acceso por correo, porque el enlace se emite para el origen
REM  desde el que entras y el navegador se abre en el 3000, que es otra copia.
REM  Antes de tocar nada mas, se comprueba y se para con un mensaje claro.
REM
REM  Se pregunta a .NET por los puertos en escucha en vez de leer `netstat`:
REM  su salida esta traducida (en un Windows en castellano pone ESCUCHANDO,
REM  no LISTENING), asi que filtrarla por texto valdria en unos ordenadores y
REM  en otros no. Los numeros de puerto no se traducen.
REM
REM  Codigos de salida: 10 libre, 11 ocupado, 12 no se ha podido mirar. Si
REM  PowerShell no esta o falla, el lanzador sigue: esto es una ayuda, no un
REM  permiso.
where powershell >nul 2>&1
if errorlevel 1 goto puerto1_sin_mirar
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { if ([System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object { $_.Port -eq 3000 }) { exit 11 } else { exit 10 } } catch { exit 12 }"
if errorlevel 12 goto puerto1_sin_mirar
if errorlevel 11 goto fin_puerto_ocupado
echo   [OK] Puerto 3000 libre
goto puerto1_hecho
:puerto1_sin_mirar
echo   [!] No he podido comprobar el puerto 3000. Sigo de todas formas.
:puerto1_hecho

REM --- 3. Node y npm --------------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
  echo   [X] No tienes Node.js instalado.
  echo.
  echo       Descargalo en https://nodejs.org  ^(el boton grande, version LTS^),
  echo       instalalo, cierra esta ventana y vuelve a empezar.
  goto fin_error
)
where npm >nul 2>&1
if errorlevel 1 (
  echo   [X] Node.js esta instalado pero no encuentro "npm".
  echo       Reinstala Node.js desde https://nodejs.org
  goto fin_error
)
for /f "delims=" %%V in ('node -v') do set "NODEV=%%V"
echo   [OK] Node.js !NODEV!

REM --- 4. Docker Desktop ----------------------------------------------
where docker >nul 2>&1
if errorlevel 1 (
  echo   [X] No tienes Docker Desktop instalado.
  echo.
  echo       Descargalo en https://www.docker.com/products/docker-desktop
  echo       Instalalo, ABRELO, y espera a que el icono de la ballena deje
  echo       de moverse. Luego vuelve a ejecutar este archivo.
  goto fin_error
)
docker info >nul 2>&1
if errorlevel 1 (
  echo   [X] Docker Desktop esta instalado pero NO esta en marcha.
  echo.
  echo       Abrelo desde el menu de Inicio y espera a que el icono de la
  echo       ballena deje de moverse. Luego vuelve a ejecutar este archivo.
  goto fin_error
)
echo   [OK] Docker Desktop en marcha

REM --- 5. CLI de Supabase ---------------------------------------------
where supabase >nul 2>&1
if errorlevel 1 (
  echo   [X] Falta la herramienta de Supabase.
  echo.
  echo       Instalala escribiendo esto en una ventana de PowerShell:
  echo           npm install -g supabase
  echo.
  echo       Luego vuelve a ejecutar este archivo.
  goto fin_error
)
echo   [OK] Herramienta de Supabase disponible

REM --- 6. Dependencias del proyecto -----------------------------------
if not exist "node_modules" (
  echo.
  echo   [ ] Primera vez: instalando las piezas del proyecto.
  echo       Esto tarda unos minutos. Vera mucho texto pasar: es normal.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   [X] La instalacion de dependencias ha fallado.
    echo       Copia el error de arriba y enviaselo a quien te ayuda.
    goto fin_error
  )
) else (
  echo   [OK] Dependencias ya instaladas
)

REM --- 7. Base de datos local -----------------------------------------
echo.
echo   [ ] Levantando la base de datos local...
echo       La PRIMERA vez descarga bastante y puede tardar varios minutos.
echo.
call supabase start
REM  `supabase start` devuelve error si ya estaba arrancada. No es un fallo:
REM  lo que decide es si `supabase status` responde, que se comprueba ahora.

REM --- 8. Leer la configuracion que genera Supabase --------------------
REM  Se usa la salida "-o env", pensada para maquinas, en vez de leer la
REM  tabla bonita: si el formato cambiase, esto falla de forma visible en
REM  lugar de escribir una configuracion a medias.
REM
REM  Los nombres API_URL y ANON_KEY estan verificados contra el binario de la
REM  CLI de Supabase (v2.113), no supuestos. SERVICE_ROLE_KEY tambien viaja en
REM  esa salida y NO se lee: ninguna linea de abajo la asigna a nada.
echo.
echo   [ ] Leyendo la configuracion de la base de datos...
set "TP_URL="
set "TP_ANON="
REM  El error de Supabase se GUARDA, no se tira. Cuando este comando falla no
REM  escribe nada por la salida normal: el motivo entero viaja por la salida de
REM  error. Mandarla a nul dejaba al lanzador con cero lineas que leer y un
REM  mensaje generico que no distinguia "falta un contenedor" de "la carpeta es
REM  la equivocada". Ahora se ensena tal cual.
del "supabase-status.err" >nul 2>&1
for /f "usebackq tokens=1,* delims==" %%A in (`supabase status -o env 2^>supabase-status.err`) do (
  if /i "%%A"=="API_URL"  set "TP_URL=%%~B"
  if /i "%%A"=="ANON_KEY" set "TP_ANON=%%~B"
)

if not defined TP_URL (
  echo   [X] No he podido leer la direccion de la base de datos.
  goto fin_sin_datos
)
if not defined TP_ANON (
  echo   [X] No he podido leer la clave publica de la base de datos.
  goto fin_sin_datos
)
echo   [OK] Configuracion leida correctamente

REM --- 9. Escribir apps\web\.env.local ---------------------------------
REM  SOLO dos variables. La clave de administracion (service_role) NUNCA se
REM  lee, ni se escribe, ni se muestra: no aparece en ninguna linea de este
REM  archivo a proposito.
> "apps\web\.env.local" echo NEXT_PUBLIC_SUPABASE_URL=!TP_URL!
>>"apps\web\.env.local" echo NEXT_PUBLIC_SUPABASE_ANON_KEY=!TP_ANON!
echo   [OK] Configuracion local escrita en apps\web\.env.local

REM --- 10. Comprobar que la base tiene las funciones del dominio --------
REM  Un `supabase start` sin las funciones deja una base que parece bien y
REM  falla en la primera accion. Se comprueba llamando a una funcion real.
where curl >nul 2>&1
if not errorlevel 1 (
  set "TP_RPC="
  for /f "delims=" %%C in ('curl -s -o nul -w "%%{http_code}" -X POST "!TP_URL!/rest/v1/rpc/listar_empresas" -H "apikey: !TP_ANON!" -H "Content-Type: application/json" -d "{}" 2^>nul') do set "TP_RPC=%%C"
  if "!TP_RPC!"=="404" (
    echo.
    echo   [!] La base de datos esta en marcha pero le faltan las funciones
    echo       de TradePilot. Suele pasar si la base se creo antes de la
    echo       ultima actualizacion del proyecto.
    echo.
    echo       Para arreglarlo, escribe en PowerShell, en esta carpeta:
    echo           supabase db reset
    echo.
    echo       AVISO: eso borra los datos de prueba que tengas guardados.
    echo.
    pause
  ) else (
    echo   [OK] Funciones de TradePilot disponibles
  )
)

REM --- 11. Ultima comprobacion del puerto ------------------------------
REM  Se repite la comprobacion del paso 2 a proposito: entre medias ha pasado
REM  `supabase start`, que puede tardar minutos, y en ese rato te da tiempo a
REM  abrir una segunda copia de este lanzador. Este es el instante que decide
REM  de verdad en que puerto se queda Next.js, asi que es donde tiene que
REM  estar la comprobacion definitiva.
where powershell >nul 2>&1
if errorlevel 1 goto puerto2_hecho
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { if ([System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object { $_.Port -eq 3000 }) { exit 11 } else { exit 10 } } catch { exit 12 }"
if errorlevel 12 goto puerto2_hecho
if errorlevel 11 goto fin_puerto_ocupado
:puerto2_hecho

REM --- 12. Abrir el navegador cuando la web este lista ------------------
REM  Puede abrir el 3000 sin dudar: si hemos llegado aqui, el puerto estaba
REM  libre y Next.js se va a quedar en el.
REM  Ojo con las comillas: `cmd /c ""%~f0" args"` parece proteger la ruta pero
REM  no lo hace. cmd empareja las comillas de izquierda a derecha, asi que las
REM  dos primeras forman una cadena VACIA y la ruta queda FUERA de comillas;
REM  con parentesis en la ruta, se leen como agrupacion y revienta. Aqui va un
REM  solo par de comillas, y ademas con expansion retardada.
start "TradePilot - abriendo navegador" /min "!TP_YO!" --esperar-y-abrir

REM --- 13. Arrancar la web (esta ventana se queda aqui) -----------------
echo.
echo   ================================================
echo      TradePilot esta arrancando
echo.
echo      Se abrira solo en:  http://localhost:3000
echo      Buzon de correo:    http://localhost:54324
echo.
echo      NO CIERRES ESTA VENTANA mientras uses TradePilot.
echo      Para apagarlo: ejecuta Cerrar_TradePilot.bat
echo   ================================================
echo.

call npm run dev --workspace=@tradepilot/web

echo.
echo   La aplicacion web se ha detenido.
echo   La base de datos sigue en marcha: ejecuta Cerrar_TradePilot.bat
echo   para apagarla del todo.
echo.
pause
exit /b 0

REM ===================================================================
:esperar_y_abrir
REM  Espera a que la web responda y entonces abre el navegador. La primera
REM  vez tarda mas porque compila.
for /l %%i in (1,1,90) do (
  curl -s -o nul --max-time 2 http://localhost:3000 >nul 2>&1
  if not errorlevel 1 (
    start "" http://localhost:3000
    exit /b 0
  )
  timeout /t 2 >nul 2>&1
)
exit /b 0

REM ===================================================================
:fin_puerto_ocupado
echo.
echo   [X] El puerto 3000 ya esta ocupado.
echo.
echo       Casi siempre significa que TradePilot ya esta abierto en otra
echo       ventana. Si arrancase igualmente, se iria al puerto 3001 y el
echo       enlace de acceso que llega por correo dejaria de funcionar.
echo.
echo       Que hacer:
echo         1. Mira si ya tienes TradePilot abierto en http://localhost:3000
echo            Si es asi, usalo y cierra esta ventana.
echo         2. Si no lo usas, ejecuta Cerrar_TradePilot.bat y vuelve a
echo            intentarlo.
echo.
goto fin_error

REM ===================================================================
:fin_sin_datos
echo.
echo       La base de datos no ha devuelto su configuracion en el formato
echo       esperado. NO he escrito ninguna configuracion a medias.
echo.
if not exist "supabase-status.err" goto sin_detalle_supabase
echo       Esto es lo que ha respondido Supabase:
echo.
type "supabase-status.err"
echo.
findstr /c:"Stopped services" "supabase-status.err" >nul 2>&1
if errorlevel 1 goto sin_detalle_supabase
echo       ^>^> Hay contenedores parados. Ejecuta EN ESTA CARPETA:
echo              supabase stop
echo              supabase start
echo          Eso NO borra tus datos: el borrado exige --no-backup, que no se usa.
echo          No lo ejecutes desde tu carpeta personal: alli no hay proyecto y
echo          Supabase crearia uno fantasma con el nombre de esa carpeta.
echo.
goto fin_error
:sin_detalle_supabase
echo       Prueba a apagarla y volver a arrancar:
echo           supabase stop
echo           supabase start
echo.
echo       Si sigue fallando, copia lo que aparece arriba y enviaselo a
echo       quien te ayuda.
goto fin_error

:fin_error
echo.
echo   TradePilot no se ha arrancado.
echo.
pause
exit /b 1
