//+------------------------------------------------------------------+
//| CRT_MultiTF_Swing_Sniper_v4.mq5                                    |
//|                                                                    |
//| Rediseño solicitado sobre v3, con dos objetivos: (1) motor mucho   |
//| mas simple, (2) instrumentado para poder auditar por que un test   |
//| no genera operaciones, en vez de adivinar.                         |
//|                                                                    |
//| CAMBIOS DE FONDO respecto a v3:                                    |
//|                                                                    |
//|  1) UN SOLO TP, SIN PARCIALES. Se elimino TP1/TP2/TP3, el reparto  |
//|     de volumen y el monitoreo manual de cierres parciales. La      |
//|     posicion se abre con SL y TP nativos de MT5 (trade.Buy/Sell    |
//|     con sl y tp directos) y MT5 la cierra sola al 100% cuando se   |
//|     toca cualquiera de los dos. Ya no existe ManageOpenPosition().  |
//|                                                                    |
//|  2) TRES CAPAS DE ALINEACION HTF (antes eran dos: HTF+intermedio). |
//|     HTF1 (ej. D1) > HTF2 (ej. H4) > HTF3/rango de trabajo (ej. H1) |
//|     > TF de entrada del grafico (ej. M15). Las tres capas usan la  |
//|     MISMA logica de manipulacion+cierre de vuelta que ya tenia el  |
//|     sistema (rango -> barrido -> cierre dentro -> sesgo), NO son   |
//|     "vela verde = alcista". Solo se opera si las tres coinciden en |
//|     direccion.                                                     |
//|     - TP = htf1TargetExtreme (extremo opuesto del rango de la      |
//|       capa mas ancha: mas recorrido disponible).                   |
//|     - Guarda de invalidacion del pullback = htf3ManipExtreme (la   |
//|       capa mas cercana al rango de trabajo: la referencia local    |
//|       relevante para la entrada en M15).                           |
//|                                                                    |
//|  3) SIN TP FORZADO: antes de abrir, se calcula el R:R real hacia   |
//|     htf1TargetExtreme. Si no llega a InpMinRR (1.5 por defecto),   |
//|     NO TRADE — no se estira el objetivo artificialmente.           |
//|                                                                    |
//|  4) InpQualityOnly = false POR DEFECTO en esta version (antes      |
//|     true). Decision deliberada: primero queremos ver la tasa real  |
//|     de señales del motor de 3 capas antes de aplicar un filtro de  |
//|     calidad adicional — si lo activas y vuelve a dar 0, sabremos   |
//|     que el filtro de calidad es el cuello de botella y no el       |
//|     motor de deteccion.                                            |
//|                                                                    |
//|  5) AUDITORIA INTEGRADA: contadores en cada etapa del embudo       |
//|     (barridos por capa, alineaciones logradas, swings armados,     |
//|     rupturas, y el motivo exacto de cada rechazo). Se imprime un   |
//|     resumen en el Diario al terminar el test (OnDeinit) — asi el   |
//|     proximo test dice exactamente donde se pierden las operaciones |
//|     en vez de tener que adivinarlo.                                |
//|                                                                    |
//| Ejecutar en el grafico del TF de entrada (M15 en los ejemplos de   |
//| arriba). Sigue siendo SOLO PARA BACKTESTING y cuenta netting,      |
//| igual que v3.                                                      |
//|                                                                    |
//| IMPORTANTE: no he podido compilar esto (no tengo MetaEditor en     |
//| este entorno) — revisa "Errores" al compilar la primera vez.       |
//+------------------------------------------------------------------+
#property copyright "CRT Multi-TF"
#property version   "1.00"

#include <Trade/Trade.mqh>
CTrade trade;

// ------------------------------- Inputs --------------------------------------
input group "Timeframes (HTF1 > HTF2 > HTF3=rango > TF de entrada del grafico)"
input ENUM_TIMEFRAMES InpHTF1      = PERIOD_D1;  // HTF1 (sesgo principal)
input ENUM_TIMEFRAMES InpHTF2      = PERIOD_H4;  // HTF2
input ENUM_TIMEFRAMES InpHTF3      = PERIOD_H1;  // HTF3 / rango de trabajo
input int              InpSwingLen = 2;          // Pivote de entrada: velas a cada lado (TF de entrada = grafico, ej. M15)

input group "Manipulacion / ATR (una capa por timeframe)"
input int    InpATRLen          = 14;
input double InpManipMinATR_1   = 0.30;  // Penetracion minima HTF1 (x ATR)
input double InpManipMinATR_2   = 0.30;  // Penetracion minima HTF2 (x ATR)
input double InpManipMinATR_3   = 0.30;  // Penetracion minima HTF3 (x ATR)
input double InpQualityMult     = 1.5;   // Umbral de calidad (x del minimo exigido)
input bool   InpQualityOnly     = false; // Exigir calidad en las 3 capas (ver nota de diseño arriba)

input group "Gestion (SL / TP unico)"
input double InpSLBufferMult = 0.25;  // Buffer de SL (x ATR entrada)
input double InpMinRR        = 1.5;   // R:R minimo hacia htf1TargetExtreme; si no se alcanza, NO TRADE

input group "Cuenta"
input double InpRiskPercent = 1.0;
input long   InpMagic       = 990022;

input group "Visual"
input bool InpShowStats = true;

// ------------------------------- Estado de sesgo por capa ----------------------
int    htf1ATRHandle, htf2ATRHandle, htf3ATRHandle, entryATRHandle;
datetime lastHTF1Time = 0, lastHTF2Time = 0, lastHTF3Time = 0, lastEntryTime = 0;

int    htf1Bias = 0; double htf1ManipExtreme = 0, htf1TargetExtreme = 0, htf1ManipStrength = 0;
int    htf2Bias = 0; double htf2ManipStrength = 0;
int    htf3Bias = 0; double htf3ManipExtreme = 0, htf3ManipStrength = 0;

datetime alignedSinceTime = 0; // 0 = sin alinear

double   lastSwingHigh = 0;  datetime lastSwingHighTime = 0; bool hasLastSwingHigh = false; bool swingHighUsed = true; double pullbackLow = 0;
double   lastSwingLow  = 0;  datetime lastSwingLowTime  = 0; bool hasLastSwingLow  = false; bool swingLowUsed  = true; double pullbackHigh = 0;

// ------------------------------- Contadores de auditoria -----------------------
long cntHTF1Sweep = 0, cntHTF2Sweep = 0, cntHTF3Sweep = 0;
long cntAlignStart = 0, cntSwingArmed = 0, cntBreakout = 0;
long cntFailManipGuard = 0, cntFailQuality = 0, cntSkippedInPosition = 0, cntFailRR = 0, cntTradesOpened = 0;

// ------------------------------- Utilidades -----------------------------------
bool ValidTFStack()
{
    return PeriodSeconds(InpHTF1) > PeriodSeconds(InpHTF2)
        && PeriodSeconds(InpHTF2) > PeriodSeconds(InpHTF3)
        && PeriodSeconds(InpHTF3) > PeriodSeconds(_Period);
}

double GetATRValue(int handle, int shift)
{
    double buf[];
    ArraySetAsSeries(buf, true);
    if (CopyBuffer(handle, 0, shift, 1, buf) <= 0) return 0;
    return buf[0];
}

double RoundToStep(double vol)
{
    double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
    if (step <= 0) step = 0.01;
    double v = MathFloor(vol / step + 0.0000001) * step;
    int digits = 0;
    double s = step;
    while (MathAbs(s - MathRound(s)) > 0.0000001 && digits < 8) { s *= 10; digits++; }
    return NormalizeDouble(v, digits);
}

double NormalizeVolume(double vol)
{
    double minVol = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
    double maxVol = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
    double v = RoundToStep(vol);
    if (v < minVol) v = minVol;
    if (v > maxVol) v = maxVol;
    return RoundToStep(v);
}

double CalcLots(double entryPrice, double sl)
{
    double slDist = MathAbs(entryPrice - sl);
    if (slDist <= 0) return 0;
    double tickValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
    double tickSize  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
    if (tickSize <= 0 || tickValue <= 0) return 0;
    double riskMoney = AccountInfoDouble(ACCOUNT_EQUITY) * InpRiskPercent / 100.0;
    double lots = riskMoney / (slDist / tickSize * tickValue);
    return NormalizeVolume(lots);
}

bool IsNewBar(ENUM_TIMEFRAMES tf, datetime &lastSeen)
{
    datetime t = iTime(_Symbol, tf, 0);
    if (t == 0) return false;
    if (t != lastSeen)
    {
        lastSeen = t;
        return true;
    }
    return false;
}

// ------------------------------- Deteccion de manipulacion (compartida) --------
// Rango -> barrido del extremo de la vela anterior -> cierre de vuelta dentro.
// Devuelve 1 (alcista), -1 (bajista) o 0 (sin señal clara en esta vela).
int DetectSweep(ENUM_TIMEFRAMES tf, int atrHandle, double minATRMult,
                 double &outManipExtreme, double &outTargetExtreme, double &outManipStrength)
{
    double hC = iHigh(_Symbol, tf, 1);
    double lC = iLow(_Symbol, tf, 1);
    double cC = iClose(_Symbol, tf, 1);
    double hP = iHigh(_Symbol, tf, 2);
    double lP = iLow(_Symbol, tf, 2);
    double atr = GetATRValue(atrHandle, 1);
    if (atr <= 0 || hP <= 0 || lP <= 0) return 0;

    bool bullSweep = (lC < lP - minATRMult * atr) && (cC > lP);
    bool bearSweep = (hC > hP + minATRMult * atr) && (cC < hP);

    if (bullSweep && !bearSweep)
    {
        outManipExtreme  = lC;
        outTargetExtreme = hP;
        outManipStrength = (lP - lC) / (minATRMult * atr);
        return 1;
    }
    if (bearSweep && !bullSweep)
    {
        outManipExtreme  = hC;
        outTargetExtreme = lP;
        outManipStrength = (hC - hP) / (minATRMult * atr);
        return -1;
    }
    return 0;
}

void ResetSwingsAndAlignment()
{
    alignedSinceTime = 0;
    hasLastSwingHigh = false;
    hasLastSwingLow  = false;
    swingHighUsed = true;
    swingLowUsed  = true;
}

void CheckAlignment()
{
    bool alignedNow = ValidTFStack() && htf1Bias != 0 && htf2Bias == htf1Bias && htf3Bias == htf1Bias;
    if (alignedNow && alignedSinceTime == 0)
    {
        alignedSinceTime = iTime(_Symbol, _Period, 0);
        hasLastSwingHigh = false;
        hasLastSwingLow  = false;
        swingHighUsed = true;
        swingLowUsed  = true;
        cntAlignStart++;
    }
    else if (!alignedNow)
    {
        alignedSinceTime = 0;
    }
}

// ------------------------------- Capa 1 (HTF1, ej. D1) -------------------------
void UpdateHTF1()
{
    double me, te, ms;
    int detected = DetectSweep(InpHTF1, htf1ATRHandle, InpManipMinATR_1, me, te, ms);
    if (detected != 0) cntHTF1Sweep++;

    if (detected != 0 && detected != htf1Bias)
    {
        htf1Bias = detected;
        htf1ManipExtreme  = me;
        htf1TargetExtreme = te;
        htf1ManipStrength = ms;
        // cambio real de sesgo en la capa mas alta: invalida todo lo que dependia de el
        htf2Bias = 0;
        htf3Bias = 0;
        ResetSwingsAndAlignment();
    }
    else if (detected != 0 && detected == htf1Bias)
    {
        htf1TargetExtreme = te;
        if (ms > htf1ManipStrength) { htf1ManipExtreme = me; htf1ManipStrength = ms; }
    }
}

// ------------------------------- Capa 2 (HTF2, ej. H4) -------------------------
void UpdateHTF2()
{
    double me, te, ms;
    int detected = DetectSweep(InpHTF2, htf2ATRHandle, InpManipMinATR_2, me, te, ms);
    if (detected != 0) cntHTF2Sweep++;

    if (detected != 0 && detected != htf2Bias)
    {
        htf2Bias = detected;
        htf2ManipStrength = ms;
        htf3Bias = 0;
        ResetSwingsAndAlignment();
    }
    else if (detected != 0 && detected == htf2Bias)
    {
        if (ms > htf2ManipStrength) htf2ManipStrength = ms;
    }
    CheckAlignment();
}

// ------------------------------- Capa 3 (HTF3, rango de trabajo, ej. H1) -------
void UpdateHTF3()
{
    double me, te, ms;
    int detected = DetectSweep(InpHTF3, htf3ATRHandle, InpManipMinATR_3, me, te, ms);
    if (detected != 0) cntHTF3Sweep++;

    if (detected != 0 && detected != htf3Bias)
    {
        htf3Bias = detected;
        htf3ManipExtreme  = me;
        htf3ManipStrength = ms;
        ResetSwingsAndAlignment();
    }
    else if (detected != 0 && detected == htf3Bias)
    {
        if (ms > htf3ManipStrength) { htf3ManipExtreme = me; htf3ManipStrength = ms; }
    }
    CheckAlignment();
}

// ------------------------------- Apertura (SL/TP nativos, sin parciales) -------
void OpenLong(double sl, double tp)
{
    double ask  = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    double lots = CalcLots(ask, sl);
    if (lots <= 0) return;
    if (trade.Buy(lots, _Symbol, 0, sl, tp, "CRT Long")) cntTradesOpened++;
}

void OpenShort(double sl, double tp)
{
    double bid  = SymbolInfoDouble(_Symbol, SYMBOL_BID);
    double lots = CalcLots(bid, sl);
    if (lots <= 0) return;
    if (trade.Sell(lots, _Symbol, 0, sl, tp, "CRT Short")) cntTradesOpened++;
}

// ------------------------------- Pivotes + gatillo de entrada ------------------
void OnNewEntryBar()
{
    int peakShift = InpSwingLen + 1;
    if (iBars(_Symbol, _Period) < peakShift + InpSwingLen + 1) return;

    bool aligned = ValidTFStack() && htf1Bias != 0 && htf2Bias == htf1Bias && htf3Bias == htf1Bias && alignedSinceTime != 0;

    // -------- pivote alto --------
    double peakHigh = iHigh(_Symbol, _Period, peakShift);
    bool isPivotHigh = true;
    for (int i = 1; i <= InpSwingLen; i++)
    {
        if (iHigh(_Symbol, _Period, i) >= peakHigh) isPivotHigh = false;
        if (iHigh(_Symbol, _Period, peakShift + i) >= peakHigh) isPivotHigh = false;
    }

    bool justArmedHigh = false;
    if (isPivotHigh)
    {
        datetime peakTime = iTime(_Symbol, _Period, peakShift);
        if (aligned && htf1Bias == 1 && peakTime >= alignedSinceTime)
        {
            lastSwingHigh = peakHigh;
            lastSwingHighTime = peakTime;
            hasLastSwingHigh = true;
            swingHighUsed = false;
            double lo = iLow(_Symbol, _Period, 1);
            for (int i = 2; i <= InpSwingLen; i++)
                lo = MathMin(lo, iLow(_Symbol, _Period, i));
            pullbackLow = lo;
            justArmedHigh = true;
            cntSwingArmed++;
        }
    }
    if (!justArmedHigh && hasLastSwingHigh && !swingHighUsed)
        pullbackLow = MathMin(pullbackLow, iLow(_Symbol, _Period, 1));

    // -------- pivote bajo --------
    double peakLow = iLow(_Symbol, _Period, peakShift);
    bool isPivotLow = true;
    for (int i = 1; i <= InpSwingLen; i++)
    {
        if (iLow(_Symbol, _Period, i) <= peakLow) isPivotLow = false;
        if (iLow(_Symbol, _Period, peakShift + i) <= peakLow) isPivotLow = false;
    }

    bool justArmedLow = false;
    if (isPivotLow)
    {
        datetime troughTime = iTime(_Symbol, _Period, peakShift);
        if (aligned && htf1Bias == -1 && troughTime >= alignedSinceTime)
        {
            lastSwingLow = peakLow;
            lastSwingLowTime = troughTime;
            hasLastSwingLow = true;
            swingLowUsed = false;
            double hi = iHigh(_Symbol, _Period, 1);
            for (int i = 2; i <= InpSwingLen; i++)
                hi = MathMax(hi, iHigh(_Symbol, _Period, i));
            pullbackHigh = hi;
            justArmedLow = true;
            cntSwingArmed++;
        }
    }
    if (!justArmedLow && hasLastSwingLow && !swingLowUsed)
        pullbackHigh = MathMax(pullbackHigh, iHigh(_Symbol, _Period, 1));

    // -------- gatillo: ruptura del swing en la vela de entrada ya cerrada ------
    double closeLast = iClose(_Symbol, _Period, 1);

    if (aligned && htf1Bias == 1 && hasLastSwingHigh && !swingHighUsed && lastSwingHighTime >= alignedSinceTime)
    {
        if (closeLast > lastSwingHigh)
        {
            cntBreakout++;
            swingHighUsed = true; // se consume pase lo que pase, evita spam
            if (htf3ManipExtreme == 0 || pullbackLow <= htf3ManipExtreme)
            {
                cntFailManipGuard++;
            }
            else
            {
                string q = (htf1ManipStrength >= InpQualityMult && htf2ManipStrength >= InpQualityMult && htf3ManipStrength >= InpQualityMult) ? "A+" : "B";
                if (InpQualityOnly && q != "A+")
                {
                    cntFailQuality++;
                }
                else if (PositionSelect(_Symbol))
                {
                    cntSkippedInPosition++;
                }
                else
                {
                    double sl   = pullbackLow - GetATRValue(entryATRHandle, 1) * InpSLBufferMult;
                    double risk = closeLast - sl;
                    double dist = htf1TargetExtreme - closeLast;
                    if (risk <= 0 || dist <= 0 || dist / risk < InpMinRR)
                        cntFailRR++;
                    else
                        OpenLong(sl, htf1TargetExtreme);
                }
            }
        }
    }

    if (aligned && htf1Bias == -1 && hasLastSwingLow && !swingLowUsed && lastSwingLowTime >= alignedSinceTime)
    {
        if (closeLast < lastSwingLow)
        {
            cntBreakout++;
            swingLowUsed = true;
            if (htf3ManipExtreme == 0 || pullbackHigh >= htf3ManipExtreme)
            {
                cntFailManipGuard++;
            }
            else
            {
                string q = (htf1ManipStrength >= InpQualityMult && htf2ManipStrength >= InpQualityMult && htf3ManipStrength >= InpQualityMult) ? "A+" : "B";
                if (InpQualityOnly && q != "A+")
                {
                    cntFailQuality++;
                }
                else if (PositionSelect(_Symbol))
                {
                    cntSkippedInPosition++;
                }
                else
                {
                    double sl   = pullbackHigh + GetATRValue(entryATRHandle, 1) * InpSLBufferMult;
                    double risk = sl - closeLast;
                    double dist = closeLast - htf1TargetExtreme;
                    if (risk <= 0 || dist <= 0 || dist / risk < InpMinRR)
                        cntFailRR++;
                    else
                        OpenShort(sl, htf1TargetExtreme);
                }
            }
        }
    }
}

// ------------------------------- Panel de estado (Comment) ---------------------
void UpdateChartComment()
{
    if (!InpShowStats) return;
    string t1 = htf1Bias == 1 ? "ALCISTA" : htf1Bias == -1 ? "BAJISTA" : "NEUTRO";
    string t2 = htf2Bias == 1 ? "ALCISTA" : htf2Bias == -1 ? "BAJISTA" : "NEUTRO";
    string t3 = htf3Bias == 1 ? "ALCISTA" : htf3Bias == -1 ? "BAJISTA" : "NEUTRO";
    bool aligned = ValidTFStack() && htf1Bias != 0 && htf2Bias == htf1Bias && htf3Bias == htf1Bias && alignedSinceTime != 0;
    string warn = ValidTFStack() ? "" : "\n⚠ CONFIG TF INVALIDA: HTF1 > HTF2 > HTF3 > entrada";

    Comment("CRT Multi-TF v4\nHTF1: ", t1, "  HTF2: ", t2, "  HTF3: ", t3,
            "\nAlineado (3 capas): ", (aligned ? "SI" : "NO"), warn);
}

// ------------------------------- Ciclo de vida del EA ---------------------------
int OnInit()
{
    trade.SetExpertMagicNumber(InpMagic);

    htf1ATRHandle  = iATR(_Symbol, InpHTF1, InpATRLen);
    htf2ATRHandle  = iATR(_Symbol, InpHTF2, InpATRLen);
    htf3ATRHandle  = iATR(_Symbol, InpHTF3, InpATRLen);
    entryATRHandle = iATR(_Symbol, _Period, InpATRLen);

    if (htf1ATRHandle == INVALID_HANDLE || htf2ATRHandle == INVALID_HANDLE ||
        htf3ATRHandle == INVALID_HANDLE || entryATRHandle == INVALID_HANDLE)
    {
        Print("Error creando los handles de ATR");
        return INIT_FAILED;
    }

    if (!ValidTFStack())
        Print("AVISO: HTF1/HTF2/HTF3/entrada no forman una escalera valida (HTF1 > HTF2 > HTF3 > entrada). El EA no abrira operaciones hasta corregirlo.");

    return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
    if (htf1ATRHandle  != INVALID_HANDLE) IndicatorRelease(htf1ATRHandle);
    if (htf2ATRHandle  != INVALID_HANDLE) IndicatorRelease(htf2ATRHandle);
    if (htf3ATRHandle  != INVALID_HANDLE) IndicatorRelease(htf3ATRHandle);
    if (entryATRHandle != INVALID_HANDLE) IndicatorRelease(entryATRHandle);
    Comment("");

    string summary = StringFormat(
        "=== AUDITORIA CRT v4 ===\r\n"
        "Simbolo/TF entrada: %s / %s\r\n"
        "Barridos HTF1=%d HTF2=%d HTF3=%d\r\n"
        "Alineaciones-3-capas iniciadas=%d\r\n"
        "Swings armados=%d\r\n"
        "Rupturas=%d\r\n"
        "Rechazadas por guarda-manipulacion=%d\r\n"
        "Rechazadas por calidad=%d\r\n"
        "Ignoradas (ya en posicion)=%d\r\n"
        "Rechazadas por R:R<%.2f=%d\r\n"
        "OPERACIONES ABIERTAS=%d\r\n",
        _Symbol, EnumToString(_Period),
        (int)cntHTF1Sweep, (int)cntHTF2Sweep, (int)cntHTF3Sweep,
        (int)cntAlignStart, (int)cntSwingArmed, (int)cntBreakout,
        (int)cntFailManipGuard, (int)cntFailQuality, (int)cntSkippedInPosition,
        InpMinRR, (int)cntFailRR, (int)cntTradesOpened);

    // El Print/PrintFormat normal no siempre llega a tiempo al panel Diario
    // del Tester antes de que se cierre la conexion del agente. Para que
    // sea imposible de perder, se escribe TAMBIEN en un archivo de texto
    // en la carpeta COMUN de MT5 (misma ruta pase lo que pase, sin
    // depender de en que agente del Tester corrio el test):
    // %APPDATA%\MetaQuotes\Terminal\Common\Files\crt_v4_audit.txt
    int fh = FileOpen("crt_v4_audit.txt", FILE_WRITE | FILE_TXT | FILE_ANSI | FILE_COMMON);
    if (fh != INVALID_HANDLE)
    {
        FileWriteString(fh, summary);
        FileClose(fh);
    }

    Print(summary);
}

void OnTick()
{
    if (IsNewBar(InpHTF1, lastHTF1Time)) UpdateHTF1();
    if (IsNewBar(InpHTF2, lastHTF2Time)) UpdateHTF2();
    if (IsNewBar(InpHTF3, lastHTF3Time)) UpdateHTF3();
    if (IsNewBar(_Period, lastEntryTime)) OnNewEntryBar();
    UpdateChartComment();
}
