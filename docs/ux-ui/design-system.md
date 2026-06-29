# Design System · Noma

> Estilos **interinos**. El equipo de diseño de Studio Nomade entregará el Design System
> oficial; toda la identidad vive en tokens (CSS variables en `src/app/globals.css`) para
> reemplazarla sin refactor de componentes.

## Principios

1. **Claridad sobre decoración** — cada elemento cumple una función.
2. **Densidad controlada** — el espacio en blanco es activo.
3. **Jerarquía editorial** — los títulos mandan, los datos apoyan.
4. **Profesionalismo con carácter** — no se parece a Notion ni a Salesforce.
5. **Feedback instantáneo** — estados de carga, vacíos y error son parte del diseño.

## Color (tokens semánticos)

Paleta editorial: crema cálido + negro editorial. Valores en `:root` de `globals.css`.

| Token                  | Uso                                                                |
| ---------------------- | ------------------------------------------------------------------ |
| `--background`         | Crema cálido — fondo general                                       |
| `--foreground`         | Negro editorial — texto y elementos activos                        |
| `--card`               | Blanco — superficie de cards                                       |
| `--border` / `--input` | Gris cálido suave                                                  |
| `--muted-foreground`   | Gris medio — textos secundarios, labels                            |
| `--accent`             | Crema acentuado — hover y fondos sutiles                           |
| `--primary`            | Negro editorial (acción primaria: `bg-foreground text-background`) |
| `--destructive`        | Rojo — errores, eliminación                                        |

### Badges de estado (semánticos)

Pares `--status-*` / `--status-*-bg` para: **azul** (prospecto/levantamiento), **violeta**
(en desarrollo/propuesta), **esmeralda** (activo/aprobado), **ámbar** (pausado/revisión),
**rojo** (rechazado/perdido), **pizarra** (cerrado/inactivo). El color acompaña siempre al
texto del estado; nunca solo color.

## Tipografía

- **Body / UI:** DM Sans (`--font-sans`).
- **Display / títulos:** Poppins (`--font-heading`), aplicado a `h1–h4` y `.font-heading`.

Escala: `text-2xl font-semibold` (título de página) · `text-lg font-medium` (subtítulo) ·
`text-sm` (cuerpo/tablas) · `text-xs` (labels/badges). Máximo ~3 tamaños por vista.

## Layout

Split layout fijo: **sidebar 224px** (`w-56`, fondo card, borde derecho) + **contenido**
(`flex-1`, scroll propio, `p-8`). Sin topbar; navegación lateral. Colapsa en móvil (sidebar
en `Sheet`).

## Componentes base (en `src/components`)

- `layout/Sidebar`, `layout/Shell` — shell con navegación.
- `shared/MetricCard` — número grande + label uppercase.
- `shared/StatusBadge` — badge semántico por valor.
- `shared/DataTable` — tabla con headers uppercase, rows con hover.
- `shared/EmptyState` — ícono + título + subtexto + CTA.
- `ui/*` — primitives shadcn/ui (button, input, dialog, select, ...).

## Patrones

- **Cards:** `rounded-xl border bg-card p-5/6`, header con título + acción secundaria.
- **Tablas:** headers `text-xs uppercase tracking-wide text-muted-foreground`, `border-b` por
  fila, hover `bg-accent/50`.
- **Formularios:** label sobre el input, ancho completo, secciones con subtítulos, acciones
  abajo, validación inline.
- **Botones:** 1 primario por sección; `outline` secundario; `ghost` baja jerarquía;
  `destructive` a la derecha. Texto = verbo en infinitivo.
- **Estados vacíos/carga/error:** siempre con acción de recuperación o CTA.
