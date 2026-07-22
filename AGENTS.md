# Noma — guía para agentes

Plataforma interna de Studio Nomade. Lee primero [`README.md`](README.md) y
[`docs/`](docs/) (especialmente `docs/decisions` y `docs/technical/data-model.md`).

## Frontera obligatoria entre repositorios

Noma está dividido en dos repositorios hermanos. Antes de crear o editar un
archivo, clasifica el resultado y trabaja en el repositorio correspondiente:

- **`noma` / `noma-app`** — `/Users/sebastian.oaks/Sites/noma` · repositorio
  público y desplegable. Aquí van exclusivamente el código funcional de la app,
  tests, configuración, assets públicos y documentación técnica no sensible
  necesaria para construir, operar o mantener el producto (`src/`,
  `docs/technical`, `docs/product`, `docs/ux-ui`, `docs/decisions`).
- **`noma-ops`** — `/Users/sebastian.oaks/Sites/noma-ops` · repositorio privado,
  no desplegable. Aquí van la documentación interna, procesos, análisis,
  información sensible, pricing real, catálogo y detalle de servicios,
  taxonomía comercial, SLA reales, propuestas, presupuestos, datos crudos y
  derivados (`docs/operations`, `docs/services`, `docs/proposals`, `docs/sla`,
  `docs/data-analysis`, `data/`, `context/`, extractores y semillas sensibles).
- **Secretos** — credenciales, tokens, contraseñas y archivos `.env*` no deben
  versionarse en ninguno de los dos repositorios; se mantienen en el gestor de
  secretos o en variables de entorno.

Reglas de ejecución:

1. Todo ajuste funcional o de código de producto se implementa en `noma`.
2. Todo contenido operativo, comercial, estratégico o sensible se crea y edita
   en `noma-ops`; nunca se reintroduce ni se copia a `noma`.
3. Si una tarea mezcla código y contenido sensible, divídela en dos cambios, uno
   por repositorio. En `noma`, deja solo el contrato, schema, importador o puntero
   genérico; el contenido real permanece en `noma-ops`.
4. Los importadores de `noma` leen el insumo privado desde
   `process.env.NOMA_DATA_DIR ?? "../noma-ops"`. `noma-ops` no participa del
   build ni del deploy de Vercel.
5. Antes de cerrar una tarea, revisa `git diff` y confirma que ningún dato de
   clientes, precio real, presupuesto, taxonomía interna o documento operativo
   haya quedado en `noma`.
6. En `noma`, las ramas van por PR a `testing` y el deploy sale desde `main`. En
   `noma-ops`, usa ramas `docs/*`, `analysis/*` u `ops/*` y commits a `main`.

## Stack

- Next.js **15** (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui
- Supabase (Postgres/Auth/Storage) · Drizzle ORM · Zod + react-hook-form
- Auth: Google Workspace SSO · Moneda: CLP/USD/UF

## Reglas

- **Next 15** (no 16): el entorno corre Node 20.12. No subir Next sin antes subir Node.
- Lectura de datos en **Server Components**; mutaciones en **Server Actions** validadas con Zod.
- Dinero = par `*_amount` + `*_currency` (UF por defecto). Conversión es de presentación.
- Identidad visual en tokens CSS (`src/app/globals.css`); no hardcodear colores.
- Componentes shadcn viven en `src/components/ui` (gestionados por CLI; evitar editarlos a mano).
- No almacenar secretos/contraseñas en claro (onboarding usa referencias a gestor externo).

## Servidor de desarrollo (convención obligatoria)

El **localhost canónico de Noma es `http://localhost:3001`**. Es **uno solo y compartido**
entre todos los agentes (Claude y Codex) y el usuario.

- Se levanta siempre con `npm run dev` (el puerto está fijo con `-p 3001`; `.claude/launch.json`
  tiene `autoPort: false`). **No** levantar el dev server en otro puerto ni con `next dev` suelto.
- Antes de levantar uno nuevo, verificar si ya hay uno corriendo (`lsof -ti:3001`) y reutilizarlo.
- **Todo cambio se verifica en ese localhost** antes de dar un hito por terminado: navegar la
  página afectada, ejercitar el caso principal y revisar que no haya errores en consola/red.
- Tras aplicar una migración, **reiniciar** el dev server (suelta conexiones con el catálogo viejo).

## Comandos

`npm run dev` (→ puerto 3001) · `npm run lint` · `npm run typecheck` · `npm run build` ·
`npm run db:push` · `npm run db:seed` · `npm run rates:sync`

Migraciones en local: `npm run db:deploy` (**no** `db:migrate`).

Antes de dar por terminado un cambio: `npm run typecheck && npm run lint`.
