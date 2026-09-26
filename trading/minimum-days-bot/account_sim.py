"""
Simulador de cuenta hipotética para el Minimum Days Bot (modo --account de analyze_trades.py).

Reproduce a un trader que abre una cuenta nueva y la opera con los trades REALES del
backtest, día a día, hasta que:
  A) consigue N Minimum Days          -> OK   (el ciclo termina en ese mismo momento)
  B) viola el drawdown                 -> FAIL (DRAWDOWN)
  C) viola el límite de pérdida diaria -> FAIL (DAILY LOSS)
El siguiente ciclo (cuenta nueva) empieza el siguiente día de mercado.

Dos modelos independientes, que NO se mezclan:
  Modelo A  solo P&L REALIZADO: la equity solo cambia al cerrar cada trade.
  Modelo B  P&L realizado + EXCURSIÓN ADVERSA de cada trade: mientras un trade está
            abierto, la equity mínima = equity antes del trade - comisión de entrada
            - drawdown del trade (columna "Drawdown"/"Excursión adversa" del export).
Los parámetros son solo del simulador; no corresponden a ninguna empresa concreta.
"""
import csv
import datetime as dt
import statistics

from analyze_trades import market_days, op_day

MODELS = ("A", "B")
PERIODS_DEFAULT = "2019-2020,2021-2022,2023-2024,2025-2026"


# ----------------------------------------------------------------------------- preparación
def adjust_costs(trades, p):
    """Recalcula P&L y drawdown si --commission/--contracts difieren de los del backtest."""
    same = p.commission == p.bt_commission and p.contracts == p.bt_contracts
    out = []
    for t in trades:
        t = dict(t)
        if not same:
            gross = t["pnl"] + p.bt_commission * 2 * p.bt_contracts
            k = p.contracts / p.bt_contracts
            t["pnl"] = round(gross * k - p.commission * 2 * p.contracts, 2)
            t["dd"] = t["dd"] * k
        out.append(t)
    return out, same


def by_day(trades):
    days = {}
    for t in trades:
        days.setdefault(op_day(t["exit"]), []).append(t)
    for ts in days.values():
        ts.sort(key=lambda t: t["exit"])
    return days


def post_goal_check(trades, target):
    """Trades abiertos DESPUÉS de que el P&L realizado del día alcanzara el objetivo."""
    bad = []
    for d, ts in sorted(by_day(trades).items()):
        real, goal_at = 0.0, None
        for t in ts:
            if goal_at is not None and (t.get("entry") or t["exit"]) >= goal_at:
                bad.append((d, t))
                continue
            real += t["pnl"]
            if goal_at is None and real >= target:
                goal_at = t["exit"]
    return bad


# ----------------------------------------------------------------------------- motor
def simulate(trades, d0, d1, p, model):
    tbd = by_day(trades)
    cal = sorted(set(market_days(d0, d1)) | {d for d in tbd if d0 <= d <= d1})
    side_comm = p.commission * p.contracts
    cycles, cur, skipped = [], None, 0

    def floor(c):
        return (p.starting_equity if p.dd_mode == "static" else c["peak"]) - p.drawdown

    for d in cal:
        if cur is None:
            cur = {"start": d, "eq": p.starting_equity, "peak": p.starting_equity, "min": 0, "mkt": 0,
                   "op": 0, "trades": 0, "path": [], "maxdd": 0.0, "mincum": 0.0, "status": "ABIERTO",
                   "reason": "FIN DE DATOS"}
        c = cur
        c["mkt"] += 1
        c["end"] = d
        day_real, goal, traded, ended = 0.0, False, False, None
        for t in tbd.get(d, []):
            if goal:                       # daily stop: no se opera tras alcanzar el objetivo
                skipped += 1
                continue
            traded = True
            c["trades"] += 1
            if model == "B":
                low_eq = c["eq"] - side_comm - t["dd"]
                low_day = day_real - side_comm - t["dd"]
                c["maxdd"] = max(c["maxdd"], c["peak"] - low_eq)
                c["mincum"] = min(c["mincum"], low_eq - p.starting_equity)
                if low_eq <= floor(c):
                    ended = "DRAWDOWN"
                elif p.daily_loss and low_day <= -p.daily_loss:
                    ended = "DAILY LOSS"
                if ended:                  # la cuenta se liquida justo en el límite violado
                    hit = floor(c) if ended == "DRAWDOWN" else c["eq"] - p.daily_loss - day_real
                    day_real += hit - c["eq"]
                    c["eq"] = hit
                    break
            c["eq"] += t["pnl"]
            day_real += t["pnl"]
            c["maxdd"] = max(c["maxdd"], c["peak"] - c["eq"])
            c["mincum"] = min(c["mincum"], c["eq"] - p.starting_equity)
            if c["eq"] <= floor(c):
                ended = "DRAWDOWN"
            elif p.daily_loss and day_real <= -p.daily_loss:
                ended = "DAILY LOSS"
            if ended:
                break
            if p.dd_mode == "trailing-intraday":
                c["peak"] = max(c["peak"], c["eq"])
            if day_real >= p.minimum_day_profit:
                goal = True
        if traded:
            c["op"] += 1
            c["path"].append(round(day_real, 2))
        if ended:
            c["status"], c["reason"] = "FAIL", ended
            c["pnl"] = c["eq"] - p.starting_equity
            cycles.append(c)
            cur = None
            continue
        if p.dd_mode == "trailing-eod":
            c["peak"] = max(c["peak"], c["eq"])
        if traded and day_real >= p.minimum_day_profit:
            c["min"] += 1
        if c["min"] >= p.minimum_days:
            c["status"], c["reason"] = "OK", f"{p.minimum_days} MIN DAYS"
            c["nat"] = (c["end"] - c["start"]).days + 1
            c["pnl"] = c["eq"] - p.starting_equity   # beneficio exacto al alcanzar el último MIN DAY
            cycles.append(c)
            cur = None
    if cur is not None:
        cur["pnl"] = cur["eq"] - p.starting_equity
        cycles.append(cur)
    for c in cycles:
        path = c["path"]
        c["neg_days"] = sum(x < 0 for x in path)
        c["pos_below"] = sum(0 <= x < p.minimum_day_profit for x in path)
        c["worst_day"] = min(path) if path else None
    return cycles, skipped


# ----------------------------------------------------------------------------- estadísticas
def _q(xs, f):
    return f(xs) if xs else None


def cycle_stats(cycles, p):
    ok = [c for c in cycles if c["status"] == "OK"]
    fail = [c for c in cycles if c["status"] == "FAIL"]
    op, nat, pnl = [c["op"] for c in ok], [c["nat"] for c in ok], [c["pnl"] for c in ok]
    hist = {str(k): sum(c["op"] == k for c in ok) for k in range(1, 10)}
    hist["10+"] = sum(c["op"] >= 10 for c in ok)
    negs = [c["neg_days"] for c in ok]
    return {
        "total": len(ok) + len(fail), "ok": len(ok), "fail": len(fail),
        "fail_dd": sum(c["reason"] == "DRAWDOWN" for c in fail),
        "fail_dl": sum(c["reason"] == "DAILY LOSS" for c in fail),
        "abierto": sum(c["status"] == "ABIERTO" for c in cycles),
        "success": 100 * len(ok) / (len(ok) + len(fail)) if ok or fail else None,
        "op_mean": _q(op, statistics.mean), "op_med": _q(op, statistics.median), "op_max": _q(op, max),
        "mkt_mean": _q([c["mkt"] for c in ok], statistics.mean),
        "nat_mean": _q(nat, statistics.mean), "nat_med": _q(nat, statistics.median), "nat_max": _q(nat, max),
        "hist": hist,
        "pnl_mean": _q(pnl, statistics.mean), "pnl_med": _q(pnl, statistics.median),
        "pnl_min": _q(pnl, min), "pnl_max": _q(pnl, max),
        "ok_pnl_neg": sum(x < 0 for x in pnl),
        "clean": sum(n == 0 for n in negs),
        "neg1": sum(n == 1 for n in negs), "neg2": sum(n == 2 for n in negs), "neg3": sum(n >= 3 for n in negs),
        "neg_mean": _q(negs, statistics.mean),
        "posb_total": sum(c["pos_below"] for c in ok),
        "worst_day_ok": _q([c["worst_day"] for c in ok if c["worst_day"] is not None], min),
        "mincum_mean": _q([c["mincum"] for c in ok], statistics.mean),
        "mincum_min": _q([c["mincum"] for c in ok], min),
        "maxdd_ok_mean": _q([c["maxdd"] for c in ok], statistics.mean),
        "maxdd_all": _q([c["maxdd"] for c in cycles], max),
    }


def day_distribution(trades, p):
    """Clasificación de TODOS los días operados: P&L realizado y mínimo intradía (con excursión adversa)."""
    side_comm = p.commission * p.contracts
    rows = []
    for d, ts in sorted(by_day(trades).items()):
        real, low = 0.0, 0.0
        for t in ts:
            low = min(low, real - side_comm - t["dd"])
            real += t["pnl"]
            low = min(low, real)
        rows.append((d, round(real, 2), low))
    T = p.minimum_day_profit
    cats = [(f"A  >= +{f(T)}", lambda x: x >= T), (f"B  0 .. +{f(T - 0.01)}", lambda x: 0 <= x < T),
            (f"C  -0,01 .. -{f(T - 0.01)}", lambda x: -T < x < 0), (f"D  <= -{f(T)}", lambda x: x <= -T),
            ("E  <= -500", lambda x: x <= -500), ("F  <= -1.000", lambda x: x <= -1000),
            ("G  <= -1.500", lambda x: x <= -1500), ("H  <= -2.000", lambda x: x <= -2000)]
    return [(name, sum(f(r) for _, r, _ in rows), sum(f(lo) for _, _, lo in rows)) for name, f in cats], rows


def trade_stats(trades):
    w = [t["pnl"] for t in trades if t["pnl"] > 0]
    l = [t["pnl"] for t in trades if t["pnl"] <= 0]
    gl = -sum(l)
    return {"trades": len(trades), "winrate": 100 * len(w) / len(trades) if trades else None,
            "pf": sum(w) / gl if gl else None}


# ----------------------------------------------------------------------------- informe
def f(v, d=2):
    if v is None:
        return "-"
    if isinstance(v, float):
        return f"{v:,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return str(v)


def ab(sa, sb, k, d=2):
    return f"{f(sa[k], d)} / {f(sb[k], d)}"


def run(trades_raw, args):
    p = args
    trades, same_costs = adjust_costs(trades_raw, p)
    d0, d1 = op_day(trades[0]["exit"]), op_day(trades[-1]["exit"])
    has_dd = any(t["dd"] for t in trades)
    L = []
    w = L.append

    w("# Simulador de cuenta hipotética — Minimum Days Bot\n")
    w(f"Fuente: `{p.csv[0]}` · {d0} → {d1} · {len(trades)} trades\n")
    w("## Parámetros del simulador\n")
    w("| Parámetro | Valor |\n|---|---|")
    for k, v in [("Equity inicial", f(p.starting_equity)), ("Drawdown", f"{f(p.drawdown)} ({p.dd_mode})"),
                 ("Límite pérdida diaria", f(p.daily_loss) if p.daily_loss else "off"),
                 ("Minimum days", p.minimum_days), ("Minimum day profit", f(p.minimum_day_profit)),
                 ("Comisión / contrato / lado", f(p.commission)), ("Contratos", p.contracts)]:
        w(f"| {k} | {v} |")
    w("")
    warns = []
    if not same_costs:
        warns.append(f"Comisión/contratos distintos del backtest ({p.bt_commission} / {p.bt_contracts}): P&L y "
                     "excursión adversa ESCALADOS linealmente. No equivale a re-ejecutar el Pine (TP/SL en ticks cambian).")
    if not has_dd:
        warns.append("El export no trae columna de excursión adversa (Drawdown): el Modelo B es idéntico al A.")
    bad = post_goal_check(trades, p.minimum_day_profit)
    if bad:
        warns.append(f"DAILY STOP: {len(bad)} trades abiertos DESPUÉS de alcanzar +{f(p.minimum_day_profit)} "
                     f"realizado (primeros: {', '.join(str(d) for d, _ in bad[:5])}). El simulador los ignora.")
    w("## Validación del daily stop del Pine\n")
    w(f"Trades abiertos después de alcanzar el objetivo diario: **{len(bad)}**" + ("  ⚠ WARNING" if bad else " (OK)") + "\n")
    w("## Reconstrucción intradía: qué se puede y qué no\n")
    w("- Solo hay una posición a la vez, así que el P&L intradía de un día = P&L realizado de los trades ya "
      "cerrados + P&L abierto del trade en curso.")
    w("- El export da, por trade, su excursión adversa máxima (MAE). Con ella el mínimo intradía de cada trade es "
      "exacto **a la resolución del backtest** (velas / bar magnifier). No conocemos el camino tick a tick, "
      "ni en qué momento del trade ocurrió la MAE.")
    w("- Por eso se calculan dos modelos: **A** (solo realizado, límite optimista) y **B** (realizado + MAE de "
      "cada trade, límite conservador). La realidad queda entre ambos.")
    w("- En un FAIL del Modelo B la cuenta se liquida justo en el límite violado (drawdown o pérdida diaria), "
      "sin slippage. En el Modelo A el FAIL se registra con el P&L realizado del trade que lo provoca.\n")
    if warns:
        w("## Avisos\n")
        for x in warns:
            w(f"- ⚠ {x}")
        w("")

    res = {}
    for m in MODELS:
        cyc, skipped = simulate(trades, d0, d1, p, m)
        res[m] = (cyc, cycle_stats(cyc, p), skipped)
    sa, sb = res["A"][1], res["B"][1]

    w("## Ciclos: resultado (Modelo A / Modelo B)\n")
    w("| Métrica | A (realizado) | B (realizado + MAE) |\n|---|---|---|")
    rows = [("Total ciclos cerrados", "total", 0), ("OK", "ok", 0), ("FAIL", "fail", 0),
            ("  FAIL por drawdown", "fail_dd", 0), ("  FAIL por pérdida diaria", "fail_dl", 0),
            ("Ciclo abierto al final", "abierto", 0), ("Success rate %", "success", 1),
            ("Media días operados a OK", "op_mean", 2), ("Mediana", "op_med", 1), ("Máximo", "op_max", 0),
            ("Media días mercado a OK", "mkt_mean", 2),
            ("Media días naturales a OK", "nat_mean", 2), ("Mediana", "nat_med", 1), ("Máximo", "nat_max", 0)]
    for lbl, k, d in rows:
        w(f"| {lbl} | {f(sa[k], d)} | {f(sb[k], d)} |")
    w("")
    w("### Distribución de días operados hasta OK\n")
    w("| Días operados | " + " | ".join(sa["hist"]) + " |\n|---|" + "---|" * len(sa["hist"]))
    for m, s in (("A", sa), ("B", sb)):
        w(f"| Ciclos OK ({m}) | " + " | ".join(str(v) for v in s["hist"].values()) + " |")
    w("")
    w(f"## Beneficio acumulado al alcanzar el {p.minimum_days}.º Minimum Day (ciclos OK)\n")
    w("| Métrica | A | B |\n|---|---|---|")
    for lbl, k in [("Media", "pnl_mean"), ("Mediana", "pnl_med"), ("Mínimo", "pnl_min"), ("Máximo", "pnl_max")]:
        w(f"| {lbl} | {f(sa[k])} | {f(sb[k])} |")
    w(f"| Ciclos OK con P&L < 0 | {sa['ok_pnl_neg']} | {sb['ok_pnl_neg']} |\n")
    w("## Camino hasta OK (ciclos OK)\n")
    w("| Métrica | A | B |\n|---|---|---|")
    for lbl, k, d in [("Ciclos sin ningún día negativo (limpios)", "clean", 0), ("Con 1 día negativo", "neg1", 0),
                      ("Con 2 días negativos", "neg2", 0), ("Con 3+ días negativos", "neg3", 0),
                      ("Media de días negativos por ciclo", "neg_mean", 2),
                      ("Días positivos < objetivo (total)", "posb_total", 0),
                      ("Peor día dentro de un ciclo OK", "worst_day_ok", 2),
                      ("Mayor pérdida acumulada: media", "mincum_mean", 2),
                      ("Mayor pérdida acumulada: peor", "mincum_min", 2),
                      ("Máx. DD por ciclo OK: media", "maxdd_ok_mean", 2)]:
        w(f"| {lbl} | {f(sa[k], d)} | {f(sb[k], d)} |")
    w("")

    dist, drows = day_distribution(trades, p)
    n_days = len(drows)
    w(f"## Distribución diaria ({n_days} días operados)\n")
    w("Las categorías E–H son acumulativas y están incluidas en D. La segunda columna clasifica cada día por "
      "su PEOR punto intradía (realizado + MAE); solo tiene sentido para las categorías de pérdida.\n")
    w("| Categoría | Días (P&L realizado del día) | % | Días (peor punto intradía) | % |\n|---|---|---|---|---|")
    for i, (name, a, b) in enumerate(dist):
        lo = ("-", "-") if i < 2 else (b, f(100 * b / n_days, 1))
        w(f"| {name} | {a} | {f(100 * a / n_days, 1)} | {lo[0]} | {lo[1]} |")
    w("")

    ts = trade_stats(trades)
    minpct = 100 * dist[0][1] / n_days if n_days else None
    w("## Estabilidad por periodos (cada periodo simulado por separado)\n")
    w("| Periodo | MIN % | OK A/B | FAIL A/B | Media días a OK A/B | Mediana días a OK A/B | "
      "P&L mediano a OK A/B | Peor DD A/B | Trades | Winrate % |\n|---|---|---|---|---|---|---|---|---|---|")
    per_rows = []
    for spec in p.periods.split(","):
        y0, _, y1 = spec.strip().partition("-")
        pd0, pd1 = max(d0, dt.date(int(y0), 1, 1)), min(d1, dt.date(int(y1 or y0), 12, 31))
        sub = [t for t in trades if pd0 <= op_day(t["exit"]) <= pd1]
        if not sub:
            w(f"| {spec} | sin datos |  |  |  |  |  |  |  |  |")
            continue
        pa = cycle_stats(simulate(sub, pd0, pd1, p, "A")[0], p)
        pb = cycle_stats(simulate(sub, pd0, pd1, p, "B")[0], p)
        pdist, _ = day_distribution(sub, p)
        pdays = len(by_day(sub))
        pts = trade_stats(sub)
        mp = 100 * pdist[0][1] / pdays
        per_rows.append((spec, mp, pa, pb))
        w(f"| {spec} | {f(mp, 1)} | {pa['ok']} / {pb['ok']} | {pa['fail']} / {pb['fail']} | "
          f"{ab(pa, pb, 'op_mean')} | {ab(pa, pb, 'op_med', 1)} | {ab(pa, pb, 'pnl_med')} | "
          f"{ab(pa, pb, 'maxdd_all')} | {pts['trades']} | {f(pts['winrate'], 1)} |")
    w("")

    w("## Resultado final (histórico completo)\n")
    w("| Métrica | Modelo A (realizado) | Modelo B (realizado + MAE) |\n|---|---|---|")
    worst_day = min(r for _, r, _ in drows)
    worst_low = min(lo for _, _, lo in drows)
    for lbl, va, vb in [
        ("Minimum Days %", f(minpct, 1), f(minpct, 1)),
        ("Ciclos OK", sa["ok"], sb["ok"]), ("Ciclos FAIL", sa["fail"], sb["fail"]),
        ("Success rate %", f(sa["success"], 1), f(sb["success"], 1)),
        ("Media días operados a OK", f(sa["op_mean"]), f(sb["op_mean"])),
        ("Mediana", f(sa["op_med"], 1), f(sb["op_med"], 1)), ("Máximo", sa["op_max"], sb["op_max"]),
        ("Media días naturales", f(sa["nat_mean"]), f(sb["nat_mean"])),
        ("Mediana", f(sa["nat_med"], 1), f(sb["nat_med"], 1)), ("Máximo", sa["nat_max"], sb["nat_max"]),
        (f"P&L medio al {p.minimum_days}.º MIN", f(sa["pnl_mean"]), f(sb["pnl_mean"])),
        (f"P&L mediano al {p.minimum_days}.º MIN", f(sa["pnl_med"]), f(sb["pnl_med"])),
        ("Peor día (realizado / mínimo intradía)", f(worst_day), f(worst_low)),
        ("Mayor DD dentro de un ciclo", f(sa["maxdd_all"]), f(sb["maxdd_all"])),
        ("Winrate trades %", f(ts["winrate"], 1), f(ts["winrate"], 1)),
        ("Profit Factor", f(ts["pf"], 3), f(ts["pf"], 3))]:
        w(f"| {lbl} | {va} | {vb} |")
    w("")
    w("| Periodo | MIN % | OK A/B | FAIL A/B | Días mediana A/B | P&L mediano a OK A/B |\n|---|---|---|---|---|---|")
    for spec, mp, pa, pb in per_rows:
        w(f"| {spec} | {f(mp, 1)} | {pa['ok']} / {pb['ok']} | {pa['fail']} / {pb['fail']} | "
          f"{ab(pa, pb, 'op_med', 1)} | {ab(pa, pb, 'pnl_med')} |")
    w("")
    if res["A"][2] or res["B"][2]:
        w(f"Trades ignorados por el daily stop en la simulación: A {res['A'][2]} · B {res['B'][2]}\n")

    report = "\n".join(L)
    print(report)
    if p.report:
        with open(p.report, "w") as fh:
            fh.write(report + "\n")
    if p.out:
        for m in MODELS:
            with open(f"{p.out}_cuenta_ciclos_{m}.csv", "w", newline="") as fh:
                wr = csv.writer(fh)
                wr.writerow(["ciclo", "inicio", "fin", "resultado", "motivo", "min_days", "dias_operados",
                             "dias_mercado", "dias_naturales", "trades", "pnl_final", "max_dd",
                             "mayor_perdida_acumulada", "dias_negativos", "peor_dia", "dias_pos_bajo_objetivo",
                             "camino"])
                for i, c in enumerate(res[m][0], 1):
                    wr.writerow([f"{i:03d}", c["start"], c["end"], c["status"], c["reason"], c["min"], c["op"],
                                 c["mkt"], c.get("nat", ""), c["trades"], f"{c['pnl']:.2f}", f"{-c['maxdd'] if c['maxdd'] else 0:.2f}",
                                 f"{c['mincum']:.2f}", c["neg_days"],
                                 "" if c["worst_day"] is None else f"{c['worst_day']:.2f}", c["pos_below"],
                                 " ".join(f"{x:+.2f}" for x in c["path"])])
        with open(f"{p.out}_cuenta_dias.csv", "w", newline="") as fh:
            wr = csv.writer(fh)
            wr.writerow(["fecha", "pnl_realizado", "minimo_intradia"])
            for d, r, lo in drows:
                wr.writerow([d, f"{r:.2f}", f"{lo:.2f}"])
