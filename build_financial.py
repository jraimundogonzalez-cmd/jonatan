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

# ── Hoja oculta de listas (dropdowns con mas de 255 chars) ────────────────────
ws_listas = wb.create_sheet(title="_LISTAS")
ws_listas.sheet_state = "hidden"

categorias = [
    "Nomina", "Trading/Payout", "Otro ingreso",
    "Vivienda/Alquiler", "Coche/Transporte", "Gasolina", "Parking",
    "Supermercado", "Restaurante", "Cafeteria/Bar",
    "Peluqueria/Estetica", "Farmacia/Salud", "Deporte/Gimnasio",
    "Ropa/Calzado", "Electronica/Amazon", "Hogar",
    "Ocio/Entretenimiento", "Viajes/Vacaciones",
    "Formacion/Suscripciones", "TraderLab", "Software/Apps",
    "Ahorro", "Bankroll", "Transferencia", "Otros",
]
for i, cat in enumerate(categorias, 1):
    ws_listas.cell(row=i, column=1, value=cat)

# Nombre definido que apunta al rango de categorias
from openpyxl.workbook.defined_name import DefinedName
cat_range = f"_LISTAS!$A$1:$A${len(categorias)}"
wb.defined_names["ListaCategorias"] = DefinedName("ListaCategorias", attr_text=cat_range)

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

# ── Helpers para formulas que leen REGISTRO DE MOVIMIENTOS ────────────────────
# Columnas del REGISTRO: A=Fecha  D=Tipo  E=Categoria  H=Importe
_RA = "'REGISTRO DE MOVIMIENTOS'!$A$3:$A$500"
_RD = "'REGISTRO DE MOVIMIENTOS'!$D$3:$D$500"
_RE = "'REGISTRO DE MOVIMIENTOS'!$E$3:$E$500"
_RH = "'REGISTRO DE MOVIMIENTOS'!$H$3:$H$500"

def reg_sum(tipo=None, cat=None, filtro_mes=True, anio=None):
    """Genera SUMPRODUCT sobre REGISTRO DE MOVIMIENTOS con filtros opcionales.
    filtro_mes=True  → filtra por el MES/AÑO del selector en PRESUPUESTO MENSUAL (B5/E5)
    anio=2026        → filtra por ese año fijo (para totales anuales)
    tipo="Gasto"/"Ingreso"  → filtra columna D (Tipo auto)
    cat="Supermercado"      → filtra columna E (Categoria)
    Devuelve string "=SUMPRODUCT(...)" listo para poner en celda Excel.
    """
    conds = [f"(ISNUMBER({_RA}))"]
    if filtro_mes:
        # Usa las celdas selector de PRESUPUESTO MENSUAL en vez de TODAY()
        # — permite cambiar el mes/año analizado sin tocar las formulas
        conds.append(f"(MONTH(IF(ISNUMBER({_RA}),{_RA},TODAY()))='PRESUPUESTO MENSUAL'!$B$5)")
        conds.append(f"(YEAR(IF(ISNUMBER({_RA}),{_RA},TODAY()))='PRESUPUESTO MENSUAL'!$E$5)")
    if anio:
        conds.append(f"(YEAR(IF(ISNUMBER({_RA}),{_RA},TODAY()))={anio})")
    if tipo:
        conds.append(f'({_RD}="{tipo}")')
    if cat:
        if isinstance(cat, list):
            sub = "+".join(f'({_RE}="{c}")' for c in cat)
            conds.append(f"(({sub})>0)")
        else:
            conds.append(f'({_RE}="{cat}")')
    return "=SUMPRODUCT(" + "*".join(conds) + f"*({_RH}))"

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
    ("COMPARATIVA MENSUAL",     "Tabla automatica mes a mes: ingresos, gastos y ahorro real enero-diciembre."),
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

headers2 = ["Fecha","Mes (auto)","Anio (auto)","Tipo (auto)","Categoria","Subcategoria","Descripcion","Importe","Metodo de Pago","Comentarios"]
for i, h in enumerate(headers2, 1):
    W(ws2, 2, i, h, "col_hdr")
ws2.row_dimensions[2].height = 20

# Pre-populate Mes, Anio y Tipo con formulas auto desde Fecha/Categoria (filas 3-300)
# El usuario solo introduce: Fecha, Categoria, Descripcion, Importe, Metodo de Pago
# Mes, Anio y Tipo (Ingreso/Gasto) se calculan solos
for fila in range(3, 501):
    sty = "alt_c" if fila % 2 == 0 else "data_c"
    c_mes  = ws2.cell(row=fila, column=2)
    c_anio = ws2.cell(row=fila, column=3)
    c_tipo = ws2.cell(row=fila, column=4)
    c_mes.value  = f'=IF(A{fila}="","",TEXT(A{fila},"MMMM"))'
    c_anio.value = f'=IF(A{fila}="","",YEAR(A{fila}))'
    c_tipo.value = (
        f'=IF(A{fila}="","",IF(OR(E{fila}="Nomina",E{fila}="Trading/Payout",'
        f'E{fila}="Otro ingreso"),"Ingreso","Gasto"))'
    )
    c_mes.style  = sty
    c_anio.style = sty
    c_tipo.style = sty

sample_movimientos = []  # Sin datos de ejemplo — el usuario rellena desde cero

# Data validations — Tipo ya es automatico, no necesita dropdown
dv_cat = DataValidation(type="list", formula1="ListaCategorias", allow_blank=True)
dv_cat.sqref = "E3:E1000"
ws2.add_data_validation(dv_cat)

metodos = "Efectivo,Tarjeta,Transferencia,Domiciliacion,Bizum"
dv_met = DataValidation(type="list", formula1=f'"{metodos}"', allow_blank=True)
dv_met.sqref = "I3:I1000"
ws2.add_data_validation(dv_met)

# Autofilter directo en la fila de cabecera (sin Table — tabla vacía causa error de reparación en Excel)
ws2.auto_filter.ref = "A2:J2"

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

# ── SELECTOR DE PERIODO (fila 5) — controla que mes/año muestra todo el sistema ──
# A5: etiqueta | B5: mes(1-12) input | C5: nombre mes+año | D5: etiqueta año | E5: año input
W(ws3, 5, 1, "PERIODO A ANALIZAR:", "bdata_l")
mes_input = W(ws3, 5, 2, 6, "input")         # B5 → numero de mes (1-12)
mes_input.number_format = "0"
c_sel_vis = ws3.cell(row=5, column=3,
    value='=TEXT(DATE($E$5,$B$5,1),"MMMM YYYY")')
c_sel_vis.style = "gold"
W(ws3, 5, 4, "Ano:", "bdata_l")
anio_input = W(ws3, 5, 5, 2026, "input")     # E5 → año
anio_input.number_format = "0"
cmt_sel = Comment(
    "Cambia B5 (mes 1-12) y E5 (anio) para ver los datos de cualquier mes.\n"
    "Ejemplo: B5=7, E5=2026 muestra julio 2026.\n"
    "Todo el seguimiento y dashboard se actualizan solos.",
    "Sistema")
mes_input.comment = cmt_sel
ws3.row_dimensions[5].height = 22

# DataValidation: mes solo acepta 1-12
dv_mes = DataValidation(type="whole", operator="between",
                        formula1="1", formula2="12", allow_blank=False)
dv_mes.error = "Introduce un numero entre 1 y 12"
dv_mes.errorTitle = "Mes invalido"
dv_mes.sqref = "B5"
ws3.add_data_validation(dv_mes)

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

# ── OPCION C: Importes fijos primero, caprichos sobre sobrante ──────────────
r += 1
merge_header(ws3, r, 1, r, 6, "DISTRIBUCION AUTOMATICA - SISTEMA INVERSOR (IMPORTES FIJOS)", "header")
r += 1
for col, h in enumerate(["Concepto","Importe fijo/mes","Importe","Objetivo anual","Descripcion"], 1):
    W(ws3, r, col, h, "col_hdr")
r += 1

# Ingreso disponible (base real despues de fijos)
disponible_base_row = r
W(ws3, r, 1, "Ingreso disponible (tras fijos)", "balt_l")
W(ws3, r, 3, f"=$D$3-C{total_fixed_row}", "alt_r", FMT_EUR)
W(ws3, r, 5, "Base real = Ingreso - Gastos fijos", "alt_l")
r += 1

# Bankroll — importe fijo editable (celda dorada)
row_bankroll = r
W(ws3, r, 1, "Bankroll (inversion trading)", "bdata_l")
bk_input = W(ws3, r, 2, 100.00, "input", FMT_EUR)
bk_input.comment = Comment("Importe fijo minimo para bankroll. Aumentalo en meses buenos.", "Sistema")
W(ws3, r, 3, f"=B{r}", "data_r", FMT_EUR)
W(ws3, r, 4, f"=B{r}*12", "data_r", FMT_EUR)
W(ws3, r, 5, "Fijo minimo garantizado cada mes", "data_l")
r += 1

# Ahorro — importe fijo editable (celda dorada)
row_ahorro = r
W(ws3, r, 1, "Ahorro (fondo personal)", "balt_l")
ah_input = W(ws3, r, 2, 100.00, "input", FMT_EUR)
ah_input.comment = Comment("Importe fijo minimo para ahorro. Aumentalo en meses buenos.", "Sistema")
W(ws3, r, 3, f"=B{r}", "alt_r", FMT_EUR)
W(ws3, r, 4, f"=B{r}*12", "alt_r", FMT_EUR)
W(ws3, r, 5, "Fijo minimo garantizado cada mes", "alt_l")
r += 1

# Caprichos — porcentaje sobre sobrante real
row_caprichos = r
W(ws3, r, 1, "Caprichos y ocio (% del sobrante)", "bdata_l")
cap_input = W(ws3, r, 2, 0.20, "input", FMT_PCT)
cap_input.comment = Comment("Porcentaje del sobrante real (despues de fijos + bankroll + ahorro).", "Sistema")
# Sobrante = D3 - fijos - bankroll - ahorro
W(ws3, r, 3, f"=MAX(0,($D$3-C{total_fixed_row}-B{row_bankroll}-B{row_ahorro})*B{r})", "data_r", FMT_EUR)
W(ws3, r, 4, f"=C{r}*12", "data_r", FMT_EUR)
W(ws3, r, 5, "20% del sobrante real del mes", "data_l")
r += 1

# Summary
r += 1
merge_header(ws3, r, 1, r, 6, "RESUMEN Y DISPONIBLE", "header")
r += 1
W(ws3, r, 1, "Concepto", "col_hdr")
W(ws3, r, 3, "Importe",  "col_hdr")
r += 1

summary_data = [
    ("Ingreso neto mensual",          "=$D$3"),
    ("(-) Total gastos fijos",        f"=-C{total_fixed_row}"),
    ("(-) Bankroll (fijo)",           f"=-C{row_bankroll}"),
    ("(-) Ahorro (fijo)",             f"=-C{row_ahorro}"),
    ("(-) Caprichos (% sobrante)",    f"=-C{row_caprichos}"),
]
sum_start = r
for i, (label, formula) in enumerate(summary_data):
    pfx = "alt_" if i % 2 == 0 else "data_"
    W(ws3, r, 1, label,   pfx + "l")
    W(ws3, r, 3, formula, pfx + "r", FMT_EUR)
    r += 1

# DISPONIBLE
disponible_row = r
W(ws3, r, 1, "DISPONIBLE RESTANTE (reserva flexible)", "gold_l")
W(ws3, r, 3, f"=SUM(C{sum_start}:C{r-1})", "gold_r", FMT_EUR)
r += 1
pct_gastado_row = r
W(ws3, r, 1, "% Gastado fijos / ingreso", "gold_l")
W(ws3, r, 3, f"=C{total_fixed_row}/$D$3", "gold_r", FMT_PCT)
r += 1
W(ws3, r, 1, "Total comprometido (fijos+BK+ahorro+cap)", "gold_l")
W(ws3, r, 3, f"=C{total_fixed_row}+C{row_bankroll}+C{row_ahorro}+C{row_caprichos}", "gold_r", FMT_EUR)
r += 1

# Alerta de umbral minimo
r += 1
merge_header(ws3, r, 1, r, 6, "ESTADO DEL PRESUPUESTO", "header")
r += 1

# Umbral minimo = fijos + bankroll_min + ahorro_min
W(ws3, r, 1, "Umbral minimo de ingreso:", "balt_l")
ws3.merge_cells(start_row=r, start_column=2, end_row=r, end_column=5)
c = ws3.cell(row=r, column=2,
    value=f'=TEXT(C{total_fixed_row}+B{row_bankroll}+B{row_ahorro},"#,##0.00")&" EUR (fijos + BK + ahorro)"')
c.style = "alt_l"
r += 1

W(ws3, r, 1, "Alerta de ingreso:", "balt_l")
ws3.merge_cells(start_row=r, start_column=2, end_row=r, end_column=5)
c = ws3.cell(row=r, column=2,
    value=f'=IF($D$3>=(C{total_fixed_row}+B{row_bankroll}+B{row_ahorro}),'
          f'"OK - Ingresos suficientes para cubrir todos los compromisos",'
          f'"ATENCION: Ingreso por debajo del umbral minimo - reduce BK o ahorro este mes")')
c.style = "alt_l"
r += 1

W(ws3, r, 1, "Disponible restante:", "balt_l")
ws3.merge_cells(start_row=r, start_column=2, end_row=r, end_column=5)
c = ws3.cell(row=r, column=2,
    value=f'=TEXT(C{disponible_row},"#,##0.00")&" EUR de reserva flexible este mes"')
c.style = "alt_l"
r += 1

W(ws3, r, 1, "Progreso gastos fijos:", "balt_l")
ws3.merge_cells(start_row=r, start_column=2, end_row=r, end_column=5)
c = ws3.cell(row=r, column=2,
    value=f'=TEXT(C{pct_gastado_row},"0.0%")&" del ingreso en gastos fijos"')
c.style = "alt_l"

# ─── SEGUIMIENTO REAL DEL MES ACTUAL ─────────────────────────────────────────
r += 2
merge_header(ws3, r, 1, r, 5,
    "SEGUIMIENTO REAL DEL MES ACTUAL  (actualizado automaticamente desde REGISTRO DE MOVIMIENTOS)",
    "header")
ws3.row_dimensions[r].height = 25
r += 1
merge_header(ws3, r, 1, r, 5,
    ">>> Las celdas DORADAS son editables: cambia el limite mensual de cada categoria <<<",
    "gold")
ws3.row_dimensions[r].height = 18
r += 1
for col, h in enumerate(["Categoria / Concepto", "Limite Mensual (edita doradas)", "Gastado Real (mes)", "Diferencia", "Estado"], 1):
    W(ws3, r, col, h, "col_hdr")
r += 1

# (categoria, limite_mensual, editable)
# editable=True  → celda dorada que el usuario edita a su gusto
# editable=False → referencia automatica al presupuesto fijo
seg_items_ws3 = [
    ("Vivienda/Alquiler",       f"=C{fixed_start}",    False),
    ("Coche/Transporte",        f"=C{fixed_start+1}",  False),
    ("Gasolina",                80.00,                  True),
    ("Supermercado",            200.00,                 True),
    ("Restaurante",             100.00,                 True),
    ("Cafeteria/Bar",           40.00,                  True),
    ("Ocio/Entretenimiento",    80.00,                  True),
    ("Ropa/Calzado",            60.00,                  True),
    ("Farmacia/Salud",          40.00,                  True),
    ("Deporte/Gimnasio",        f"=C{fixed_start+2}",  False),
    ("Formacion/Suscripciones", f"=C{fixed_start+3}",  False),
    ("Ahorro",                  f"=B{row_ahorro}",      False),
    ("Bankroll",                f"=B{row_bankroll}",    False),
    ("Otros",                   50.00,                  True),
]

seg_start_row = r
for i, (cat, presup, editable) in enumerate(seg_items_ws3):
    pfx = "alt_" if i % 2 == 0 else "data_"
    W(ws3, r, 1, cat, "b" + pfx + "l")
    # Limite: dorado si editable, referencia fija si no
    W(ws3, r, 2, presup, "input" if editable else (pfx + "r"), FMT_EUR)
    # Gastado real: suma por categoria (Tipo auto-rellena en REGISTRO)
    W(ws3, r, 3, reg_sum(cat=cat, filtro_mes=True), pfx + "r", FMT_EUR)
    W(ws3, r, 4, f"=B{r}-C{r}", pfx + "r", FMT_EUR)
    c5 = ws3.cell(row=r, column=5)
    c5.value = f'=IF(B{r}=0,"Sin limite",IF(C{r}<=B{r}*0.8,"OK",IF(C{r}<=B{r},"AVISO","EXCEDIDO")))'
    c5.style = pfx + "c"
    r += 1
seg_end_row = r - 1

# ── Semaforo de colores: verde / amarillo / rojo ──────────────────────────────
seg_range = f"A{seg_start_row}:E{seg_end_row}"
# Rojo: gasto supera el limite
ws3.conditional_formatting.add(seg_range, FormulaRule(
    formula=[f"AND($B{seg_start_row}>0,$C{seg_start_row}>$B{seg_start_row})"],
    fill=PatternFill("solid", fgColor="FFC7CE")
))
# Amarillo: entre 80% y 100% del limite
ws3.conditional_formatting.add(seg_range, FormulaRule(
    formula=[f"AND($B{seg_start_row}>0,$C{seg_start_row}>$B{seg_start_row}*0.8,$C{seg_start_row}<=$B{seg_start_row})"],
    fill=PatternFill("solid", fgColor="FFEB9C")
))
# Verde claro: gasto registrado y por debajo del 80% del limite
ws3.conditional_formatting.add(seg_range, FormulaRule(
    formula=[f"AND($B{seg_start_row}>0,$C{seg_start_row}>0,$C{seg_start_row}<=$B{seg_start_row}*0.8)"],
    fill=PatternFill("solid", fgColor="C6EFCE")
))

W(ws3, r, 1, "TOTAL GASTOS REALES DEL MES", "gold_l")
W(ws3, r, 3, reg_sum(tipo="Gasto", filtro_mes=True), "gold_r", FMT_EUR)
W(ws3, r, 4, f"=$D$3-C{r}", "gold_r", FMT_EUR)
W(ws3, r, 5, f'=IF(C{r}<=$D$3,"Dentro del ingreso","SUPERA EL INGRESO")', "gold_l")
total_real_row_ws3 = r
r += 1
W(ws3, r, 1, "TOTAL INGRESOS REGISTRADOS DEL MES", "balt_l")
W(ws3, r, 3, reg_sum(tipo="Ingreso", filtro_mes=True), "alt_r", FMT_EUR)
r += 1
W(ws3, r, 1, "% del presupuesto ejecutado (gastos / ingreso)", "balt_l")
W(ws3, r, 3, f"=IFERROR(C{total_real_row_ws3}/$D$3,0)", "alt_r", FMT_PCT)

# Conditional formatting on disponible_row (verde si >0, rojo si <0)
ws3.conditional_formatting.add(
    f"C{disponible_row}",
    CellIsRule(operator="greaterThan", formula=["0"],
               fill=PatternFill("solid", fgColor="C6EFCE"))
)
ws3.conditional_formatting.add(
    f"C{disponible_row}",
    CellIsRule(operator="lessThanOrEqual", formula=["0"],
               fill=PatternFill("solid", fgColor="FFC7CE"))
)
# Conditional formatting on pct_gastado_row
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

# Sin datos de ejemplo — el usuario rellena

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
r += 1

# ── Totales automaticos desde REGISTRO DE MOVIMIENTOS ────────────────────────
merge_header(ws4, r, 1, r, 6, "DESDE REGISTRO DE MOVIMIENTOS (automatico)", "subheader")
r += 1
W(ws4, r, 1, "Ahorro registrado este mes", "balt_l")
W(ws4, r, 2, reg_sum(tipo="Gasto", cat="Ahorro", filtro_mes=True), "alt_r", FMT_EUR)
W(ws4, r, 3, "Suma entradas Categoria=Ahorro del mes en curso", "alt_l")
r += 1
W(ws4, r, 1, "Ahorro registrado en 2026", "bdata_l")
W(ws4, r, 2, reg_sum(tipo="Gasto", cat="Ahorro", filtro_mes=False, anio=2026), "data_r", FMT_EUR)
W(ws4, r, 3, "Acumulado anual segun REGISTRO", "data_l")

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

# Sin datos de ejemplo — el usuario rellena

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
r += 1

# ── Totales automaticos desde REGISTRO DE MOVIMIENTOS ────────────────────────
merge_header(ws5, r, 1, r, 5, "DESDE REGISTRO DE MOVIMIENTOS (automatico)", "subheader")
r += 1
W(ws5, r, 1, "Bankroll registrado este mes", "balt_l")
W(ws5, r, 2, reg_sum(tipo="Gasto", cat="Bankroll", filtro_mes=True), "alt_r", FMT_EUR)
W(ws5, r, 3, "Suma entradas Categoria=Bankroll del mes en curso", "alt_l")
r += 1
W(ws5, r, 1, "Bankroll registrado en 2026", "bdata_l")
W(ws5, r, 2, reg_sum(tipo="Gasto", cat="Bankroll", filtro_mes=False, anio=2026), "data_r", FMT_EUR)
W(ws5, r, 3, "Acumulado anual segun REGISTRO", "data_l")

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

# Sin datos de ejemplo — el usuario rellena

ws6.conditional_formatting.add("C3:C1000",
    CellIsRule(operator="greaterThan", formula=["0"],
               fill=PatternFill("solid", fgColor="C6EFCE")))
ws6.conditional_formatting.add("C3:C1000",
    CellIsRule(operator="lessThan", formula=["0"],
               fill=PatternFill("solid", fgColor="FFC7CE")))

# Stats placed at row 502 so ranges B3:B500 / C3:C500 never overlap with summary rows
r = 502
merge_header(ws6, r, 1, r, 5, "ESTADISTICAS DE TRADING", "header")
r += 1

stats = [
    ("Beneficio mensual Jun 2026",
     "=SUMPRODUCT((ISNUMBER(A3:A500))*(MONTH(IF(ISNUMBER(A3:A500),A3:A500,TODAY()))=6)*(YEAR(IF(ISNUMBER(A3:A500),A3:A500,TODAY()))=2026)*(C3:C500))",
     FMT_EUR),
    ("Beneficio anual 2026",
     "=SUMPRODUCT((ISNUMBER(A3:A500))*(YEAR(IF(ISNUMBER(A3:A500),A3:A500,TODAY()))=2026)*(C3:C500))",
     FMT_EUR),
    ("Total payouts recibidos", "=SUM(D3:D500)", FMT_EUR),
    ("ROI (sobre bankroll inicial 200 EUR)", "=IFERROR(SUM(C3:C500)/200,0)", FMT_PCT),
    ("Mejor resultado individual", "=IFERROR(MAX(C3:C500),0)", FMT_EUR),
    ("Peor resultado individual",  "=IFERROR(MIN(C3:C500),0)", FMT_EUR),
    ("Beneficio acumulado total",  "=SUM(C3:C500)", FMT_EUR),
    ("Numero de entradas",         "=COUNTA(B3:B500)", FMT_INT),
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

# Sin datos de ejemplo — el usuario rellena

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
    ("Cuenta Bancaria Corriente", 0.00, "Saldo en cuenta corriente"),
    ("Fondo de Ahorro",           0.00, "Ahorro acumulado"),
    ("Bankroll Trading",          0.00, "Capital para trading"),
    ("Capital en Plataformas",    0.00, "Fondos en brokers/prop firms"),
    ("Otros Activos",             0.00, "Otros activos"),
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
# Sin datos de ejemplo — el usuario rellena el historial mensual

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
    ("Ahorro anual",       2400.00,
     reg_sum(tipo="Gasto", cat="Ahorro", filtro_mes=False, anio=2026)),
    ("Bankroll anual",     2400.00,
     reg_sum(tipo="Gasto", cat="Bankroll", filtro_mes=False, anio=2026)),
    ("Patrimonio anual",   5000.00,
     f"='PATRIMONIO NETO'!B{patrimonio_row}"),
    ("Beneficios trading", 4200.00,
     "=SUM('DASHBOARD DE TRADING'!C3:C500)"),
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

hormiga_data = []  # Sin datos de ejemplo

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

# Category summary — placed at row 502 so SUMIF(C3:C500) never overlaps with summary rows
r = 502
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
    W(ws11, r, 2, f"=SUMIF($C$3:$C$500,$A{r},$E$3:$E$500)", pfx + "r", FMT_EUR)
    W(ws11, r, 3, f"=B{r}/'PRESUPUESTO MENSUAL'!$D$3", pfx + "r", FMT_PCT)
    W(ws11, r, 4, "5% limite", pfx + "c")
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

# ── Seccion automatica desde REGISTRO DE MOVIMIENTOS ─────────────────────────
r_h = cat_start_row + len(cats_hormiga) + 3  # separacion limpia debajo del resumen manual
merge_header(ws11, r_h, 1, r_h, 5,
    "GASTOS DEL MES ACTUAL POR CATEGORIA  (automatico desde REGISTRO DE MOVIMIENTOS)",
    "subheader")
r_h += 1
for col, h in enumerate(["Categoria", "Mes Actual (EUR)", "% Ingreso", "Acumulado 2026 (EUR)", "Limite 5%"], 1):
    W(ws11, r_h, col, h, "col_hdr")
r_h += 1

reg_cats_h = [
    "Supermercado", "Restaurante", "Cafeteria/Bar",
    "Ocio/Entretenimiento", "Ropa/Calzado", "Electronica/Amazon",
    "Farmacia/Salud", "Peluqueria/Estetica", "Hogar",
    "Formacion/Suscripciones", "Software/Apps", "Otros",
]
for i, cat in enumerate(reg_cats_h):
    pfx = "alt_" if i % 2 == 0 else "data_"
    W(ws11, r_h, 1, cat, "b" + pfx + "l")
    W(ws11, r_h, 2, reg_sum(tipo="Gasto", cat=cat, filtro_mes=True),               pfx + "r", FMT_EUR)
    W(ws11, r_h, 3, f"=B{r_h}/'PRESUPUESTO MENSUAL'!$D$3",                         pfx + "r", FMT_PCT)
    W(ws11, r_h, 4, reg_sum(tipo="Gasto", cat=cat, filtro_mes=False, anio=2026),   pfx + "r", FMT_EUR)
    ws11.cell(row=r_h, column=5).value = f"=IF(B{r_h}>'PRESUPUESTO MENSUAL'!$D$3*0.05,\"EXCEDIDO\",\"OK\")"
    ws11.cell(row=r_h, column=5).style = pfx + "c"
    r_h += 1

W(ws11, r_h, 1, "TOTAL GASTOS VARIABLES DEL MES", "gold_l")
W(ws11, r_h, 2, reg_sum(tipo="Gasto", filtro_mes=True), "gold_r", FMT_EUR)
W(ws11, r_h, 3, f"=B{r_h}/'PRESUPUESTO MENSUAL'!$D$3", "gold_r", FMT_PCT)
W(ws11, r_h, 4, reg_sum(tipo="Gasto", filtro_mes=False, anio=2026), "gold_r", FMT_EUR)

ws11.freeze_panes = "A3"
for col, w in [(1,13),(2,10),(3,22),(4,28),(5,12),(6,12),(7,14)]:
    set_col_width(ws11, col, w)


# ══════════════════════════════════════════════════════════════════════════════
# SHEET: COMPARATIVA MENSUAL
# Resumen automatico mes a mes — sin tocar nada, se actualiza con el REGISTRO
# ══════════════════════════════════════════════════════════════════════════════
ws_comp = add_sheet(wb, "COMPARATIVA MENSUAL", "007BFF")

merge_header(ws_comp, 1, 1, 1, 15,
    "COMPARATIVA MENSUAL 2026 - EVOLUCION MES A MES (automatico desde REGISTRO DE MOVIMIENTOS)",
    "header")
ws_comp.row_dimensions[1].height = 30

merge_header(ws_comp, 2, 1, 2, 15,
    "Cada columna es un mes. Los datos se rellenan solos cuando introduces registros con la fecha correcta.",
    "gold")
ws_comp.row_dimensions[2].height = 18

MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
ANIO_COMP = 2026

# ── Cabecera de columnas ──────────────────────────────────────────────────────
W(ws_comp, 4, 1, "Categoria / Concepto", "col_hdr")
for m, mes in enumerate(MESES, 1):
    W(ws_comp, 4, m + 1, mes, "col_hdr")
W(ws_comp, 4, 14, "TOTAL 2026", "col_hdr")
W(ws_comp, 4, 15, "MEDIA/mes",  "col_hdr")
ws_comp.row_dimensions[4].height = 20

def sp_mes_cat(m, cat=None, tipo=None):
    """SUMPRODUCT filtrado por mes fijo y año ANIO_COMP."""
    conds = [f"(ISNUMBER({_RA}))"]
    conds.append(f"(MONTH(IF(ISNUMBER({_RA}),{_RA},TODAY()))={m})")
    conds.append(f"(YEAR(IF(ISNUMBER({_RA}),{_RA},TODAY()))={ANIO_COMP})")
    if tipo:
        conds.append(f'({_RD}="{tipo}")')
    if cat:
        conds.append(f'({_RE}="{cat}")')
    return "=SUMPRODUCT(" + "*".join(conds) + f"*({_RH}))"

# ── Sección 1: INGRESOS ───────────────────────────────────────────────────────
r = 5
merge_header(ws_comp, r, 1, r, 15, "INGRESOS", "green")
r += 1

ingreso_cats = ["Nomina", "Trading/Payout", "Otro ingreso"]
for cat in ingreso_cats:
    W(ws_comp, r, 1, cat, "data_l")
    for m in range(1, 13):
        W(ws_comp, r, m + 1, sp_mes_cat(m, cat=cat, tipo="Ingreso"), "data_r", FMT_EUR)
    W(ws_comp, r, 14, f"=SUM(B{r}:M{r})", "bold_r", FMT_EUR)
    W(ws_comp, r, 15, f"=IFERROR(N{r}/COUNTIF(B{r}:M{r},\">0\"),0)", "bold_r", FMT_EUR)
    r += 1

total_ing_row = r
W(ws_comp, r, 1, "TOTAL INGRESOS", "gold_l")
for m in range(1, 13):
    W(ws_comp, r, m + 1, sp_mes_cat(m, tipo="Ingreso"), "gold_r", FMT_EUR)
W(ws_comp, r, 14, f"=SUM(B{r}:M{r})", "gold_r", FMT_EUR)
W(ws_comp, r, 15, f"=IFERROR(N{r}/12,0)", "gold_r", FMT_EUR)
r += 2

# ── Sección 2: GASTOS FIJOS ───────────────────────────────────────────────────
merge_header(ws_comp, r, 1, r, 15, "GASTOS FIJOS (mensuales constantes)", "header")
r += 1

gastos_fijos_cats = [
    "Vivienda/Alquiler", "Coche/Transporte", "Gasolina",
    "Deporte/Gimnasio", "Formacion/Suscripciones",
]
for cat in gastos_fijos_cats:
    pfx = "alt_" if r % 2 == 0 else "data_"
    W(ws_comp, r, 1, cat, pfx + "l")
    for m in range(1, 13):
        W(ws_comp, r, m + 1, sp_mes_cat(m, cat=cat), pfx + "r", FMT_EUR)
    W(ws_comp, r, 14, f"=SUM(B{r}:M{r})", "b" + pfx + "r", FMT_EUR)
    W(ws_comp, r, 15, f"=IFERROR(N{r}/COUNTIF(B{r}:M{r},\">0\"),0)", "b" + pfx + "r", FMT_EUR)
    r += 1

total_fijos_row = r
W(ws_comp, r, 1, "TOTAL GASTOS FIJOS", "gold_l")
for m in range(1, 13):
    col_letter = chr(ord('B') + m - 1)
    W(ws_comp, r, m + 1,
      f"=SUM({col_letter}{total_fijos_row-len(gastos_fijos_cats)}:{col_letter}{total_fijos_row-1})",
      "gold_r", FMT_EUR)
W(ws_comp, r, 14, f"=SUM(B{r}:M{r})", "gold_r", FMT_EUR)
W(ws_comp, r, 15, f"=IFERROR(N{r}/12,0)", "gold_r", FMT_EUR)
r += 2

# ── Sección 3: GASTOS VARIABLES ───────────────────────────────────────────────
merge_header(ws_comp, r, 1, r, 15, "GASTOS VARIABLES (lo que gastas de mas)", "header")
r += 1

gastos_var_cats = [
    "Supermercado", "Restaurante", "Cafeteria/Bar",
    "Ocio/Entretenimiento", "Ropa/Calzado", "Farmacia/Salud",
    "Peluqueria/Estetica", "Electronica/Amazon", "Hogar",
    "Software/Apps", "Viajes/Vacaciones", "Otros",
]
for cat in gastos_var_cats:
    pfx = "alt_" if r % 2 == 0 else "data_"
    W(ws_comp, r, 1, cat, pfx + "l")
    for m in range(1, 13):
        W(ws_comp, r, m + 1, sp_mes_cat(m, cat=cat), pfx + "r", FMT_EUR)
    W(ws_comp, r, 14, f"=SUM(B{r}:M{r})", "b" + pfx + "r", FMT_EUR)
    W(ws_comp, r, 15, f"=IFERROR(N{r}/COUNTIF(B{r}:M{r},\">0\"),0)", "b" + pfx + "r", FMT_EUR)
    r += 1

total_var_row = r
W(ws_comp, r, 1, "TOTAL GASTOS VARIABLES", "gold_l")
for m in range(1, 13):
    col_letter = chr(ord('B') + m - 1)
    W(ws_comp, r, m + 1,
      f"=SUM({col_letter}{total_var_row-len(gastos_var_cats)}:{col_letter}{total_var_row-1})",
      "gold_r", FMT_EUR)
W(ws_comp, r, 14, f"=SUM(B{r}:M{r})", "gold_r", FMT_EUR)
W(ws_comp, r, 15, f"=IFERROR(N{r}/12,0)", "gold_r", FMT_EUR)
r += 2

# ── Sección 4: INVERSION (Ahorro + Bankroll) ──────────────────────────────────
merge_header(ws_comp, r, 1, r, 15, "INVERSION Y AHORRO", "subheader")
r += 1

for cat in ["Ahorro", "Bankroll", "TraderLab"]:
    pfx = "alt_" if r % 2 == 0 else "data_"
    W(ws_comp, r, 1, cat, pfx + "l")
    for m in range(1, 13):
        W(ws_comp, r, m + 1, sp_mes_cat(m, cat=cat), pfx + "r", FMT_EUR)
    W(ws_comp, r, 14, f"=SUM(B{r}:M{r})", "b" + pfx + "r", FMT_EUR)
    W(ws_comp, r, 15, f"=IFERROR(N{r}/COUNTIF(B{r}:M{r},\">0\"),0)", "b" + pfx + "r", FMT_EUR)
    r += 1

r += 1

# ── Fila resumen: TOTAL GASTOS y AHORRO REAL ──────────────────────────────────
merge_header(ws_comp, r, 1, r, 15, "RESUMEN FINAL POR MES", "subheader")
r += 1

W(ws_comp, r, 1, "TOTAL GASTOS DEL MES", "bdata_l")
for m in range(1, 13):
    W(ws_comp, r, m + 1, sp_mes_cat(m, tipo="Gasto"), "data_r", FMT_EUR)
W(ws_comp, r, 14, f"=SUM(B{r}:M{r})", "bold_r", FMT_EUR)
W(ws_comp, r, 15, f"=IFERROR(N{r}/12,0)", "bold_r", FMT_EUR)
total_gastos_comp_row = r
r += 1

W(ws_comp, r, 1, "TOTAL INGRESOS DEL MES", "balt_l")
for m in range(1, 13):
    W(ws_comp, r, m + 1, sp_mes_cat(m, tipo="Ingreso"), "alt_r", FMT_EUR)
W(ws_comp, r, 14, f"=SUM(B{r}:M{r})", "balt_r", FMT_EUR)
W(ws_comp, r, 15, f"=IFERROR(N{r}/12,0)", "balt_r", FMT_EUR)
total_ing_comp_row = r
r += 1

W(ws_comp, r, 1, "AHORRO REAL (Ingresos - Gastos)", "gold_l")
for m in range(1, 13):
    col_letter = chr(ord('B') + m - 1)
    W(ws_comp, r, m + 1, f"={col_letter}{total_ing_comp_row}-{col_letter}{total_gastos_comp_row}", "gold_r", FMT_EUR)
W(ws_comp, r, 14, f"=SUM(B{r}:M{r})", "gold_r", FMT_EUR)
W(ws_comp, r, 15, f"=IFERROR(N{r}/12,0)", "gold_r", FMT_EUR)
ahorro_real_row = r
r += 1

W(ws_comp, r, 1, "% Ahorro real / Ingresos", "balt_l")
for m in range(1, 13):
    col_letter = chr(ord('B') + m - 1)
    W(ws_comp, r, m + 1,
      f"=IFERROR({col_letter}{ahorro_real_row}/{col_letter}{total_ing_comp_row},0)",
      "alt_r", FMT_PCT)
W(ws_comp, r, 14, f"=IFERROR(N{ahorro_real_row}/N{total_ing_comp_row},0)", "alt_r", FMT_PCT)
W(ws_comp, r, 15, f"=IFERROR(AVERAGE(B{r}:M{r}),0)", "alt_r", FMT_PCT)
pct_ahorro_row = r

# ── Formato condicional: verde si ahorro>0, rojo si <0 ───────────────────────
ws_comp.conditional_formatting.add(
    f"B{ahorro_real_row}:M{ahorro_real_row}",
    CellIsRule(operator="greaterThan", formula=["0"],
               fill=PatternFill("solid", fgColor="C6EFCE"))
)
ws_comp.conditional_formatting.add(
    f"B{ahorro_real_row}:M{ahorro_real_row}",
    CellIsRule(operator="lessThanOrEqual", formula=["0"],
               fill=PatternFill("solid", fgColor="FFC7CE"))
)

# ── Grafico de barras apiladas: ingresos vs gastos vs ahorro ──────────────────
chart_comp = BarChart()
chart_comp.type = "col"
chart_comp.grouping = "clustered"
chart_comp.style = 10
chart_comp.title = "Ingresos vs Gastos por Mes 2026"
chart_comp.y_axis.title = "EUR"
chart_comp.width = 28
chart_comp.height = 14

ref_ingresos = Reference(ws_comp, min_col=2, max_col=13,
                         min_row=total_ing_comp_row, max_row=total_ing_comp_row)
ref_gastos   = Reference(ws_comp, min_col=2, max_col=13,
                         min_row=total_gastos_comp_row, max_row=total_gastos_comp_row)
ref_ahorro   = Reference(ws_comp, min_col=2, max_col=13,
                         min_row=ahorro_real_row, max_row=ahorro_real_row)
ref_meses    = Reference(ws_comp, min_col=2, max_col=13, min_row=4, max_row=4)

chart_comp.add_data(ref_ingresos)
chart_comp.add_data(ref_gastos)
chart_comp.add_data(ref_ahorro)
chart_comp.set_categories(ref_meses)
from openpyxl.chart.series import SeriesLabel
chart_comp.series[0].title = SeriesLabel(v="Ingresos")
chart_comp.series[1].title = SeriesLabel(v="Gastos")
chart_comp.series[2].title = SeriesLabel(v="Ahorro Real")
chart_comp.series[0].graphicalProperties.solidFill = "28A745"
chart_comp.series[1].graphicalProperties.solidFill = "DC3545"
chart_comp.series[2].graphicalProperties.solidFill = "007BFF"
ws_comp.add_chart(chart_comp, f"A{r + 3}")

ws_comp.freeze_panes = "B5"
for col, w in [(1, 26)] + [(i, 10) for i in range(2, 14)] + [(14, 12), (15, 11)]:
    set_col_width(ws_comp, col, w)
ws_comp.sheet_view.showGridLines = False

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
        W(ws12, 5+ri, col_start+1, "-", sty)
        W(ws12, 5+ri, col_start+2, 0.00, sty, FMT_EUR)

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
    ("Beneficio medio mensual trading (editar)",
     "=IFERROR(SUM('DASHBOARD DE TRADING'!C3:C500)/MAX(1,COUNTA('DASHBOARD DE TRADING'!A3:A500)),0)",
     FMT_EUR),
    ("% Cobertura actual",                       "=B4/B3", FMT_PCT),
    ("Meses con datos de trading",               0,         FMT_INT),
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
    achieved = False  # Sin datos reales aun
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
    ("Ingreso medio mensual neto",         2000.00, FMT_EUR),
    ("Ahorro fijo mensual (editar)",        100.00,  FMT_EUR),
    ("Bankroll fijo mensual (editar)",      100.00,  FMT_EUR),
    ("Beneficio medio mensual trading",     0.00,    FMT_EUR),
    ("Rentabilidad anual inversion %",      0.05,    FMT_PCT),
]
input_rows = {}
for label, val, fmt in inputs14:
    W(ws14, r, 1, label, "balt_l")
    W(ws14, r, 2, val,   "input", fmt)
    input_rows[label] = r
    r += 1

ing_r  = input_rows["Ingreso medio mensual neto"]
ah_r   = input_rows["Ahorro fijo mensual (editar)"]
bk_r   = input_rows["Bankroll fijo mensual (editar)"]
trd_r  = input_rows["Beneficio medio mensual trading"]

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
    W(ws14, r, 2, f"=$B${ah_r}*12*{yr}",          pfx + "r", FMT_EUR)
    W(ws14, r, 3, f"=$B${bk_r}*12*{yr}",           pfx + "r", FMT_EUR)
    W(ws14, r, 4, f"=B{r}+C{r}",                   pfx + "r", FMT_EUR)
    W(ws14, r, 5, f"=$B${trd_r}*12*{yr}",          pfx + "r", FMT_EUR)
    W(ws14, r, 6, f"=IFERROR($B${trd_r}/1575,0)",  pfx + "r", FMT_PCT)
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
    ("Cumplimiento Ahorro",   "20 pts", "Actualiza con % cumplimiento ahorro",   0),
    ("Cumplimiento Bankroll", "20 pts", "Actualiza con % cumplimiento bankroll", 0),
    ("Control de Gastos",     "20 pts", "Actualiza segun control de gastos",     0),
    ("Crecimiento Patrimonio","20 pts", "Actualiza con crecimiento patrimonio",  0),
    ("Resultados Trading",    "20 pts", "Actualiza con resultados de trading",   0),
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
    (3, 4,  "Gastos Reales (mes actual)",
     reg_sum(tipo="Gasto", filtro_mes=True),
     FMT_EUR),
    (5, 6,  "Flujo de Caja (mes actual)",
     f"='PRESUPUESTO MENSUAL'!$D$3-({reg_sum(tipo='Gasto', filtro_mes=True)[1:]})",
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
    (1, 2,  "Benef. Trading (mes actual)",
     "=SUMPRODUCT((ISNUMBER('DASHBOARD DE TRADING'!A3:A500))*(MONTH(IF(ISNUMBER('DASHBOARD DE TRADING'!A3:A500),'DASHBOARD DE TRADING'!A3:A500,TODAY()))=MONTH(TODAY()))*(YEAR(IF(ISNUMBER('DASHBOARD DE TRADING'!A3:A500),'DASHBOARD DE TRADING'!A3:A500,TODAY()))=YEAR(TODAY()))*('DASHBOARD DE TRADING'!C3:C500))",
     FMT_EUR),
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
    ("Gastos Fijos",                          f"='PRESUPUESTO MENSUAL'!$C${total_fixed_row}"),
    ("Bankroll (fijo)",                       f"='PRESUPUESTO MENSUAL'!$C${row_bankroll}"),
    ("Ahorro (fijo)",                         f"='PRESUPUESTO MENSUAL'!$C${row_ahorro}"),
    ("Caprichos",                             f"='PRESUPUESTO MENSUAL'!$C${row_caprichos}"),
    ("DISPONIBLE",                            f"='PRESUPUESTO MENSUAL'!$C${disponible_row}"),
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
merge_header(ws1, r, 1, r, 12, "GASTOS POR CATEGORIA DEL MES ACTUAL (desde REGISTRO)", "subheader")
ws1.row_dimensions[r].height = 22
r += 1
dash_cats = [
    "Vivienda/Alquiler", "Coche/Transporte", "Gasolina",
    "Supermercado", "Restaurante", "Cafeteria/Bar",
    "Ocio/Entretenimiento", "Ropa/Calzado", "Farmacia/Salud",
    "Formacion/Suscripciones", "Ahorro", "Bankroll",
]
cols_per_row = 6
for idx, cat in enumerate(dash_cats):
    col_pair_idx = idx % cols_per_row
    col_start = col_pair_idx * 2 + 1
    col_end   = col_start + 1
    if col_pair_idx == 0 and idx > 0:
        r += 3
    ws1.merge_cells(start_row=r, start_column=col_start, end_row=r, end_column=col_end)
    c_t = ws1.cell(row=r, column=col_start, value=cat)
    c_t.style = "header_sm"
    ws1.merge_cells(start_row=r+1, start_column=col_start, end_row=r+2, end_column=col_end)
    c_v = ws1.cell(row=r+1, column=col_start,
                   value=reg_sum(tipo="Gasto", cat=cat, filtro_mes=True))
    c_v.style = "data_c"
    c_v.number_format = FMT_EUR
    ws1.row_dimensions[r].height   = 18
    ws1.row_dimensions[r+1].height = 28
    ws1.row_dimensions[r+2].height = 12
r += 3

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
    "COMPARATIVA MENSUAL",
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
