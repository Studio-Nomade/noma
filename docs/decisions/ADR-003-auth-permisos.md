# ADR-003 — Autenticación y permisos

**Estado:** Aceptado · **Fecha:** 2026-06-29

## Contexto

Studio Nomade vive en el ecosistema Google (Drive, Calendar, Meet, Gemini). El equipo es
pequeño y de confianza. En V2 se requerirá dar acceso a clientes a sus propios dashboards.

## Decisión

- **V1 — Google Workspace SSO** vía Supabase Auth + Google OAuth, integrado en Next con
  `@supabase/ssr` (middleware de sesión). Sin gestión de contraseñas.
- Opción de **restringir el dominio** a `@studionomade.cl` (allowlist) — configurable por
  variable de entorno `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN`.
- **Permisos V1:** todos los usuarios internos ven y editan todo. Roles `admin` / `user`
  existen en el modelo (`team_members.team_role`) para diferenciar borrado y configuración
  global, pero la visibilidad es total.
- **Fase posterior:** permisos por cargo (granularidad por rol/área).
- **V2 — Portal cliente:** login adicional con **email/contraseña** para clientes, con RLS
  que limite cada cliente a sus propios proyectos/propuestas.

## Consecuencias

- Onboarding de acceso inmediato para el equipo (cuenta Google existente).
- La capa de autorización fina (RLS por organización) se diseña ahora pero se activa con el
  portal cliente. Toda escritura pasa por server actions que validan rol cuando corresponda
  (borrado, configuración).
