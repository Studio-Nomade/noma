# Plan de extracción

Metodología para convertir los insumos en datos estructurados, con estado.

## Entorno

- `python3` + venv en `.venv` (gitignored) con `openpyxl` y `pdfplumber`.
- Scripts en `scripts/data/`. Leen de `/data/raw`, escriben en
  `/data/{processed,normalized}`. **Nunca** modifican originales.

## Fuentes y estado

| Fuente | Método | Script | Estado |
|---|---|---|---|
| Excel servicios | openpyxl | `extract_services_excel.py` | ✅ hecho |
| Nombres de PDF | regex + heurística | `parse_budget_filenames.py` | ✅ hecho |
| Contenido PDF | pdfplumber (texto por página) + heurística de secciones | `extract_pdf_budgets.py` | ⏳ pendiente |
| SVG | parse XML (`<text>`, `fill`) | `extract_svg_assets.py` | ⏳ pendiente |
| SLA | pdfplumber + segmentación por encabezados | `extract_sla_modules.py` | ⏳ pendiente |
| Import a Noma | Drizzle seed desde `/data/normalized` | `import-services.ts` | ⏳ pendiente |

## Convención de moneda (decisión aprobada)

- **UF como fuente de verdad**, CLP recalculado con la UF diaria del sistema
  (`exchange_rates`, mindicador). Ver pricing-analysis.md.
- UF de referencia detectada en el Excel: **37.000 CLP** (constante).

## Supuestos registrados

- El nombre del servicio puede venir en col C o col J del Excel (coalesce).
- En nombres de PDF, el código `[N]AAMMDD` usa año de 2 dígitos (`26`→2026); los
  de 8 dígitos se interpretan `YYYYMMDD`.
- Separadores cliente/servicio: doble espacio, ` _ `, ` – `, ` - ` (en ese orden).
- Sufijos `-v3`, `-2` y typos de fecha → quedan en baja confianza para revisión
  humana; **no se corrigen automáticamente**.

## Riesgos

- PDFs escaneados sin texto seleccionable → requerirán OCR (a evaluar al correr
  `extract_pdf_budgets.py`).
- Valores en PDF pueden diferir del Excel (precios negociados) → se tratan como
  evidencia histórica, no como catálogo.
- Nombres de cliente inconsistentes entre PDFs → normalización + revisión manual.
