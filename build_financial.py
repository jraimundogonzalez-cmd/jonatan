#!/usr/bin/env python3
"""Sistema Financiero Personal/Profesional en Excel — Rewrite v2
Fixes: NamedStyle architecture, no Unicode in formulas, no SUMIF(YEAR), valid number formats
"""

from openpyxl import Workbook
from openpyxl.styles import NamedStyle, PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import ColorScaleRule, CellIsRule, FormulaRule
from openpyxl.chart import BarChart, LineChart, PieChart, AreaChart, Reference
from openpyxl.comments import Comment
from datetime import date
import os

# ── NamedStyle factory ─────────────────────────────────────────────────────────
def make_style(name, bg, fg="FFFFFF", bold=False, size=10, halign="left",
               valign="center", border_color="DEE2E6", wrap=True):
    ns = NamedStyle(name=name)
    ns.fill = PatternFill("solid", fgColor=bg)
    ns.font = Font(name="Calibri", bold=bold, color=fg, size=size)
    ns.alignment = Alignment(horizontal=halign, vertical=valign, wrap_text=wrap)
    s = Side(style="thin", color=border_color)
    ns.border = Border(left=s, right=s, top=s, bottom=s)
    return ns

STYLES = {
    "header":    make_style("header",    "1F2D3D", "FFFFFF", True,  11, "center"),
    "header_sm": make_style("header_sm", "1F2D3D", "FFFFFF", True,  10, "center"),
    "subheader": make_style("subheader", "2C3E50", "FFFFFF", True,  11, "center"),
    "gold":      make_style("gold",      "F5A623", "1F2D3D", True,  11, "center"),
    "gold_r":    make_style("gold_r",    "F5A623", "1F2D3D", True,  11, "right"),
    "gold_l":    make_style("gold_l",    "F5A623", "1F2D3D", True,  10, "left"),
    "green":     make_style("green",     "28A745", "FFFFFF", True,  10, "center"),
    "red":       make_style("red",       "DC3545", "FFFFFF", True,  10, "center"),
    "teal":      make_style("teal",      "20C997", "FFFFFF", True,  10, "center"),
    "orange":    make_style("orange",    "FD7E14", "FFFFFF", True,  10, "center"),
    "blue":      make_style("blue",      "007BFF", "FFFFFF", True,  10, "center"),
    "col_hdr":   make_style("col_hdr",   "DEE2E6", "1F2D3D", True,  10, "center"),
    "data_l":    make_style("data_l",    "FFFFFF", "212529", False, 10, "left"),
    "data_r":    make_style("data_r",    "FFFFFF", "212529", False, 10, "right"),
    "data_c":    make_style("data_c",    "FFFFFF", "212529", False, 10, "center"),
    "alt_l":     make_style("alt_l",     "F8F9FA", "212529", False, 10, "left"),
    "alt_r":     make_style("alt_r",     "F8F9FA", "212529", False, 10, "right"),
    "alt_c":     make_style("alt_c",     "F8F9FA", "212529", False, 10, "center"),
    "bold_l":    make_style("bold_l",    "FFFFFF", "1F2D3D", True,  10, "left"),
    "bold_r":    make_style("bold_r",    "FFFFFF", "1F2D3D", True,  10, "right"),
    "input":     make_style("input",     "F5A623", "1F2D3D", True,  12, "right"),
    # Bold data variants
    "bdata_l":   make_style("bdata_l",   "FFFFFF", "1F2D3D", True,  10, "left"),
    "bdata_r":   make_style("bdata_r",   "FFFFFF", "1F2D3D", True,  10, "right"),
    "bdata_c":   make_style("bdata_c",   "FFFFFF", "1F2D3D", True,  10, "center"),
    "balt_l":    make_style("balt_l",    "F8F9FA", "1F2D3D", True,  10, "left"),
    "balt_r":    make_style("balt_r",    "F8F9FA", "1F2D3D", True,  10, "right"),
    "balt_c":    make_style("balt_c",    "F8F9FA", "1F2D3D", True,  10, "center"),
}

# ── Workbook ───────────────────────────────────────────────────────────────────
wb = Workbook()
wb.remove(wb.active)

for s in STYLES.values():
    wb.add_named_style(s)

# ── Helpers ────────────────────────────────────────────────────────────────────
def add_sheet(wb, title, tab_color="1F2D3D"):
    ws = wb.create_sheet(title=title)
    ws.sheet_properties.tabColor = tab_color
    return ws

def W(ws, row, col, value=None, style="data_l", fmt=None):
    """Write a cell with a named style."""
    cell = ws.cell(row=row, column=col, value=value)
    cell.style = style
    if fmt:
        cell.number_format = fmt
    return cell

def set_col_width(ws, col, width):
    ws.column_dimensions[get_column_letter(col)].width = width

def row_style(i):
    """Alternate row style suffix: '' or 'alt_'"""
    return "alt_" if i % 2 == 0 else "data_"

def merge_header(ws, r1, c1, r2, c2, value, style="header"):
    ws.merge_cells(start_row=r1, start_column=c1, end_row=r2, end_column=c2)
    c = ws.cell(row=r1, column=c1, value=value)
    c.style = style
    return c

# Number formats
FMT_EUR  = '#,##0.00 €'
FMT_PCT  = '0.0%'
FMT_INT  = '#,##0'
FMT_SCR  = '0.0'
FMT_DATE = 'DD/MM/YYYY'

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 0: GUIA DE USO
# ══════════════════════════════════════════════════════════════════════════════
ws0 = add_sheet(wb, "GUIA DE USO", "F5A623")

merge_header(ws0, 1, 1, 1, 8, "GUIA DE USO - SISTEMA FINANCIERO PERSONAL", "header")
ws0.row_dimensions[1].height = 35

merge_header(ws0, 2, 1, 2, 8,
    "Sistema para el control integral de finanzas personales y profesionales | Inicio: Junio 2026",
    "gold")
ws0.row_dimensions[2].height = 22

# === COMO CAMBIAR EL INGRESO MENSUAL ===
merge_header(ws0, 4, 1, 4, 8, "COMO CAMBIAR EL INGRESO MENSUAL", "subheader")
ws0.row_dimensions[4].height = 25

instrucciones = [
    "PASO 1: Ve a la pestana 'PRESUPUESTO MENSUAL' (tercera pestana del libro)",
    "PASO 2: Localiza la celda D3 — tiene fondo AMARILLO/DORADO y letra grande",
    "PASO 3: Haz doble clic en D3 y escribe tu nuevo ingreso neto mensual",
    "PASO 4: Pulsa ENTER — todo el sistema se actualiza automaticamente",
    "",
    "NOTA IMPORTANTE: La celda D3 de PRESUPUESTO MENSUAL es el unico valor que debes",
    "cambiar cada mes. Todos los calculos del sistema usan ese valor como referencia.",
]
for i, txt in enumerate(instrucciones, 5):
    style = "gold_l" if txt.startswith("PASO") else ("bold_l" if txt.startswith("NOTA") else "data_l")
    merge_header(ws0, i, 1, i, 8, txt, style)
    ws0.row_dimensions[i].height = 25

# Sheets table
merge_header(ws0, 13, 1, 13, 8, "DESCRIPCION DE LAS HOJAS DEL SISTEMA", "subheader")
ws0.row_dimensions[13].height = 25

W(ws0, 14, 1, "Hoja", "col_hdr")
W(ws0, 14, 2, "Descripcion y uso", "col_hdr")
ws0.row_dimensions[14].height = 20

sheets_info = [
    ("DASHBOARD EJECUTIVO",     "Panel principal con todos los KPIs financieros."),
    ("REGISTRO DE MOVIMIENTOS", "Registra TODOS tus ingresos y gastos. Es la hoja mas importante."),
    ("PRESUPUESTO MENSUAL",     "Define tu presupuesto. Introduce el ingreso en D3 (celda dorada)."),
    ("CONTROL DE AHORRO",       "Registra aportaciones al ahorro mensual."),
    ("CONTROL DE BANKROLL",     "Registra aportaciones al bankroll de trading (10% del ingreso)."),
    ("DASHBOARD DE TRADING",    "Registra resultados de trading. Calcula ROI y evolucion."),
    ("CONTROL DE PAYOUTS",      "Registra pagos recibidos de plataformas de trading."),
    ("PATRIMONIO NETO",         "Calcula tu patrimonio neto (Activos - Pasivos)."),
    ("FONDO DE EMERGENCIA",     "Controla el progreso hacia tu fondo de emergencia."),
    ("OBJETIVOS",               "Define y sigue el progreso de tus objetivos financieros anuales."),
    ("GASTOS HORMIGA",          "Registra gastos pequenos recurrentes. Detecta fugas de dinero."),
    ("RANKING MEJORES MESES",   "Ranking de mejores meses. Actualiza con tus datos."),
    ("LIBERTAD FINANCIERA",     "Mide el porcentaje de cobertura de gastos con ingresos de trading."),
    ("PROYECCIONES FUTURAS",    "Proyecciones a 1, 3 y 5 anos basadas en parametros actuales."),
    ("SCORE DEL TRADER",        "Puntuacion 0-100 que evalua tu desempeno financiero."),
]
for i, (name, desc) in enumerate(sheets_info, 15):
    pfx = "alt_" if i % 2 == 0 else "data_"
    W(ws0, i, 1, name, "b" + pfx + "l")
    W(ws0, i, 2, desc, pfx + "l")
    ws0.row_dimensions[i].height = 30

# Legend
leg_row = 31
merge_header(ws0, leg_row, 1, leg_row, 8, "LEYENDA DE COLORES", "subheader")
ws0.row_dimensions[leg_row].height = 22

legend = [
    ("green",     "VERDE: Indicador positivo / objetivo cumplido / dentro de presupuesto"),
    ("gold",      "DORADO: Subtitulos, totales y valores destacados (tambien la celda de ingreso D3)"),
    ("red",       "ROJO: Alerta / presupuesto excedido / objetivo no alcanzado"),
    ("header",    "AZUL OSCURO: Cabeceras de tablas y secciones principales"),
    ("col_hdr",   "GRIS: Cabeceras de columnas"),
    ("alt_l",     "GRIS CLARO: Filas alternas para mejor legibilidad"),
]
for i, (sty, txt) in enumerate(legend, leg_row + 1):
    merge_header(ws0, i, 1, i, 8, txt, sty)
    ws0.row_dimensions[i].height = 20

set_col_width(ws0, 1, 38)
set_col_width(ws0, 2, 80)
ws0.sheet_view.showGridLines = False

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 2: REGISTRO DE MOVIMIENTOS
# ══════════════════════════════════════════════════════════════════════════════
ws2 = add_sheet(wb, "REGISTRO DE MOVIMIENTOS", "808080")

merge_header(ws2, 1, 1, 1, 10, "REGISTRO DE MOVIMIENTOS - SISTEMA FINANCIERO 2026", "header")
ws2.row_dimensions[1].height = 30

headers2 = ["Fecha","Mes","Anio","Tipo","Categoria","Subcategoria","Descripcion","Importe","Metodo de Pago","Comentarios"]
for i, h in enumerate(headers2, 1):
    W(ws2, 2, i, h, "col_hdr")
ws2.row_dimensions[2].height = 20

sample_movimientos = [
    (date(2026,6,1),  "Junio", 2026, "Ingreso", "Nomina",       "Salario neto",  "Salario neto junio 2026",         2000.00, "Transferencia", "Ingreso mensual regular"),
    (date(2026,6,1),  "Junio", 2026, "Gasto",   "Vivienda",     "Alquiler",      "Piso alquiler junio",             1000.00, "Transferencia", "Gasto fijo"),
    (date(2026,6,1),  "Junio", 2026, "Gasto",   "Transporte",   "Coche",         "Cuota coche junio",                450.00, "Domiciliacion", "Gasto fijo"),
    (date(2026,6,1),  "Junio", 2026, "Gasto",   "Salud/Deporte","Gimnasio",      "Cuota gimnasio junio",              25.00, "Domiciliacion", "Gasto fijo"),
    (date(2026,6,1),  "Junio", 2026, "Gasto",   "Formacion",    "TraderLab",     "Suscripcion TraderLab junio",      100.00, "Tarjeta",       "Gasto fijo"),
    (date(2026,6,5),  "Junio", 2026, "Gasto",   "Alimentacion", "Supermercado",  "Compra semanal Mercadona",          85.50, "Tarjeta",       ""),
    (date(2026,6,10), "Junio", 2026, "Gasto",   "Restaurantes", "Comida fuera",  "Restaurante con familia",           35.00, "Tarjeta",       "Gasto capricho"),
    (date(2026,6,15), "Junio", 2026, "Ingreso", "Trading",      "Payout",        "Payout FTMO junio",                350.00, "Transferencia", "Beneficios trading"),
    (date(2026,6,20), "Junio", 2026, "Gasto",   "Ahorro",       "Ahorro mensual","Aportacion ahorro junio",          200.00, "Transferencia", "10% ingreso mensual"),
    (date(2026,6,20), "Junio", 2026, "Gasto",   "Inversion",    "Bankroll",      "Aportacion bankroll junio",        200.00, "Transferencia", "10% ingreso mensual"),
]

for i, row_data in enumerate(sample_movimientos, 3):
    pfx = "alt_" if i % 2 == 0 else "data_"
    for j, val in enumerate(row_data, 1):
        sty = pfx + ("c" if j in [1,2,3,4,9] else ("r" if j==8 else "l"))
        c = W(ws2, i, j, val, sty)
        if j == 1:
            c.number_format = FMT_DATE
        if j == 8:
            c.number_format = FMT_EUR

# Data validations
dv_tipo = DataValidation(type="list", formula1='"Ingreso,Gasto"', allow_blank=False)
dv_tipo.sqref = "D3:D1000"
ws2.add_data_validation(dv_tipo)

cats = "Nomina,Vivienda,Transporte,Salud/Deporte,Formacion,Alimentacion,Restaurantes,Trading,Ahorro,Inversion,Ocio,Suscripciones,Amazon,Compras,Otros"
dv_cat = DataValidation(type="list", formula1=f'"{cats}"', allow_blank=True)
dv_cat.sqref = "E3:E1000"
ws2.add_data_validation(dv_cat)

metodos = "Efectivo,Tarjeta,Transferencia,Domiciliacion,Bizum"
dv_met = DataValidation(type="list", formula1=f'"{metodos}"', allow_blank=True)
dv_met.sqref = "I3:I1000"
ws2.add_data_validation(dv_met)

# Table (no ws.auto_filter.ref — table handles it)
table2 = Table(displayName="Movimientos", ref=f"A2:J{len(sample_movimientos)+2}")
ts2 = TableStyleInfo(name="TableStyleMedium2", showFirstColumn=False,
                     showLastColumn=False, showRowStripes=True, showColumnStripes=False)
table2.tableStyleInfo = ts2
ws2.add_table(table2)

ws2.freeze_panes = "A3"
widths2 = [13, 10, 6, 10, 18, 18, 35, 14, 18, 30]
for i, w in enumerate(widths2, 1):
    set_col_width(ws2, i, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 3: PRESUPUESTO MENSUAL
# ══════════════════════════════════════════════════════════════════════════════
ws3 = add_sheet(wb, "PRESUPUESTO MENSUAL", "808080")

merge_header(ws3, 1, 1, 1, 6, "PRESUPUESTO MENSUAL - JUNIO 2026", "header")
ws3.row_dimensions[1].height = 30

# Income input row — D3 is the key input cell
merge_header(ws3, 3, 1, 3, 3, "Ingreso neto mensual - MODIFICA AQUI CADA MES:", "bold_l")
income_cell = W(ws3, 3, 4, 2000.00, "input", FMT_EUR)
# Add comment
cmt = Comment("Cambia este valor cada mes. Todo el sistema se actualiza automaticamente.", "Sistema")
income_cell.comment = cmt
ws3.row_dimensions[3].height = 28

# Instruction label
merge_header(ws3, 4, 1, 4, 6,
    ">>> ESTA ES LA CELDA CLAVE: cambia D3 cada mes y todo el sistema se actualiza <<<",
    "gold")
ws3.row_dimensions[4].height = 22

# Fixed expenses
merge_header(ws3, 6, 1, 6, 6, "GASTOS FIJOS MENSUALES", "header")
for col, h in enumerate(["Concepto","Categoria","Importe","% Ingreso","Estado"], 1):
    W(ws3, 7, col, h, "col_hdr")
ws3.row_dimensions[7].height = 20

fixed_expenses = [
    ("Piso",      "Vivienda",     1000.00),
    ("Coche",     "Transporte",    450.00),
    ("Gimnasio",  "Salud/Deporte",  25.00),
    ("TraderLab", "Formacion",     100.00),
]
r = 8
fixed_start = r
for i, (name, cat, amt) in enumerate(fixed_expenses):
    pfx = "alt_" if i % 2 == 0 else "data_"
    W(ws3, r, 1, name, pfx + "l")
    W(ws3, r, 2, cat,  pfx + "l")
    W(ws3, r, 3, amt,  pfx + "r", FMT_EUR)
    W(ws3, r, 4, f"=C{r}/$D$3", pfx + "r", FMT_PCT)
    W(ws3, r, 5, "Fijo", pfx + "c")
    r += 1

fixed_end = r - 1
total_fixed_row = r
W(ws3, r, 1, "TOTAL GASTOS FIJOS", "gold_l")
W(ws3, r, 2, "", "gold")
W(ws3, r, 3, f"=SUM(C{fixed_start}:C{fixed_end})", "gold_r", FMT_EUR)
W(ws3, r, 4, f"=C{r}/$D$3", "gold_r", FMT_PCT)
r += 1

# Auto distribution
r += 1
merge_header(ws3, r, 1, r, 6, "DISTRIBUCION AUTOMATICA (% INGRESO)", "header")
r += 1
for col, h in enumerate(["Concepto","% Aplicado","Importe","Objetivo anual","Descripcion"], 1):
    W(ws3, r, col, h, "col_hdr")
r += 1

auto_dist = [
    ("Bankroll", 0.10, "10% para capital de trading"),
    ("Ahorro",   0.10, "10% para fondo de ahorro"),
    ("Caprichos",0.05, "5% para gastos personales"),
]
row_bankroll = r
row_ahorro   = r + 1
row_caprichos= r + 2
for i, (name, pct, desc) in enumerate(auto_dist):
    pfx = "alt_" if i % 2 == 0 else "data_"
    W(ws3, r, 1, name, "b" + pfx + "l")
    W(ws3, r, 2, pct,  pfx + "c", FMT_PCT)
    W(ws3, r, 3, f"=$D$3*B{r}", pfx + "r", FMT_EUR)
    W(ws3, r, 4, f"=$D$3*B{r}*12", pfx + "r", FMT_EUR)
    W(ws3, r, 5, desc, pfx + "l")
    r += 1

# Summary
r += 1
merge_header(ws3, r, 1, r, 6, "RESUMEN Y DISPONIBLE", "header")
r += 1
W(ws3, r, 1, "Concepto", "col_hdr")
W(ws3, r, 3, "Importe",  "col_hdr")
r += 1

summary_data = [
    ("Ingreso neto mensual",     "=$D$3"),
    ("(-) Total gastos fijos",   f"=-C{total_fixed_row}"),
    ("(-) Bankroll (10%)",       f"=-C{row_bankroll}"),
    ("(-) Ahorro (10%)",         f"=-C{row_ahorro}"),
    ("(-) Caprichos (5%)",       f"=-C{row_caprichos}"),
]
sum_start = r
for i, (label, formula) in enumerate(summary_data):
    pfx = "alt_" if i % 2 == 0 else "data_"
    W(ws3, r, 1, label,   pfx + "l")
    W(ws3, r, 3, formula, pfx + "r", FMT_EUR)
    r += 1

# DISPONIBLE
disponible_row = r
W(ws3, r, 1, "DISPONIBLE RESTANTE", "gold_l")
W(ws3, r, 3, f"=SUM(C{sum_start}:C{r-1})", "gold_r", FMT_EUR)
r += 1
pct_gastado_row = r
W(ws3, r, 1, "% Gastado (fijos/ingreso)", "gold_l")
W(ws3, r, 3, f"=C{total_fixed_row}/$D$3", "gold_r", FMT_PCT)
r += 1
W(ws3, r, 1, "Desviacion vs presupuesto", "gold_l")
W(ws3, r, 3, f"=$D$3-C{total_fixed_row}", "gold_r", FMT_EUR)
r += 1

# Progress as percentage text (NO Unicode block chars)
r += 1
merge_header(ws3, r, 1, r, 6, "ESTADO DEL PRESUPUESTO", "header")
r += 1
W(ws3, r, 1, "Progreso gastos fijos:", "balt_l")
W(ws3, r, 2, f'=TEXT(C{pct_gastado_row},"0.0%")&" del ingreso en gastos fijos"', "alt_l")
r += 1
W(ws3, r, 1, "Disponible restante:", "balt_l")
W(ws3, r, 2, f'=TEXT(C{disponible_row},"#,##0.00")&" EUR disponibles este mes"', "alt_l")

# Conditional formatting
ws3.conditional_formatting.add(
    f"C{pct_gastado_row}",
    CellIsRule(operator="greaterThan", formula=["1"],
               fill=PatternFill("solid", fgColor="DC3545"))
)
ws3.conditional_formatting.add(
    f"C{pct_gastado_row}",
    CellIsRule(operator="between", formula=["0.9","1"],
               fill=PatternFill("solid", fgColor="FFC107"))
)
ws3.conditional_formatting.add(
    f"C{pct_gastado_row}",
    CellIsRule(operator="lessThanOrEqual", formula=["0.9"],
               fill=PatternFill("solid", fgColor="28A745"))
)

ws3.freeze_panes = "A2"
for col, w in [(1,35),(2,15),(3,16),(4,16),(5,35)]:
    set_col_width(ws3, col, w)
ws3.sheet_view.showGridLines = False

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 4: CONTROL DE AHORRO
# ══════════════════════════════════════════════════════════════════════════════
ws4 = add_sheet(wb, "CONTROL DE AHORRO", "20C997")

merge_header(ws4, 1, 1, 1, 6, "CONTROL DE AHORRO - EVOLUCION ACUMULADA", "header")
ws4.row_dimensions[1].height = 30

for i, h in enumerate(["Fecha","Mes","Anio","Cantidad (EUR)","Acumulado (EUR)","Tasa Ahorro %"], 1):
    W(ws4, 2, i, h, "col_hdr")

sample_ahorro = [(date(2026,6,20), "Junio", 2026, 200.00, 2000.00)]
for i, (dt, mes, anio, cant, acum) in enumerate(sample_ahorro, 3):
    pfx = "alt_" if i % 2 == 0 else "data_"
    W(ws4, i, 1, dt,   pfx + "c", FMT_DATE)
    W(ws4, i, 2, mes,  pfx + "c")
    W(ws4, i, 3, anio, pfx + "c")
    W(ws4, i, 4, cant, pfx + "r", FMT_EUR)
    W(ws4, i, 5, acum, pfx + "r", FMT_EUR)
    W(ws4, i, 6, f"=D{i}/'PRESUPUESTO MENSUAL'!$D$3", pfx + "r", FMT_PCT)

# Summary
r = 6
merge_header(ws4, r, 1, r, 6, "RESUMEN ANUAL 2026", "header")
r += 1

# Use SUMPRODUCT instead of SUMIF(YEAR...)
summary4 = [
    ("Total ahorrado anio 2026",
     "=SUMPRODUCT((ISNUMBER(A3:A1000))*(YEAR(IF(ISNUMBER(A3:A1000),A3:A1000,TODAY()))=2026)*(D3:D1000))",
     FMT_EUR),
    ("Ahorro mensual medio",
     "=IFERROR(AVERAGEIF(C3:C1000,2026,D3:D1000),0)",
     FMT_EUR),
    ("Capital acumulado total",
     "=MAX(E3:E1000)",
     FMT_EUR),
    ("Objetivo anual (10% x 12 meses)",
     f"='PRESUPUESTO MENSUAL'!$D$3*0.10*12",
     FMT_EUR),
]
for i, (label, formula, fmt) in enumerate(summary4):
    pfx = "alt_" if i % 2 == 0 else "data_"
    W(ws4, r, 1, label,   "b" + pfx + "l")
    W(ws4, r, 2, formula, pfx + "r", fmt)
    r += 1
obj_row = r - 1
tot_row = r - 3

W(ws4, r, 1, "% Cumplimiento", "balt_l")
W(ws4, r, 2, f"=IFERROR(B{tot_row}/B{obj_row},0)", "alt_r", FMT_PCT)

# Chart
chart4 = LineChart()
chart4.title = "Evolucion del Ahorro Acumulado"
chart4.style = 10
chart4.y_axis.title = "EUR"
chart4.x_axis.title = "Mes"
chart4.width = 20; chart4.height = 12
data_ref = Reference(ws4, min_col=5, min_row=2, max_row=12)
chart4.add_data(data_ref, titles_from_data=True)
chart4.series[0].graphicalProperties.line.solidFill = "20C997"
chart4.series[0].graphicalProperties.line.width = 25000
ws4.add_chart(chart4, "H2")

ws4.freeze_panes = "A3"
for col, w in [(1,13),(2,10),(3,6),(4,16),(5,16),(6,16)]:
    set_col_width(ws4, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 5: CONTROL DE BANKROLL
# ══════════════════════════════════════════════════════════════════════════════
ws5 = add_sheet(wb, "CONTROL DE BANKROLL", "FD7E14")

merge_header(ws5, 1, 1, 1, 5, "CONTROL DE BANKROLL - CAPITAL DE TRADING", "header")
ws5.row_dimensions[1].height = 30

for i, h in enumerate(["Fecha","Mes","Anio","Aporte (EUR)","Capital Acumulado (EUR)"], 1):
    W(ws5, 2, i, h, "col_hdr")

W(ws5, 3, 1, date(2026,6,20), "alt_c", FMT_DATE)
W(ws5, 3, 2, "Junio",         "alt_c")
W(ws5, 3, 3, 2026,            "alt_c")
W(ws5, 3, 4, 200.00,          "alt_r", FMT_EUR)
W(ws5, 3, 5, 200.00,          "alt_r", FMT_EUR)

r = 5
merge_header(ws5, r, 1, r, 5, "RESUMEN", "header")
r += 1

bankroll_summary = [
    ("Total bankroll aportado 2026",
     "=SUMPRODUCT((ISNUMBER(A3:A1000))*(YEAR(IF(ISNUMBER(A3:A1000),A3:A1000,TODAY()))=2026)*(D3:D1000))",
     FMT_EUR),
    ("Capital acumulado total", "=MAX(E3:E1000)", FMT_EUR),
    ("Objetivo anual",
     f"='PRESUPUESTO MENSUAL'!$D$3*0.10*12",
     FMT_EUR),
]
bk_tot_row = r
bk_obj_row = r + 2
for i, (label, formula, fmt) in enumerate(bankroll_summary):
    pfx = "alt_" if i % 2 == 0 else "data_"
    W(ws5, r, 1, label,   "b" + pfx + "l")
    W(ws5, r, 2, formula, pfx + "r", fmt)
    r += 1

W(ws5, r, 1, "% Cumplimiento", "balt_l")
W(ws5, r, 2, f"=IFERROR(B{bk_tot_row}/B{bk_obj_row},0)", "alt_r", FMT_PCT)

# Chart
chart5 = BarChart()
chart5.type = "col"; chart5.style = 10
chart5.title = "Evolucion del Bankroll"
chart5.y_axis.title = "EUR"; chart5.x_axis.title = "Mes"
chart5.width = 20; chart5.height = 12
data_ref5 = Reference(ws5, min_col=5, min_row=2, max_row=12)
chart5.add_data(data_ref5, titles_from_data=True)
ws5.add_chart(chart5, "G2")

ws5.freeze_panes = "A3"
for col, w in [(1,13),(2,10),(3,6),(4,16),(5,20)]:
    set_col_width(ws5, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 6: DASHBOARD DE TRADING
# ══════════════════════════════════════════════════════════════════════════════
ws6 = add_sheet(wb, "DASHBOARD DE TRADING", "FD7E14")

merge_header(ws6, 1, 1, 1, 5, "DASHBOARD DE TRADING - RESULTADOS Y ANALISIS", "header")
ws6.row_dimensions[1].height = 30

for i, h in enumerate(["Fecha","Cuenta / Plataforma","Beneficio/Perdida (EUR)","Payout Recibido (EUR)","Observaciones"], 1):
    W(ws6, 2, i, h, "col_hdr")

trading_data = [(date(2026,6,15), "FTMO", 350.00, 350.00, "Cuenta 10K - challenge superado")]
for i, row_data in enumerate(trading_data, 3):
    pfx = "alt_" if i % 2 == 0 else "data_"
    W(ws6, i, 1, row_data[0], pfx + "c", FMT_DATE)
    W(ws6, i, 2, row_data[1], pfx + "c")
    W(ws6, i, 3, row_data[2], pfx + "r", FMT_EUR)
    W(ws6, i, 4, row_data[3], pfx + "r", FMT_EUR)
    W(ws6, i, 5, row_data[4], pfx + "l")

ws6.conditional_formatting.add("C3:C1000",
    CellIsRule(operator="greaterThan", formula=["0"],
               fill=PatternFill("solid", fgColor="C6EFCE")))
ws6.conditional_formatting.add("C3:C1000",
    CellIsRule(operator="lessThan", formula=["0"],
               fill=PatternFill("solid", fgColor="FFC7CE")))

r = 5
merge_header(ws6, r, 1, r, 5, "ESTADISTICAS DE TRADING", "header")
r += 1

stats = [
    ("Beneficio mensual Jun 2026",
     "=SUMPRODUCT((ISNUMBER(A3:A1000))*(MONTH(IF(ISNUMBER(A3:A1000),A3:A1000,TODAY()))=6)*(YEAR(IF(ISNUMBER(A3:A1000),A3:A1000,TODAY()))=2026)*(C3:C1000))",
     FMT_EUR),
    ("Beneficio anual 2026",
     "=SUMPRODUCT((ISNUMBER(A3:A1000))*(YEAR(IF(ISNUMBER(A3:A1000),A3:A1000,TODAY()))=2026)*(C3:C1000))",
     FMT_EUR),
    ("Total payouts recibidos", "=SUM(D3:D1000)", FMT_EUR),
    ("ROI (sobre bankroll inicial 200 EUR)", "=IFERROR(SUM(C3:C1000)/200,0)", FMT_PCT),
    ("Mejor resultado individual", "=IFERROR(MAX(C3:C1000),0)", FMT_EUR),
    ("Peor resultado individual",  "=IFERROR(MIN(C3:C1000),0)", FMT_EUR),
    ("Beneficio acumulado total",  "=SUM(C3:C1000)", FMT_EUR),
    ("Numero de entradas",         "=COUNTA(B3:B1000)", FMT_INT),
]
for i, (label, formula, fmt) in enumerate(stats):
    pfx = "alt_" if i % 2 == 0 else "data_"
    W(ws6, r, 1, label,   "b" + pfx + "l")
    W(ws6, r, 2, formula, pfx + "r", fmt)
    r += 1

chart6 = BarChart()
chart6.type = "col"; chart6.style = 10
chart6.title = "Resultados Trading (EUR)"
chart6.y_axis.title = "EUR"; chart6.x_axis.title = "Operacion"
chart6.width = 20; chart6.height = 12
data_ref6 = Reference(ws6, min_col=3, min_row=2, max_row=12)
chart6.add_data(data_ref6, titles_from_data=True)
ws6.add_chart(chart6, "G2")

ws6.freeze_panes = "A3"
for col, w in [(1,13),(2,22),(3,22),(4,22),(5,35)]:
    set_col_width(ws6, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 7: CONTROL DE PAYOUTS
# ══════════════════════════════════════════════════════════════════════════════
ws7 = add_sheet(wb, "CONTROL DE PAYOUTS", "FD7E14")

merge_header(ws7, 1, 1, 1, 5, "CONTROL DE PAYOUTS - INGRESOS DE TRADING", "header")
ws7.row_dimensions[1].height = 30

for i, h in enumerate(["Fecha","Empresa / Plataforma","Importe (EUR)","Estado","Observaciones"], 1):
    W(ws7, 2, i, h, "col_hdr")

payout_data = [
    (date(2026,6,15), "FTMO", 350.00, "Cobrado",   "Payout junio 2026"),
    (date(2026,7,1),  "FTMO", 400.00, "Pendiente", "Payout julio 2026 - estimado"),
]
for i, row_data in enumerate(payout_data, 3):
    pfx = "alt_" if i % 2 == 0 else "data_"
    W(ws7, i, 1, row_data[0], pfx + "c", FMT_DATE)
    W(ws7, i, 2, row_data[1], pfx + "c")
    W(ws7, i, 3, row_data[2], pfx + "r", FMT_EUR)
    W(ws7, i, 4, row_data[3], pfx + "c")
    W(ws7, i, 5, row_data[4], pfx + "l")

ws7.conditional_formatting.add("D3:D1000",
    FormulaRule(formula=['D3="Cobrado"'],   fill=PatternFill("solid", fgColor="C6EFCE")))
ws7.conditional_formatting.add("D3:D1000",
    FormulaRule(formula=['D3="Pendiente"'], fill=PatternFill("solid", fgColor="FFEB9C")))

dv_estado = DataValidation(type="list", formula1='"Cobrado,Pendiente,Cancelado"', allow_blank=True)
dv_estado.sqref = "D3:D1000"
ws7.add_data_validation(dv_estado)

r = 6
payout_summary = [
    ("Total cobrado",   '=SUMIF(D3:D1000,"Cobrado",C3:C1000)',   FMT_EUR),
    ("Total pendiente", '=SUMIF(D3:D1000,"Pendiente",C3:C1000)', FMT_EUR),
    ("Total anual 2026",
     "=SUMPRODUCT((ISNUMBER(A3:A1000))*(YEAR(IF(ISNUMBER(A3:A1000),A3:A1000,TODAY()))=2026)*(C3:C1000))",
     FMT_EUR),
    ("Total historico", "=SUM(C3:C1000)", FMT_EUR),
]
for i, (label, formula, fmt) in enumerate(payout_summary):
    pfx = "alt_" if i % 2 == 0 else "data_"
    W(ws7, r, 1, label,   "b" + pfx + "l")
    W(ws7, r, 2, formula, pfx + "r", fmt)
    r += 1

chart7 = BarChart()
chart7.type = "col"; chart7.style = 10
chart7.title = "Payouts por Mes"
chart7.y_axis.title = "EUR"
chart7.width = 18; chart7.height = 12
data_ref7 = Reference(ws7, min_col=3, min_row=2, max_row=12)
chart7.add_data(data_ref7, titles_from_data=True)
ws7.add_chart(chart7, "G2")

ws7.freeze_panes = "A3"
for col, w in [(1,13),(2,22),(3,16),(4,14),(5,35)]:
    set_col_width(ws7, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 8: PATRIMONIO NETO
# ══════════════════════════════════════════════════════════════════════════════
ws8 = add_sheet(wb, "PATRIMONIO NETO", "20C997")

merge_header(ws8, 1, 1, 1, 4, "PATRIMONIO NETO - ACTIVOS Y PASIVOS", "header")
ws8.row_dimensions[1].height = 30

# ACTIVOS
r = 3
merge_header(ws8, r, 1, r, 4, "ACTIVOS", "green")
r += 1
for col, h in enumerate(["Concepto","Valor Actual (EUR)","Notas"], 1):
    W(ws8, r, col, h, "col_hdr")
r += 1

activos = [
    ("Cuenta Bancaria Corriente", 500.00,  "Saldo en cuenta corriente"),
    ("Fondo de Ahorro",           2000.00, "Ahorro acumulado"),
    ("Bankroll Trading",          200.00,  "Capital para trading"),
    ("Capital en Plataformas",    0.00,    "Fondos en brokers/prop firms"),
    ("Otros Activos",             0.00,    "Otros activos"),
]
activos_start = r
for i, (name, val, note) in enumerate(activos):
    pfx = "alt_" if i % 2 == 0 else "data_"
    W(ws8, r, 1, name, pfx + "l")
    W(ws8, r, 2, val,  pfx + "r", FMT_EUR)
    W(ws8, r, 3, note, pfx + "l")
    r += 1
activos_end = r - 1
total_activos_row = r
merge_header(ws8, r, 1, r, 1, "TOTAL ACTIVOS", "green")
W(ws8, r, 2, f"=SUM(B{activos_start}:B{activos_end})", "green", FMT_EUR)
r += 1

# PASIVOS
r += 1
merge_header(ws8, r, 1, r, 4, "PASIVOS / DEUDAS", "red")
r += 1
for col, h in enumerate(["Concepto","Valor Actual (EUR)","Notas"], 1):
    W(ws8, r, col, h, "col_hdr")
r += 1

pasivos = [
    ("Deudas personales",         0.00, ""),
    ("Financiaciones pendientes", 0.00, ""),
    ("Otros pasivos",             0.00, ""),
]
pasivos_start = r
for i, (name, val, note) in enumerate(pasivos):
    pfx = "alt_" if i % 2 == 0 else "data_"
    W(ws8, r, 1, name, pfx + "l")
    W(ws8, r, 2, val,  pfx + "r", FMT_EUR)
    W(ws8, r, 3, note, pfx + "l")
    r += 1
pasivos_end = r - 1
total_pasivos_row = r
merge_header(ws8, r, 1, r, 1, "TOTAL PASIVOS", "red")
W(ws8, r, 2, f"=SUM(B{pasivos_start}:B{pasivos_end})", "red", FMT_EUR)

# PATRIMONIO NETO total
r += 2
merge_header(ws8, r, 1, r, 4, "PATRIMONIO NETO", "header")
r += 1
W(ws8, r, 1, "PATRIMONIO NETO = Activos - Pasivos", "gold_l")
W(ws8, r, 2, f"=B{total_activos_row}-B{total_pasivos_row}", "gold_r", FMT_EUR)
patrimonio_row = r

# Historical evolution
r += 2
merge_header(ws8, r, 1, r, 4, "EVOLUCION HISTORICA DEL PATRIMONIO", "header")
r += 1
for col, h in enumerate(["Mes","Activos (EUR)","Pasivos (EUR)","Patrimonio Neto (EUR)"], 1):
    W(ws8, r, col, h, "col_hdr")
r += 1

hist_start = r
history_data = [("Junio 2026", 2700.00, 0.00)]
for i, (mes, act, pas) in enumerate(history_data):
    pfx = "alt_" if i % 2 == 0 else "data_"
    W(ws8, r, 1, mes, pfx + "l")
    W(ws8, r, 2, act, pfx + "r", FMT_EUR)
    W(ws8, r, 3, pas, pfx + "r", FMT_EUR)
    W(ws8, r, 4, f"=B{r}-C{r}", pfx + "r", FMT_EUR)
    r += 1

chart8 = AreaChart()
chart8.title = "Evolucion del Patrimonio Neto"
chart8.style = 10
chart8.y_axis.title = "EUR"; chart8.x_axis.title = "Mes"
chart8.width = 20; chart8.height = 12
data_ref8 = Reference(ws8, min_col=4, min_row=hist_start-1, max_row=hist_start+5)
chart8.add_data(data_ref8, titles_from_data=True)
ws8.add_chart(chart8, "F2")

ws8.freeze_panes = "A2"
for col, w in [(1,30),(2,20),(3,20),(4,22)]:
    set_col_width(ws8, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 9: FONDO DE EMERGENCIA
# ══════════════════════════════════════════════════════════════════════════════
ws9 = add_sheet(wb, "FONDO DE EMERGENCIA", "20C997")

merge_header(ws9, 1, 1, 1, 4, "FONDO DE EMERGENCIA - COBERTURA FINANCIERA", "header")
ws9.row_dimensions[1].height = 30

r = 3
gastos_fijos = 1575  # reference constant

info_data = [
    ("Gastos fijos mensuales",         gastos_fijos,       FMT_EUR),
    ("Objetivo 3 meses",               gastos_fijos * 3,   FMT_EUR),
    ("Objetivo 6 meses (recomendado)", gastos_fijos * 6,   FMT_EUR),
    ("Objetivo 12 meses (optimo)",     gastos_fijos * 12,  FMT_EUR),
]
for i, (label, val, fmt) in enumerate(info_data):
    pfx = "alt_" if i % 2 == 0 else "data_"
    W(ws9, r, 1, label, "b" + pfx + "l")
    W(ws9, r, 2, val,   pfx + "r", fmt)
    r += 1

r += 1
merge_header(ws9, r, 1, r, 4, "TU FONDO DE EMERGENCIA ACTUAL (edita la celda dorada)", "header")
r += 1

W(ws9, r, 1, "Capital actual fondo emergencia:", "balt_l")
capital_cell_row = r
W(ws9, r, 2, 500.00, "input", FMT_EUR)
r += 1

calculated = [
    ("Meses cubiertos actualmente",    f"=B{capital_cell_row}/{gastos_fijos}",         FMT_SCR),
    ("% cobertura objetivo 6 meses",   f"=B{capital_cell_row}/{gastos_fijos*6}",       FMT_PCT),
    ("% cobertura objetivo 12 meses",  f"=B{capital_cell_row}/{gastos_fijos*12}",      FMT_PCT),
    ("Faltan para 6 meses",            f"={gastos_fijos*6}-B{capital_cell_row}",       FMT_EUR),
    ("Faltan para 12 meses",           f"={gastos_fijos*12}-B{capital_cell_row}",      FMT_EUR),
]
pct6_row = r + 1  # index of the 6-month % row
for i, (label, formula, fmt) in enumerate(calculated):
    pfx = "alt_" if i % 2 == 0 else "data_"
    W(ws9, r, 1, label,   "b" + pfx + "l")
    W(ws9, r, 2, formula, pfx + "r", fmt)
    r += 1

# Progress as text (NO Unicode)
r += 1
W(ws9, r, 1, "Progreso hacia 6 meses:", "balt_l")
W(ws9, r, 2, f'=TEXT(MIN(B{pct6_row},1),"0.0%")&" completado (objetivo: {gastos_fijos*6:,} EUR)"', "alt_l")
r += 1
W(ws9, r, 1, "Resumen estado:", "balt_l")
W(ws9, r, 2,
  f'=IF(B{pct6_row}>=1,"OBJETIVO 6 MESES ALCANZADO",'
  f'IF(B{pct6_row}>=0.5,"MAS DE LA MITAD COMPLETADO","EN PROGRESO - SIGUE APORTANDO"))',
  "gold")

# Milestones
r += 2
merge_header(ws9, r, 1, r, 4, "HITOS DEL FONDO DE EMERGENCIA", "header")
r += 1
milestones = [(gastos_fijos, "1 mes"), (gastos_fijos*3, "3 meses"), (gastos_fijos*6, "6 meses"), (gastos_fijos*12, "12 meses")]
for target, label in milestones:
    W(ws9, r, 1, f"Objetivo {label}: {target:,} EUR", "alt_l")
    r += 1

for col, w in [(1,40),(2,25),(3,20)]:
    set_col_width(ws9, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 10: OBJETIVOS
# ══════════════════════════════════════════════════════════════════════════════
ws10 = add_sheet(wb, "OBJETIVOS", "20C997")

merge_header(ws10, 1, 1, 1, 6, "OBJETIVOS FINANCIEROS ANUALES 2026", "header")
ws10.row_dimensions[1].height = 30

for i, h in enumerate(["Objetivo","Meta Anual (EUR)","Actual (EUR)","Diferencia (EUR)","% Cumplimiento","Estado"], 1):
    W(ws10, 2, i, h, "col_hdr")

objetivos = [
    ("Ahorro anual",           2400.00, 200.00),
    ("Bankroll anual",         2400.00, 200.00),
    ("Patrimonio anual",       5000.00, 2700.00),
    ("Beneficios trading",     4200.00, 350.00),
]

for i, (name, meta, actual) in enumerate(objetivos, 3):
    pfx = "alt_" if i % 2 == 0 else "data_"
    W(ws10, i, 1, name,   "b" + pfx + "l")
    W(ws10, i, 2, meta,   pfx + "r", FMT_EUR)
    W(ws10, i, 3, actual, pfx + "r", FMT_EUR)
    W(ws10, i, 4, f"=C{i}-B{i}",          pfx + "r", FMT_EUR)
    W(ws10, i, 5, f"=IFERROR(C{i}/B{i},0)", pfx + "r", FMT_PCT)
    # Text status instead of Unicode progress bar
    W(ws10, i, 6,
      f'=TEXT(IFERROR(C{i}/B{i},0),"0.0%")&IF(IFERROR(C{i}/B{i},0)>=1," COMPLETADO",'
      f'IF(IFERROR(C{i}/B{i},0)>=0.5," EN BUEN CAMINO"," EN PROGRESO"))',
      pfx + "l")

ws10.conditional_formatting.add("E3:E10",
    CellIsRule(operator="greaterThanOrEqual", formula=["0.75"],
               fill=PatternFill("solid", fgColor="C6EFCE")))
ws10.conditional_formatting.add("E3:E10",
    CellIsRule(operator="between", formula=["0.5","0.75"],
               fill=PatternFill("solid", fgColor="FFEB9C")))
ws10.conditional_formatting.add("E3:E10",
    CellIsRule(operator="lessThan", formula=["0.5"],
               fill=PatternFill("solid", fgColor="FFC7CE")))

ws10.freeze_panes = "A3"
for col, w in [(1,28),(2,16),(3,16),(4,16),(5,18),(6,30)]:
    set_col_width(ws10, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 11: GASTOS HORMIGA
# ══════════════════════════════════════════════════════════════════════════════
ws11 = add_sheet(wb, "GASTOS HORMIGA", "808080")

merge_header(ws11, 1, 1, 1, 7, "GASTOS HORMIGA - CONTROL DE PEQUENOS GASTOS", "header")
ws11.row_dimensions[1].height = 30

for i, h in enumerate(["Fecha","Mes","Categoria","Descripcion","Importe (EUR)","% Ingreso","Alerta"], 1):
    W(ws11, 2, i, h, "col_hdr")

dv_hormiga = DataValidation(type="list",
    formula1='"Restaurantes,Amazon,Ocio,Compras impulsivas,Suscripciones,Otros"', allow_blank=True)
dv_hormiga.sqref = "C3:C1000"
ws11.add_data_validation(dv_hormiga)

hormiga_data = [
    (date(2026,6,10), "Junio", "Restaurantes",      "Restaurante familiar",    35.00),
    (date(2026,6,12), "Junio", "Amazon",             "Compra Amazon impulsiva", 28.50),
    (date(2026,6,14), "Junio", "Ocio",               "Cine + palomitas",        18.00),
    (date(2026,6,18), "Junio", "Suscripciones",      "Netflix",                 13.99),
    (date(2026,6,22), "Junio", "Compras impulsivas", "Ropa",                    45.00),
]

for i, row_data in enumerate(hormiga_data, 3):
    pfx = "alt_" if i % 2 == 0 else "data_"
    W(ws11, i, 1, row_data[0], pfx + "c", FMT_DATE)
    W(ws11, i, 2, row_data[1], pfx + "c")
    W(ws11, i, 3, row_data[2], pfx + "c")
    W(ws11, i, 4, row_data[3], pfx + "l")
    W(ws11, i, 5, row_data[4], pfx + "r", FMT_EUR)
    W(ws11, i, 6, f"=E{i}/'PRESUPUESTO MENSUAL'!$D$3", pfx + "r", FMT_PCT)
    W(ws11, i, 7,
      f'=IF(E{i}/"PRESUPUESTO MENSUAL"!$D$3>0.05,"ALERTA","OK")',
      pfx + "c")
    # Fix the formula to use single quotes properly
    ws11.cell(row=i, column=7).value = f"=IF(E{i}/'PRESUPUESTO MENSUAL'!$D$3>0.05,\"ALERTA\",\"OK\")"

# Category summary
r = 10
merge_header(ws11, r, 1, r, 7, "RESUMEN POR CATEGORIA - JUNIO 2026", "header")
r += 1
for col, h in enumerate(["Categoria","Total Mes (EUR)","% Ingreso","Limite 5%","Estado"], 1):
    W(ws11, r, col, h, "col_hdr")
r += 1

cats_hormiga = ["Restaurantes","Amazon","Ocio","Suscripciones","Compras impulsivas"]
cat_start_row = r
for i, cat in enumerate(cats_hormiga):
    pfx = "alt_" if i % 2 == 0 else "data_"
    W(ws11, r, 1, cat, "b" + pfx + "l")
    W(ws11, r, 2, f"=SUMIF(C3:C100,A{r},E3:E100)", pfx + "r", FMT_EUR)
    W(ws11, r, 3, f"=B{r}/'PRESUPUESTO MENSUAL'!$D$3", pfx + "r", FMT_PCT)
    W(ws11, r, 4, "5% limite", pfx + "c")
    W(ws11, r, 5, f'=IF(B{r}>"PRESUPUESTO MENSUAL"!$D$3*0.05,"EXCEDIDO","OK")', pfx + "c")
    ws11.cell(row=r, column=5).value = f"=IF(B{r}>'PRESUPUESTO MENSUAL'!$D$3*0.05,\"EXCEDIDO\",\"OK\")"
    r += 1

chart11 = PieChart()
chart11.title = "Distribucion Gastos Hormiga"
chart11.style = 10; chart11.width = 18; chart11.height = 12
labels11 = Reference(ws11, min_col=1, min_row=cat_start_row, max_row=cat_start_row+4)
data11   = Reference(ws11, min_col=2, min_row=cat_start_row, max_row=cat_start_row+4)
chart11.add_data(data11)
chart11.set_categories(labels11)
ws11.add_chart(chart11, "G2")

ws11.freeze_panes = "A3"
for col, w in [(1,13),(2,10),(3,22),(4,28),(5,12),(6,12),(7,14)]:
    set_col_width(ws11, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 12: RANKING MEJORES MESES
# ══════════════════════════════════════════════════════════════════════════════
ws12 = add_sheet(wb, "RANKING MEJORES MESES", "20C997")

merge_header(ws12, 1, 1, 1, 9, "RANKING DE MEJORES MESES - TOP 5 HISTORICO", "header")
ws12.row_dimensions[1].height = 30

rankings = [
    ("MEJORES MESES - INGRESOS", 1),
    ("MEJORES MESES - AHORRO",   4),
    ("MEJORES MESES - TRADING",  7),
]

for rank_title, col_start in rankings:
    ws12.merge_cells(start_row=3, start_column=col_start, end_row=3, end_column=col_start+2)
    c = ws12.cell(row=3, column=col_start, value=rank_title)
    c.style = "header"

    W(ws12, 4, col_start,   "Posicion", "col_hdr")
    W(ws12, 4, col_start+1, "Mes",      "col_hdr")
    W(ws12, 4, col_start+2, "Importe",  "col_hdr")

    medals = ["1ro","2do","3ro","4to","5to"]
    for ri in range(5):
        sty = "gold" if ri == 0 else ("alt_l" if ri % 2 == 0 else "data_l")
        W(ws12, 5+ri, col_start,   medals[ri], sty)
        W(ws12, 5+ri, col_start+1, "Junio 2026" if ri == 0 else "-", sty)
        W(ws12, 5+ri, col_start+2, 2350.00 if ri == 0 else 0.00, sty, FMT_EUR)

note_row = 12
ws12.merge_cells(f"A{note_row}:I{note_row}")
c = ws12.cell(row=note_row, column=1,
    value="NOTA: Actualiza manualmente los valores de este ranking con tus datos mensuales.")
c.style = "alt_l"

for col, w in [(1,12),(2,15),(3,14),(4,2),(5,12),(6,15),(7,14),(8,2)]:
    set_col_width(ws12, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 13: LIBERTAD FINANCIERA
# ══════════════════════════════════════════════════════════════════════════════
ws13 = add_sheet(wb, "LIBERTAD FINANCIERA", "20C997")

merge_header(ws13, 1, 1, 1, 4, "LIBERTAD FINANCIERA - COBERTURA CON TRADING", "header")
ws13.row_dimensions[1].height = 30

r = 3
lf_data = [
    ("Gastos mensuales fijos",                  1575.00, FMT_EUR),
    ("Beneficio medio mensual trading (editar)", 350.00, FMT_EUR),
    ("% Cobertura actual",                       "=B4/B3", FMT_PCT),
    ("Meses con datos de trading",               1,         FMT_INT),
]
pct_row_lf = r + 2

for i, (label, val, fmt) in enumerate(lf_data, r):
    sty_l = "gold_l" if i == r+2 else ("alt_l" if i % 2 == 0 else "data_l")
    sty_r = "gold_r" if i == r+2 else ("alt_r" if i % 2 == 0 else "data_r")
    W(ws13, i, 1, label, sty_l)
    W(ws13, i, 2, val,   sty_r, fmt)

r = 8
W(ws13, r, 1, "Progreso libertad financiera:", "balt_l")
W(ws13, r, 2, f'=TEXT(MIN(B{pct_row_lf},1),"0.0%")&" de cobertura de gastos con trading"', "alt_l")
r += 1

W(ws13, r, 1, "Estado actual:", "teal")
W(ws13, r, 2,
  f'="El trading cubre el "&TEXT(B{pct_row_lf},"0.0%")&" de tus gastos mensuales fijos"',
  "teal")
r += 2

merge_header(ws13, r, 1, r, 4, "HITOS DE LIBERTAD FINANCIERA", "header")
r += 1

milestones13 = [
    (0.25, "25% - Inicio del camino: trading cubre 1/4 de gastos"),
    (0.50, "50% - Punto medio: trading cubre la mitad de gastos"),
    (0.75, "75% - Casi libre: solo 25% depende del empleo"),
    (1.00, "100% - LIBERTAD FINANCIERA: trading cubre todos los gastos"),
]
for pct, desc in milestones13:
    achieved = 350/1575 >= pct
    sty = "green" if achieved else "alt_l"
    W(ws13, r, 1, f"{pct*100:.0f}%", sty)
    W(ws13, r, 2, desc, sty)
    r += 1

for col, w in [(1,38),(2,50)]:
    set_col_width(ws13, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 14: PROYECCIONES FUTURAS
# ══════════════════════════════════════════════════════════════════════════════
ws14 = add_sheet(wb, "PROYECCIONES FUTURAS", "20C997")

merge_header(ws14, 1, 1, 1, 6, "PROYECCIONES FUTURAS - 1, 3 Y 5 ANOS", "header")
ws14.row_dimensions[1].height = 30

r = 3
merge_header(ws14, r, 1, r, 6, "PARAMETROS DE ENTRADA (edita las celdas doradas)", "header")
r += 1

inputs14 = [
    ("Ingreso medio mensual neto",        2000.00, FMT_EUR),
    ("Tasa de ahorro mensual %",          0.10,    FMT_PCT),
    ("Beneficio medio mensual trading",   350.00,  FMT_EUR),
    ("Rentabilidad anual inversion %",    0.05,    FMT_PCT),
    ("Aportacion bankroll mensual",       200.00,  FMT_EUR),
]
input_rows = {}
for label, val, fmt in inputs14:
    W(ws14, r, 1, label, "balt_l")
    W(ws14, r, 2, val,   "input", fmt)
    input_rows[label] = r
    r += 1

ing_r  = input_rows["Ingreso medio mensual neto"]
tasa_r = input_rows["Tasa de ahorro mensual %"]
trd_r  = input_rows["Beneficio medio mensual trading"]
bk_r   = input_rows["Aportacion bankroll mensual"]

r += 1
merge_header(ws14, r, 1, r, 6, "TABLA DE PROYECCIONES", "header")
r += 1

for col, h in enumerate(["Anio","Ahorro Acum. (EUR)","Bankroll (EUR)","Patrimonio Total (EUR)","Benef. Trading Acum. (EUR)","Libertad Fin. %"], 1):
    W(ws14, r, col, h, "col_hdr")
r += 1

proj_start = r
for yr in range(1, 6):
    pfx = "alt_" if yr % 2 == 0 else "data_"
    W(ws14, r, 1, f"Anio {yr}", "b" + pfx + "l")
    W(ws14, r, 2, f"=$B${ing_r}*$B${tasa_r}*12*{yr}", pfx + "r", FMT_EUR)
    W(ws14, r, 3, f"=$B${bk_r}*12*{yr}",               pfx + "r", FMT_EUR)
    W(ws14, r, 4, f"=B{r}+C{r}",                        pfx + "r", FMT_EUR)
    W(ws14, r, 5, f"=$B${trd_r}*12*{yr}",               pfx + "r", FMT_EUR)
    W(ws14, r, 6, f"=IFERROR($B${trd_r}/1575,0)",       pfx + "r", FMT_PCT)
    r += 1

chart14 = LineChart()
chart14.title = "Proyeccion Patrimonial a 5 Anos"
chart14.style = 10
chart14.y_axis.title = "EUR"; chart14.x_axis.title = "Anio"
chart14.width = 22; chart14.height = 14
data_ref14 = Reference(ws14, min_col=2, max_col=5, min_row=proj_start-1, max_row=proj_start+4)
chart14.add_data(data_ref14, titles_from_data=True)
ws14.add_chart(chart14, "H4")

ws14.freeze_panes = "A3"
for col, w in [(1,10),(2,22),(3,16),(4,20),(5,24),(6,20)]:
    set_col_width(ws14, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 15: SCORE DEL TRADER
# ══════════════════════════════════════════════════════════════════════════════
ws15 = add_sheet(wb, "SCORE DEL TRADER", "FD7E14")

merge_header(ws15, 1, 1, 1, 4, "SCORE DEL TRADER - EVALUACION INTEGRAL 0-100", "header")
ws15.row_dimensions[1].height = 30

r = 3
merge_header(ws15, r, 1, r, 4, "COMPONENTES DEL SCORE", "header")
r += 1

for col, h in enumerate(["Componente","Peso","Descripcion","Puntos (max 20)"], 1):
    W(ws15, r, col, h, "col_hdr")
r += 1

components = [
    ("Cumplimiento Ahorro",   "20 pts", "200/2400 = 8.3% completado",  "=MIN(20,IFERROR(200/2400*20,0))"),
    ("Cumplimiento Bankroll", "20 pts", "200/2400 = 8.3% completado",  "=MIN(20,IFERROR(200/2400*20,0))"),
    ("Control de Gastos",     "20 pts", "Gastos vs ingreso mensual",   "=IF(1575<=2000,20,MAX(0,20-((1575-2000)/2000)*20))"),
    ("Crecimiento Patrimonio","20 pts", "2700/5000 objetivo",          "=MIN(20,IFERROR(2700/5000*20,0))"),
    ("Resultados Trading",    "20 pts", "350/2000 objetivo anual",     "=MIN(20,IFERROR(350/2000*20,0))"),
]

comp_start = r
for i, (name, weight, desc, formula) in enumerate(components):
    pfx = "alt_" if i % 2 == 0 else "data_"
    W(ws15, r, 1, name,    "b" + pfx + "l")
    W(ws15, r, 2, weight,  pfx + "c")
    W(ws15, r, 3, desc,    pfx + "l")
    W(ws15, r, 4, formula, pfx + "r", FMT_SCR)
    r += 1

comp_end = r - 1

# Total score
total_row = r
ws15.merge_cells(f"A{total_row}:C{total_row}")
c = ws15.cell(row=total_row, column=1, value="SCORE TOTAL DEL TRADER (sobre 100)")
c.style = "gold"
# Score value and label
W(ws15, total_row, 4, f"=ROUND(SUM(D{comp_start}:D{comp_end}),1)", "gold_r", FMT_SCR)

r = total_row + 2
merge_header(ws15, r, 1, r, 4, "SEMAFORO DE EVALUACION", "header")
r += 1

tl_data = [
    ("green", "SCORE >= 70 - EXCELENTE: Vas por buen camino, manten el ritmo"),
    ("gold",  "SCORE 40-69 - MEJORABLE: Hay areas que necesitan atencion"),
    ("red",   "SCORE < 40 - ALERTA: Revisa tu estrategia financiera"),
]
for sty, txt in tl_data:
    merge_header(ws15, r, 1, r, 4, txt, sty)
    ws15.row_dimensions[r].height = 18
    r += 1

r += 1
W(ws15, r, 1, "Tu evaluacion:", "balt_l")
ws15.merge_cells(f"B{r}:D{r}")
W(ws15, r, 2,
  f'=IF(D{total_row}>=70,"EXCELENTE - Score: "&TEXT(D{total_row},"0.0")&"/100",'
  f'IF(D{total_row}>=40,"MEJORABLE - Score: "&TEXT(D{total_row},"0.0")&"/100",'
  f'"ALERTA - Score: "&TEXT(D{total_row},"0.0")&"/100"))',
  "gold")

for col, w in [(1,30),(2,12),(3,30),(4,18)]:
    set_col_width(ws15, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 1: DASHBOARD EJECUTIVO (created last for cross-sheet references)
# ══════════════════════════════════════════════════════════════════════════════
ws1 = add_sheet(wb, "DASHBOARD EJECUTIVO", "1F2D3D")

merge_header(ws1, 1, 1, 1, 12, "DASHBOARD EJECUTIVO - SISTEMA FINANCIERO PERSONAL 2026", "header")
ws1.row_dimensions[1].height = 40

merge_header(ws1, 2, 1, 2, 12,
    "Sistema de control financiero integral | Inicio: Junio 2026 | Referencia: 2.000 EUR/mes",
    "subheader")
ws1.row_dimensions[2].height = 20

# Highlight the income cell reference
merge_header(ws1, 3, 1, 3, 12,
    "INGRESO MENSUAL: Para cambiar el ingreso ve a la hoja 'PRESUPUESTO MENSUAL' y edita la celda D3 (dorada)",
    "gold")
ws1.row_dimensions[3].height = 22

r = 5
merge_header(ws1, r, 1, r, 12, "KPIs PRINCIPALES - JUNIO 2026", "subheader")
ws1.row_dimensions[r].height = 22
r += 1

# KPI helper
def kpi_box(ws, sr, sc, ec, title, formula, fmt, sty_title="header_sm", sty_val="data_c"):
    ws.merge_cells(start_row=sr, start_column=sc, end_row=sr, end_column=ec)
    t = ws.cell(row=sr, column=sc, value=title)
    t.style = sty_title
    ws.merge_cells(start_row=sr+1, start_column=sc, end_row=sr+2, end_column=ec)
    v = ws.cell(row=sr+1, column=sc, value=formula)
    v.style = sty_val
    v.number_format = fmt
    ws.row_dimensions[sr].height = 18
    ws.row_dimensions[sr+1].height = 28
    ws.row_dimensions[sr+2].height = 12

kpis = [
    (1, 2,  "Ingreso del Mes (D3 PRESUPUESTO)",
     "='PRESUPUESTO MENSUAL'!$D$3", FMT_EUR),
    (3, 4,  "Gastos Totales (Movimientos)",
     '=SUMIF(\'REGISTRO DE MOVIMIENTOS\'!D3:D1000,"Gasto",\'REGISTRO DE MOVIMIENTOS\'!H3:H1000)',
     FMT_EUR),
    (5, 6,  "Flujo de Caja",
     "='PRESUPUESTO MENSUAL'!$D$3-SUMIF('REGISTRO DE MOVIMIENTOS'!D3:D1000,\"Gasto\",'REGISTRO DE MOVIMIENTOS'!H3:H1000)",
     FMT_EUR),
    (7, 8,  "Ahorro Mensual",
     "='CONTROL DE AHORRO'!D3", FMT_EUR),
    (9, 10, "Ahorro Acumulado",
     "=MAX('CONTROL DE AHORRO'!E3:E1000)", FMT_EUR),
    (11, 12,"Bankroll Capital",
     "=MAX('CONTROL DE BANKROLL'!E3:E1000)", FMT_EUR),
]
for sc, ec, title, formula, fmt in kpis:
    kpi_box(ws1, r, sc, ec, title, formula, fmt)

r += 3
kpis2 = [
    (1, 2,  "Benef. Trading Mes",
     "=SUM('DASHBOARD DE TRADING'!C3:C1000)", FMT_EUR),
    (3, 4,  "Payouts Cobrados",
     '=SUMIF(\'CONTROL DE PAYOUTS\'!D3:D1000,"Cobrado",\'CONTROL DE PAYOUTS\'!C3:C1000)',
     FMT_EUR),
    (5, 6,  "Patrimonio Neto",
     f"='PATRIMONIO NETO'!B{patrimonio_row}", FMT_EUR),
    (7, 8,  "ROI Trading %",
     "=IFERROR(SUM('DASHBOARD DE TRADING'!C3:C1000)/MAX('CONTROL DE BANKROLL'!E3:E1000),0)",
     FMT_PCT),
    (9, 10, "Score Financiero /100",
     f"='SCORE DEL TRADER'!D{total_row}", FMT_SCR),
    (11, 12,"Libertad Financiera %",
     "='LIBERTAD FINANCIERA'!B5", FMT_PCT),
]
for sc, ec, title, formula, fmt in kpis2:
    kpi_box(ws1, r, sc, ec, title, formula, fmt)

r += 4
merge_header(ws1, r, 1, r, 12, "RESUMEN PRESUPUESTARIO MENSUAL", "subheader")
ws1.row_dimensions[r].height = 22
r += 1

for col, h in [(1,"Concepto"),(3,"Importe"),(5,"% Ingreso")]:
    W(ws1, r, col, h, "col_hdr")
r += 1

budget_items = [
    ("Ingreso Neto (PRESUPUESTO MENSUAL D3)", "='PRESUPUESTO MENSUAL'!$D$3"),
    ("Gastos Fijos",                          "=1575"),
    ("Bankroll (10%)",                        "='PRESUPUESTO MENSUAL'!$D$3*0.1"),
    ("Ahorro (10%)",                          "='PRESUPUESTO MENSUAL'!$D$3*0.1"),
    ("Caprichos (5%)",                        "='PRESUPUESTO MENSUAL'!$D$3*0.05"),
    ("DISPONIBLE",
     "='PRESUPUESTO MENSUAL'!$D$3-1575-'PRESUPUESTO MENSUAL'!$D$3*0.25"),
]
for i, (label, formula) in enumerate(budget_items):
    pfx = "alt_" if i % 2 == 0 else "data_"
    sty_l = "gold_l" if i == 5 else pfx + "l"
    sty_r = "gold_r" if i == 5 else pfx + "r"
    W(ws1, r, 1, label,   sty_l)
    W(ws1, r, 3, formula, sty_r, FMT_EUR)
    W(ws1, r, 5, f"=C{r}/'PRESUPUESTO MENSUAL'!$D$3", sty_r, FMT_PCT)
    r += 1

r += 1
merge_header(ws1, r, 1, r, 12,
    "NAVEGACION: Usa las pestanas de abajo para acceder a cada seccion del sistema",
    "gold")
ws1.row_dimensions[r].height = 20

ws1.freeze_panes = "A4"
for col in range(1, 13):
    set_col_width(ws1, col, 14)
ws1.sheet_view.showGridLines = False

# ══════════════════════════════════════════════════════════════════════════════
# Reorder sheets
# ══════════════════════════════════════════════════════════════════════════════
sheet_order = [
    "GUIA DE USO",
    "DASHBOARD EJECUTIVO",
    "REGISTRO DE MOVIMIENTOS",
    "PRESUPUESTO MENSUAL",
    "CONTROL DE AHORRO",
    "CONTROL DE BANKROLL",
    "DASHBOARD DE TRADING",
    "CONTROL DE PAYOUTS",
    "PATRIMONIO NETO",
    "FONDO DE EMERGENCIA",
    "OBJETIVOS",
    "GASTOS HORMIGA",
    "RANKING MEJORES MESES",
    "LIBERTAD FINANCIERA",
    "PROYECCIONES FUTURAS",
    "SCORE DEL TRADER",
]
for idx, name in enumerate(sheet_order):
    if name in wb.sheetnames:
        wb.move_sheet(name, offset=idx - wb.sheetnames.index(name))

# ══════════════════════════════════════════════════════════════════════════════
# Final polish
# ══════════════════════════════════════════════════════════════════════════════
for ws in wb.worksheets:
    ws.sheet_view.showGridLines = ws.title not in ["GUIA DE USO", "DASHBOARD EJECUTIVO", "PRESUPUESTO MENSUAL"]
    max_row = ws.max_row + 5
    max_col = ws.max_column + 2
    ws.print_area = f"A1:{get_column_letter(max_col)}{max_row}"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToPage = True
    ws.page_setup.fitToWidth = 1

# ══════════════════════════════════════════════════════════════════════════════
# Save
# ══════════════════════════════════════════════════════════════════════════════
output_path = "/home/user/jonatan/sistema_financiero.xlsx"
wb.save(output_path)
print(f"Archivo guardado: {output_path}")
print(f"Tamano: {os.path.getsize(output_path):,} bytes")
print(f"Hojas creadas: {len(wb.sheetnames)}")
for i, name in enumerate(wb.sheetnames):
    print(f"  {i:2d}. {name}")

# ══════════════════════════════════════════════════════════════════════════════
# Validation
# ══════════════════════════════════════════════════════════════════════════════
from openpyxl import load_workbook
import re

wb2 = load_workbook(output_path, data_only=False)
errors = []
for ws in wb2.worksheets:
    for row in ws.iter_rows():
        for cell in row:
            if cell.value and isinstance(cell.value, str):
                if cell.value.startswith('=') and any(ord(c) > 127 for c in cell.value):
                    errors.append(f"UNICODE IN FORMULA: {ws.title}!{cell.coordinate}: {cell.value[:60]}")
                if 'SUMIF(YEAR' in cell.value or 'SUMIF(MONTH' in cell.value or 'AVERAGEIF(YEAR' in cell.value:
                    errors.append(f"INVALID SUMIF: {ws.title}!{cell.coordinate}: {cell.value[:60]}")

if errors:
    print("\nERRORS FOUND:")
    for e in errors:
        print(f"  {e}")
else:
    print("\nNo formula errors detected")

print(f"File size: {os.path.getsize(output_path):,} bytes")
print(f"Sheets: {len(wb2.sheetnames)}")
print(f"Named styles: {wb2.style_names}")
