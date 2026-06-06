#!/usr/bin/env python3
"""Sistema Financiero Personal/Profesional en Excel"""

from openpyxl import Workbook
from openpyxl.styles import (
    PatternFill, Font, Alignment, Border, Side, GradientFill
)
from openpyxl.utils import get_column_letter, column_index_from_string
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import ColorScaleRule, CellIsRule, FormulaRule
from openpyxl.chart import BarChart, LineChart, PieChart, AreaChart, Reference
from openpyxl.chart.series import DataPoint
from openpyxl.worksheet.dimensions import ColumnDimension
from datetime import date, datetime
import os

# ── Color palette ──────────────────────────────────────────────────────────────
NAVY   = "1F2D3D"
GOLD   = "F5A623"
WHITE  = "FFFFFF"
LGRAY  = "F8F9FA"
DGRAY  = "DEE2E6"
GREEN  = "28A745"
YELLOW = "FFC107"
RED    = "DC3545"
BLUE   = "007BFF"
ORANGE = "FD7E14"
TEAL   = "20C997"

# ── Style helpers ──────────────────────────────────────────────────────────────
def fill(hex_color):
    return PatternFill("solid", fgColor=hex_color)

def font(bold=False, color=WHITE, size=11, italic=False):
    return Font(bold=bold, color=color, size=size, italic=italic, name="Calibri")

def center():
    return Alignment(horizontal="center", vertical="center", wrap_text=True)

def left():
    return Alignment(horizontal="left", vertical="center", wrap_text=True)

def right():
    return Alignment(horizontal="right", vertical="center")

def thin_border():
    s = Side(style="thin", color=DGRAY)
    return Border(left=s, right=s, top=s, bottom=s)

def header_style(ws, row, col, text, bg=NAVY, fg=WHITE, bold=True, size=11, colspan=1, align="center"):
    cell = ws.cell(row=row, column=col, value=text)
    cell.fill = fill(bg)
    cell.font = font(bold=bold, color=fg, size=size)
    cell.alignment = center() if align == "center" else left()
    cell.border = thin_border()
    return cell

def data_cell(ws, row, col, value=None, bg=WHITE, fg="212529", bold=False,
              fmt=None, align="left"):
    cell = ws.cell(row=row, column=col, value=value)
    cell.fill = fill(bg)
    cell.font = Font(bold=bold, color=fg, size=10, name="Calibri")
    cell.alignment = center() if align == "center" else (right() if align == "right" else left())
    cell.border = thin_border()
    if fmt:
        cell.number_format = fmt
    return cell

def euro_fmt():
    return '#,##0.00 €'

def pct_fmt():
    return '0.00%'

def date_fmt():
    return 'DD/MM/YYYY'

def set_col_width(ws, col, width):
    ws.column_dimensions[get_column_letter(col)].width = width

def freeze(ws, cell="A2"):
    ws.freeze_panes = cell

def alt_row(row_idx):
    return LGRAY if row_idx % 2 == 0 else WHITE

# ── Workbook setup ─────────────────────────────────────────────────────────────
wb = Workbook()
wb.remove(wb.active)  # remove default sheet

def add_sheet(wb, title, tab_color=NAVY):
    ws = wb.create_sheet(title=title)
    ws.sheet_properties.tabColor = tab_color
    return ws

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 0: GUÍA DE USO
# ══════════════════════════════════════════════════════════════════════════════
ws0 = add_sheet(wb, "GUÍA DE USO", GOLD)

# Title
ws0.merge_cells("A1:H1")
c = ws0["A1"]
c.value = "📋 GUÍA DE USO — SISTEMA FINANCIERO PERSONAL"
c.fill = fill(NAVY)
c.font = Font(bold=True, color=GOLD, size=16, name="Calibri")
c.alignment = center()
ws0.row_dimensions[1].height = 35

ws0.merge_cells("A2:H2")
c = ws0["A2"]
c.value = "Sistema diseñado para el control integral de tus finanzas personales y profesionales | Inicio: Junio 2026"
c.fill = fill(GOLD)
c.font = Font(bold=True, color=NAVY, size=11, name="Calibri")
c.alignment = center()
ws0.row_dimensions[2].height = 22

sheets_info = [
    ("DASHBOARD EJECUTIVO", "Panel principal con todos los KPIs financieros. Actualiza automáticamente con los datos de las demás hojas."),
    ("REGISTRO DE MOVIMIENTOS", "Registra TODOS tus ingresos y gastos aquí. Es la hoja más importante. Usa los desplegables para categorizar."),
    ("PRESUPUESTO MENSUAL", "Define tu presupuesto mensual. Introduce el ingreso neto y el sistema calcula automáticamente las distribuciones."),
    ("CONTROL DE AHORRO", "Registra tus aportaciones al ahorro mensual. El gráfico muestra la evolución acumulada."),
    ("CONTROL DE BANKROLL", "Registra las aportaciones al bankroll de trading (10% del ingreso mensual)."),
    ("DASHBOARD DE TRADING", "Registra resultados de trading. Calcula ROI, mejor/peor mes y evolución acumulada."),
    ("CONTROL DE PAYOUTS", "Registra los pagos recibidos de plataformas de trading. Controla cobros pendientes."),
    ("PATRIMONIO NETO", "Calcula tu patrimonio neto (Activos - Pasivos). Actualiza mensualmente para ver evolución."),
    ("FONDO DE EMERGENCIA", "Controla el progreso hacia tu fondo de emergencia objetivo (6-12 meses de gastos fijos)."),
    ("OBJETIVOS", "Define y sigue el progreso de tus objetivos financieros anuales."),
    ("GASTOS HORMIGA", "Registra gastos pequeños recurrentes. Detecta fugas de dinero por categoría."),
    ("RANKING MEJORES MESES", "Ranking automático de mejores meses. Se actualiza solo al registrar datos."),
    ("LIBERTAD FINANCIERA", "Mide el porcentaje de cobertura de gastos con ingresos de trading."),
    ("PROYECCIONES FUTURAS", "Proyecciones a 1, 3 y 5 años basadas en tus parámetros actuales."),
    ("SCORE DEL TRADER", "Puntuación 0-100 que evalúa tu desempeño financiero integral."),
]

# Headers
row = 4
for col, txt in [(1,"Hoja"), (2,"Descripción y uso")]:
    cell = ws0.cell(row=row, column=col, value=txt)
    cell.fill = fill(NAVY)
    cell.font = Font(bold=True, color=WHITE, size=11, name="Calibri")
    cell.alignment = center()
    cell.border = thin_border()
ws0.row_dimensions[row].height = 20

row = 5
for i, (name, desc) in enumerate(sheets_info):
    bg = LGRAY if i % 2 == 0 else WHITE
    c1 = ws0.cell(row=row, column=1, value=name)
    c1.fill = fill(bg); c1.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
    c1.alignment = left(); c1.border = thin_border()
    c2 = ws0.cell(row=row, column=2, value=desc)
    c2.fill = fill(bg); c2.font = Font(color="212529", size=10, name="Calibri")
    c2.alignment = left(); c2.border = thin_border()
    ws0.row_dimensions[row].height = 35
    row += 1

# Legend
row += 1
ws0.merge_cells(f"A{row}:H{row}")
c = ws0.cell(row=row, column=1, value="LEYENDA DE COLORES")
c.fill = fill(NAVY); c.font = Font(bold=True, color=GOLD, size=12, name="Calibri")
c.alignment = center(); ws0.row_dimensions[row].height = 22
row += 1

legend = [
    (GREEN, WHITE, "VERDE → Indicador positivo / objetivo cumplido / dentro de presupuesto"),
    (YELLOW, NAVY, "AMARILLO → Atención / cerca del límite / entre 50-75% del objetivo"),
    (RED, WHITE, "ROJO → Alerta / presupuesto excedido / objetivo no alcanzado"),
    (NAVY, WHITE, "AZUL OSCURO → Cabeceras de tablas y secciones principales"),
    (GOLD, NAVY, "DORADO → Subtítulos, totales y valores destacados"),
    (LGRAY, NAVY, "GRIS CLARO → Filas alternas para mejor legibilidad"),
]
for hex_bg, hex_fg, txt in legend:
    ws0.merge_cells(f"A{row}:H{row}")
    c = ws0.cell(row=row, column=1, value=txt)
    c.fill = fill(hex_bg); c.font = Font(bold=True, color=hex_fg, size=10, name="Calibri")
    c.alignment = left(); c.border = thin_border()
    ws0.row_dimensions[row].height = 22
    row += 1

# Config info
row += 1
ws0.merge_cells(f"A{row}:H{row}")
c = ws0.cell(row=row, column=1, value="CONFIGURACIÓN INICIAL DEL SISTEMA")
c.fill = fill(NAVY); c.font = Font(bold=True, color=GOLD, size=12, name="Calibri")
c.alignment = center(); ws0.row_dimensions[row].height = 22
row += 1

config_data = [
    ("Ingreso neto mensual de referencia:", "2.000 €  (rango: 1.500 € – 2.500 €)"),
    ("Gastos fijos mensuales:", "1.575 € (Piso 1.000 + Coche 450 + Gimnasio 25 + TraderLab 100)"),
    ("Bankroll (10% ingreso):", "200 € / mes"),
    ("Ahorro (10% ingreso):", "200 € / mes"),
    ("Caprichos (5% ingreso):", "100 € / mes"),
    ("Inicio del sistema:", "Junio 2026"),
    ("Moneda:", "Euro (€)"),
]
for label, val in config_data:
    bg = LGRAY if row % 2 == 0 else WHITE
    c1 = ws0.cell(row=row, column=1, value=label)
    c1.fill = fill(bg); c1.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
    c1.alignment = left(); c1.border = thin_border()
    c2 = ws0.cell(row=row, column=2, value=val)
    c2.fill = fill(bg); c2.font = Font(color="212529", size=10, name="Calibri")
    c2.alignment = left(); c2.border = thin_border()
    ws0.row_dimensions[row].height = 22
    row += 1

set_col_width(ws0, 1, 38)
set_col_width(ws0, 2, 80)
ws0.sheet_view.showGridLines = False

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 2: REGISTRO DE MOVIMIENTOS (created first for references)
# ══════════════════════════════════════════════════════════════════════════════
ws2 = add_sheet(wb, "REGISTRO DE MOVIMIENTOS", "808080")

ws2.merge_cells("A1:J1")
c = ws2["A1"]
c.value = "REGISTRO DE MOVIMIENTOS — SISTEMA FINANCIERO 2026"
c.fill = fill(NAVY); c.font = Font(bold=True, color=GOLD, size=14, name="Calibri")
c.alignment = center(); ws2.row_dimensions[1].height = 30

headers2 = ["Fecha","Mes","Año","Tipo","Categoría","Subcategoría","Descripción","Importe","Método de Pago","Comentarios"]
for i, h in enumerate(headers2, 1):
    cell = ws2.cell(row=2, column=i, value=h)
    cell.fill = fill(NAVY); cell.font = Font(bold=True, color=WHITE, size=10, name="Calibri")
    cell.alignment = center(); cell.border = thin_border()
ws2.row_dimensions[2].height = 20

sample_movimientos = [
    (date(2026,6,1), "Junio", 2026, "Ingreso", "Nómina", "Salario neto", "Salario neto junio 2026", 2000.00, "Transferencia", "Ingreso mensual regular"),
    (date(2026,6,1), "Junio", 2026, "Gasto", "Vivienda", "Alquiler", "Piso alquiler junio", 1000.00, "Transferencia", "Gasto fijo"),
    (date(2026,6,1), "Junio", 2026, "Gasto", "Transporte", "Coche", "Cuota coche junio", 450.00, "Domiciliación", "Gasto fijo"),
    (date(2026,6,1), "Junio", 2026, "Gasto", "Salud/Deporte", "Gimnasio", "Cuota gimnasio junio", 25.00, "Domiciliación", "Gasto fijo"),
    (date(2026,6,1), "Junio", 2026, "Gasto", "Formación", "TraderLab", "Suscripción TraderLab junio", 100.00, "Tarjeta", "Gasto fijo"),
    (date(2026,6,5), "Junio", 2026, "Gasto", "Alimentación", "Supermercado", "Compra semanal Mercadona", 85.50, "Tarjeta", ""),
    (date(2026,6,10), "Junio", 2026, "Gasto", "Restaurantes", "Comida fuera", "Restaurante con familia", 35.00, "Tarjeta", "Gasto capricho"),
    (date(2026,6,15), "Junio", 2026, "Ingreso", "Trading", "Payout", "Payout FTMO junio", 350.00, "Transferencia", "Beneficios trading"),
    (date(2026,6,20), "Junio", 2026, "Gasto", "Ahorro", "Ahorro mensual", "Aportación ahorro junio", 200.00, "Transferencia", "10% ingreso mensual"),
    (date(2026,6,20), "Junio", 2026, "Gasto", "Inversión", "Bankroll", "Aportación bankroll junio", 200.00, "Transferencia", "10% ingreso mensual"),
]

for i, row_data in enumerate(sample_movimientos, 3):
    bg = LGRAY if i % 2 == 0 else WHITE
    for j, val in enumerate(row_data, 1):
        cell = ws2.cell(row=i, column=j, value=val)
        cell.fill = fill(bg)
        cell.font = Font(color="212529", size=10, name="Calibri")
        cell.alignment = center() if j in [1,2,3,4,9] else left()
        cell.border = thin_border()
        if j == 1:
            cell.number_format = date_fmt()
        if j == 8:
            cell.number_format = euro_fmt()
            cell.alignment = right()

# Data validations
dv_tipo = DataValidation(type="list", formula1='"Ingreso,Gasto"', allow_blank=False)
dv_tipo.sqref = "D3:D1000"
dv_tipo.error = "Selecciona Ingreso o Gasto"
dv_tipo.errorTitle = "Valor no válido"
ws2.add_data_validation(dv_tipo)

cats = "Nómina,Vivienda,Transporte,Salud/Deporte,Formación,Alimentación,Restaurantes,Trading,Ahorro,Inversión,Ocio,Suscripciones,Amazon,Compras,Otros"
dv_cat = DataValidation(type="list", formula1=f'"{cats}"', allow_blank=True)
dv_cat.sqref = "E3:E1000"
ws2.add_data_validation(dv_cat)

metodos = "Efectivo,Tarjeta,Transferencia,Domiciliación,Bizum"
dv_met = DataValidation(type="list", formula1=f'"{metodos}"', allow_blank=True)
dv_met.sqref = "I3:I1000"
ws2.add_data_validation(dv_met)

# Table
table2 = Table(displayName="Movimientos", ref=f"A2:J{len(sample_movimientos)+2}")
ts2 = TableStyleInfo(name="TableStyleMedium2", showFirstColumn=False,
                     showLastColumn=False, showRowStripes=True, showColumnStripes=False)
table2.tableStyleInfo = ts2
ws2.add_table(table2)


freeze(ws2, "A3")
widths2 = [13,10,6,10,18,18,35,14,18,30]
for i, w in enumerate(widths2, 1):
    set_col_width(ws2, i, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 3: PRESUPUESTO MENSUAL
# ══════════════════════════════════════════════════════════════════════════════
ws3 = add_sheet(wb, "PRESUPUESTO MENSUAL", "808080")

ws3.merge_cells("A1:F1")
c = ws3["A1"]
c.value = "PRESUPUESTO MENSUAL — JUNIO 2026"
c.fill = fill(NAVY); c.font = Font(bold=True, color=GOLD, size=14, name="Calibri")
c.alignment = center(); ws3.row_dimensions[1].height = 30

# Income input
row = 3
ws3.merge_cells(f"A{row}:C{row}")
c = ws3.cell(row=row, column=1, value="INGRESO NETO MENSUAL (edita esta celda):")
c.fill = fill(NAVY); c.font = Font(bold=True, color=WHITE, size=11, name="Calibri")
c.alignment = left()

income_cell = ws3.cell(row=row, column=4, value=2000.00)
income_cell.fill = fill(GOLD)
income_cell.font = Font(bold=True, color=NAVY, size=12, name="Calibri")
income_cell.number_format = euro_fmt()
income_cell.alignment = right()
income_cell.border = Border(
    left=Side(style="medium", color=NAVY),
    right=Side(style="medium", color=NAVY),
    top=Side(style="medium", color=NAVY),
    bottom=Side(style="medium", color=NAVY)
)
ws3.row_dimensions[row].height = 25

# Section: Gastos fijos
row = 5
ws3.merge_cells(f"A{row}:F{row}")
c = ws3.cell(row=row, column=1, value="GASTOS FIJOS MENSUALES")
c.fill = fill(NAVY); c.font = Font(bold=True, color=WHITE, size=11, name="Calibri")
c.alignment = center()

row += 1
for col, h in [(1,"Concepto"),(2,"Categoría"),(3,"Importe"),(4,"% Ingreso"),(5,"Estado")]:
    cell = ws3.cell(row=row, column=col, value=h)
    cell.fill = fill(DGRAY); cell.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
    cell.alignment = center(); cell.border = thin_border()

fixed_expenses = [
    ("Piso", "Vivienda", 1000.00),
    ("Coche", "Transporte", 450.00),
    ("Gimnasio", "Salud/Deporte", 25.00),
    ("TraderLab", "Formación", 100.00),
]

row_start_fixed = row + 1
for i, (name, cat, amt) in enumerate(fixed_expenses):
    row += 1
    bg = LGRAY if i % 2 == 0 else WHITE
    data_cell(ws3, row, 1, name, bg)
    data_cell(ws3, row, 2, cat, bg)
    c3 = data_cell(ws3, row, 3, amt, bg, fmt=euro_fmt(), align="right")
    c4 = ws3.cell(row=row, column=4, value=f"=C{row}/$D$3")
    c4.fill = fill(bg); c4.font = Font(color="212529", size=10, name="Calibri")
    c4.number_format = pct_fmt(); c4.alignment = right(); c4.border = thin_border()
    c5 = ws3.cell(row=row, column=5, value="Fijo")
    c5.fill = fill(bg); c5.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
    c5.alignment = center(); c5.border = thin_border()

row += 1
# Total fijos
for col in [1,2]:
    c = ws3.cell(row=row, column=col, value="" if col==2 else "TOTAL GASTOS FIJOS")
    c.fill = fill(GOLD); c.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
    c.alignment = left() if col==1 else center(); c.border = thin_border()
c3 = ws3.cell(row=row, column=3, value=f"=SUM(C{row_start_fixed}:C{row-1})")
c3.fill = fill(GOLD); c3.font = Font(bold=True, color=NAVY, size=11, name="Calibri")
c3.number_format = euro_fmt(); c3.alignment = right(); c3.border = thin_border()
c4 = ws3.cell(row=row, column=4, value=f"=C{row}/$D$3")
c4.fill = fill(GOLD); c4.font = Font(bold=True, color=NAVY, size=11, name="Calibri")
c4.number_format = pct_fmt(); c4.alignment = right(); c4.border = thin_border()
total_fixed_row = row

# Section: distribución automática
row += 2
ws3.merge_cells(f"A{row}:F{row}")
c = ws3.cell(row=row, column=1, value="DISTRIBUCIÓN AUTOMÁTICA (% INGRESO)")
c.fill = fill(NAVY); c.font = Font(bold=True, color=WHITE, size=11, name="Calibri")
c.alignment = center()

row += 1
for col, h in [(1,"Concepto"),(2,"% Aplicado"),(3,"Importe"),(4,"Objetivo anual"),(5,"Descripción")]:
    cell = ws3.cell(row=row, column=col, value=h)
    cell.fill = fill(DGRAY); cell.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
    cell.alignment = center(); cell.border = thin_border()

auto_dist = [
    ("Bankroll", 0.10, "10% para capital de trading"),
    ("Ahorro", 0.10, "10% para fondo de ahorro"),
    ("Caprichos", 0.05, "5% para gastos personales"),
]
row_bankroll = row + 1
row_ahorro = row + 2
row_caprichos = row + 3
for i, (name, pct, desc) in enumerate(auto_dist):
    row += 1
    bg = LGRAY if i % 2 == 0 else WHITE
    data_cell(ws3, row, 1, name, bg, bold=True)
    c2 = ws3.cell(row=row, column=2, value=pct)
    c2.fill = fill(bg); c2.font = Font(color="212529", size=10, name="Calibri")
    c2.number_format = pct_fmt(); c2.alignment = center(); c2.border = thin_border()
    c3 = ws3.cell(row=row, column=3, value=f"=$D$3*B{row}")
    c3.fill = fill(bg); c3.font = Font(color="212529", size=10, name="Calibri")
    c3.number_format = euro_fmt(); c3.alignment = right(); c3.border = thin_border()
    c4 = ws3.cell(row=row, column=4, value=f"=$D$3*B{row}*12")
    c4.fill = fill(bg); c4.font = Font(color="212529", size=10, name="Calibri")
    c4.number_format = euro_fmt(); c4.alignment = right(); c4.border = thin_border()
    data_cell(ws3, row, 5, desc, bg)

# Summary
row += 2
ws3.merge_cells(f"A{row}:F{row}")
c = ws3.cell(row=row, column=1, value="RESUMEN Y DISPONIBLE")
c.fill = fill(NAVY); c.font = Font(bold=True, color=WHITE, size=11, name="Calibri")
c.alignment = center()

summary_data = [
    ("Ingreso neto mensual", "=$D$3", euro_fmt()),
    ("(-) Total gastos fijos", f"=-C{total_fixed_row}", euro_fmt()),
    ("(-) Bankroll (10%)", f"=-C{row_bankroll}", euro_fmt()),
    ("(-) Ahorro (10%)", f"=-C{row_ahorro}", euro_fmt()),
    ("(-) Caprichos (5%)", f"=-C{row_caprichos}", euro_fmt()),
    ("DISPONIBLE RESTANTE", None, euro_fmt()),
    ("% Gastado (fijos/ingreso)", None, pct_fmt()),
    ("Desviación vs presupuesto", None, euro_fmt()),
]

row += 1
sum_rows = []
for col, h in [(1,"Concepto"),(3,"Importe")]:
    cell = ws3.cell(row=row, column=col, value=h)
    cell.fill = fill(DGRAY); cell.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
    cell.alignment = center(); cell.border = thin_border()

first_sum_row = row + 1
for i, (label, formula, fmt) in enumerate(summary_data):
    row += 1
    bg = LGRAY if i % 2 == 0 else WHITE
    bold = i >= 5
    c1 = ws3.cell(row=row, column=1, value=label)
    c1.fill = fill(GOLD if bold else bg)
    c1.font = Font(bold=bold, color=NAVY if bold else "212529", size=10, name="Calibri")
    c1.alignment = left(); c1.border = thin_border()
    if i == 5:  # Disponible
        formula = f"=SUM(C{first_sum_row}:C{row-1})"
        disponible_row = row
    elif i == 6:  # % gastado
        formula = f"=C{total_fixed_row}/$D$3"
        pct_gastado_row = row
    elif i == 7:  # Desviación
        formula = f"=$D$3-C{total_fixed_row}"
    c3 = ws3.cell(row=row, column=3, value=formula)
    c3.fill = fill(GOLD if bold else bg)
    c3.font = Font(bold=bold, color=NAVY if bold else "212529", size=10, name="Calibri")
    c3.number_format = fmt; c3.alignment = right(); c3.border = thin_border()
    sum_rows.append(row)

# Conditional formatting for % gastado
ws3.conditional_formatting.add(
    f"C{pct_gastado_row}",
    CellIsRule(operator="greaterThan", formula=["1"], fill=fill(RED))
)
ws3.conditional_formatting.add(
    f"C{pct_gastado_row}",
    CellIsRule(operator="between", formula=["0.9","1"], fill=fill(YELLOW))
)
ws3.conditional_formatting.add(
    f"C{pct_gastado_row}",
    CellIsRule(operator="lessThanOrEqual", formula=["0.9"], fill=fill(GREEN))
)

# Progress bar simulation
row += 2
ws3.merge_cells(f"A{row}:F{row}")
c = ws3.cell(row=row, column=1, value="BARRA DE PROGRESO PRESUPUESTO")
c.fill = fill(NAVY); c.font = Font(bold=True, color=WHITE, size=11, name="Calibri")
c.alignment = center()

row += 1
data_cell(ws3, row, 1, "Progreso gastos fijos:", LGRAY, bold=True)
c2 = ws3.cell(row=row, column=2, value=f'=REPT("█",ROUND(C{pct_gastado_row}*10,0))&REPT("░",10-ROUND(C{pct_gastado_row}*10,0))&" "&TEXT(C{pct_gastado_row},"0%")')
c2.fill = fill(LGRAY); c2.font = Font(color=NAVY, size=11, name="Calibri")
c2.alignment = left(); c2.border = thin_border()

freeze(ws3, "A2")
for col, w in [(1,35),(2,15),(3,16),(4,16),(5,35)]:
    set_col_width(ws3, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 4: CONTROL DE AHORRO
# ══════════════════════════════════════════════════════════════════════════════
ws4 = add_sheet(wb, "CONTROL DE AHORRO", "20C997")

ws4.merge_cells("A1:F1")
c = ws4["A1"]
c.value = "CONTROL DE AHORRO — EVOLUCIÓN ACUMULADA"
c.fill = fill(NAVY); c.font = Font(bold=True, color=GOLD, size=14, name="Calibri")
c.alignment = center(); ws4.row_dimensions[1].height = 30

headers4 = ["Fecha","Mes","Año","Cantidad (€)","Acumulado (€)","Tasa Ahorro %"]
for i, h in enumerate(headers4, 1):
    cell = ws4.cell(row=2, column=i, value=h)
    cell.fill = fill(NAVY); cell.font = Font(bold=True, color=WHITE, size=10, name="Calibri")
    cell.alignment = center(); cell.border = thin_border()

sample_ahorro = [
    (date(2026,6,20), "Junio", 2026, 200.00, 2000.00),
]

for i, row_data in enumerate(sample_ahorro, 3):
    bg = LGRAY if i % 2 == 0 else WHITE
    vals = list(row_data)
    for j, val in enumerate(vals, 1):
        cell = ws4.cell(row=i, column=j, value=val)
        cell.fill = fill(bg); cell.font = Font(color="212529", size=10, name="Calibri")
        cell.alignment = center() if j <= 3 else right()
        cell.border = thin_border()
        if j == 1: cell.number_format = date_fmt()
        if j in [4,5]: cell.number_format = euro_fmt()
    # Tasa ahorro
    cell = ws4.cell(row=i, column=6, value=f"=D{i}/200*0.10")
    cell.fill = fill(bg); cell.font = Font(color="212529", size=10, name="Calibri")
    cell.number_format = pct_fmt(); cell.alignment = right(); cell.border = thin_border()

# Summary
row = 6
ws4.merge_cells(f"A{row}:F{row}")
c = ws4.cell(row=row, column=1, value="RESUMEN ANUAL 2026")
c.fill = fill(NAVY); c.font = Font(bold=True, color=WHITE, size=11, name="Calibri")
c.alignment = center()
row += 1

summary4 = [
    ("Total ahorrado año 2026", f"=SUMIF(C3:C1000,2026,D3:D1000)"),
    ("Ahorro mensual medio", f"=IFERROR(AVERAGEIF(C3:C1000,2026,D3:D1000),0)"),
    ("Capital acumulado total", f"=MAX(E3:E1000)"),
    ("Objetivo anual (10% x 12)", 2400.00),
    ("% Cumplimiento", f"=IFERROR(B{row+2}/B{row+3},0)"),
]
for i, (label, val) in enumerate(summary4):
    bg = LGRAY if i % 2 == 0 else WHITE
    c1 = ws4.cell(row=row, column=1, value=label)
    c1.fill = fill(bg); c1.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
    c1.alignment = left(); c1.border = thin_border()
    c2 = ws4.cell(row=row, column=2, value=val)
    c2.fill = fill(bg); c2.font = Font(color="212529", size=10, name="Calibri")
    c2.number_format = pct_fmt() if i == 4 else euro_fmt()
    c2.alignment = right(); c2.border = thin_border()
    row += 1

# Chart
chart4 = LineChart()
chart4.title = "Evolución del Ahorro Acumulado"
chart4.style = 10
chart4.y_axis.title = "€"
chart4.x_axis.title = "Mes"
chart4.width = 20; chart4.height = 12

data_ref = Reference(ws4, min_col=5, min_row=2, max_row=12)
chart4.add_data(data_ref, titles_from_data=True)
chart4.series[0].graphicalProperties.line.solidFill = TEAL
chart4.series[0].graphicalProperties.line.width = 25000

ws4.add_chart(chart4, "H2")

freeze(ws4, "A3")
for col, w in [(1,13),(2,10),(3,6),(4,15),(5,15),(6,15)]:
    set_col_width(ws4, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 5: CONTROL DE BANKROLL
# ══════════════════════════════════════════════════════════════════════════════
ws5 = add_sheet(wb, "CONTROL DE BANKROLL", ORANGE)

ws5.merge_cells("A1:E1")
c = ws5["A1"]
c.value = "CONTROL DE BANKROLL — CAPITAL DE TRADING"
c.fill = fill(NAVY); c.font = Font(bold=True, color=GOLD, size=14, name="Calibri")
c.alignment = center(); ws5.row_dimensions[1].height = 30

headers5 = ["Fecha","Mes","Año","Aporte (€)","Capital Acumulado (€)"]
for i, h in enumerate(headers5, 1):
    cell = ws5.cell(row=2, column=i, value=h)
    cell.fill = fill(NAVY); cell.font = Font(bold=True, color=WHITE, size=10, name="Calibri")
    cell.alignment = center(); cell.border = thin_border()

ws5.cell(row=3, column=1, value=date(2026,6,20)).number_format = date_fmt()
ws5.cell(row=3, column=2, value="Junio")
ws5.cell(row=3, column=3, value=2026)
ws5.cell(row=3, column=4, value=200.00).number_format = euro_fmt()
ws5.cell(row=3, column=5, value=200.00).number_format = euro_fmt()
for col in range(1,6):
    cell = ws5.cell(row=3, column=col)
    cell.fill = fill(LGRAY)
    cell.font = Font(color="212529", size=10, name="Calibri")
    cell.alignment = center() if col <= 3 else right()
    cell.border = thin_border()

# Summary
row = 5
for label, val in [("Total bankroll aportado 2026", "=SUMIF(C3:C1000,2026,D3:D1000)"),
                   ("Capital acumulado total", "=MAX(E3:E1000)"),
                   ("Objetivo anual", 2400.00),
                   ("% Cumplimiento", "=IFERROR(B6/B7,0)")]:
    c1 = ws5.cell(row=row, column=1, value=label)
    c1.fill = fill(LGRAY if row%2==0 else WHITE)
    c1.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
    c1.alignment = left(); c1.border = thin_border()
    c2 = ws5.cell(row=row, column=2, value=val)
    c2.fill = fill(LGRAY if row%2==0 else WHITE)
    c2.font = Font(color="212529", size=10, name="Calibri")
    c2.number_format = pct_fmt() if "IFERROR" in str(val) else euro_fmt()
    c2.alignment = right(); c2.border = thin_border()
    row += 1

# Bar chart
chart5 = BarChart()
chart5.type = "col"; chart5.style = 10
chart5.title = "Evolución del Bankroll"
chart5.y_axis.title = "€"; chart5.x_axis.title = "Mes"
chart5.width = 20; chart5.height = 12
data_ref5 = Reference(ws5, min_col=5, min_row=2, max_row=12)
chart5.add_data(data_ref5, titles_from_data=True)
ws5.add_chart(chart5, "G2")

freeze(ws5, "A3")
for col, w in [(1,13),(2,10),(3,6),(4,15),(5,18)]:
    set_col_width(ws5, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 6: DASHBOARD DE TRADING
# ══════════════════════════════════════════════════════════════════════════════
ws6 = add_sheet(wb, "DASHBOARD DE TRADING", ORANGE)

ws6.merge_cells("A1:E1")
c = ws6["A1"]
c.value = "DASHBOARD DE TRADING — RESULTADOS Y ANÁLISIS"
c.fill = fill(NAVY); c.font = Font(bold=True, color=GOLD, size=14, name="Calibri")
c.alignment = center(); ws6.row_dimensions[1].height = 30

headers6 = ["Fecha","Cuenta / Plataforma","Beneficio/Pérdida (€)","Payout Recibido (€)","Observaciones"]
for i, h in enumerate(headers6, 1):
    cell = ws6.cell(row=2, column=i, value=h)
    cell.fill = fill(NAVY); cell.font = Font(bold=True, color=WHITE, size=10, name="Calibri")
    cell.alignment = center(); cell.border = thin_border()

trading_data = [
    (date(2026,6,15), "FTMO", 350.00, 350.00, "Cuenta 10K - challenge superado"),
]
for i, row_data in enumerate(trading_data, 3):
    bg = LGRAY
    for j, val in enumerate(row_data, 1):
        cell = ws6.cell(row=i, column=j, value=val)
        cell.fill = fill(bg); cell.font = Font(color="212529", size=10, name="Calibri")
        cell.alignment = center() if j <= 2 else (right() if j in [3,4] else left())
        cell.border = thin_border()
        if j == 1: cell.number_format = date_fmt()
        if j in [3,4]: cell.number_format = euro_fmt()

# Conditional formatting: green if profit, red if loss
ws6.conditional_formatting.add(
    "C3:C1000",
    CellIsRule(operator="greaterThan", formula=["0"], fill=fill("C6EFCE"))
)
ws6.conditional_formatting.add(
    "C3:C1000",
    CellIsRule(operator="lessThan", formula=["0"], fill=fill("FFC7CE"))
)

# Summary
row = 5
ws6.merge_cells(f"A{row}:E{row}")
c = ws6.cell(row=row, column=1, value="ESTADÍSTICAS DE TRADING")
c.fill = fill(NAVY); c.font = Font(bold=True, color=WHITE, size=11, name="Calibri")
c.alignment = center()
row += 1

stats = [
    ("Beneficio mensual (Jun 2026)", "=SUMPRODUCT((ISNUMBER(A3:A1000))*(MONTH(IF(ISNUMBER(A3:A1000),A3:A1000,1))=6)*(YEAR(IF(ISNUMBER(A3:A1000),A3:A1000,1))=2026)*(C3:C1000))"),
    ("Beneficio anual 2026", "=SUMPRODUCT((ISNUMBER(A3:A1000))*(YEAR(IF(ISNUMBER(A3:A1000),A3:A1000,1))=2026)*(C3:C1000))"),
    ("Total payouts recibidos", "=SUM(D3:D1000)"),
    ("ROI % (sobre bankroll 2.000€)", "=IFERROR(SUM(C3:C1000)/2000,0)"),
    ("Mejor mes (max beneficio)", "=IFERROR(MAX(C3:C1000),0)"),
    ("Peor mes (max pérdida)", "=IFERROR(MIN(C3:C1000),0)"),
    ("Beneficio acumulado total", "=SUM(C3:C1000)"),
    ("Número de operaciones", "=COUNTA(B3:B1000)"),
]

for i, (label, val) in enumerate(stats):
    bg = LGRAY if i % 2 == 0 else WHITE
    c1 = ws6.cell(row=row, column=1, value=label)
    c1.fill = fill(bg); c1.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
    c1.alignment = left(); c1.border = thin_border()
    c2 = ws6.cell(row=row, column=2, value=val)
    c2.fill = fill(bg); c2.font = Font(color="212529", size=10, name="Calibri")
    c2.number_format = pct_fmt() if "ROI" in label else euro_fmt()
    c2.alignment = right(); c2.border = thin_border()
    row += 1

# Chart
chart6 = BarChart()
chart6.type = "col"; chart6.style = 10
chart6.title = "Resultados Mensuales Trading (€)"
chart6.y_axis.title = "€"; chart6.x_axis.title = "Operación"
chart6.width = 20; chart6.height = 12
data_ref6 = Reference(ws6, min_col=3, min_row=2, max_row=12)
chart6.add_data(data_ref6, titles_from_data=True)
ws6.add_chart(chart6, "G2")

freeze(ws6, "A3")
for col, w in [(1,13),(2,22),(3,20),(4,20),(5,35)]:
    set_col_width(ws6, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 7: CONTROL DE PAYOUTS
# ══════════════════════════════════════════════════════════════════════════════
ws7 = add_sheet(wb, "CONTROL DE PAYOUTS", ORANGE)

ws7.merge_cells("A1:E1")
c = ws7["A1"]
c.value = "CONTROL DE PAYOUTS — INGRESOS DE TRADING"
c.fill = fill(NAVY); c.font = Font(bold=True, color=GOLD, size=14, name="Calibri")
c.alignment = center(); ws7.row_dimensions[1].height = 30

headers7 = ["Fecha","Empresa / Plataforma","Importe (€)","Estado","Observaciones"]
for i, h in enumerate(headers7, 1):
    cell = ws7.cell(row=2, column=i, value=h)
    cell.fill = fill(NAVY); cell.font = Font(bold=True, color=WHITE, size=10, name="Calibri")
    cell.alignment = center(); cell.border = thin_border()

payout_data = [
    (date(2026,6,15), "FTMO", 350.00, "Cobrado", "Payout junio 2026"),
    (date(2026,7,1),  "FTMO", 400.00, "Pendiente", "Payout julio 2026 - estimado"),
]
for i, row_data in enumerate(payout_data, 3):
    bg = LGRAY if i % 2 == 0 else WHITE
    for j, val in enumerate(row_data, 1):
        cell = ws7.cell(row=i, column=j, value=val)
        cell.fill = fill(bg); cell.font = Font(color="212529", size=10, name="Calibri")
        cell.alignment = center() if j in [1,2,4] else (right() if j==3 else left())
        cell.border = thin_border()
        if j == 1: cell.number_format = date_fmt()
        if j == 3: cell.number_format = euro_fmt()

# Conditional formatting Estado
ws7.conditional_formatting.add(
    "D3:D1000",
    FormulaRule(formula=['D3="Cobrado"'], fill=fill("C6EFCE"))
)
ws7.conditional_formatting.add(
    "D3:D1000",
    FormulaRule(formula=['D3="Pendiente"'], fill=fill("FFEB9C"))
)

dv_estado = DataValidation(type="list", formula1='"Cobrado,Pendiente,Cancelado"', allow_blank=True)
dv_estado.sqref = "D3:D1000"
ws7.add_data_validation(dv_estado)

# Summary
row = 6
for label, val in [
    ("Total cobrado", '=SUMIF(D3:D1000,"Cobrado",C3:C1000)'),
    ("Total pendiente", '=SUMIF(D3:D1000,"Pendiente",C3:C1000)'),
    ("Total anual 2026", "=SUMPRODUCT((ISNUMBER(A3:A1000))*(YEAR(IF(ISNUMBER(A3:A1000),A3:A1000,1))=2026)*(C3:C1000))"),
    ("Total histórico", "=SUM(C3:C1000)"),
]:
    c1 = ws7.cell(row=row, column=1, value=label)
    c1.fill = fill(LGRAY if row%2==0 else WHITE)
    c1.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
    c1.alignment = left(); c1.border = thin_border()
    c2 = ws7.cell(row=row, column=2, value=val)
    c2.fill = fill(LGRAY if row%2==0 else WHITE)
    c2.font = Font(color="212529", size=10, name="Calibri")
    c2.number_format = euro_fmt(); c2.alignment = right(); c2.border = thin_border()
    row += 1

# Chart
chart7 = BarChart()
chart7.type = "col"; chart7.style = 10
chart7.title = "Payouts por Mes"
chart7.y_axis.title = "€"
chart7.width = 18; chart7.height = 12
data_ref7 = Reference(ws7, min_col=3, min_row=2, max_row=12)
chart7.add_data(data_ref7, titles_from_data=True)
ws7.add_chart(chart7, "G2")

freeze(ws7, "A3")
for col, w in [(1,13),(2,22),(3,16),(4,14),(5,35)]:
    set_col_width(ws7, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 8: PATRIMONIO NETO
# ══════════════════════════════════════════════════════════════════════════════
ws8 = add_sheet(wb, "PATRIMONIO NETO", "20C997")

ws8.merge_cells("A1:D1")
c = ws8["A1"]
c.value = "PATRIMONIO NETO — ACTIVOS Y PASIVOS"
c.fill = fill(NAVY); c.font = Font(bold=True, color=GOLD, size=14, name="Calibri")
c.alignment = center(); ws8.row_dimensions[1].height = 30

# ACTIVOS
row = 3
ws8.merge_cells(f"A{row}:D{row}")
c = ws8.cell(row=row, column=1, value="ACTIVOS")
c.fill = fill(GREEN); c.font = Font(bold=True, color=WHITE, size=12, name="Calibri")
c.alignment = center()
row += 1

for col, h in [(1,"Concepto"),(2,"Valor Actual (€)"),(3,"Notas")]:
    cell = ws8.cell(row=row, column=col, value=h)
    cell.fill = fill(DGRAY); cell.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
    cell.alignment = center(); cell.border = thin_border()
row += 1

activos = [
    ("Cuenta Bancaria Corriente", 500.00, "Saldo en cuenta corriente"),
    ("Fondo de Ahorro", 2000.00, "Ahorro acumulado"),
    ("Bankroll Trading", 200.00, "Capital para trading"),
    ("Capital en Plataformas Trading", 0.00, "Fondos en brokers/prop firms"),
    ("Otros Activos", 0.00, "Otros activos"),
]
activos_start = row
for i, (name, val, note) in enumerate(activos):
    bg = LGRAY if i % 2 == 0 else WHITE
    data_cell(ws8, row, 1, name, bg)
    c2 = data_cell(ws8, row, 2, val, bg, fmt=euro_fmt(), align="right")
    data_cell(ws8, row, 3, note, bg)
    row += 1

activos_end = row - 1
total_activos_row = row
c1 = ws8.cell(row=row, column=1, value="TOTAL ACTIVOS")
c1.fill = fill(GREEN); c1.font = Font(bold=True, color=WHITE, size=11, name="Calibri")
c1.alignment = left(); c1.border = thin_border()
c2 = ws8.cell(row=row, column=2, value=f"=SUM(B{activos_start}:B{activos_end})")
c2.fill = fill(GREEN); c2.font = Font(bold=True, color=WHITE, size=11, name="Calibri")
c2.number_format = euro_fmt(); c2.alignment = right(); c2.border = thin_border()

# PASIVOS
row += 2
ws8.merge_cells(f"A{row}:D{row}")
c = ws8.cell(row=row, column=1, value="PASIVOS / DEUDAS")
c.fill = fill(RED); c.font = Font(bold=True, color=WHITE, size=12, name="Calibri")
c.alignment = center()
row += 1

for col, h in [(1,"Concepto"),(2,"Valor Actual (€)"),(3,"Notas")]:
    cell = ws8.cell(row=row, column=col, value=h)
    cell.fill = fill(DGRAY); cell.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
    cell.alignment = center(); cell.border = thin_border()
row += 1

pasivos = [
    ("Deudas personales", 0.00, ""),
    ("Financiaciones pendientes", 0.00, ""),
    ("Otros pasivos", 0.00, ""),
]
pasivos_start = row
for i, (name, val, note) in enumerate(pasivos):
    bg = LGRAY if i % 2 == 0 else WHITE
    data_cell(ws8, row, 1, name, bg)
    data_cell(ws8, row, 2, val, bg, fmt=euro_fmt(), align="right")
    data_cell(ws8, row, 3, note, bg)
    row += 1

pasivos_end = row - 1
total_pasivos_row = row
c1 = ws8.cell(row=row, column=1, value="TOTAL PASIVOS")
c1.fill = fill(RED); c1.font = Font(bold=True, color=WHITE, size=11, name="Calibri")
c1.alignment = left(); c1.border = thin_border()
c2 = ws8.cell(row=row, column=2, value=f"=SUM(B{pasivos_start}:B{pasivos_end})")
c2.fill = fill(RED); c2.font = Font(bold=True, color=WHITE, size=11, name="Calibri")
c2.number_format = euro_fmt(); c2.alignment = right(); c2.border = thin_border()

# PATRIMONIO NETO
row += 2
ws8.merge_cells(f"A{row}:D{row}")
c = ws8.cell(row=row, column=1, value="PATRIMONIO NETO")
c.fill = fill(NAVY); c.font = Font(bold=True, color=GOLD, size=13, name="Calibri")
c.alignment = center()
patrimonio_neto_row = row + 1
row += 1
c1 = ws8.cell(row=row, column=1, value="PATRIMONIO NETO = Activos - Pasivos")
c1.fill = fill(GOLD); c1.font = Font(bold=True, color=NAVY, size=12, name="Calibri")
c1.alignment = left(); c1.border = thin_border()
c2 = ws8.cell(row=row, column=2, value=f"=B{total_activos_row}-B{total_pasivos_row}")
c2.fill = fill(GOLD); c2.font = Font(bold=True, color=NAVY, size=12, name="Calibri")
c2.number_format = euro_fmt(); c2.alignment = right(); c2.border = thin_border()

# Historical evolution
row += 2
ws8.merge_cells(f"A{row}:D{row}")
c = ws8.cell(row=row, column=1, value="EVOLUCIÓN HISTÓRICA DEL PATRIMONIO")
c.fill = fill(NAVY); c.font = Font(bold=True, color=WHITE, size=11, name="Calibri")
c.alignment = center()
row += 1

for col, h in [(1,"Mes"),(2,"Activos (€)"),(3,"Pasivos (€)"),(4,"Patrimonio Neto (€)")]:
    cell = ws8.cell(row=row, column=col, value=h)
    cell.fill = fill(DGRAY); cell.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
    cell.alignment = center(); cell.border = thin_border()
row += 1

hist_start = row
history_data = [
    ("Junio 2026", 2700.00, 0.00),
]
for i, (mes, act, pas) in enumerate(history_data):
    bg = LGRAY if i % 2 == 0 else WHITE
    data_cell(ws8, row, 1, mes, bg)
    data_cell(ws8, row, 2, act, bg, fmt=euro_fmt(), align="right")
    data_cell(ws8, row, 3, pas, bg, fmt=euro_fmt(), align="right")
    c4 = ws8.cell(row=row, column=4, value=f"=B{row}-C{row}")
    c4.fill = fill(bg); c4.font = Font(color="212529", size=10, name="Calibri")
    c4.number_format = euro_fmt(); c4.alignment = right(); c4.border = thin_border()
    row += 1

# Area chart
chart8 = AreaChart()
chart8.title = "Evolución del Patrimonio Neto"
chart8.style = 10
chart8.y_axis.title = "€"; chart8.x_axis.title = "Mes"
chart8.width = 20; chart8.height = 12
data_ref8 = Reference(ws8, min_col=4, min_row=hist_start-1, max_row=hist_start+5)
chart8.add_data(data_ref8, titles_from_data=True)
ws8.add_chart(chart8, "F2")

freeze(ws8, "A2")
for col, w in [(1,30),(2,18),(3,18),(4,22)]:
    set_col_width(ws8, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 9: FONDO DE EMERGENCIA
# ══════════════════════════════════════════════════════════════════════════════
ws9 = add_sheet(wb, "FONDO DE EMERGENCIA", "20C997")

ws9.merge_cells("A1:D1")
c = ws9["A1"]
c.value = "FONDO DE EMERGENCIA — COBERTURA FINANCIERA"
c.fill = fill(NAVY); c.font = Font(bold=True, color=GOLD, size=14, name="Calibri")
c.alignment = center(); ws9.row_dimensions[1].height = 30

row = 3
info_data = [
    ("Gastos fijos mensuales", 1575.00, euro_fmt()),
    ("Objetivo 3 meses", 1575*3, euro_fmt()),
    ("Objetivo 6 meses (recomendado)", 1575*6, euro_fmt()),
    ("Objetivo 12 meses (óptimo)", 1575*12, euro_fmt()),
]

for label, val, fmt in info_data:
    c1 = ws9.cell(row=row, column=1, value=label)
    c1.fill = fill(LGRAY if row%2==0 else WHITE)
    c1.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
    c1.alignment = left(); c1.border = thin_border()
    c2 = ws9.cell(row=row, column=2, value=val)
    c2.fill = fill(LGRAY if row%2==0 else WHITE)
    c2.font = Font(color="212529", size=10, name="Calibri")
    c2.number_format = fmt; c2.alignment = right(); c2.border = thin_border()
    row += 1

row += 1
ws9.merge_cells(f"A{row}:D{row}")
c = ws9.cell(row=row, column=1, value="TU FONDO DE EMERGENCIA ACTUAL (edita la celda amarilla)")
c.fill = fill(NAVY); c.font = Font(bold=True, color=WHITE, size=11, name="Calibri")
c.alignment = center()
row += 1

c1 = ws9.cell(row=row, column=1, value="Capital actual fondo emergencia:")
c1.fill = fill(LGRAY); c1.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
c1.alignment = left(); c1.border = thin_border()
capital_cell_row = row
c2 = ws9.cell(row=row, column=2, value=500.00)
c2.fill = fill(GOLD); c2.font = Font(bold=True, color=NAVY, size=12, name="Calibri")
c2.number_format = euro_fmt(); c2.alignment = right()
c2.border = Border(
    left=Side(style="medium", color=NAVY), right=Side(style="medium", color=NAVY),
    top=Side(style="medium", color=NAVY), bottom=Side(style="medium", color=NAVY)
)
row += 1

calculated = [
    ("Meses cubiertos actualmente", f"=B{capital_cell_row}/1575"),
    ("% cobertura objetivo 6 meses", f"=B{capital_cell_row}/{1575*6}"),
    ("% cobertura objetivo 12 meses", f"=B{capital_cell_row}/{1575*12}"),
    ("Faltan para 6 meses", f"={1575*6}-B{capital_cell_row}"),
    ("Faltan para 12 meses", f"={1575*12}-B{capital_cell_row}"),
]
for label, formula in calculated:
    bg = LGRAY if row % 2 == 0 else WHITE
    c1 = ws9.cell(row=row, column=1, value=label)
    c1.fill = fill(bg); c1.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
    c1.alignment = left(); c1.border = thin_border()
    c2 = ws9.cell(row=row, column=2, value=formula)
    c2.fill = fill(bg); c2.font = Font(color="212529", size=10, name="Calibri")
    c2.number_format = pct_fmt() if "%" in label else ("#,##0.00 meses" if "Meses" in label else euro_fmt())
    c2.alignment = right(); c2.border = thin_border()
    row += 1

# Progress bar
row += 1
pct_row_ref = capital_cell_row + 2  # % cobertura 6 meses
c1 = ws9.cell(row=row, column=1, value="Progreso hacia 6 meses:")
c1.fill = fill(LGRAY); c1.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
c1.alignment = left(); c1.border = thin_border()
c2 = ws9.cell(row=row, column=2, value=f'=REPT("█",ROUND(MIN(B{pct_row_ref},1)*10,0))&REPT("░",10-ROUND(MIN(B{pct_row_ref},1)*10,0))&" "&TEXT(MIN(B{pct_row_ref},1),"0%")')
c2.fill = fill(LGRAY); c2.font = Font(color=NAVY, size=11, name="Calibri")
c2.alignment = left(); c2.border = thin_border()

# Milestones
row += 2
ws9.merge_cells(f"A{row}:D{row}")
c = ws9.cell(row=row, column=1, value="HITOS DEL FONDO DE EMERGENCIA")
c.fill = fill(NAVY); c.font = Font(bold=True, color=WHITE, size=11, name="Calibri")
c.alignment = center()
row += 1

milestones = [(1575, "1 mes"), (4725, "3 meses"), (9450, "6 meses ✓"), (18900, "12 meses ★")]
for target, label in milestones:
    c1 = ws9.cell(row=row, column=1, value=f"Objetivo {label}: {target:,.0f} €")
    c1.fill = fill(LGRAY if row%2==0 else WHITE)
    c1.font = Font(color=NAVY, size=10, name="Calibri")
    c1.alignment = left(); c1.border = thin_border()
    row += 1

for col, w in [(1,38),(2,20),(3,20)]:
    set_col_width(ws9, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 10: OBJETIVOS
# ══════════════════════════════════════════════════════════════════════════════
ws10 = add_sheet(wb, "OBJETIVOS", "20C997")

ws10.merge_cells("A1:E1")
c = ws10["A1"]
c.value = "OBJETIVOS FINANCIEROS ANUALES 2026"
c.fill = fill(NAVY); c.font = Font(bold=True, color=GOLD, size=14, name="Calibri")
c.alignment = center(); ws10.row_dimensions[1].height = 30

headers10 = ["Objetivo","Meta Anual (€)","Actual (€)","Diferencia (€)","% Cumplimiento","Progreso Visual"]
for i, h in enumerate(headers10, 1):
    cell = ws10.cell(row=2, column=i, value=h)
    cell.fill = fill(NAVY); cell.font = Font(bold=True, color=WHITE, size=10, name="Calibri")
    cell.alignment = center(); cell.border = thin_border()

objetivos = [
    ("Ahorro anual", 2400.00, 200.00),
    ("Bankroll anual", 2400.00, 200.00),
    ("Patrimonio anual", 5000.00, 2700.00),
    ("Beneficios trading anual", 4200.00, 350.00),
]

for i, (name, meta, actual) in enumerate(objetivos, 3):
    bg = LGRAY if i % 2 == 0 else WHITE
    data_cell(ws10, i, 1, name, bg, bold=True)
    data_cell(ws10, i, 2, meta, bg, fmt=euro_fmt(), align="right")
    data_cell(ws10, i, 3, actual, bg, fmt=euro_fmt(), align="right")
    c4 = ws10.cell(row=i, column=4, value=f"=C{i}-B{i}")
    c4.fill = fill(bg); c4.font = Font(color="212529", size=10, name="Calibri")
    c4.number_format = euro_fmt(); c4.alignment = right(); c4.border = thin_border()
    c5 = ws10.cell(row=i, column=5, value=f"=IFERROR(C{i}/B{i},0)")
    c5.fill = fill(bg); c5.font = Font(color="212529", size=10, name="Calibri")
    c5.number_format = pct_fmt(); c5.alignment = right(); c5.border = thin_border()
    c6 = ws10.cell(row=i, column=6, value=f'=REPT("█",ROUND(MIN(E{i},1)*10,0))&REPT("░",10-ROUND(MIN(E{i},1)*10,0))')
    c6.fill = fill(bg); c6.font = Font(color=NAVY, size=11, name="Calibri")
    c6.alignment = left(); c6.border = thin_border()

# Conditional formatting for % cumplimiento
ws10.conditional_formatting.add(
    "E3:E10",
    CellIsRule(operator="greaterThanOrEqual", formula=["0.75"], fill=fill("C6EFCE"))
)
ws10.conditional_formatting.add(
    "E3:E10",
    CellIsRule(operator="between", formula=["0.5","0.75"], fill=fill("FFEB9C"))
)
ws10.conditional_formatting.add(
    "E3:E10",
    CellIsRule(operator="lessThan", formula=["0.5"], fill=fill("FFC7CE"))
)

freeze(ws10, "A3")
for col, w in [(1,28),(2,16),(3,16),(4,16),(5,18),(6,20)]:
    set_col_width(ws10, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 11: GASTOS HORMIGA
# ══════════════════════════════════════════════════════════════════════════════
ws11 = add_sheet(wb, "GASTOS HORMIGA", "808080")

ws11.merge_cells("A1:G1")
c = ws11["A1"]
c.value = "GASTOS HORMIGA — CONTROL DE PEQUEÑOS GASTOS"
c.fill = fill(NAVY); c.font = Font(bold=True, color=GOLD, size=14, name="Calibri")
c.alignment = center(); ws11.row_dimensions[1].height = 30

headers11 = ["Fecha","Mes","Categoría","Descripción","Importe (€)","% Ingreso","Alerta"]
for i, h in enumerate(headers11, 1):
    cell = ws11.cell(row=2, column=i, value=h)
    cell.fill = fill(NAVY); cell.font = Font(bold=True, color=WHITE, size=10, name="Calibri")
    cell.alignment = center(); cell.border = thin_border()

cats_hormiga = ["Restaurantes","Amazon","Ocio","Compras impulsivas","Suscripciones"]
dv_hormiga = DataValidation(type="list", formula1='"Restaurantes,Amazon,Ocio,Compras impulsivas,Suscripciones,Otros"', allow_blank=True)
dv_hormiga.sqref = "C3:C1000"
ws11.add_data_validation(dv_hormiga)

hormiga_data = [
    (date(2026,6,10), "Junio", "Restaurantes", "Restaurante familiar", 35.00),
    (date(2026,6,12), "Junio", "Amazon", "Compra Amazon impulsiva", 28.50),
    (date(2026,6,14), "Junio", "Ocio", "Cine + palomitas", 18.00),
    (date(2026,6,18), "Junio", "Suscripciones", "Netflix", 13.99),
    (date(2026,6,22), "Junio", "Compras impulsivas", "Ropa", 45.00),
]

for i, row_data in enumerate(hormiga_data, 3):
    bg = LGRAY if i % 2 == 0 else WHITE
    for j, val in enumerate(row_data, 1):
        cell = ws11.cell(row=i, column=j, value=val)
        cell.fill = fill(bg); cell.font = Font(color="212529", size=10, name="Calibri")
        cell.alignment = center() if j <= 3 else (right() if j==5 else left())
        cell.border = thin_border()
        if j == 1: cell.number_format = date_fmt()
        if j == 5: cell.number_format = euro_fmt()
    # % ingreso
    c6 = ws11.cell(row=i, column=6, value=f"=E{i}/2000")
    c6.fill = fill(bg); c6.font = Font(color="212529", size=10, name="Calibri")
    c6.number_format = pct_fmt(); c6.alignment = right(); c6.border = thin_border()
    # Alerta
    c7 = ws11.cell(row=i, column=7, value=f'=IF(E{i}/2000>0.05,"⚠️ ALERTA","")')
    c7.fill = fill(bg); c7.font = Font(color=RED, bold=True, size=10, name="Calibri")
    c7.alignment = center(); c7.border = thin_border()

# Summary by category
row = 10
ws11.merge_cells(f"A{row}:G{row}")
c = ws11.cell(row=row, column=1, value="RESUMEN POR CATEGORÍA — JUNIO 2026")
c.fill = fill(NAVY); c.font = Font(bold=True, color=WHITE, size=11, name="Calibri")
c.alignment = center()
row += 1

for col, h in [(1,"Categoría"),(2,"Total Mes (€)"),(3,"% Ingreso"),(4,"Límite 5%"),(5,"Estado")]:
    cell = ws11.cell(row=row, column=col, value=h)
    cell.fill = fill(DGRAY); cell.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
    cell.alignment = center(); cell.border = thin_border()
row += 1

for i, cat in enumerate(cats_hormiga):
    bg = LGRAY if i % 2 == 0 else WHITE
    data_cell(ws11, row, 1, cat, bg, bold=True)
    c2 = ws11.cell(row=row, column=2, value=f'=SUMIF(C3:C100,A{row},E3:E100)')
    c2.fill = fill(bg); c2.font = Font(color="212529", size=10, name="Calibri")
    c2.number_format = euro_fmt(); c2.alignment = right(); c2.border = thin_border()
    c3 = ws11.cell(row=row, column=3, value=f"=B{row}/2000")
    c3.fill = fill(bg); c3.font = Font(color="212529", size=10, name="Calibri")
    c3.number_format = pct_fmt(); c3.alignment = right(); c3.border = thin_border()
    data_cell(ws11, row, 4, "5% = 100 €", bg, align="center")
    c5 = ws11.cell(row=row, column=5, value=f'=IF(B{row}>100,"⚠️ EXCEDIDO","✓ OK")')
    c5.fill = fill(bg); c5.font = Font(color="212529", bold=True, size=10, name="Calibri")
    c5.alignment = center(); c5.border = thin_border()
    row += 1

# Pie chart
chart11 = PieChart()
chart11.title = "Distribución Gastos Hormiga"
chart11.style = 10; chart11.width = 18; chart11.height = 12
labels11 = Reference(ws11, min_col=1, min_row=12, max_row=16)
data11 = Reference(ws11, min_col=2, min_row=12, max_row=16)
chart11.add_data(data11)
chart11.set_categories(labels11)
ws11.add_chart(chart11, "G2")

freeze(ws11, "A3")
for col, w in [(1,13),(2,10),(3,22),(4,28),(5,12),(6,12),(7,14)]:
    set_col_width(ws11, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 12: RANKING MEJORES MESES
# ══════════════════════════════════════════════════════════════════════════════
ws12 = add_sheet(wb, "RANKING MEJORES MESES", "20C997")

ws12.merge_cells("A1:H1")
c = ws12["A1"]
c.value = "RANKING DE MEJORES MESES — TOP 5 HISTÓRICO"
c.fill = fill(NAVY); c.font = Font(bold=True, color=GOLD, size=14, name="Calibri")
c.alignment = center(); ws12.row_dimensions[1].height = 30

rankings = [
    ("MEJORES MESES — INGRESOS", "Ingresos"),
    ("MEJORES MESES — AHORRO", "Ahorro"),
    ("MEJORES MESES — TRADING", "Trading"),
]

col_start = 1
for rank_title, _ in rankings:
    ws12.merge_cells(start_row=3, start_column=col_start, end_row=3, end_column=col_start+2)
    c = ws12.cell(row=3, column=col_start, value=rank_title)
    c.fill = fill(NAVY); c.font = Font(bold=True, color=WHITE, size=11, name="Calibri")
    c.alignment = center()
    for i, h in enumerate(["Posición","Mes","Importe (€)"], col_start):
        cell = ws12.cell(row=4, column=i, value=h)
        cell.fill = fill(DGRAY); cell.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
        cell.alignment = center(); cell.border = thin_border()
    medals = ["🥇","🥈","🥉","4º","5º"]
    for r in range(5):
        bg = GOLD if r==0 else (LGRAY if r%2==0 else WHITE)
        data_cell(ws12, 5+r, col_start, medals[r], bg, bold=(r==0), align="center")
        data_cell(ws12, 5+r, col_start+1, "—" if r > 0 else "Junio 2026", bg)
        c_amt = ws12.cell(row=5+r, column=col_start+2, value=2350.00 if r==0 else 0.00)
        c_amt.fill = fill(bg); c_amt.font = Font(bold=(r==0), color=NAVY if r==0 else "212529", size=10, name="Calibri")
        c_amt.number_format = euro_fmt(); c_amt.alignment = right(); c_amt.border = thin_border()
    col_start += 4

# Note about dynamic formulas
note_row = 11
ws12.merge_cells(f"A{note_row}:H{note_row}")
c = ws12.cell(row=note_row, column=1, value="ℹ️ NOTA: A medida que ingreses datos en las demás hojas, actualiza manualmente los valores de este ranking o añade fórmulas LARGE/INDEX/MATCH según tu estructura de datos.")
c.fill = fill(LGRAY); c.font = Font(italic=True, color=NAVY, size=10, name="Calibri")
c.alignment = left()

for col, w in [(1,12),(2,15),(3,14),(4,2),(5,12),(6,15),(7,14),(8,2)]:
    set_col_width(ws12, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 13: LIBERTAD FINANCIERA
# ══════════════════════════════════════════════════════════════════════════════
ws13 = add_sheet(wb, "LIBERTAD FINANCIERA", "20C997")

ws13.merge_cells("A1:D1")
c = ws13["A1"]
c.value = "LIBERTAD FINANCIERA — COBERTURA CON TRADING"
c.fill = fill(NAVY); c.font = Font(bold=True, color=GOLD, size=14, name="Calibri")
c.alignment = center(); ws13.row_dimensions[1].height = 30

row = 3
data = [
    ("Gastos mensuales fijos", 1575.00, euro_fmt()),
    ("Beneficio medio mensual trading (editar)", 350.00, euro_fmt()),
    ("% Cobertura actual", "=B4/B3", pct_fmt()),
    ("Meses con datos de trading", 1, "#,##0"),
]

for i, (label, val, fmt) in enumerate(data, row):
    bg = GOLD if i == row+2 else (LGRAY if i%2==0 else WHITE)
    bold = i == row+2
    c1 = ws13.cell(row=i, column=1, value=label)
    c1.fill = fill(bg); c1.font = Font(bold=bold, color=NAVY, size=10, name="Calibri")
    c1.alignment = left(); c1.border = thin_border()
    c2 = ws13.cell(row=i, column=2, value=val)
    c2.fill = fill(bg); c2.font = Font(bold=bold, color=NAVY, size=11 if bold else 10, name="Calibri")
    c2.number_format = fmt; c2.alignment = right(); c2.border = thin_border()

pct_row = row + 2  # row 5 = % cobertura

row = 8
# Progress bar
c1 = ws13.cell(row=row, column=1, value="Progreso libertad financiera:")
c1.fill = fill(LGRAY); c1.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
c1.alignment = left(); c1.border = thin_border()
c2 = ws13.cell(row=row, column=2, value=f'=REPT("█",ROUND(MIN(B{pct_row},1)*10,0))&REPT("░",10-ROUND(MIN(B{pct_row},1)*10,0))&" "&TEXT(MIN(B{pct_row},1),"0%")')
c2.fill = fill(LGRAY); c2.font = Font(color=NAVY, size=12, name="Calibri")
c2.alignment = left(); c2.border = thin_border()
row += 1

# Text sentence
c1 = ws13.cell(row=row, column=1, value="Estado actual:")
c1.fill = fill(TEAL); c1.font = Font(bold=True, color=WHITE, size=10, name="Calibri")
c1.alignment = left(); c1.border = thin_border()
c2 = ws13.cell(row=row, column=2, value=f'="Actualmente el trading cubre el "&TEXT(B{pct_row},"0.0%")&" de tus gastos mensuales fijos"')
c2.fill = fill(TEAL); c2.font = Font(bold=True, color=WHITE, size=10, name="Calibri")
c2.alignment = left(); c2.border = thin_border()
row += 2

# Milestones
ws13.merge_cells(f"A{row}:D{row}")
c = ws13.cell(row=row, column=1, value="HITOS DE LIBERTAD FINANCIERA")
c.fill = fill(NAVY); c.font = Font(bold=True, color=WHITE, size=11, name="Calibri")
c.alignment = center()
row += 1

milestones13 = [
    (0.25, "25% — Inicio del camino: trading cubre 1/4 de gastos"),
    (0.50, "50% — Punto medio: trading cubre la mitad de gastos"),
    (0.75, "75% — Casi libre: solo 25% depende del empleo"),
    (1.00, "100% — LIBERTAD FINANCIERA: trading cubre todos los gastos"),
]

for pct, desc in milestones13:
    achieved = 350/1575 >= pct
    bg = GREEN if achieved else LGRAY
    fg = WHITE if achieved else NAVY
    c1 = ws13.cell(row=row, column=1, value=f"{pct*100:.0f}%")
    c1.fill = fill(bg); c1.font = Font(bold=True, color=fg, size=11, name="Calibri")
    c1.alignment = center(); c1.border = thin_border()
    c2 = ws13.cell(row=row, column=2, value=desc)
    c2.fill = fill(bg); c2.font = Font(bold=achieved, color=fg, size=10, name="Calibri")
    c2.alignment = left(); c2.border = thin_border()
    row += 1

for col, w in [(1,38),(2,45)]:
    set_col_width(ws13, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 14: PROYECCIONES FUTURAS
# ══════════════════════════════════════════════════════════════════════════════
ws14 = add_sheet(wb, "PROYECCIONES FUTURAS", "20C997")

ws14.merge_cells("A1:F1")
c = ws14["A1"]
c.value = "PROYECCIONES FUTURAS — 1, 3 Y 5 AÑOS"
c.fill = fill(NAVY); c.font = Font(bold=True, color=GOLD, size=14, name="Calibri")
c.alignment = center(); ws14.row_dimensions[1].height = 30

# Inputs
row = 3
ws14.merge_cells(f"A{row}:F{row}")
c = ws14.cell(row=row, column=1, value="PARÁMETROS DE ENTRADA (edita las celdas amarillas)")
c.fill = fill(NAVY); c.font = Font(bold=True, color=WHITE, size=11, name="Calibri")
c.alignment = center()
row += 1

inputs14 = [
    ("Ingreso medio mensual neto", 2000.00, euro_fmt()),
    ("Tasa de ahorro mensual %", 0.10, pct_fmt()),
    ("Beneficio medio mensual trading", 350.00, euro_fmt()),
    ("Rentabilidad anual inversión %", 0.05, pct_fmt()),
    ("Aportación bankroll mensual", 200.00, euro_fmt()),
]
input_rows = {}
for label, val, fmt in inputs14:
    c1 = ws14.cell(row=row, column=1, value=label)
    c1.fill = fill(LGRAY); c1.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
    c1.alignment = left(); c1.border = thin_border()
    c2 = ws14.cell(row=row, column=2, value=val)
    c2.fill = fill(GOLD); c2.font = Font(bold=True, color=NAVY, size=11, name="Calibri")
    c2.number_format = fmt; c2.alignment = right()
    c2.border = Border(
        left=Side(style="medium", color=NAVY), right=Side(style="medium", color=NAVY),
        top=Side(style="medium", color=NAVY), bottom=Side(style="medium", color=NAVY)
    )
    input_rows[label] = row
    row += 1

ahorro_row = input_rows["Ingreso medio mensual neto"]
tasa_row = input_rows["Tasa de ahorro mensual %"]
trading_row = input_rows["Beneficio medio mensual trading"]
rent_row = input_rows["Rentabilidad anual inversión %"]
bankroll_row = input_rows["Aportación bankroll mensual"]

# Projection table
row += 1
ws14.merge_cells(f"A{row}:F{row}")
c = ws14.cell(row=row, column=1, value="TABLA DE PROYECCIONES")
c.fill = fill(NAVY); c.font = Font(bold=True, color=WHITE, size=11, name="Calibri")
c.alignment = center()
row += 1

for col, h in enumerate(["Año","Ahorro Acumulado (€)","Bankroll (€)","Patrimonio Total (€)","Benef. Trading Acum. (€)","Libertad Financiera %"], 1):
    cell = ws14.cell(row=row, column=col, value=h)
    cell.fill = fill(DGRAY); cell.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
    cell.alignment = center(); cell.border = thin_border()
row += 1

proj_start = row
for yr in range(1, 6):
    bg = LGRAY if yr % 2 == 0 else WHITE
    data_cell(ws14, row, 1, f"Año {yr}", bg, bold=True)
    # Ahorro acumulado
    c2 = ws14.cell(row=row, column=2, value=f"=$B${ahorro_row}*$B${tasa_row}*12*{yr}")
    c2.fill = fill(bg); c2.font = Font(color="212529", size=10, name="Calibri")
    c2.number_format = euro_fmt(); c2.alignment = right(); c2.border = thin_border()
    # Bankroll
    c3 = ws14.cell(row=row, column=3, value=f"=$B${bankroll_row}*12*{yr}")
    c3.fill = fill(bg); c3.font = Font(color="212529", size=10, name="Calibri")
    c3.number_format = euro_fmt(); c3.alignment = right(); c3.border = thin_border()
    # Patrimonio total
    c4 = ws14.cell(row=row, column=4, value=f"=B{row}+C{row}")
    c4.fill = fill(bg); c4.font = Font(color="212529", size=10, name="Calibri")
    c4.number_format = euro_fmt(); c4.alignment = right(); c4.border = thin_border()
    # Trading acumulado
    c5 = ws14.cell(row=row, column=5, value=f"=$B${trading_row}*12*{yr}")
    c5.fill = fill(bg); c5.font = Font(color="212529", size=10, name="Calibri")
    c5.number_format = euro_fmt(); c5.alignment = right(); c5.border = thin_border()
    # Libertad financiera %
    c6 = ws14.cell(row=row, column=6, value=f"=IFERROR($B${trading_row}/1575,0)")
    c6.fill = fill(bg); c6.font = Font(color="212529", size=10, name="Calibri")
    c6.number_format = pct_fmt(); c6.alignment = right(); c6.border = thin_border()
    row += 1

# Chart
chart14 = LineChart()
chart14.title = "Proyección Patrimonial a 5 Años"
chart14.style = 10
chart14.y_axis.title = "€"; chart14.x_axis.title = "Año"
chart14.width = 22; chart14.height = 14
data_ref14 = Reference(ws14, min_col=2, max_col=5, min_row=proj_start-1, max_row=proj_start+4)
chart14.add_data(data_ref14, titles_from_data=True)
ws14.add_chart(chart14, "H4")

freeze(ws14, "A3")
for col, w in [(1,10),(2,22),(3,16),(4,18),(5,22),(6,20)]:
    set_col_width(ws14, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 15: SCORE DEL TRADER
# ══════════════════════════════════════════════════════════════════════════════
ws15 = add_sheet(wb, "SCORE DEL TRADER", ORANGE)

ws15.merge_cells("A1:D1")
c = ws15["A1"]
c.value = "SCORE DEL TRADER — EVALUACIÓN INTEGRAL 0-100"
c.fill = fill(NAVY); c.font = Font(bold=True, color=GOLD, size=14, name="Calibri")
c.alignment = center(); ws15.row_dimensions[1].height = 30

# Score components
row = 3
ws15.merge_cells(f"A{row}:D{row}")
c = ws15.cell(row=row, column=1, value="COMPONENTES DEL SCORE (edita los valores actuales)")
c.fill = fill(NAVY); c.font = Font(bold=True, color=WHITE, size=11, name="Calibri")
c.alignment = center()
row += 1

for col, h in [(1,"Componente"),(2,"Peso"),(3,"Valor Actual"),(4,"Puntos Obtenidos")]:
    cell = ws15.cell(row=row, column=col, value=h)
    cell.fill = fill(DGRAY); cell.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
    cell.alignment = center(); cell.border = thin_border()
row += 1

components = [
    ("Cumplimiento Ahorro", "20 pts", "Ahorro actual / objetivo", 200, 2400),
    ("Cumplimiento Bankroll", "20 pts", "Bankroll actual / objetivo", 200, 2400),
    ("Control de Gastos", "20 pts", "Gastos < presupuesto", 1575, 2000),
    ("Crecimiento Patrimonio", "20 pts", "% crecimiento vs inicio", 2700, 0),
    ("Resultados Trading", "20 pts", "ROI sobre bankroll", 350, 2000),
]

comp_rows = []
comp_start_row = row
for comp_idx, (name, weight, desc, actual, target) in enumerate(components):
    i = comp_start_row + comp_idx
    bg = LGRAY if i % 2 == 0 else WHITE
    data_cell(ws15, i, 1, name, bg, bold=True)
    data_cell(ws15, i, 2, weight, bg, align="center")
    data_cell(ws15, i, 3, desc, bg)
    # Points formula — use comp_idx to identify which component
    if comp_idx == 0:  # Ahorro
        formula = f"=MIN(20,IFERROR({actual}/{target}*20,0))"
    elif comp_idx == 1:  # Bankroll
        formula = f"=MIN(20,IFERROR({actual}/{target}*20,0))"
    elif comp_idx == 2:  # Gastos
        formula = f"=IF({actual}<={target},20,MAX(0,20-(({actual}-{target})/{target})*20))"
    elif comp_idx == 3:  # Patrimonio (target may be 0, use fixed denominator 5000)
        formula = f"=MIN(20,IFERROR(({actual}-0)/5000*20,0))"
    else:  # Trading
        formula = f"=MIN(20,IFERROR({actual}/{target}*20,0))"

    c4 = ws15.cell(row=i, column=4, value=formula)
    c4.fill = fill(bg); c4.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
    c4.number_format = "0.0 \"pts\""; c4.alignment = right(); c4.border = thin_border()
    comp_rows.append(i)
row = comp_start_row + len(components)

# Total score
total_row = row
ws15.merge_cells(f"A{total_row}:C{total_row}")
c = ws15.cell(row=total_row, column=1, value="SCORE TOTAL DEL TRADER")
c.fill = fill(GOLD); c.font = Font(bold=True, color=NAVY, size=13, name="Calibri")
c.alignment = center(); c.border = thin_border()
score_formula = f"=ROUND(SUM(D{comp_rows[0]}:D{comp_rows[-1]}),1)"
c4 = ws15.cell(row=total_row, column=4, value=score_formula)
c4.fill = fill(GOLD); c4.font = Font(bold=True, color=NAVY, size=14, name="Calibri")
c4.number_format = "0.0 \"/100\""; c4.alignment = center(); c4.border = thin_border()

row = total_row + 2

# Traffic light
ws15.merge_cells(f"A{row}:D{row}")
c = ws15.cell(row=row, column=1, value="SEMÁFORO DE EVALUACIÓN")
c.fill = fill(NAVY); c.font = Font(bold=True, color=WHITE, size=11, name="Calibri")
c.alignment = center()
row += 1

tl_data = [
    (GREEN, WHITE, "🟢 SCORE ≥ 70 — EXCELENTE: Vas por buen camino, mantén el ritmo"),
    (YELLOW, NAVY, "🟡 SCORE 40-69 — MEJORABLE: Hay áreas que necesitan atención"),
    (RED, WHITE, "🔴 SCORE < 40 — ALERTA: Revisa tu estrategia financiera"),
]
for hex_bg, hex_fg, txt in tl_data:
    ws15.merge_cells(f"A{row}:D{row}")
    c = ws15.cell(row=row, column=1, value=txt)
    c.fill = fill(hex_bg); c.font = Font(bold=True, color=hex_fg, size=10, name="Calibri")
    c.alignment = left(); c.border = thin_border()
    ws15.row_dimensions[row].height = 18
    row += 1

row += 1
# Dynamic evaluation text
c = ws15.cell(row=row, column=1, value="Tu evaluación:")
c.fill = fill(LGRAY); c.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
c.alignment = left(); c.border = thin_border()
ws15.merge_cells(f"B{row}:D{row}")
c2 = ws15.cell(row=row, column=2, value=f'=IF(D{total_row}>=70,"🟢 EXCELENTE — Score: "&TEXT(D{total_row},"0.0")&"/100",IF(D{total_row}>=40,"🟡 MEJORABLE — Score: "&TEXT(D{total_row},"0.0")&"/100","🔴 ALERTA — Score: "&TEXT(D{total_row},"0.0")&"/100"))')
c2.fill = fill(LGRAY); c2.font = Font(bold=True, color=NAVY, size=11, name="Calibri")
c2.alignment = left(); c2.border = thin_border()

for col, w in [(1,30),(2,12),(3,28),(4,18)]:
    set_col_width(ws15, col, w)

# ══════════════════════════════════════════════════════════════════════════════
# SHEET 1: DASHBOARD EJECUTIVO (created last to reference other sheets)
# ══════════════════════════════════════════════════════════════════════════════
ws1 = add_sheet(wb, "DASHBOARD EJECUTIVO", NAVY)

# Move to position 2 (after GUÍA)
# We'll reorder at the end

ws1.merge_cells("A1:L1")
c = ws1["A1"]
c.value = "🏦 DASHBOARD EJECUTIVO — SISTEMA FINANCIERO PERSONAL 2026"
c.fill = fill(NAVY); c.font = Font(bold=True, color=GOLD, size=16, name="Calibri")
c.alignment = center(); ws1.row_dimensions[1].height = 40

ws1.merge_cells("A2:L2")
c = ws1["A2"]
c.value = "Sistema de control financiero integral | Inicio: Junio 2026 | Referencia: 2.000 €/mes"
c.fill = fill("2C3E50"); c.font = Font(color=GOLD, size=11, italic=True, name="Calibri")
c.alignment = center(); ws1.row_dimensions[2].height = 20

# KPI Section header
row = 4
ws1.merge_cells(f"A{row}:L{row}")
c = ws1.cell(row=row, column=1, value="KPIs PRINCIPALES — JUNIO 2026")
c.fill = fill("2C3E50"); c.font = Font(bold=True, color=WHITE, size=12, name="Calibri")
c.alignment = center(); ws1.row_dimensions[row].height = 22

# KPI boxes — row 5-7 (3 rows merged per KPI box)
def kpi_box(ws, start_row, start_col, end_col, title, value_formula, fmt, indicator_color=NAVY):
    ws.merge_cells(start_row=start_row, start_column=start_col, end_row=start_row, end_column=end_col)
    c = ws.cell(row=start_row, column=start_col, value=title)
    c.fill = fill(indicator_color); c.font = Font(bold=True, color=WHITE, size=9, name="Calibri")
    c.alignment = center(); c.border = thin_border()
    ws.merge_cells(start_row=start_row+1, start_column=start_col, end_row=start_row+2, end_column=end_col)
    cv = ws.cell(row=start_row+1, column=start_col, value=value_formula)
    cv.fill = fill(LGRAY); cv.font = Font(bold=True, color=NAVY, size=14, name="Calibri")
    cv.number_format = fmt; cv.alignment = center()
    cv.border = Border(
        left=Side(style="medium", color=indicator_color),
        right=Side(style="medium", color=indicator_color),
        bottom=Side(style="medium", color=indicator_color)
    )
    ws.row_dimensions[start_row].height = 20
    ws.row_dimensions[start_row+1].height = 25
    ws.row_dimensions[start_row+2].height = 15

kpis = [
    (1, 2, "Ingresos del Mes", "='REGISTRO DE MOVIMIENTOS'!H3", euro_fmt(), TEAL),
    (3, 4, "Gastos Totales", '=SUMIF(\'REGISTRO DE MOVIMIENTOS\'!D3:D1000,"Gasto",\'REGISTRO DE MOVIMIENTOS\'!H3:H1000)', euro_fmt(), RED),
    (5, 6, "Flujo de Caja", "='PRESUPUESTO MENSUAL'!D3-SUMIF('REGISTRO DE MOVIMIENTOS'!D3:D1000,\"Gasto\",'REGISTRO DE MOVIMIENTOS'!H3:H1000)", euro_fmt(), BLUE),
    (7, 8, "Ahorro Mensual", "='CONTROL DE AHORRO'!D3", euro_fmt(), GREEN),
    (9, 10, "Ahorro Acumulado", "=MAX('CONTROL DE AHORRO'!E3:E1000)", euro_fmt(), GREEN),
    (11, 12, "Bankroll Capital", "=MAX('CONTROL DE BANKROLL'!E3:E1000)", euro_fmt(), ORANGE),
]

row = 5
for sc, ec, title, formula, fmt, color in kpis:
    kpi_box(ws1, row, sc, ec, title, formula, fmt, color)

row = 8
kpis2 = [
    (1, 2, "Benef. Trading Mes", "=SUM('DASHBOARD DE TRADING'!C3:C1000)", euro_fmt(), ORANGE),
    (3, 4, "Payouts Cobrados", "='CONTROL DE PAYOUTS'!B6", euro_fmt(), ORANGE),
    (5, 6, "Patrimonio Neto", "='PATRIMONIO NETO'!B20", euro_fmt(), NAVY),
    (7, 8, "ROI Trading %", "=IFERROR(SUM('DASHBOARD DE TRADING'!C3:C1000)/MAX('CONTROL DE BANKROLL'!E3:E1000),0)", pct_fmt(), BLUE),
    (9, 10, "Score Financiero", "='SCORE DEL TRADER'!D10", "0.0 \"/100\"", GOLD),
    (11, 12, "Libertad Financiera", "='LIBERTAD FINANCIERA'!B5", pct_fmt(), TEAL),
]
for sc, ec, title, formula, fmt, color in kpis2:
    kpi_box(ws1, row, sc, ec, title, formula, fmt, color)

# Traffic lights section
row = 12
ws1.merge_cells(f"A{row}:L{row}")
c = ws1.cell(row=row, column=1, value="SEMÁFOROS FINANCIEROS")
c.fill = fill("2C3E50"); c.font = Font(bold=True, color=WHITE, size=12, name="Calibri")
c.alignment = center(); ws1.row_dimensions[row].height = 22
row += 1

tl_items = [
    ("Ahorro", "=MAX('CONTROL DE AHORRO'!E3:E1000)", euro_fmt(), ">=2000", ">=1000"),
    ("Gastos Fijos", "=SUMIF('REGISTRO DE MOVIMIENTOS'!E3:E1000,\"Vivienda\",'REGISTRO DE MOVIMIENTOS'!H3:H1000)+SUMIF('REGISTRO DE MOVIMIENTOS'!E3:E1000,\"Transporte\",'REGISTRO DE MOVIMIENTOS'!H3:H1000)", euro_fmt(), "<=1575", "<=1700"),
    ("ROI Trading", "=IFERROR(SUM('DASHBOARD DE TRADING'!C3:C1000)/MAX('CONTROL DE BANKROLL'!E3:E1000),0)", pct_fmt(), ">=0.15", ">=0.05"),
    ("Flujo de Caja", "='PRESUPUESTO MENSUAL'!D3-SUMIF('REGISTRO DE MOVIMIENTOS'!D3:D1000,\"Gasto\",'REGISTRO DE MOVIMIENTOS'!H3:H1000)", euro_fmt(), ">=0", ">=(-200)"),
]

for col_start, (label, formula, fmt, good, warn) in enumerate(tl_items):
    col = col_start * 3 + 1
    c1 = ws1.cell(row=row, column=col, value=label)
    c1.fill = fill(DGRAY); c1.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
    c1.alignment = center(); c1.border = thin_border()
    c2 = ws1.cell(row=row+1, column=col, value=formula)
    c2.fill = fill(WHITE); c2.font = Font(bold=True, color=NAVY, size=11, name="Calibri")
    c2.number_format = fmt; c2.alignment = center(); c2.border = thin_border()

# Budget section
row += 3
ws1.merge_cells(f"A{row}:L{row}")
c = ws1.cell(row=row, column=1, value="RESUMEN PRESUPUESTARIO MENSUAL")
c.fill = fill("2C3E50"); c.font = Font(bold=True, color=WHITE, size=12, name="Calibri")
c.alignment = center(); ws1.row_dimensions[row].height = 22
row += 1

budget_items = [
    ("Ingreso Neto", "='PRESUPUESTO MENSUAL'!$D$3", euro_fmt()),
    ("Gastos Fijos", 1575.00, euro_fmt()),
    ("Bankroll (10%)", "='PRESUPUESTO MENSUAL'!$D$3*0.1", euro_fmt()),
    ("Ahorro (10%)", "='PRESUPUESTO MENSUAL'!$D$3*0.1", euro_fmt()),
    ("Caprichos (5%)", "='PRESUPUESTO MENSUAL'!$D$3*0.05", euro_fmt()),
    ("Disponible", "='PRESUPUESTO MENSUAL'!$D$3-1575-'PRESUPUESTO MENSUAL'!$D$3*0.25", euro_fmt()),
]

for col, h in [(1,"Concepto"),(3,"Importe"),(5,"% Ingreso")]:
    cell = ws1.cell(row=row, column=col, value=h)
    cell.fill = fill(NAVY); cell.font = Font(bold=True, color=WHITE, size=10, name="Calibri")
    cell.alignment = center(); cell.border = thin_border()
row += 1

for i, (label, val, fmt) in enumerate(budget_items):
    bg = LGRAY if i % 2 == 0 else WHITE
    c1 = ws1.cell(row=row, column=1, value=label)
    c1.fill = fill(bg); c1.font = Font(bold=(i==5), color=NAVY if i==5 else "212529", size=10, name="Calibri")
    c1.alignment = left(); c1.border = thin_border()
    c2 = ws1.cell(row=row, column=3, value=val)
    c2.fill = fill(bg); c2.font = Font(bold=(i==5), color=NAVY if i==5 else "212529", size=10, name="Calibri")
    c2.number_format = fmt; c2.alignment = right(); c2.border = thin_border()
    c3 = ws1.cell(row=row, column=5, value=f"=C{row}/'PRESUPUESTO MENSUAL'!$D$3")
    c3.fill = fill(bg); c3.font = Font(bold=(i==5), color=NAVY if i==5 else "212529", size=10, name="Calibri")
    c3.number_format = pct_fmt(); c3.alignment = right(); c3.border = thin_border()
    row += 1

# Navigation note
row += 1
ws1.merge_cells(f"A{row}:L{row}")
c = ws1.cell(row=row, column=1, value="ℹ️ NAVEGACIÓN: Usa las pestañas de abajo para acceder a cada sección del sistema financiero")
c.fill = fill(GOLD); c.font = Font(bold=True, color=NAVY, size=10, name="Calibri")
c.alignment = center(); ws1.row_dimensions[row].height = 20

freeze(ws1, "A3")
for col in range(1, 13):
    set_col_width(ws1, col, 14)

# ══════════════════════════════════════════════════════════════════════════════
# Reorder sheets: GUÍA first, then DASHBOARD, then rest
# ══════════════════════════════════════════════════════════════════════════════
sheet_order = [
    "GUÍA DE USO",
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

# Reorder
for idx, name in enumerate(sheet_order):
    if name in wb.sheetnames:
        wb.move_sheet(name, offset=idx - wb.sheetnames.index(name))

# ══════════════════════════════════════════════════════════════════════════════
# Set print areas and final polish
# ══════════════════════════════════════════════════════════════════════════════
for ws in wb.worksheets:
    ws.sheet_view.showGridLines = ws.title != "GUÍA DE USO"
    # Set print area
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
print(f"Tamaño: {os.path.getsize(output_path):,} bytes")
print(f"Hojas creadas: {len(wb.sheetnames)}")
for i, name in enumerate(wb.sheetnames):
    print(f"  {i:2d}. {name}")
