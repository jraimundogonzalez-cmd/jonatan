#!/usr/bin/env python3
"""
Auditoría de Minimum Days sobre la LISTA DE TRADES exportada de TradingView.

Replica el motor de ciclos del script Pine (f_cycles) sobre TODO el backtest
profundo, que la tabla del gráfico no puede ver.

Uso:
  python3 analyze_trades.py trades.csv                       # un backtest
  python3 analyze_trades.py base.csv be40.csv t60.csv        # comparar variantes
  python3 analyze_trades.py trades.csv --split 2024-01-01    # in-sample / out-of-sample
  python3 analyze_trades.py trades.csv --out informe         # CSV de días y ciclos

Exportar en TradingView: Probador de estrategias -> Lista de operaciones ->
icono de descarga (CSV o XLSX, ambos valen). Las horas del CSV están en la zona horaria del
gráfico: indícala con --tz (por defecto Europe/Madrid, que es UTC+2 en verano).

Definiciones (idénticas al Pine):
  - Día operativo: 18:00 ET (D-1) -> 17:00 ET (D). El P&L cuenta el día de la SALIDA.
  - MIN DAY: P&L neto realizado del día >= objetivo (150 $).
  - Ciclo: empieza el siguiente día de mercado tras el fin del anterior; OK al
    4.º MIN DAY; FAIL si la equity intradía cae a (pico EOD del ciclo - 2.000 $).
    La equity intradía se aproxima con la columna Drawdown de cada trade.
  - Días de mercado: lunes a viernes salvo 1-ene, 25-dic y Viernes Santo
    (en el resto de festivos CME hay sesión por la mañana en NY).
"""
import argparse
import csv
import datetime as dt
import statistics
import sys
import unicodedata
import xml.etree.ElementTree as ET_XML
import zipfile
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")


# ----------------------------------------------------------------------------- CSV
def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return " ".join(s.lower().replace("_", " ").split())


COLS = {
    "trade": ["trade #", "trade", "n.o de operacion", "no de operacion", "operacion", "n.o"],
    "type": ["type", "tipo"],
    "time": ["date/time", "date and time", "date", "fecha/hora", "fecha y hora", "fecha"],
    "signal": ["signal", "senal"],
    "pnl": ["net p&l usd", "net p&l", "profit usd", "profit", "p&g neto usd", "p&g neto",
            "pyg neto usd", "pyg neto", "beneficio usd", "beneficio", "ganancias usd"],
    "dd": ["drawdown usd", "drawdown", "adverse excursion usd", "excursion adversa usd",
           "excursion adversa", "reduccion usd", "reduccion", "caida usd", "caida"],
}


def find_col(headers, key, override=None):
    nh = [norm(h) for h in headers]
    if override:
        o = norm(override)
        for i, h in enumerate(nh):
            if h == o:
                return i
        sys.exit(f"Columna '{override}' no encontrada. Cabeceras: {headers}")
    for cand in COLS[key]:
        for i, h in enumerate(nh):
            if h == cand:
                return i
    for cand in COLS[key]:
        for i, h in enumerate(nh):
            if h.startswith(cand) and "%" not in h and "cum" not in h and "acum" not in h:
                return i
    return None


def num(s):
    s = (s or "").strip().replace("−", "-").replace("$", "").replace("USD", "").replace(" ", "")
    if s in ("", "-"):
        return 0.0
    if "," in s and "." in s:          # 1,234.56 o 1.234,56
        s = s.replace(",", "") if s.rfind(".") > s.rfind(",") else s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    return float(s)


def parse_time(s, tz):
    s = s.strip()
    try:                                   # número de serie de Excel
        serial = float(s)
        return (dt.datetime(1899, 12, 30) + dt.timedelta(days=serial)).replace(second=0, microsecond=0, tzinfo=tz)
    except ValueError:
        pass
    for f in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%dT%H:%M:%S",
              "%d/%m/%Y %H:%M", "%d.%m.%Y %H:%M", "%m/%d/%Y %H:%M"):
        try:
            return dt.datetime.strptime(s, f).replace(tzinfo=tz)
        except ValueError:
            pass
    sys.exit(f"Formato de fecha no reconocido: '{s}'")


def read_xlsx(path):
    """Lee la hoja de la lista de operaciones de un .xlsx exportado (solo librería estándar)."""
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    rel = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
    with zipfile.ZipFile(path) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            for si in ET_XML.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", ns):
                shared.append("".join(t.text or "" for t in si.iter(f"{{{ns['m']}}}t")))
        wb = ET_XML.fromstring(z.read("xl/workbook.xml"))
        rels = ET_XML.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        targets = {r.get("Id"): r.get("Target") for r in rels}
        sheets = [(s.get("name"), "xl/" + targets[s.get(rel)].lstrip("/").replace("xl/", ""))
                  for s in wb.find("m:sheets", ns)]
        best = None
        for name, target in sheets:
            rows = []
            for r in ET_XML.fromstring(z.read(target)).iter(f"{{{ns['m']}}}row"):
                row = {}
                for c in r.findall("m:c", ns):
                    ref = "".join(ch for ch in c.get("r") if ch.isalpha())
                    col = 0
                    for ch in ref:
                        col = col * 26 + ord(ch) - 64
                    v = c.find("m:v", ns)
                    isv = c.find("m:is", ns)
                    if c.get("t") == "s" and v is not None:
                        val = shared[int(v.text)]
                    elif isv is not None:
                        val = "".join(t.text or "" for t in isv.iter(f"{{{ns['m']}}}t"))
                    else:
                        val = v.text if v is not None else ""
                    row[col - 1] = val
                rows.append([row.get(i, "") for i in range(max(row) + 1)] if row else [])
            rows = [r for r in rows if r]
            if rows and find_col(rows[0], "type") is not None and find_col(rows[0], "pnl") is not None:
                best = rows
                break
        if best is None:
            sys.exit(f"{path}: no encuentro la hoja de la lista de operaciones. Hojas: {[n for n, _ in sheets]}")
        return best


def load_trades(path, tz, args):
    if path.lower().endswith((".xlsx", ".xlsm")):
        rows = read_xlsx(path)
    else:
        with open(path, newline="", encoding="utf-8-sig") as fh:
            sample = fh.read(4096)
            fh.seek(0)
            try:
                dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
            except csv.Error:
                dialect = csv.excel
            rows = list(csv.reader(fh, dialect))
    headers, rows = rows[0], [r for r in rows[1:] if any(c.strip() for c in r)]
    ci = {k: find_col(headers, k, getattr(args, f"col_{k}", None)) for k in COLS}
    for k in ("trade", "type", "time", "pnl"):
        if ci[k] is None:
            sys.exit(f"No encuentro la columna '{k}' en {path}. Cabeceras: {headers}\n"
                     f"Indícala con --col-{k} \"<nombre exacto>\"")
    trades = {}
    for r in rows:
        tid = r[ci["trade"]].strip()
        typ = norm(r[ci["type"]])
        is_exit = any(w in typ for w in ("exit", "salida", "cierre", "close"))
        t = trades.setdefault(tid, {"id": tid})
        if is_exit:
            t["exit"] = parse_time(r[ci["time"]], tz).astimezone(ET)
            t["pnl"] = num(r[ci["pnl"]])
            t["dd"] = abs(num(r[ci["dd"]])) if ci["dd"] is not None else 0.0
            t["signal"] = r[ci["signal"]].strip() if ci["signal"] is not None else ""
        else:
            t["entry"] = parse_time(r[ci["time"]], tz).astimezone(ET)
    out = [t for t in trades.values() if "exit" in t]
    out.sort(key=lambda t: (t["exit"], t.get("entry") or t["exit"]))
    if ci["dd"] is None:
        print(f"[aviso] {path}: sin columna Drawdown -> el DD de ciclo usa solo P&L realizado", file=sys.stderr)
    return out


# ----------------------------------------------------------------------------- calendario
def easter(y):
    a, b, c = y % 19, y // 100, y % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    mo = (h + l - 7 * m + 114) // 31
    da = (h + l - 7 * m + 114) % 31 + 1
    return dt.date(y, mo, da)


def observed(d):
    return d - dt.timedelta(days=1) if d.weekday() == 5 else d + dt.timedelta(days=1) if d.weekday() == 6 else d


def market_days(d0, d1):
    closed = set()
    for y in range(d0.year - 1, d1.year + 2):
        closed |= {observed(dt.date(y, 1, 1)), observed(dt.date(y, 12, 25)), easter(y) - dt.timedelta(days=2)}
    d, out = d0, []
    while d <= d1:
        if d.weekday() < 5 and d not in closed:
            out.append(d)
        d += dt.timedelta(days=1)
    return out


def op_day(t):
    return (t + dt.timedelta(hours=6)).date()   # 18:00 ET -> medianoche del día D


# ----------------------------------------------------------------------------- motor
def build_days(trades, target, capital, d0=None, d1=None):
    by_day = {}
    for t in trades:
        by_day.setdefault(op_day(t["exit"]), []).append(t)
    first = min(by_day) if by_day else None
    last = max(by_day) if by_day else None
    d0, d1 = d0 or first, d1 or last
    cal = sorted(set(market_days(d0, d1)) | {d for d in by_day if d0 <= d <= d1})
    eq = capital + sum(t["pnl"] for t in trades if op_day(t["exit"]) < d0)
    days = []
    for d in cal:
        ts = by_day.get(d, [])
        eq_s, eq_min, e = eq, eq, eq
        for t in ts:
            eq_min = min(eq_min, e - t["dd"])
            e += t["pnl"]
            eq_min = min(eq_min, e)
        pnl = e - eq_s
        eq = e
        days.append({"date": d, "pnl": round(pnl, 2), "trades": len(ts),
                     "losses": sum(1 for t in ts if t["pnl"] < 0),
                     "eqS": eq_s, "eqE": e, "eqMin": eq_min,
                     "exits": "|".join(t.get("signal", "") for t in ts)})
    return days


def cycles(days, target, need, dd):
    out, cur = [], None
    for d in days:
        if cur is None:
            cur = {"start": d["date"], "eq0": d["eqS"], "peak": d["eqS"], "min": 0, "mkt": 0,
                   "op": 0, "trades": 0, "path": []}
        cur["mkt"] += 1
        if d["trades"]:
            cur["op"] += 1
            cur["trades"] += d["trades"]
            cur["path"].append(d["pnl"])
        cur["end"] = d["date"]
        cur["pnl"] = d["eqE"] - cur["eq0"]
        if d["eqMin"] <= cur["peak"] - dd:
            cur["status"] = "FAIL"
            out.append(cur)
            cur = None
            continue
        if d["pnl"] >= target:
            cur["min"] += 1
        cur["peak"] = max(cur["peak"], d["eqE"])
        if cur["min"] >= need:
            cur["status"] = "OK"
            cur["nat"] = (cur["end"] - cur["start"]).days + 1
            out.append(cur)
            cur = None
    if cur is not None:
        cur["status"] = "ABIERTO"
        out.append(cur)
    return out


def stats(trades, days, cyc, target):
    tr = [d for d in days if d["trades"]]
    ok = [c for c in cyc if c["status"] == "OK"]
    fail = [c for c in cyc if c["status"] == "FAIL"]
    wins = [t["pnl"] for t in trades if t["pnl"] > 0]
    loss = [t["pnl"] for t in trades if t["pnl"] <= 0]
    gp, gl = sum(wins), -sum(loss)
    streak = best = 0
    for d in tr:
        streak = streak + 1 if d["pnl"] >= target else 0
        best = max(best, streak)
    q = lambda xs, f: f(xs) if xs else None
    op, nat, mkt = [c["op"] for c in ok], [c["nat"] for c in ok], [c["mkt"] for c in ok]
    aw = gp / len(wins) if wins else None
    al = gl / len(loss) if loss else None
    return {
        "desde": days[0]["date"] if days else None, "hasta": days[-1]["date"] if days else None,
        "trades": len(trades), "dias_mercado": len(days), "dias_operados": len(tr),
        "A_min_days": sum(d["pnl"] >= target for d in tr),
        "B_0_a_obj": sum(0 <= d["pnl"] < target for d in tr),
        "C_perdida_leve": sum(-target < d["pnl"] < 0 for d in tr),
        "D_perdida_grande": sum(d["pnl"] <= -target for d in tr),
        "pct_min": 100 * sum(d["pnl"] >= target for d in tr) / len(tr) if tr else None,
        "ciclos_ok": len(ok), "ciclos_fail": len(fail),
        "ciclos_abierto": sum(c["status"] == "ABIERTO" for c in cyc),
        "pct_ciclos_ok": 100 * len(ok) / (len(ok) + len(fail)) if ok or fail else None,
        "ok_con_pnl_pos": sum(c["pnl"] > 0 for c in ok),
        "pct_ok_pos": 100 * sum(c["pnl"] > 0 for c in ok) / len(ok) if ok else None,
        "op_media": q(op, statistics.mean), "op_mediana": q(op, statistics.median),
        "op_mejor": q(op, min), "op_peor": q(op, max),
        "mkt_media": q(mkt, statistics.mean),
        "nat_media": q(nat, statistics.mean), "nat_mediana": q(nat, statistics.median),
        "nat_max": q(nat, max),
        "pnl_medio_ciclo_ok": q([c["pnl"] for c in ok], statistics.mean),
        "racha_max_min": best,
        "winrate": 100 * len(wins) / len(trades) if trades else None,
        "ganadoras": len(wins), "perdedoras": len(loss),
        "gross_profit": gp, "gross_loss": gl, "profit_factor": gp / gl if gl else None,
        "gan_media": aw, "perd_media": al,
        "winrate_equilibrio": 100 * al / (aw + al) if aw and al else None,
        "neto": gp - gl,
    }


# ----------------------------------------------------------------------------- salida
LABELS = [
    ("desde", "Desde"), ("hasta", "Hasta"), ("trades", "Trades"),
    ("dias_mercado", "Días mercado"), ("dias_operados", "Días operados"),
    ("A_min_days", "A) MIN DAYS >= obj"), ("B_0_a_obj", "B) 0..obj"),
    ("C_perdida_leve", "C) pérdida < obj"), ("D_perdida_grande", "D) pérdida >= obj"),
    ("pct_min", "% MIN / operados"),
    ("ciclos_ok", "Ciclos OK"), ("ciclos_fail", "Ciclos FAIL"), ("ciclos_abierto", "Ciclo abierto"),
    ("pct_ciclos_ok", "% ciclos OK"), ("ok_con_pnl_pos", "Ciclos OK con P&L > 0"),
    ("pct_ok_pos", "% ciclos OK con P&L > 0"),
    ("op_media", "Días operados a OK: media"), ("op_mediana", "  mediana"),
    ("op_mejor", "  mejor"), ("op_peor", "  peor"),
    ("mkt_media", "Días mercado a OK: media"),
    ("nat_media", "Días naturales a OK: media"), ("nat_mediana", "  mediana"), ("nat_max", "  máximo"),
    ("pnl_medio_ciclo_ok", "P&L medio ciclo OK ($)"), ("racha_max_min", "Racha máx. MIN DAYS"),
    ("winrate", "Winrate trades %"), ("ganadoras", "Ganadoras"), ("perdedoras", "Perdedoras"),
    ("gross_profit", "Gross profit"), ("gross_loss", "Gross loss"),
    ("profit_factor", "Profit factor"), ("gan_media", "Ganancia media"),
    ("perd_media", "Pérdida media"), ("winrate_equilibrio", "Winrate equilibrio %"),
    ("neto", "Neto ($)"),
]


def fmt(v):
    if v is None:
        return "-"
    if isinstance(v, float):
        return f"{v:,.2f}"
    return str(v)


def print_table(results):
    names = list(results)
    w0 = max(len(l) for _, l in LABELS)
    ws = [max(12, len(n)) for n in names]
    print(" " * w0 + " | " + " | ".join(n.rjust(w) for n, w in zip(names, ws)))
    print("-" * (w0 + sum(w + 3 for w in ws)))
    for k, lbl in LABELS:
        print(lbl.ljust(w0) + " | " + " | ".join(fmt(results[n][k]).rjust(w) for n, w in zip(names, ws)))


# ----------------------------------------------------------------------------- ranking
# Objetivo lexicográfico: (1) % ciclos OK, (2) % ciclos OK con P&L > 0,
# (3) mediana de días operados a OK (menos es mejor), (4) peor caso de días operados.
# Una diferencia menor que la tolerancia cuenta como empate y pasa al criterio siguiente.
OBJ = [("pct_ciclos_ok", +1, 1.0), ("pct_ok_pos", +1, 2.0), ("op_mediana", -1, 0.5), ("op_peor", -1, 1.0)]
MIN_OOS_CYCLES = 20


def compare(a, b):
    """+1 si a es mejor que b, -1 si es peor, 0 si empatan dentro de tolerancia."""
    for k, sign, tol in OBJ:
        va, vb = a.get(k), b.get(k)
        if va is None or vb is None:
            continue
        d = (va - vb) * sign
        if d > tol:
            return 1
        if d < -tol:
            return -1
    return 0


def oos_not_worse(v, b):
    return all(v.get(k) is not None and b.get(k) is not None and (v[k] - b[k]) * sign >= -tol
               for k, sign, tol in OBJ[:3])


def rank(results, names, base):
    rows = []
    for n in names:
        full, i, o = results[n], results.get(n + " <"), results.get(n + " >=")
        if n == base:
            verdict = "BASE"
        elif o is None or i is None:
            verdict = "SIN SPLIT"
        elif o["ciclos_ok"] + o["ciclos_fail"] < MIN_OOS_CYCLES:
            verdict = "MUESTRA OOS INSUFICIENTE"
        else:
            c = compare(i, results[base + " <"])
            ok_oos = oos_not_worse(o, results[base + " >="])
            verdict = ("ACEPTAR" if ok_oos else "DESCARTAR (empeora OOS)") if c > 0 else \
                      "NEUTRA (empata IS)" if c == 0 else "DESCARTAR (peor IS)"
        rows.append((n, i or full, o, full, verdict))
    key = lambda r: tuple(sign * (r[1].get(k) or 0) for k, sign, _ in OBJ)
    rows.sort(key=key, reverse=True)
    hdr = ["Variante", "IS %OK", "IS %OK>0", "IS med op", "IS peor op", "OOS %OK", "OOS %OK>0",
           "OOS med op", "Ciclos (OK/FAIL)", "Neto total", "Veredicto"]
    out = ["| " + " | ".join(hdr) + " |", "|" + "---|" * len(hdr)]
    for n, i, o, full, verdict in rows:
        g = lambda r, k: fmt(r.get(k)) if r else "-"
        out.append("| " + " | ".join([n, g(i, "pct_ciclos_ok"), g(i, "pct_ok_pos"), g(i, "op_mediana"),
                                      g(i, "op_peor"), g(o, "pct_ciclos_ok"), g(o, "pct_ok_pos"),
                                      g(o, "op_mediana"), f"{full['ciclos_ok']}/{full['ciclos_fail']}",
                                      fmt(full["neto"]), verdict]) + " |")
    return "\n".join(out)


def write_reports(prefix, days, cyc, target):
    with open(prefix + "_dias.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["fecha", "pnl", "trades", "perdedoras", "categoria", "eq_inicio", "eq_min", "eq_fin", "salidas"])
        for d in days:
            cat = "-" if not d["trades"] else "A" if d["pnl"] >= target else "B" if d["pnl"] >= 0 else "C" if d["pnl"] > -target else "D"
            w.writerow([d["date"], f"{d['pnl']:.2f}", d["trades"], d["losses"], cat,
                        f"{d['eqS']:.2f}", f"{d['eqMin']:.2f}", f"{d['eqE']:.2f}", d["exits"]])
    with open(prefix + "_ciclos.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["ciclo", "estado", "inicio", "fin", "min_days", "dias_operados", "dias_mercado",
                    "dias_naturales", "trades", "pnl", "camino"])
        for i, c in enumerate(cyc, 1):
            w.writerow([i, c["status"], c["start"], c["end"], c["min"], c["op"], c["mkt"],
                        c.get("nat", ""), c["trades"], f"{c['pnl']:.2f}",
                        " ".join(f"{p:+.2f}" for p in c["path"])])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv", nargs="+", help="CSV(s) de la lista de operaciones de TradingView")
    ap.add_argument("--tz", default="Europe/Madrid", help="zona horaria de las fechas del CSV (la del gráfico)")
    ap.add_argument("--target", type=float, default=150.0)
    ap.add_argument("--need", type=int, default=4)
    ap.add_argument("--dd", type=float, default=2000.0)
    ap.add_argument("--capital", type=float, default=50000.0)
    ap.add_argument("--split", help="fecha AAAA-MM-DD: calcula también antes / después (in / out of sample)")
    ap.add_argument("--out", help="prefijo para escribir <prefijo>_dias.csv y <prefijo>_ciclos.csv (solo 1 CSV)")
    ap.add_argument("--cycles", action="store_true", help="imprimir cada ciclo con su camino")
    ap.add_argument("--rank", metavar="BASE", help="ranking + veredicto frente a la variante BASE (nombre de archivo sin extensión; requiere --split)")
    ap.add_argument("--md", help="escribir el ranking en este archivo Markdown")
    for k in COLS:
        ap.add_argument(f"--col-{k}", dest=f"col_{k}", help=f"nombre exacto de la columna '{k}'")
    args = ap.parse_args()
    tz = ZoneInfo(args.tz)

    results = {}
    for path in args.csv:
        trades = load_trades(path, tz, args)
        if not trades:
            sys.exit(f"{path}: no hay trades cerrados")
        name = path.rsplit("/", 1)[-1].rsplit(".", 1)[0]
        parts = [(name, None, None)]
        if args.split:
            s = dt.date.fromisoformat(args.split)
            parts += [(name + " <", None, s - dt.timedelta(days=1)), (name + " >=", s, None)]
        for label, d0, d1 in parts:
            sub = [t for t in trades if (d0 is None or op_day(t["exit"]) >= d0) and (d1 is None or op_day(t["exit"]) <= d1)]
            if not sub:
                continue
            days = build_days(trades, args.target, args.capital,
                              d0 or op_day(sub[0]["exit"]), d1 or op_day(sub[-1]["exit"]))
            cyc = cycles(days, args.target, args.need, args.dd)
            results[label] = stats(sub, days, cyc, args.target)
            if label == name:
                if args.out and len(args.csv) == 1:
                    write_reports(args.out, days, cyc, args.target)
                if args.cycles:
                    print(f"\n== Ciclos {name} ==")
                    for i, c in enumerate(cyc, 1):
                        print(f"#{i:>3} {c['status']:<7} {c['start']} -> {c['end']} | MIN {c['min']} | "
                              f"operados {c['op']} | mercado {c['mkt']} | naturales {c.get('nat', '-')} | "
                              f"P&L {c['pnl']:+.2f} | " + ", ".join(f"{p:+.2f}" for p in c["path"]))
    print()
    print_table(results)
    if args.rank:
        names = [p.rsplit("/", 1)[-1].rsplit(".", 1)[0] for p in args.csv]
        if args.rank not in names:
            sys.exit(f"--rank {args.rank}: no está entre los archivos {names}")
        if not args.split:
            sys.exit("--rank requiere --split AAAA-MM-DD")
        table = rank(results, names, args.rank)
        print("\n" + table)
        if args.md:
            with open(args.md, "w") as fh:
                fh.write(f"# Ranking de variantes (base: {args.rank}, split {args.split})\n\n{table}\n")


if __name__ == "__main__":
    main()
