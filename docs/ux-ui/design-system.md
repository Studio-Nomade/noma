# Design System · Noma

Sistema visual de la plataforma interna de Studio Nomade: **editorial y minimalista, con
profundidad de vidrio sobre un fondo vivo**. Toda la identidad vive en tokens CSS
(`src/app/globals.css`); los componentes no hardcodean colores, sombras ni curvas de
animación, así que la identidad se puede reemplazar sin refactor.

## Principios

1. **Claridad sobre decoración** — cada elemento cumple una función.
2. **Densidad controlada** — el espacio en blanco es activo.
3. **Jerarquía editorial** — los títulos mandan, los datos apoyan.
4. **Profundidad con propósito** — el vidrio separa planos y jerarquiza; no decora. Donde
   estorba a la lectura de datos, se usa superficie sólida.
5. **Feedback instantáneo** — estados de carga, vacíos y error son parte del diseño.

---

## Color

Paleta editorial: **crema cálido + negro editorial**. Valores en `:root` de `globals.css`.

| Token                  | Uso                                      |
| ---------------------- | ---------------------------------------- |
| `--background`         | Crema cálido — fondo general             |
| `--foreground`         | Negro editorial — texto y activos        |
| `--card`               | Blanco — base de las superficies         |
| `--border` / `--input` | Gris cálido suave                        |
| `--muted-foreground`   | Gris medio — textos secundarios, labels  |
| `--accent`             | Crema acentuado — hover y fondos sutiles |
| `--primary`            | Negro editorial (acción primaria)        |
| `--destructive`        | Rojo — errores, eliminación              |

### Modo oscuro

`next-themes` con `attribute="class"` (`ThemeProvider` en `src/components/layout/`). Los
tokens `.dark` **no** son los grises neutros de shadcn: se recalibraron a **tinta cálida**
(matiz 45, el mismo de la paleta clara) para que el oscuro se lea como "Nomade de noche".
El toggle vive en el pie del sidebar.

### Badges de estado

Pares `--status-*` / `--status-*-bg` para **azul** (prospecto/levantamiento), **violeta**
(en desarrollo/propuesta), **esmeralda** (activo/aprobado), **ámbar** (pausado/revisión),
**rojo** (rechazado/perdido) y **pizarra** (cerrado/inactivo). El fondo va **con alfa**, no
en color plano, para que el badge pertenezca al mismo sistema translúcido que el resto. El
color acompaña siempre al texto del estado; nunca solo color.

## Tipografía

- **Body / UI:** DM Sans (`--font-sans`).
- **Display / títulos:** Poppins (`--font-heading`), aplicado a `h1–h4` y `.font-heading`.

Escala: `text-2xl font-semibold` (título de página) · `text-lg font-medium` (subtítulo) ·
`text-sm` (cuerpo/tablas) · `text-xs` (labels/badges). Máximo ~3 tamaños por vista.

---

## Vidrio

Tokens en `:root` / `.dark`:

| Token                              | Qué controla                                     |
| ---------------------------------- | ------------------------------------------------ |
| `--glass-bg` / `--glass-bg-strong` | Opacidad de la superficie (normal / overlays)    |
| `--glass-border`                   | Hairline de 1px                                  |
| `--glass-highlight`                | Brillo interno superior — el "canto" del cristal |
| `--glass-shadow` / `-lg`           | Sombra difusa cálida (no gris)                   |
| `--glass-blur` / `-strong`         | 16px / 28px                                      |
| `--glass-saturate`                 | 180% — sin esto el vidrio se ve gris y muerto    |

Clases utilitarias (`@layer components`):

- `.glass` — superficie translúcida estándar.
- `.glass-strong` — más opaca y con más blur: shell, diálogos, sheets, command menu,
  cabeceras de tabla. Se usa donde la legibilidad manda sobre la transparencia.
- `.glass-solid` — opaca, mismo borde y sombra, **sin** `backdrop-filter`.
- `.glass-hairline` — solo borde + brillo, sin fondo.
- `.glass-sheen` — brillo horizontal en el canto superior (detalle, no obligatorio).
- `.hover-lift` — elevación en hover para superficies interactivas.

Todas caen a superficie opaca vía `@supports not (backdrop-filter: …)`.

### Primitiva `Surface`

`src/components/shared/surface.tsx` — envoltorio tipado sobre las clases anteriores.
Reemplaza el patrón `rounded-xl border border-border bg-card p-N` que estaba copiado en
decenas de vistas.

| Variante | Cuándo                                                       |
| -------- | ------------------------------------------------------------ |
| `glass`  | Por defecto: cards de contenido, paneles, bloques de detalle |
| `solid`  | Datos densos: contenedores de tabla, listados largos         |
| `raised` | Superficies clicables: suma `.hover-lift`                    |
| `flat`   | Agrupaciones sutiles: solo hairline                          |

En elementos semánticos (`<section>`, `<ul>`, `<details>`) se aplican las clases
directamente en vez de envolver en `Surface`, para no perder la etiqueta.

---

## Fondo ambiental

`src/components/layout/ambient-background.tsx`, montado una vez en el layout raíz. Cuatro
degradés radiales con los acentos de las áreas de Studio Nomade (`AREA_THEME` en
`src/lib/brand/brand.ts`) en deriva lenta (38–52s, desfasados), más grano SVG y viñeta.

Reglas de implementación, no negociables:

- Solo se animan `transform` y `opacity`. Nunca `filter`, `top/left` ni `background`.
- El contenedor lleva `contain: strict` y los blobs `will-change: transform`.
- El lima de A&A entra a menor alfa que el resto: es el acento más saturado y se come la
  cabecera si va parejo con los demás.

---

## Movimiento

Una sola escala para toda la plataforma:

| Token              | Valor                         | Uso                                |
| ------------------ | ----------------------------- | ---------------------------------- |
| `--dur-fast`       | 120ms                         | Hover de filas, feedback inmediato |
| `--dur-base`       | 220ms                         | Botones, items de nav, badges      |
| `--dur-slow`       | 420ms                         | Paneles, sheets, entrada de página |
| `--ease-out-expo`  | `cubic-bezier(.16,1,.3,1)`    | Curva por defecto                  |
| `--ease-out-quint` | `cubic-bezier(.22,1,.36,1)`   | Movimiento ambiental               |
| `--ease-spring`    | `cubic-bezier(.34,1.4,.64,1)` | Aparición de acentos               |

Animaciones disponibles: `.page-enter` (entrada de ruta), `.stagger-in` (listas, con
`style={{ "--i": index }}`), `.indicator-enter` (acento del item activo),
`.skeleton-shimmer` (carga).

**Transiciones de ruta:** no se usa la View Transitions API. Requiere el componente
`<ViewTransition>` de React, que no existe en React estable, y `AGENTS.md` fija Next 15 por
Node 20.12 — se verificó que `experimental.viewTransition` por sí solo no llama a
`document.startViewTransition`. En su lugar, `PageTransition` remonta el contenedor de
contenido por `pathname` y la animación CSS se vuelve a disparar. Se ata al pathname y no a
los searchParams a propósito: filtrar o paginar no debe re-animar la vista.

---

## Layout

Split fijo: **sidebar** (`w-64`, colapsable a `w-20`, vidrio fuerte, estado en
`localStorage`) + **contenido** (`max-w-6xl`, transparente para que se vea el fondo
ambiental). En móvil el sidebar pasa a `Sheet` y aparece una topbar de vidrio.

## Componentes base (en `src/components`)

- `layout/AppShell`, `layout/SidebarNav`, `layout/Brand` — shell y navegación.
- `layout/AmbientBackground`, `layout/ThemeProvider`, `layout/ThemeToggle`,
  `layout/PageTransition` — capa ambiental, tema y transición de ruta.
- `shared/Surface` — superficie base del sistema.
- `shared/MetricCard` — número grande + label uppercase.
- `shared/StatusBadge` — badge semántico por valor.
- `shared/EmptyState` — ícono + título + subtexto + CTA.
- `ui/*` — primitives shadcn/ui (gestionados por CLI; evitar editarlos a mano).

## Patrones

- **Cards:** `Surface` (o `.glass`) con `rounded-xl`, header con título + acción secundaria.
- **Tablas:** contenedor `solid`; cabecera con `.glass-strong`; headers
  `text-xs uppercase tracking-wide`; filas con hover `bg-accent/60`.
- **Formularios:** label sobre el input, ancho completo, secciones con subtítulos, acciones
  abajo, validación inline.
- **Botones:** 1 primario por sección. `default` sólido con brillo interno; `outline` es
  vidrio real; `ghost` baja jerarquía; `destructive` a la derecha. Texto = verbo en infinitivo.
- **Estados vacíos/carga/error:** siempre con acción de recuperación o CTA.

---

## Accesibilidad y performance

- **Contraste:** el texto nunca va sobre translúcido puro. `--glass-bg` está calibrado para
  mantener ≥4.5:1 con `--foreground` en ambos temas. Al tocar las opacidades, revalidar.
- **`prefers-reduced-motion: reduce`** apaga el fondo ambiental y colapsa todas las
  transiciones. Es una regla global al final de `globals.css`.
- **Dónde NUNCA va `backdrop-filter`:** filas de tabla, badges, y cualquier elemento que se
  repita decenas de veces en una vista. Cada uno crea una capa de compositing.
- **Impresión:** `@media print` elimina el fondo ambiental y neutraliza vidrio y sombras.
  El deck de propuestas (`(print)/`) sale en blanco sólido.
