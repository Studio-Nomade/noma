# Índice de archivos fuente

Clasificación de los insumos y estado de extracción. Las salidas estructuradas
viven en `/data` (gitignored): `normalized/` (datos limpios) y `processed/`
(intermedios).

## Excel — `branding_services_master.xlsx`

- 1 hoja (`Sheet1`), 56 servicios (filas 2–57), columnas A–J.
- Columnas: `ID Servicio · Subárea · Servicio · Descripción · Entregables ·
Tiempo · Valor UF · Valor CLP · Unidad · Service(J)`.
- **El nombre del servicio está en col C o, si está vacía, en col J** (overflow).
- Extraído por `scripts/data/extract_services_excel.py` →
  `data/normalized/branding_services.{json,csv}`.

## Presupuestos PDF — 94 archivos

- Metadata extraída de nombres por `scripts/data/parse_budget_filenames.py` →
  `data/processed/budgets_index.{json,csv}`.
- Distribución: **2025 = 67 · 2026 = 27**. Por área: B&D 56, A&A 21, WD 16, CE 6,
  A&D 5, MP 3 (las combinadas suman a varias áreas).
- Confianza de parseo: **68 alta · 23 media · 3 baja**.
- **Contenido interno de los PDF: pendiente** (extracción de alcance/valores/etapas
  con pdfplumber — ver extraction-plan.md).

### Archivos a revisar manualmente (baja confianza)

| Archivo                       | Problema                                       |
| ----------------------------- | ---------------------------------------------- |
| `…/A&A_N251022-v3 - Natura …` | sufijo de versión `-v3` rompe el código        |
| `…/B&D_N252710 - lentes`      | código `N252710` → mes 27 inválido (typo real) |
| `…/B&D_N251201-2 -EQUIFAX`    | sufijo `-2` y guion pegado                     |

## SLA PDF — 3 archivos

- `B&D+WD` Alianza Ciberseguridad · `B&D` Todo Carnes · `WD` IDEA.
- **Pendiente**: segmentar en módulos reutilizables (sla-analysis).

## SVG — 23 archivos

- `ARCHIVO MAESTRO NOMADE/` (15) = plantilla de deck.
- `Punta Volcanes/` (8) = propuesta real de ejemplo.
- **Pendiente**: extraer textos/colores/tipos de slide (svg-assets-map).

## Credencial — `client_secret_*.json`

⚠️ Secreto OAuth de Google. **No copiado a `/data/raw`, no versionado**
(`.gitignore`). Debe moverse fuera de la carpeta de trabajo; si se usa para la
futura integración con Google Drive/Calendar, vía variables de entorno.
