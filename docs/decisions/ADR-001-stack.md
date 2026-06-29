# ADR-001 — Stack técnico

**Estado:** Aceptado · **Fecha:** 2026-06-29

## Contexto

Noma nace de un prototipo en Base44 (React/Vite sobre un BaaS propietario). Se decide
construir una app propia, portable y mantenible, fuera de Base44. Debe ser data-heavy,
interna, con estética editorial y preparada para portal cliente e integraciones futuras.

## Decisión

- **Next.js 15 (App Router) + React 19 + TypeScript.** Server Components + Server Actions
  reducen el boilerplate de API en una app interna; SSR portable a Vercel.
- **Tailwind CSS v4 + shadcn/ui (Radix).** Mismos primitives conceptuales que el prototipo;
  el código vive en el repo (sin dependencia de plataforma). Tokens semánticos editoriales.
- **Supabase** (PostgreSQL gestionado + Auth + Storage), región `sa-east-1` (latencia Chile).
- **Drizzle ORM** como fuente de verdad del schema y migraciones versionadas, con tipos
  end-to-end.
- **Zod + react-hook-form** para validación compartida entre formularios y server actions.
- **Vercel** (deploy) + **Cloudflare** (DNS) + **GitHub** (repo/respaldo).

### Nota de versión

Next se fija en **15.x** porque el entorno de desarrollo corre Node 20.12 y Next 16 exige
Node ≥ 20.19. Al actualizar Node (20.19/22 LTS) se puede migrar a Next 16.

## Consecuencias

- Acceso a datos **server-only** (Server Components/Actions) detrás de auth; menos superficie
  pública.
- shadcn/ui implica mantener los componentes en `src/components/ui` (se actualizan vía CLI).
- Drizzle + Supabase: las migraciones se gestionan con `drizzle-kit`; Supabase aporta Auth,
  Storage y RLS. Ver [ADR-002](ADR-002-data-model.md) y [ADR-003](ADR-003-auth-permisos.md).
