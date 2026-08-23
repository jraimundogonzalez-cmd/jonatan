//+------------------------------------------------------------------+
//| CRT_MultiTF_Swing_Sniper_v4.mq5                                    |
//|                                                                    |
//| Cambios de esta revision respecto a la version anterior de v4:     |
//|                                                                    |
//|  A) REGLA DEL ULTIMO 10% (sweep intravela, sin repintado):         |
//|     Para cada capa HTF, ademas de la deteccion normal al cierre de |
//|     su vela, se evalua EN CADA TICK si esa vela (en formacion)     |
//|     esta dentro de su ultimo 10% de tiempo (duracion_TF * 0.10,    |
//|     calculado de forma generica via PeriodSeconds(), sin tablas    |
//|     fijas por timeframe). Si dentro de esa ventana ya se cumple    |
//|     barrido + reentrada (usando SOLO el high/low/ultimo precio de  |
//|     la vela EN FORMACION hasta ese instante — nunca datos           |
//|     posteriores), la manipulacion queda validada y CONGELADA en    |
//|     ese mismo tick: no se exige una segunda manipulacion, y si esa |
//|     vela cierra despues, la deteccion normal de cierre para esa    |
//|     vela concreta se omite (no se reprocesa ni se sobreescribe).   |
//|     Interruptor: InpAllowLateSweep10 (activado por defecto). Cada  |
//|     operacion registra si su alineacion involucro una capa         |
//|     validada por esta via (LateSweep10 = TRUE/FALSE) para poder    |
//|     comparar el subconjunto sin volver a correr el test.           |
//|                                                                    |
//|  B) SL CONFIGURABLE (InpSLFromManipTF, activado por defecto):      |
//|     - true  = SL en el extremo del sweep de HTF3 (la capa "rango   |
//|       de trabajo", la misma que ya se usa como guarda de           |
//|       invalidacion del pullback) + buffer de ATR de entrada.       |
//|     - false = comportamiento anterior: SL en el pullback del TF    |
//|       de entrada (M15) + buffer.                                   |
//|     Es un interruptor deliberado para poder aislar el efecto de    |
//|     este cambio del efecto de la regla del 10% — son dos variables |
//|     distintas y no se quieren mezclar en el mismo dato.            |
//|                                                                    |
//|  C) REGISTRO POR OPERACION EN CSV (no solo el resumen final):      |
//|     Common\Files\crt_v4_trades.csv — una fila por operacion         |
//|     CERRADA (via OnTradeTransaction, capturando el precio de       |
//|     salida real), con Symbol/EntryTF/HTF1/HTF2/HTF3/Direccion/     |
//|     Entrada/SL/TP/Riesgo/LateSweep10/CloseTime/ExitPrice/ResultR/  |
//|     WinLoss. El archivo se ACUMULA entre ejecuciones del Tester    |
//|     (no se borra al relanzar) para poder comparar configuraciones  |
//|     sin perder historico — borrarlo a mano si se quiere empezar de |
//|     cero.                                                          |
//|                                                                    |
//| CAMBIOS DE FONDO heredados de la version anterior de v4:           |
//|  1) Un solo TP, sin parciales — SL/TP nativos de MT5.              |
//|  2) Tres capas de alineacion HTF (HTF1 > HTF2 > HTF3/rango de      |
//|     trabajo > TF de entrada), misma logica de manipulacion+cierre  |
//|     de vuelta en las tres, no color de vela.                       |
//|  3) Sin TP forzado: R:R real hacia el objetivo, o NO TRADE.        |
//|  4) InpQualityOnly = false por defecto (ver auditoria previa).      |
//|  5) Auditoria de embudo en Common\Files\crt_v4_audit.txt.          |
//|  6) TP = htf3TargetExtreme (extremo del rango H1) tras comparar    |
//|     TP en HTF1 (PF 0.64), HTF2 (PF 0.86) y esta version (HTF3).    |
//|                                                                    |
//| Ejecutar en el grafico del TF de entrada (M15 en los ejemplos).    |
//| Solo para backtesting, cuenta netting o hedging (el EA nunca abre  |
//| mas de una posicion a la vez por diseño propio).                   |
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
input bool   InpQualityOnly     = false; // Exigir calidad en las 3 capas

input group "Regla del ultimo 10% (sweep intravela, sin repintado)"
input bool InpAllowLateSweep10 = true; // Validar manipulacion dentro del ultimo 10% de tiempo de la vela, sin esperar a que cierre

input group "Gestion (SL / TP unico)"
input bool   InpSLFromManipTF = true;  // SL desde el extremo del sweep de HTF3 (true) o desde el pullback M15 (false)
input double InpSLBufferMult  = 0.25;  // Buffer de SL (x ATR entrada)
input double InpMinRR         = 1.5;   // R:R minimo hacia htf3TargetExtreme; si no se alcanza, NO TRADE

input group "Cuenta"
input double InpRiskPercent = 1.0;
input long   InpMagic       = 990022;

input group "Visual"
input bool InpShowStats = true;

// ------------------------------- Estado de sesgo por capa ----------------------
int    htf1ATRHandle, htf2ATRHandle, htf3ATRHandle, entryATRHandle;
datetime lastHTF1Time = 0, lastHTF2Time = 0, lastHTF3Time = 0, lastEntryTime = 0;

int    htf1Bias = 0; double htf1ManipExtreme = 0, htf1TargetExtreme = 0, htf1ManipStrength = 0; bool htf1BiasIsLate = false;
int    htf2Bias = 0; double htf2TargetExtreme = 0, htf2ManipStrength = 0;                        bool htf2BiasIsLate = false;
int    htf3Bias = 0; double htf3ManipExtreme = 0, htf3TargetExtreme = 0, htf3ManipStrength = 0;   bool htf3BiasIsLate = false;

datetime htf1LateValidatedBarTime = 0, htf2LateValidatedBarTime = 0, htf3LateValidatedBarTime = 0;

datetime alignedSinceTime = 0; // 0 = sin alinear

double   lastSwingHigh = 0;  datetime lastSwingHighTime = 0; bool hasLastSwingHigh = false; bool swingHighUsed = true; double pullbackLow = 0;
double   lastSwingLow  = 0;  datetime lastSwingLowTime  = 0; bool hasLastSwingLow  = false; bool swingLowUsed  = true; double pullbackHigh = 0;

// ------------------------------- Registro de la operacion abierta --------------
bool     openTradeActive = false;
int      openTradeDir = 0;
double   openTradeEntry = 0, openTradeSL = 0, openTradeTP = 0;
datetime openTradeTime = 0;
bool     openTradeLateSweep10 = false;

// ------------------------------- Contadores de auditoria -----------------------
long cntHTF1Sweep = 0, cntHTF2Sweep = 0, cntHTF3Sweep = 0;
long cntHTF1LateSweep = 0, cntHTF2LateSweep = 0, cntHTF3LateSweep = 0;
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

// ------------------------------- Deteccion al CIERRE de la vela (compartida) ---
// Rango -> barrido del extremo de la vela anterior -> cierre de vuelta dentro,
// usando la vela YA CERRADA (shift 1 vs shift 2).
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

// ------------------------------- Aplicacion del sesgo detectado (compartida) ---
// isLate=true si vino de la ventana del ultimo 10% (intravela); false si vino
// del cierre normal de la vela. Solo cambia el sesgo/cascada de reset cuando la
// direccion detectada es distinta de la actual (cambio real), igual que antes.
void ApplyHTF1Detection(int detected, double me, double te, double ms, bool isLate)
{
    if (detected != 0 && detected != htf1Bias)
    {
        htf1Bias = detected;
        htf1ManipExtreme  = me;
        htf1TargetExtreme = te;
        htf1ManipStrength = ms;
        htf1BiasIsLate = isLate;
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

void ApplyHTF2Detection(int detected, double me, double te, double ms, bool isLate)
{
    if (detected != 0 && detected != htf2Bias)
    {
        htf2Bias = detected;
        htf2TargetExtreme = te;
        htf2ManipStrength = ms;
        htf2BiasIsLate = isLate;
        htf3Bias = 0;
        ResetSwingsAndAlignment();
        CheckAlignment();
    }
    else if (detected != 0 && detected == htf2Bias)
    {
        htf2TargetExtreme = te;
        if (ms > htf2ManipStrength) htf2ManipStrength = ms;
    }
}

void ApplyHTF3Detection(int detected, double me, double te, double ms, bool isLate)
{
    if (detected != 0 && detected != htf3Bias)
    {
        htf3Bias = detected;
        htf3ManipExtreme  = me;
        htf3TargetExtreme = te;
        htf3ManipStrength = ms;
        htf3BiasIsLate = isLate;
        ResetSwingsAndAlignment();
        CheckAlignment();
    }
    else if (detected != 0 && detected == htf3Bias)
    {
        htf3TargetExtreme = te;
        if (ms > htf3ManipStrength) { htf3ManipExtreme = me; htf3ManipStrength = ms; }
    }
}

// ------------------------------- Deteccion INTRAVELA (ultimo 10%, sin repintado)
// Se llama en CADA tick. Solo actua si la vela en formacion de ese timeframe ya
// entro en su ultimo 10% de tiempo, y usa UNICAMENTE el high/low/ultimo precio
// de esa vela hasta el tick actual (shift 0) — nunca informacion posterior. Se
// congela en el primer tick que valide; no se vuelve a evaluar esa misma vela.
void CheckLateSweepHTF1()
{
    if (!InpAllowLateSweep10) return;
    datetime barStart = iTime(_Symbol, InpHTF1, 0);
    if (barStart == 0 || barStart == htf1LateValidatedBarTime) return;

    int periodSecs = PeriodSeconds(InpHTF1);
    if (periodSecs <= 0) return;
    if ((double)(TimeCurrent() - barStart) < periodSecs * 0.10 * 9.0) return; // < 90% transcurrido -> aun no es el ultimo 10%

    double formingLow  = iLow(_Symbol, InpHTF1, 0);
    double formingHigh = iHigh(_Symbol, InpHTF1, 0);
    double formingClose= iClose(_Symbol, InpHTF1, 0);
    double priorLow  = iLow(_Symbol, InpHTF1, 1);
    double priorHigh = iHigh(_Symbol, InpHTF1, 1);
    double atr = GetATRValue(htf1ATRHandle, 1);
    if (atr <= 0 || priorLow <= 0 || priorHigh <= 0 || formingLow <= 0 || formingHigh <= 0) return;

    bool bull = (formingLow < priorLow - InpManipMinATR_1 * atr) && (formingClose > priorLow);
    bool bear = (formingHigh > priorHigh + InpManipMinATR_1 * atr) && (formingClose < priorHigh);

    int detected = 0; double me = 0, te = 0, ms = 0;
    if (bull && !bear) { detected = 1;  me = formingLow;  te = priorHigh; ms = (priorLow - formingLow) / (InpManipMinATR_1 * atr); }
    else if (bear && !bull) { detected = -1; me = formingHigh; te = priorLow; ms = (formingHigh - priorHigh) / (InpManipMinATR_1 * atr); }

    if (detected != 0)
    {
        htf1LateValidatedBarTime = barStart;
        cntHTF1Sweep++;
        cntHTF1LateSweep++;
        ApplyHTF1Detection(detected, me, te, ms, true);
    }
}

void CheckLateSweepHTF2()
{
    if (!InpAllowLateSweep10) return;
    datetime barStart = iTime(_Symbol, InpHTF2, 0);
    if (barStart == 0 || barStart == htf2LateValidatedBarTime) return;

    int periodSecs = PeriodSeconds(InpHTF2);
    if (periodSecs <= 0) return;
    if ((double)(TimeCurrent() - barStart) < periodSecs * 0.10 * 9.0) return;

    double formingLow  = iLow(_Symbol, InpHTF2, 0);
    double formingHigh = iHigh(_Symbol, InpHTF2, 0);
    double formingClose= iClose(_Symbol, InpHTF2, 0);
    double priorLow  = iLow(_Symbol, InpHTF2, 1);
    double priorHigh = iHigh(_Symbol, InpHTF2, 1);
    double atr = GetATRValue(htf2ATRHandle, 1);
    if (atr <= 0 || priorLow <= 0 || priorHigh <= 0 || formingLow <= 0 || formingHigh <= 0) return;

    bool bull = (formingLow < priorLow - InpManipMinATR_2 * atr) && (formingClose > priorLow);
    bool bear = (formingHigh > priorHigh + InpManipMinATR_2 * atr) && (formingClose < priorHigh);

    int detected = 0; double me = 0, te = 0, ms = 0;
    if (bull && !bear) { detected = 1;  me = formingLow;  te = priorHigh; ms = (priorLow - formingLow) / (InpManipMinATR_2 * atr); }
    else if (bear && !bull) { detected = -1; me = formingHigh; te = priorLow; ms = (formingHigh - priorHigh) / (InpManipMinATR_2 * atr); }

    if (detected != 0)
    {
        htf2LateValidatedBarTime = barStart;
        cntHTF2Sweep++;
        cntHTF2LateSweep++;
        ApplyHTF2Detection(detected, me, te, ms, true);
    }
}

void CheckLateSweepHTF3()
{
    if (!InpAllowLateSweep10) return;
    datetime barStart = iTime(_Symbol, InpHTF3, 0);
    if (barStart == 0 || barStart == htf3LateValidatedBarTime) return;

    int periodSecs = PeriodSeconds(InpHTF3);
    if (periodSecs <= 0) return;
    if ((double)(TimeCurrent() - barStart) < periodSecs * 0.10 * 9.0) return;

    double formingLow  = iLow(_Symbol, InpHTF3, 0);
    double formingHigh = iHigh(_Symbol, InpHTF3, 0);
    double formingClose= iClose(_Symbol, InpHTF3, 0);
    double priorLow  = iLow(_Symbol, InpHTF3, 1);
    double priorHigh = iHigh(_Symbol, InpHTF3, 1);
    double atr = GetATRValue(htf3ATRHandle, 1);
    if (atr <= 0 || priorLow <= 0 || priorHigh <= 0 || formingLow <= 0 || formingHigh <= 0) return;

    bool bull = (formingLow < priorLow - InpManipMinATR_3 * atr) && (formingClose > priorLow);
    bool bear = (formingHigh > priorHigh + InpManipMinATR_3 * atr) && (formingClose < priorHigh);

    int detected = 0; double me = 0, te = 0, ms = 0;
    if (bull && !bear) { detected = 1;  me = formingLow;  te = priorHigh; ms = (priorLow - formingLow) / (InpManipMinATR_3 * atr); }
    else if (bear && !bull) { detected = -1; me = formingHigh; te = priorLow; ms = (formingHigh - priorHigh) / (InpManipMinATR_3 * atr); }

    if (detected != 0)
    {
        htf3LateValidatedBarTime = barStart;
        cntHTF3Sweep++;
        cntHTF3LateSweep++;
        ApplyHTF3Detection(detected, me, te, ms, true);
    }
}

// ------------------------------- Deteccion al CIERRE (capas 1/2/3) -------------
// Si la vela que acaba de cerrar ya fue validada por la via del ultimo 10%, se
// omite (no se reprocesa/duplica la misma manipulacion).
void UpdateHTF1()
{
    datetime closedBarStart = iTime(_Symbol, InpHTF1, 1);
    if (closedBarStart != 0 && closedBarStart == htf1LateValidatedBarTime) return;

    double me, te, ms;
    int detected = DetectSweep(InpHTF1, htf1ATRHandle, InpManipMinATR_1, me, te, ms);
    if (detected != 0) cntHTF1Sweep++;
    ApplyHTF1Detection(detected, me, te, ms, false);
}

void UpdateHTF2()
{
    datetime closedBarStart = iTime(_Symbol, InpHTF2, 1);
    if (closedBarStart != 0 && closedBarStart == htf2LateValidatedBarTime) return;

    double me, te, ms;
    int detected = DetectSweep(InpHTF2, htf2ATRHandle, InpManipMinATR_2, me, te, ms);
    if (detected != 0) cntHTF2Sweep++;
    ApplyHTF2Detection(detected, me, te, ms, false);
}

void UpdateHTF3()
{
    datetime closedBarStart = iTime(_Symbol, InpHTF3, 1);
    if (closedBarStart != 0 && closedBarStart == htf3LateValidatedBarTime) return;

    double me, te, ms;
    int detected = DetectSweep(InpHTF3, htf3ATRHandle, InpManipMinATR_3, me, te, ms);
    if (detected != 0) cntHTF3Sweep++;
    ApplyHTF3Detection(detected, me, te, ms, false);
}

// ------------------------------- Registro CSV por operacion --------------------
void LogTradeRow(datetime openTime, int dir, double entryPx, double slPx, double tpPx,
                  double riskDist, bool lateSweep, datetime closeTime, double exitPx,
                  double resultR, string winLoss)
{
    int fh = FileOpen("crt_v4_trades.csv", FILE_READ | FILE_WRITE | FILE_TXT | FILE_ANSI | FILE_COMMON);
    if (fh == INVALID_HANDLE) return;
    bool isNewFile = (FileSize(fh) == 0);
    FileSeek(fh, 0, SEEK_END);
    if (isNewFile)
        FileWriteString(fh, "OpenTime,Symbol,EntryTF,HTF1,HTF2,HTF3,Direction,Entry,SL,TP,Risk,LateSweep10,CloseTime,ExitPrice,ResultR,WinLoss\r\n");

    string row = StringFormat("%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%.4f,%s\r\n",
        TimeToString(openTime, TIME_DATE | TIME_MINUTES | TIME_SECONDS),
        _Symbol,
        EnumToString(_Period),
        EnumToString(InpHTF1), EnumToString(InpHTF2), EnumToString(InpHTF3),
        (dir == 1 ? "LONG" : "SHORT"),
        DoubleToString(entryPx, _Digits),
        DoubleToString(slPx, _Digits),
        DoubleToString(tpPx, _Digits),
        DoubleToString(riskDist, _Digits),
        (lateSweep ? "TRUE" : "FALSE"),
        TimeToString(closeTime, TIME_DATE | TIME_MINUTES | TIME_SECONDS),
        DoubleToString(exitPx, _Digits),
        resultR,
        winLoss);

    FileWriteString(fh, row);
    FileClose(fh);
}

// ------------------------------- Apertura (SL/TP nativos, sin parciales) -------
void OpenLong(double sl, double tp)
{
    double ask  = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    double lots = CalcLots(ask, sl);
    if (lots <= 0) return;
    if (trade.Buy(lots, _Symbol, 0, sl, tp, "CRT Long"))
    {
        cntTradesOpened++;
        openTradeActive = true;
        openTradeDir = 1;
        openTradeEntry = trade.ResultPrice();
        openTradeSL = sl;
        openTradeTP = tp;
        openTradeTime = TimeCurrent();
        openTradeLateSweep10 = htf1BiasIsLate || htf2BiasIsLate || htf3BiasIsLate;
    }
}

void OpenShort(double sl, double tp)
{
    double bid  = SymbolInfoDouble(_Symbol, SYMBOL_BID);
    double lots = CalcLots(bid, sl);
    if (lots <= 0) return;
    if (trade.Sell(lots, _Symbol, 0, sl, tp, "CRT Short"))
    {
        cntTradesOpened++;
        openTradeActive = true;
        openTradeDir = -1;
        openTradeEntry = trade.ResultPrice();
        openTradeSL = sl;
        openTradeTP = tp;
        openTradeTime = TimeCurrent();
        openTradeLateSweep10 = htf1BiasIsLate || htf2BiasIsLate || htf3BiasIsLate;
    }
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
                    double sl = InpSLFromManipTF
                        ? htf3ManipExtreme - GetATRValue(entryATRHandle, 1) * InpSLBufferMult
                        : pullbackLow - GetATRValue(entryATRHandle, 1) * InpSLBufferMult;
                    double risk = closeLast - sl;
                    double dist = htf3TargetExtreme - closeLast;
                    if (risk <= 0 || dist <= 0 || dist / risk < InpMinRR)
                        cntFailRR++;
                    else
                        OpenLong(sl, htf3TargetExtreme);
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
                    double sl = InpSLFromManipTF
                        ? htf3ManipExtreme + GetATRValue(entryATRHandle, 1) * InpSLBufferMult
                        : pullbackHigh + GetATRValue(entryATRHandle, 1) * InpSLBufferMult;
                    double risk = sl - closeLast;
                    double dist = closeLast - htf3TargetExtreme;
                    if (risk <= 0 || dist <= 0 || dist / risk < InpMinRR)
                        cntFailRR++;
                    else
                        OpenShort(sl, htf3TargetExtreme);
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
        "Regla ultimo 10%%: %s | SL desde sweep HTF3: %s\r\n"
        "Barridos HTF1=%d (tardios=%d)  HTF2=%d (tardios=%d)  HTF3=%d (tardios=%d)\r\n"
        "Alineaciones-3-capas iniciadas=%d\r\n"
        "Swings armados=%d\r\n"
        "Rupturas=%d\r\n"
        "Rechazadas por guarda-manipulacion=%d\r\n"
        "Rechazadas por calidad=%d\r\n"
        "Ignoradas (ya en posicion)=%d\r\n"
        "Rechazadas por R:R<%.2f=%d\r\n"
        "OPERACIONES ABIERTAS=%d\r\n"
        "Detalle por operacion: Common\\Files\\crt_v4_trades.csv\r\n",
        _Symbol, EnumToString(_Period),
        (InpAllowLateSweep10 ? "SI" : "NO"), (InpSLFromManipTF ? "SI" : "NO"),
        (int)cntHTF1Sweep, (int)cntHTF1LateSweep,
        (int)cntHTF2Sweep, (int)cntHTF2LateSweep,
        (int)cntHTF3Sweep, (int)cntHTF3LateSweep,
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

void OnTradeTransaction(const MqlTradeTransaction &trans, const MqlTradeRequest &request, const MqlTradeResult &result)
{
    if (!openTradeActive) return;
    if (trans.type != TRADE_TRANSACTION_DEAL_ADD) return;
    if (!HistoryDealSelect(trans.deal)) return;
    if ((long)HistoryDealGetInteger(trans.deal, DEAL_MAGIC) != InpMagic) return;
    if (HistoryDealGetString(trans.deal, DEAL_SYMBOL) != _Symbol) return;
    if ((int)HistoryDealGetInteger(trans.deal, DEAL_ENTRY) != DEAL_ENTRY_OUT) return;

    double exitPrice = HistoryDealGetDouble(trans.deal, DEAL_PRICE);
    datetime closeTime = (datetime)HistoryDealGetInteger(trans.deal, DEAL_TIME);

    double riskDist = MathAbs(openTradeEntry - openTradeSL);
    double pnlDist  = (openTradeDir == 1) ? (exitPrice - openTradeEntry) : (openTradeEntry - exitPrice);
    double resultR  = (riskDist > 0) ? (pnlDist / riskDist) : 0;
    string winLoss  = (resultR > 0) ? "WIN" : "LOSS";

    LogTradeRow(openTradeTime, openTradeDir, openTradeEntry, openTradeSL, openTradeTP,
                riskDist, openTradeLateSweep10, closeTime, exitPrice, resultR, winLoss);

    openTradeActive = false;
}

void OnTick()
{
    CheckLateSweepHTF1();
    CheckLateSweepHTF2();
    CheckLateSweepHTF3();

    if (IsNewBar(InpHTF1, lastHTF1Time)) UpdateHTF1();
    if (IsNewBar(InpHTF2, lastHTF2Time)) UpdateHTF2();
    if (IsNewBar(InpHTF3, lastHTF3Time)) UpdateHTF3();
    if (IsNewBar(_Period, lastEntryTime)) OnNewEntryBar();
    UpdateChartComment();
}
