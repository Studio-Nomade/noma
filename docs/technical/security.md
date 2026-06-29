# Seguridad · Noma

Postura de seguridad de la V1 y checklist de hardening.

## Modelo de acceso a datos

- **Acceso server-only.** Toda lectura/escritura ocurre en el servidor (Server
  Components + Server Actions) usando **Drizzle** con el rol `postgres`
  (`DATABASE_URL`). Ese rol es owner de las tablas y **omite RLS**.
- **La API de datos pública (PostgREST/supabase-js) NO se usa.** Solo usamos
  Supabase para **Auth**.
- **RLS deny-by-default.** Todas las tablas tienen RLS activa **sin políticas
  permisivas**, y se revocó el acceso de `anon`/`authenticated`
  (`src/db/policies.sql`). Resultado: aunque la `publishable key` es pública,
  nadie puede leer/escribir datos por la API directa. Resuelve el linter
  `rls_policy_always_true`.
- **Server Actions** validan sesión (`requireUser`) y, cuando corresponde, rol
  (`requireAdmin`). Entradas validadas con **Zod**; Drizzle parametriza (sin SQL
  injection).

> Portal cliente (V2): se agregarán políticas RLS por cliente + grants para
> `authenticated`, y login email/contraseña. Ver [ADR-003](../decisions/ADR-003-auth-permisos.md).

## Manejo de errores

`src/lib/actions.ts` (`handleActionError`):

- Re-lanza los errores de control de Next (`redirect`/`notFound`).
- Devuelve mensajes de validación de Zod (seguros).
- Para el resto: registra en servidor y devuelve un mensaje **genérico** (no se
  filtran detalles internos/DB al cliente).

## Secretos

- `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` y demás secretos viven solo en
  `.env.local` (gitignored); **nunca** con prefijo `NEXT_PUBLIC`.
- Solo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable,
  diseñada para ser pública) llegan al cliente.
- Onboarding: los accesos se guardan como **referencia** a un gestor externo,
  nunca como secreto en claro.

## Autenticación

- Google Workspace SSO (Supabase Auth). Restricción de dominio en `/auth/callback`
  (`NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN`) + consent screen "Internal" en Google.
- Middleware protege todas las rutas salvo `/login` y `/auth`.

## Checklist de hardening pendiente

- [ ] **Supabase → Authentication → Leaked password protection**: habilitar
      (relevante cuando V2 sume login con contraseña; HaveIBeenPwned).
- [ ] **Rotar la contraseña de la base de datos** si fue compartida por canales
      no seguros (Supabase → Settings → Database → Reset database password; actualizar
      `DATABASE_URL`).
- [ ] Definir gestor de contraseñas del estudio para onboarding (1Password/Bitwarden).
- [ ] Al activar IA: la API key solo en servidor; límites de uso.
- [ ] Producción: variables de entorno en Vercel (no en el repo); revisar el
      linter de Supabase periódicamente.
