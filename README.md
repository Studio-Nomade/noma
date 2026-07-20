# Noma

Plataforma interna a medida de **Studio Nomade** — el corazón operativo y comercial del
estudio. Centraliza clientes, proyectos, briefs, propuestas y la biblioteca de servicios en
un solo sistema, con estética editorial boutique.

> Regla cultural: **si un proyecto/cliente/propuesta no está en Noma, no existe para el
> estudio como unidad de negocio.**

## Stack

- **Next.js 15** (App Router) · React 19 · TypeScript
- **Tailwind CSS v4** + **shadcn/ui** (Radix) — design system editorial tokenizado
- **Supabase** (PostgreSQL · Auth · Storage), región `sa-east-1`
- **Drizzle ORM** (schema + migraciones versionadas)
- **Zod** + **react-hook-form** (validación compartida)
- Auth: **Google Workspace SSO** (Supabase Auth)
- Moneda: **CLP / USD / UF** con conversor diario (mindicador.cl)
- IA de propuestas: arquitectura lista (interfaz `LLMProvider`), activable en fase futura
- Deploy: **Vercel** → `app.studionomade.cl` · DNS **Cloudflare**

Decisiones detalladas en [`/docs/decisions`](docs/decisions).

## Requisitos

- **Node ≥ 20.19** (ver `.nvmrc`). _Nota:_ el proyecto está fijado a Next 15 para correr en
  Node 20.12+. Al subir a Node 20.19/22 se puede migrar a Next 16.
- Cuenta de Supabase y proyecto creado.

## Setup local

Desarrollo contra **Postgres local** (no contra Supabase de producción):

```bash
cp .env.example .env.local   # completar credenciales de Supabase (Auth/Storage)
createdb noma                # Postgres local (brew services start postgresql@16)
# En .env.local dejar DATABASE_URL="postgresql://postgres@localhost:5432/noma"
npm install
npm run db:deploy            # aplica todas las migraciones a la base local
npm run db:seed              # áreas, servicios demo, studio_config y datos de Finanzas
npm run dev                  # http://localhost:3000
```

> **DEV vs PROD:** en local, `DATABASE_URL` apunta a Postgres local; Supabase queda solo
> para producción (y para Auth/Storage, que sí usan el proyecto Supabase también en dev).
> `db:deploy` usa un migrador seguro (`scripts/migrate.ts`) compatible con drizzle-kit que
> evita el error 55P04 al aplicar todas las migraciones desde cero.

## Módulo CFO / Finanzas

Dashboard financiero **gateado por rol** (solo `NOMA_FINANCE_EMAILS`) en `/finanzas`:
importa facturas de Nubox y cartolas BCI (CSV/Excel), clasifica contra el plan de cuentas,
concilia pagos contra el banco y proyecta flujo de caja. Dialoga con clientes/facturas del
resto de Noma (`fin_documents.invoice_id` enlaza con `invoices`). Ver módulo en
[`src/features/finance`](src/features/finance).

## Deploy (GitHub → Supabase → Vercel)

- **App**: Vercel despliega por integración Git (rama `main`). Configurar las env vars del
  `.env.example` en Vercel (usar el **pooler** de Supabase, puerto 6543, en `DATABASE_URL`).
- **Migraciones**: la Action [`.github/workflows/migrate.yml`](.github/workflows/migrate.yml)
  corre `npm run db:deploy` contra Supabase al mergear a `main`. Requiere el secreto
  `DATABASE_URL` de GitHub con la **conexión directa** (puerto 5432).

## Scripts

| Script                           | Descripción                                    |
| -------------------------------- | ---------------------------------------------- |
| `npm run dev`                    | Servidor de desarrollo                         |
| `npm run build` / `start`        | Build y arranque de producción                 |
| `npm run lint` / `typecheck`     | ESLint / TypeScript                            |
| `npm run format`                 | Prettier                                       |
| `npm run db:generate`            | Genera migraciones SQL desde el schema Drizzle |
| `npm run db:deploy`              | Aplica migraciones (migrador seguro, local/CI) |
| `npm run db:migrate` / `db:push` | drizzle-kit: migra / sincroniza schema         |
| `npm run db:seed`                | Carga datos iniciales (incluye Finanzas)       |
| `npm run rates:sync`             | Sincroniza UF y dólar observado                |

## Estructura

```
src/
  app/         Rutas (App Router) + layout con sidebar
  components/  ui/ (shadcn) · layout/ · shared/
  features/    Lógica por módulo (clients, projects, briefs, proposals, ...)
  lib/         supabase/ · auth/ · ai/ · currency/ · utils
  db/          schema Drizzle · migraciones · seed
  types/       enums y tipos de dominio
docs/          Documentación de producto, técnica, UX y decisiones (ADR)
scripts/       Tareas (seed, sync de tasas)
```

El conocimiento interno y estratégico del estudio (procesos, pricing, análisis de
servicios/SLA, presupuestos) vive en el repositorio **privado** `noma-ops`, no en este repo.

## Documentación

- Producto: [`docs/product`](docs/product) — PRD, roadmap, alcance
- Técnica: [`docs/technical`](docs/technical) — TRD, arquitectura, modelo de datos,
  integraciones
- UX/UI: [`docs/ux-ui`](docs/ux-ui) — design system, flujos, pantallas
- Decisiones: [`docs/decisions`](docs/decisions) — ADRs

> La documentación operativa interna (procesos, onboarding, fricciones, pricing, análisis de
> servicios y SLA) se mantiene en el repositorio privado `noma-ops`.

El plan de ejecución por fases vive en el plan aprobado del proyecto.
