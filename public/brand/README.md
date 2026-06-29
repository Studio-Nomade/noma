# Recursos de marca · Studio Nomade

Base de assets para la cotización/deck de Noma. **El equipo de diseño reemplaza
estos archivos** a medida que avanza el Design System; el código los consume desde
`src/lib/brand/brand.ts` (no hace falta tocar código para cambiar un asset, solo
mantener el mismo nombre de archivo).

## Estructura

```
public/brand/
├── logo/
│   ├── nomade.svg          # logotipo principal (usado en portada y cierre)
│   └── nomade-mono.svg      # versión monocroma (opcional)
├── banners/
│   └── cover-default.(svg|png)   # banner genérico de portada (opcional)
└── areas/
    ├── B&D.(svg|png)        # banner/acento por área (opcional)
    ├── WD.(svg|png)
    ├── A&D.(svg|png)
    ├── A&A.(svg|png)
    ├── CE.(svg|png)
    └── MP.(svg|png)
```

## Convenciones

- **Formato**: SVG preferido (vectorial, nítido en PDF). PNG @2x si no hay SVG.
- **Slides**: el deck es **16:9 (1440×810)**. Los banners full-bleed deben respetar
  esa proporción.
- **Colores de marca** (también en `src/lib/brand/brand.ts`):
  - Negro editorial `#1d1d1b` · Crema `#ecf0ee` · **Naranja Nomade `#f48134`** · Blanco `#ffffff`
- **Tipografía**: la del sistema (Poppins display / DM Sans texto) salvo que el
  Design System defina otra.

## Cómo se conecta

- `BRAND` (logo, colores, datos de contacto) y `AREA_THEME` (etiqueta + acento +
  banner por área) viven en `src/lib/brand/brand.ts`.
- Para cambiar un color de área o asignar un banner, editar ese archivo y dejar el
  asset en la carpeta correspondiente.
- Mientras no haya assets reales, el deck usa el logo placeholder y los acentos por
  defecto (no se rompe nada).
