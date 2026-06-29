# Arquitectura · Noma

## Visión general

```
┌──────────────────────────────────────────────┐
│  Next.js 15 (App Router) en Vercel            │
│  · Server Components (lectura de datos)        │
│  · Server Actions (escrituras, validadas Zod)  │
│  · Client Components (interacción/formularios)  │
│  · Middleware @supabase/ssr (sesión)           │
└───────────────┬───────────────┬───────────────┘
                │               │
        Drizzle │               │ supabase-js
                ▼               ▼
        ┌───────────────────────────────┐
        │  Supabase (sa-east-1)          │
        │  Postgres · Auth · Storage     │
        │  RLS (baseline autenticados)   │
        └───────────────────────────────┘
                │
        ┌───────▼─────────────┐   ┌──────────────────────┐
        │ mindicador.cl (UF/$)│   │ LLMProvider (futuro)  │
        └─────────────────────┘   │ Anthropic Claude      │
                                   └──────────────────────┘
```

## Principios

- **Server-first.** Lectura en Server Components; mutaciones en Server Actions. El cliente
  solo recibe lo necesario. La API key de IA y la service role key nunca llegan al navegador.
- **Validación compartida.** Schemas Zod por entidad/área se usan en el formulario
  (react-hook-form) y en la server action (revalidación en servidor).
- **Capa de datos en `src/db`** (Drizzle): schema, migraciones y queries tipadas. Acceso a
  Auth/Storage vía `@supabase/ssr` en `src/lib/supabase`.
- **Features verticales.** Cada módulo en `src/features/<modulo>` agrupa sus componentes,
  acciones, queries y schemas.
- **Tokens de diseño.** La identidad visual vive en CSS variables (`globals.css`); cambiar el
  Design System oficial no requiere tocar componentes. Ver
  [design-system.md](../ux-ui/design-system.md).

## Flujo de autenticación

1. Usuario entra → middleware revisa sesión Supabase.
2. Sin sesión → `/login` con Google OAuth (Workspace).
3. Callback `/auth/callback` intercambia el código por sesión.
4. (Opcional) se valida dominio `@studionomade.cl`.
5. Rutas de la app protegidas; layout con sidebar.

Ver [ADR-003](../decisions/ADR-003-auth-permisos.md).

## Generación de propuestas (preparado, no activo en V1)

`src/lib/ai/provider.ts` define la interfaz `LLMProvider.generateProposal(input)` que
devuelve las 12 secciones. En V1 es un stub; al activar se implementa con Anthropic Claude en
una server action. Ver [ADR-004](../decisions/ADR-004-ai-provider.md).

## Integraciones futuras

Los enlaces externos se modelan hoy con `resource_links`. Las integraciones activas
(Google Drive/Calendar, Asana, Slack, Canva) y el portal cliente se documentan en
[integrations.md](integrations.md).
