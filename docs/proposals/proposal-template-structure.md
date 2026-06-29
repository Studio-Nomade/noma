# Estructura de la plantilla modular de cotización (Noma)

Ajuste de la estructura genérica a lo que Studio Nomade ya usa. Cada slide es un
**bloque modular** con datos de la base; se reconstruye en HTML/React 16:9 y se
exporta a PDF. Ver svg-assets-map.md (por qué HTML y no SVG).

## Slides (tipo · obligatorio · repetible · fuente de datos)

| # | Slide | Oblig. | Repetible | Fuente |
|---|---|---|---|---|
| 1 | Portada | ✅ | — | cliente, proyecto, código, área(s), fecha |
| 2 | Contexto del proyecto | — | — | editable / brief |
| 3 | Objetivo general | — | — | proyecto / editable |
| 4 | Diagnóstico inicial | — | — | editable |
| 5 | Alcance de servicios | ✅ | — | servicios seleccionados |
| 6 | Servicio (bloque) | ✅ | ✅ | por cada servicio: valor UF+IVA, incluye, no incluye, unidad |
| 7 | Metodología / etapas | — | ✅ | etapas por semana (Branding) |
| 8 | Entregables | — | — | agregado de servicios/módulos |
| 9 | Equipo principal | — | — | personas + rol (editable) |
| 10 | Cronograma | — | — | semanas / fechas |
| 11 | Inversión | ✅ | — | subtotal UF → CLP → **+IVA 19%** → total |
| 12 | Condiciones comerciales | — | — | plantilla `studio_config` |
| 13 | Próximos pasos | — | — | editable |
| 14 | Cierre Studio Nomade | ✅ | — | contacto |

## Cómo se arma (flujo)

cliente → proyecto → área(s) → **servicios** (de la base) → **módulos** incluidos
→ equipo (personas + rol manual) → condiciones → **preview** → **export PDF**.

Los servicios/módulos seleccionados **autocompletan** alcance (slide 5/6),
entregables (8) y valor (11). Ver `docs/services/services-data-model.md`.

## Totales

```
subtotal_uf = Σ servicios/módulos (UF)
subtotal_clp = subtotal_uf × UF_diaria      (presentación)
iva = total_neto × 0.19
total = neto + iva
```
Recurrentes (mensual/trimestral) se muestran aparte de los valores únicos.

## Tema visual

16:9, paleta Nomade (naranja `#f48134`, crema `#ecf0ee`, negro `#1d1d1b`) sobre los
tokens de `globals.css`. Ver svg-assets-map.md.
