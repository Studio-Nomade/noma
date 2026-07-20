# Contribuir a Noma

## Flujo de trabajo

- Ramas: `feature/*`, `fix/*`, `chore/*`.
- **Los PR van siempre a `testing`**, no a `main`. Vercel deploya desde `main`.
- Antes de dar por terminado un cambio: `npm run typecheck && npm run lint`.

## Setup

Ver [`README.md`](README.md) y [`docs/technical`](docs/technical) (setup, deploy, entorno).
Requiere Node 20.12 (ver `.nvmrc`). Copiar `.env.example` a `.env.local` y completar valores.

## Reglas del proyecto

- Next.js 15 (no 16 hasta subir Node). Lectura en Server Components; mutaciones en Server
  Actions validadas con Zod.
- Dinero = par `*_amount` + `*_currency` (UF por defecto); la conversión es de presentación.
- Identidad visual en tokens CSS (`src/app/globals.css`); no hardcodear colores.
- Componentes shadcn en `src/components/ui` (gestionados por CLI; no editar a mano).

## Qué NO va en este repo

Conocimiento interno, comercial o estratégico (pricing real, procesos del estudio, análisis
de servicios/SLA, presupuestos, datos de clientes) → repositorio **privado** `noma-ops`.
Nunca subir secretos ni credenciales (ver [`SECURITY.md`](SECURITY.md)).
