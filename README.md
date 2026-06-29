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

```bash
cp .env.example .env.local   # completar credenciales de Supabase
npm install
npm run db:push              # aplicar el schema a la base (Fase 1+)
npm run db:seed              # cargar áreas, servicios demo y studio_config
npm run dev                  # http://localhost:3000
```

## Scripts

| Script                           | Descripción                                    |
| -------------------------------- | ---------------------------------------------- |
| `npm run dev`                    | Servidor de desarrollo                         |
| `npm run build` / `start`        | Build y arranque de producción                 |
| `npm run lint` / `typecheck`     | ESLint / TypeScript                            |
| `npm run format`                 | Prettier                                       |
| `npm run db:generate`            | Genera migraciones SQL desde el schema Drizzle |
| `npm run db:migrate` / `db:push` | Aplica migraciones / sincroniza schema         |
| `npm run db:seed`                | Carga datos iniciales                          |
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
context/       Materiales fuente del estudio (privado, no versionado)
scripts/       Tareas (seed, sync de tasas)
```

## Documentación

- Producto: [`docs/product`](docs/product) — PRD, roadmap, alcance
- Técnica: [`docs/technical`](docs/technical) — TRD, arquitectura, modelo de datos,
  integraciones
- UX/UI: [`docs/ux-ui`](docs/ux-ui) — design system, flujos, pantallas
- Operaciones: [`docs/operations`](docs/operations) — procesos, onboarding, mapa de
  herramientas, fricciones
- Decisiones: [`docs/decisions`](docs/decisions) — ADRs

El plan de ejecución por fases vive en el plan aprobado del proyecto.
