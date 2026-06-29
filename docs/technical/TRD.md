# TRD · Noma v1.0

Documento de requerimientos técnicos de la plataforma propia (post-Base44).

## 1. Arquitectura

App Next.js 15 (App Router) desplegada en Vercel, con Supabase (Postgres/Auth/Storage) como
backend. Detalle en [architecture.md](architecture.md).

## 2. Stack

| Capa         | Tecnología                                           |
| ------------ | ---------------------------------------------------- |
| Framework    | Next.js 15 · React 19 · TypeScript                   |
| Estilos / UI | Tailwind CSS v4 · shadcn/ui (Radix) · tokens CSS     |
| Datos        | Supabase Postgres + Drizzle ORM                      |
| Auth         | Supabase Auth + Google OAuth (`@supabase/ssr`)       |
| Validación   | Zod + react-hook-form                                |
| Storage      | Supabase Storage                                     |
| Moneda       | módulo `currency` + `exchange_rates` (mindicador.cl) |
| IA (futura)  | `LLMProvider` → Anthropic Claude                     |
| Deploy       | Vercel · Cloudflare (DNS) · GitHub                   |

Decisión y justificación: [ADR-001](../decisions/ADR-001-stack.md).

## 3. Autenticación

Google Workspace SSO vía Supabase Auth; sesión gestionada por middleware `@supabase/ssr`.
Rutas protegidas; opción de restringir dominio. Ver [ADR-003](../decisions/ADR-003-auth-permisos.md).

## 4. Base de datos

Modelo relacional en Postgres gestionado con Drizzle (schema + migraciones versionadas en
`src/db`). Entidades, enums y relaciones en [data-model.md](data-model.md).

## 5. Rutas

```
/                      Dashboard
/login · /auth/callback
/clients · /clients/:id
/projects · /projects/:id
/briefs · /briefs/:id
/proposals · /proposals/:id
/services
/settings
/onboarding
/context-docs
/docs
```

## 6. Seguridad

- Acceso solo autenticado; sin rutas públicas (salvo login).
- Datos accedidos server-side; service role key y API keys nunca en el cliente.
- RLS habilitada (baseline autenticados); RLS granular para portal cliente V2.
- Accesos/contraseñas en onboarding: solo **referencias** a gestor externo, nunca en claro.

## 7. Convenciones de código

- TypeScript estricto; Zod como fuente de tipos de entrada.
- Mutaciones en Server Actions; lectura en Server Components. Ver [api-design.md](api-design.md).
- Features verticales en `src/features/<modulo>`.

## 8. Referencia: prototipo Base44

El prototipo original usaba Base44 (BaaS). No forma parte de la infraestructura final; se
conserva solo como referencia funcional/visual. No se migran datos (V1 parte desde cero).
