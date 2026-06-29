# Mapa de assets SVG

De `scripts/data/extract_svg_assets.py` sobre 23 SVG. Datos en
`data/processed/svg_assets.json`.

## Sets

| Set                             | SVG | Qué es                     |
| ------------------------------- | --- | -------------------------- |
| `ARCHIVO MAESTRO NOMADE`        | 15  | Plantilla maestra del deck |
| `WD_N260623 - Punta Volcanes …` | 8   | Propuesta real (ejemplo)   |

- **Formato slide: viewBox `1440×810` (16:9)** en los 23.

## ⚠️ Hallazgo importante: texto vectorizado

Los SVG **no contienen elementos `<text>`** — el texto está **convertido a paths**
(slide 1 = 56 `<path>`, 0 `<text>`/`<tspan>`). Por lo tanto:

- **No se puede extraer el contenido textual** desde los SVG.
- Sirven como **referencia visual + paleta de marca**, no como fuente de datos ni
  como plantilla editable por reemplazo de texto.

**Conclusión:** la plantilla de cotización en Noma se **reconstruye como
HTML/React** (16:9), tomando de los SVG la **identidad visual** (colores, layout,
ritmo de slides) y el **contenido** desde la base de datos + PDFs.

## Paleta de marca (fills más frecuentes)

| Color                             | Uso probable                                        |
| --------------------------------- | --------------------------------------------------- |
| `#ffffff`                         | Fondo claro                                         |
| `#ecf0ee`                         | Crema / gris muy claro (fondos)                     |
| `#f48134`                         | **Naranja Nomade (acento)**                         |
| `#1d1d1b` / `#191919` / `#000000` | Negro editorial / texto                             |
| `#a0de00`                         | Verde lima (acento de proyecto, ej. Punta Volcanes) |

> Cotejar con los tokens de `src/app/globals.css`; el naranja `#f48134` es el
> acento de marca a incorporar en el tema del deck.
