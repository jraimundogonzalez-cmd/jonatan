//+------------------------------------------------------------------+
//| CRT_MultiTF_Swing_Sniper_v3.mq5                                    |
//|                                                                    |
//| Puerto a MQL5 del indicador/estrategia Pine "CRT Multi-TF          |
//| Swing/Sniper v3": mismo modelo (manipulacion HTF + alineacion en   |
//| TF intermedio + ruptura de pivote en el TF de entrada), mismo      |
//| filtro de calidad A+, misma validacion dura de que                 |
//| HTF > intermedio > entrada, mismo SL por ATR del pullback y salida |
//| en 3 tramos (33% / 33% / 34%) en TP1/TP2/TP3.                      |
//|                                                                    |
//| PENSADO SOLO PARA BACKTESTING (Strategy Tester de MT5), como       |
//| confirmaste. No incluye manejo de reconexion/requotes para         |
//| operativa real en vivo — si mas adelante quieres pasarlo a         |
//| real/demo, hay que anadir esa capa antes.                          |
//|                                                                    |
//| Asume cuenta NETTING (una sola posicion neta por simbolo, que es   |
//| lo mas comun en cuentas de fondeo sobre MT5): los TP1/TP2/TP3 se   |
//| simulan con cierres PARCIALES de esa unica posicion               |
//| (PositionClosePartial), monitoreados en cada tick. Si tu broker    |
//| usa cuenta HEDGING, dimelo y lo adapto a 3 ordenes independientes. |
//|                                                                    |
//| IMPORTANTE: no he podido compilar esto (no tengo MetaEditor en     |
//| este entorno) — revisa la pestaña "Errores" al compilar la        |
//| primera vez, por si hay que ajustar algun detalle de sintaxis.     |
//+------------------------------------------------------------------+
#property copyright "CRT Multi-TF"
#property version   "1.00"

#include <Trade/Trade.mqh>
CTrade trade;

// ------------------------------- Inputs --------------------------------------
input group "Timeframes (el EA va en el grafico del TF de entrada)"
input ENUM_TIMEFRAMES InpHTF        = PERIOD_D1;   // HTF (SWING: D1, SNIPER: H4)
input ENUM_TIMEFRAMES InpMidTF      = PERIOD_H4;   // TF intermedio (SWING: H4, SNIPER: H1)
input int             InpSwingLen   = 2;           // Pivote de entrada: velas a cada lado

input group "Manipulacion / ATR"
input int    InpATRLen           = 14;    // Longitud ATR
input double InpManipMinATR_HTF  = 0.30;  // Penetracion minima HTF (x ATR)
input double InpManipMinATR_Mid  = 0.30;  // Penetracion minima intermedio (x ATR)
input double InpQualityMult      = 1.5;   // Umbral para calidad A+
input bool   InpQualityOnly      = true;  // Descartar señales B (solo A+)

input group "Gestion (SL / TP escalonado)"
input double         InpSLBufferMult = 0.25;      // Buffer de SL (x ATR entrada)
input ENUM_TIMEFRAMES InpTP1TF       = PERIOD_H4; // TP1 - rango de
input ENUM_TIMEFRAMES InpTP2TF       = PERIOD_H6; // TP2 - rango de
input ENUM_TIMEFRAMES InpTP3TF       = PERIOD_H8; // TP3 - rango de

input group "Cuenta"
input double InpRiskPercent = 1.0;      // % de equity arriesgado por operacion
input long   InpMagic       = 990022;   // Numero magico

// ------------------------------- Estado del sesgo -----------------------------
int    htfATRHandle, midATRHandle, entryATRHandle;

datetime lastHTFTime = 0, lastMidTime = 0, lastEntryTime = 0;

int    htfBias = 0;
double htfManipExtreme = 0, htfManipStrength = 0;

int    midBias = 0;
double midManipStrength = 0;

datetime alignedSinceTime = 0; // 0 = sin alinear (equivalente a "na")

double   lastSwingHigh = 0;  datetime lastSwingHighTime = 0; bool hasLastSwingHigh = false; bool swingHighUsed = true; double pullbackLow = 0;
double   lastSwingLow  = 0;  datetime lastSwingLowTime  = 0; bool hasLastSwingLow  = false; bool swingLowUsed  = true; double pullbackHigh = 0;

// ------------------------------- Estado de la posicion -------------------------
int    posDir = 0;     // 0 flat, 1 long, -1 short
int    posStage = 0;   // 0 = nada cerrado, 1 = TP1 hecho, 2 = TP1+TP2 hechos
double posSL = 0, posTP1 = 0, posTP2 = 0, posTP3 = 0;
double posVol1 = 0, posVol2 = 0, posVol3 = 0;

// ------------------------------- Utilidades -----------------------------------
bool ValidTFStack()
{
    return PeriodSeconds(InpHTF) > PeriodSeconds(InpMidTF) && PeriodSeconds(InpMidTF) > PeriodSeconds(_Period);
}

double GetATRValue(int handle, int shift)
{
    double buf[];
    ArraySetAsSeries(buf, true);
    if (CopyBuffer(handle, 0, shift, 1, buf) <= 0) return 0;
    return buf[0];
}

// Redondea al step del simbolo, SIN forzar el minimo del broker — para
// repartir tramos de una posicion cuyo tamaño total ya es valido. Usar
// NormalizeVolume (que si fuerza el minimo) aqui inflaria la suma de los
// 3 tramos por encima del volumen real abierto en posiciones pequeñas.
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

// Redondea Y fuerza los limites min/max del broker — solo para el tamaño
// TOTAL de la operacion (CalcLots), nunca para repartir tramos.
double NormalizeVolume(double vol)
{
    double step   = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
    double minVol = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
    double maxVol = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
    double v = RoundToStep(vol);
    if (v < minVol) v = minVol;
    if (v > maxVol) v = maxVol;
    return RoundToStep(v);
}

void SplitVolume(double total, double &v1, double &v2, double &v3)
{
    double minVol = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
    v1 = RoundToStep(total * 0.33);
    v2 = RoundToStep(total * 0.33);
    v3 = RoundToStep(total - v1 - v2);
    if (v1 < minVol || v2 < minVol || v3 < minVol)
    {
        // posicion demasiado pequeña para partir en 3 tramos limpios:
        // un solo cierre completo en TP3, sin parciales en TP1/TP2.
        v1 = 0; v2 = 0; v3 = total;
    }
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
    if (t == 0) return false; // historial insuficiente todavia
    if (t != lastSeen)
    {
        lastSeen = t;
        return true;
    }
    return false;
}

// ------------------------------- Apertura de posicion --------------------------
void OpenLong(double sl, double tp1, double tp2, double tp3)
{
    double ask  = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
    double lots = CalcLots(ask, sl);
    if (lots <= 0) return;

    double v1, v2, v3;
    SplitVolume(lots, v1, v2, v3);

    if (trade.Buy(lots, _Symbol, 0, sl, 0, "CRT Long"))
    {
        posDir = 1; posStage = 0;
        posSL = sl; posTP1 = tp1; posTP2 = tp2; posTP3 = tp3;
        posVol1 = v1; posVol2 = v2; posVol3 = v3;
    }
}

void OpenShort(double sl, double tp1, double tp2, double tp3)
{
    double bid  = SymbolInfoDouble(_Symbol, SYMBOL_BID);
    double lots = CalcLots(bid, sl);
    if (lots <= 0) return;

    double v1, v2, v3;
    SplitVolume(lots, v1, v2, v3);

    if (trade.Sell(lots, _Symbol, 0, sl, 0, "CRT Short"))
    {
        posDir = -1; posStage = 0;
        posSL = sl; posTP1 = tp1; posTP2 = tp2; posTP3 = tp3;
        posVol1 = v1; posVol2 = v2; posVol3 = v3;
    }
}

// ------------------------------- Gestion de la posicion abierta ----------------
void ManageOpenPosition()
{
    if (posDir == 0) return;

    if (!PositionSelect(_Symbol))
    {
        // se cerro fuera de este bloque (SL nativo, cierre manual, etc.)
        posDir = 0; posStage = 0;
        return;
    }

    double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
    double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);

    if (posDir == 1)
    {
        if (posStage == 0 && posVol1 > 0 && bid >= posTP1)
        {
            trade.PositionClosePartial(_Symbol, posVol1);
            posStage = 1;
        }
        else if (posStage == 1 && posVol2 > 0 && bid >= posTP2)
        {
            trade.PositionClosePartial(_Symbol, posVol2);
            posStage = 2;
        }
        else if (posStage <= 2 && bid >= posTP3)
        {
            trade.PositionClose(_Symbol);
            posDir = 0; posStage = 0;
        }
    }
    else if (posDir == -1)
    {
        if (posStage == 0 && posVol1 > 0 && ask <= posTP1)
        {
            trade.PositionClosePartial(_Symbol, posVol1);
            posStage = 1;
        }
        else if (posStage == 1 && posVol2 > 0 && ask <= posTP2)
        {
            trade.PositionClosePartial(_Symbol, posVol2);
            posStage = 2;
        }
        else if (posStage <= 2 && ask <= posTP3)
        {
            trade.PositionClose(_Symbol);
            posDir = 0; posStage = 0;
        }
    }
}

// ------------------------------- Sesgo HTF (reset solo si cambia de verdad) ----
void UpdateHTFBias()
{
    double htfHighC  = iHigh(_Symbol, InpHTF, 1);
    double htfLowC   = iLow(_Symbol, InpHTF, 1);
    double htfCloseC = iClose(_Symbol, InpHTF, 1);
    double htfHighP  = iHigh(_Symbol, InpHTF, 2);
    double htfLowP   = iLow(_Symbol, InpHTF, 2);
    double htfATR    = GetATRValue(htfATRHandle, 1);
    if (htfATR <= 0 || htfHighP <= 0 || htfLowP <= 0) return; // historial insuficiente

    bool bullSweep = (htfLowC < htfLowP - InpManipMinATR_HTF * htfATR) && (htfCloseC > htfLowP);
    bool bearSweep = (htfHighC > htfHighP + InpManipMinATR_HTF * htfATR) && (htfCloseC < htfHighP);
    int detected = 0;
    if (bullSweep && !bearSweep) detected = 1;
    else if (bearSweep && !bullSweep) detected = -1;

    if (detected != 0 && detected != htfBias)
    {
        htfBias = detected;
        htfManipExtreme  = (detected == 1) ? htfLowC : htfHighC;
        htfManipStrength = (detected == 1) ? (htfLowP - htfLowC) / (InpManipMinATR_HTF * htfATR)
                                            : (htfHighC - htfHighP) / (InpManipMinATR_HTF * htfATR);
        midBias = 0;
        alignedSinceTime = 0;
        hasLastSwingHigh = false;
        hasLastSwingLow  = false;
        swingHighUsed = true;
        swingLowUsed  = true;
    }
    else if (detected != 0 && detected == htfBias)
    {
        double newManipExtreme  = (detected == 1) ? htfLowC : htfHighC;
        double newManipStrength = (detected == 1) ? (htfLowP - htfLowC) / (InpManipMinATR_HTF * htfATR)
                                                    : (htfHighC - htfHighP) / (InpManipMinATR_HTF * htfATR);
        if (newManipStrength > htfManipStrength)
        {
            htfManipExtreme  = newManipExtreme;
            htfManipStrength = newManipStrength;
        }
    }
}

// ------------------------------- Sesgo intermedio + alineacion -----------------
void UpdateMidBias()
{
    double midHighC  = iHigh(_Symbol, InpMidTF, 1);
    double midLowC   = iLow(_Symbol, InpMidTF, 1);
    double midCloseC = iClose(_Symbol, InpMidTF, 1);
    double midHighP  = iHigh(_Symbol, InpMidTF, 2);
    double midLowP   = iLow(_Symbol, InpMidTF, 2);
    double midATR    = GetATRValue(midATRHandle, 1);
    if (midATR <= 0 || midHighP <= 0 || midLowP <= 0) return;

    bool bullSweep = (midLowC < midLowP - InpManipMinATR_Mid * midATR) && (midCloseC > midLowP);
    bool bearSweep = (midHighC > midHighP + InpManipMinATR_Mid * midATR) && (midCloseC < midHighP);
    int detected = 0;
    if (bullSweep && !bearSweep) detected = 1;
    else if (bearSweep && !bullSweep) detected = -1;

    if (detected != 0 && detected != midBias)
    {
        midBias = detected;
        midManipStrength = (detected == 1) ? (midLowP - midLowC) / (InpManipMinATR_Mid * midATR)
                                            : (midHighC - midHighP) / (InpManipMinATR_Mid * midATR);
    }
    else if (detected != 0 && detected == midBias)
    {
        double newStrength = (detected == 1) ? (midLowP - midLowC) / (InpManipMinATR_Mid * midATR)
                                              : (midHighC - midHighP) / (InpManipMinATR_Mid * midATR);
        if (newStrength > midManipStrength) midManipStrength = newStrength;
    }

    bool alignedNowRaw = ValidTFStack() && htfBias != 0 && midBias == htfBias;
    if (alignedNowRaw && alignedSinceTime == 0)
    {
        alignedSinceTime = iTime(_Symbol, _Period, 0);
        hasLastSwingHigh = false;
        hasLastSwingLow  = false;
        swingHighUsed = true;
        swingLowUsed  = true;
    }
    else if (!alignedNowRaw)
    {
        alignedSinceTime = 0;
    }
}

// ------------------------------- Pivotes + gatillo de entrada ------------------
void OnNewEntryBar()
{
    int peakShift = InpSwingLen + 1;
    if (iBars(_Symbol, _Period) < peakShift + InpSwingLen + 1) return; // historial insuficiente

    bool aligned = ValidTFStack() && htfBias != 0 && midBias == htfBias && alignedSinceTime != 0;

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
        if (aligned && htfBias == 1 && peakTime >= alignedSinceTime)
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
        if (aligned && htfBias == -1 && troughTime >= alignedSinceTime)
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
        }
    }
    if (!justArmedLow && hasLastSwingLow && !swingLowUsed)
        pullbackHigh = MathMax(pullbackHigh, iHigh(_Symbol, _Period, 1));

    // -------- gatillo: ruptura del swing en la vela de entrada ya cerrada ------
    double closeLast = iClose(_Symbol, _Period, 1);

    if (aligned && htfBias == 1 && hasLastSwingHigh && !swingHighUsed && lastSwingHighTime >= alignedSinceTime)
    {
        if (closeLast > lastSwingHigh && htfManipExtreme != 0 && pullbackLow > htfManipExtreme)
        {
            string q = (htfManipStrength >= InpQualityMult && midManipStrength >= InpQualityMult) ? "A+" : "B";
            bool passes = !InpQualityOnly || q == "A+";
            swingHighUsed = true;
            if (passes && posDir == 0)
            {
                double sl  = pullbackLow - GetATRValue(entryATRHandle, 1) * InpSLBufferMult;
                double tp1 = iHigh(_Symbol, InpTP1TF, 1);
                double tp2 = iHigh(_Symbol, InpTP2TF, 1);
                double tp3 = iHigh(_Symbol, InpTP3TF, 1);
                OpenLong(sl, tp1, tp2, tp3);
            }
        }
    }

    if (aligned && htfBias == -1 && hasLastSwingLow && !swingLowUsed && lastSwingLowTime >= alignedSinceTime)
    {
        if (closeLast < lastSwingLow && htfManipExtreme != 0 && pullbackHigh < htfManipExtreme)
        {
            string q = (htfManipStrength >= InpQualityMult && midManipStrength >= InpQualityMult) ? "A+" : "B";
            bool passes = !InpQualityOnly || q == "A+";
            swingLowUsed = true;
            if (passes && posDir == 0)
            {
                double sl  = pullbackHigh + GetATRValue(entryATRHandle, 1) * InpSLBufferMult;
                double tp1 = iLow(_Symbol, InpTP1TF, 1);
                double tp2 = iLow(_Symbol, InpTP2TF, 1);
                double tp3 = iLow(_Symbol, InpTP3TF, 1);
                OpenShort(sl, tp1, tp2, tp3);
            }
        }
    }
}

// ------------------------------- Panel de estado (Comment) ---------------------
void UpdateChartComment()
{
    string htfTxt = htfBias == 1 ? "ALCISTA" : htfBias == -1 ? "BAJISTA" : "NEUTRO - NO OPERAR";
    string midTxt = midBias == 1 ? "ALCISTA" : midBias == -1 ? "BAJISTA" : "NEUTRO";
    bool aligned = ValidTFStack() && htfBias != 0 && midBias == htfBias && alignedSinceTime != 0;
    string alTxt = aligned ? "SI" : "NO";
    string warn  = ValidTFStack() ? "" : "\n⚠ CONFIG TF INVALIDA: intermedio debe ser < HTF y > TF de entrada";

    Comment("CRT Multi-TF Swing/Sniper v3\nHTF: ", htfTxt, "\nIntermedio: ", midTxt, "\nAlineado: ", alTxt, warn);
}

// ------------------------------- Ciclo de vida del EA ---------------------------
int OnInit()
{
    trade.SetExpertMagicNumber(InpMagic);

    htfATRHandle   = iATR(_Symbol, InpHTF, InpATRLen);
    midATRHandle   = iATR(_Symbol, InpMidTF, InpATRLen);
    entryATRHandle = iATR(_Symbol, _Period, InpATRLen);

    if (htfATRHandle == INVALID_HANDLE || midATRHandle == INVALID_HANDLE || entryATRHandle == INVALID_HANDLE)
    {
        Print("Error creando los handles de ATR");
        return INIT_FAILED;
    }

    if (!ValidTFStack())
        Print("AVISO: HTF/intermedio/entrada no forman una escalera valida (HTF > intermedio > entrada). El EA no abrira operaciones hasta corregirlo.");

    return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
    if (htfATRHandle != INVALID_HANDLE) IndicatorRelease(htfATRHandle);
    if (midATRHandle != INVALID_HANDLE) IndicatorRelease(midATRHandle);
    if (entryATRHandle != INVALID_HANDLE) IndicatorRelease(entryATRHandle);
    Comment("");
}

void OnTick()
{
    ManageOpenPosition();

    if (IsNewBar(InpHTF, lastHTFTime))   UpdateHTFBias();
    if (IsNewBar(InpMidTF, lastMidTime)) UpdateMidBias();
    if (IsNewBar(_Period, lastEntryTime)) OnNewEntryBar();

    UpdateChartComment();
}
