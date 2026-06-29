# Noma — guía para agentes

Plataforma interna de Studio Nomade. Lee primero [`README.md`](README.md) y
[`docs/`](docs/) (especialmente `docs/decisions` y `docs/technical/data-model.md`).

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

## Comandos

`npm run dev` · `npm run lint` · `npm run typecheck` · `npm run build` ·
`npm run db:push` · `npm run db:seed` · `npm run rates:sync`

Antes de dar por terminado un cambio: `npm run typecheck && npm run lint`.
