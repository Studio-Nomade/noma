# Análisis de contenido de los presupuestos PDF

De `scripts/data/extract_pdf_budgets.py` sobre 94 PDFs. Texto en
`data/processed/pdf_text/`, índice en `data/processed/pdf_content_index.json`.

## Hallazgos generales

- **94/94 con texto seleccionable** (0 escaneados) → **no se requiere OCR**. ✅
- Todos los presupuestos cotizan en **UF + IVA** (confirma UF como moneda base; el
  IVA 19% es de presentación y debe sumarse en el total).

## Frecuencia de secciones (keyword match, aproximada)

| Sección              | PDFs |
| -------------------- | ---- |
| Inversión / valores  | 94   |
| Equipo               | 64   |
| Objetivo             | 41   |
| Entregables          | 34   |
| Alcance              | 25   |
| Metodología / etapas | 15   |
| Contexto             | 9    |
| Condiciones          | 6    |
| Diagnóstico          | 4    |
| Cronograma           | 3    |

> Los conteos bajos no implican ausencia: muchos rótulos están como gráfica
> vectorizada (ver svg-assets-map.md) y no siempre coinciden con la keyword.

## Patrones por área

- **Web (WD)**: orientado a **lista de servicios**, cada uno con título, **valor
  (UF + IVA)**, alcance ("incluye") y **exclusiones** ("el presupuesto no
  considera"), y tipo de valor (único / mensual / trimestral). Niveles de
  mantención (Light…). Slide de **Equipo Principal** con persona + rol.
- **Branding (B&D / CE)**: orientado a **metodología por semanas** (Kick Off →
  Levantamiento de referencias → Definición de identidad y propuestas → Espacio de
  cambios → Identidad y Manual de Marca), con descripción por etapa.

## Implicancias para el generador

- Bloque por servicio: `título · valor UF (+IVA) · incluye · no incluye · unidad`.
- Slide de equipo: lista `persona + rol` (rol editable).
- Total: subtotal UF → CLP (UF diaria) → + IVA 19%.
- Cronograma/etapas: por semanas, especialmente en Branding.
