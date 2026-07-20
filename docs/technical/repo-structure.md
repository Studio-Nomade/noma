# Estructura del repositorio

Noma se organiza en **dos repositorios** que trabajan en conjunto:

## `noma-app` (este repo · público · deployable)

Todo lo necesario para construir, correr y deployar la plataforma.

```txt
src/
  app/         Rutas (App Router)
  components/  UI (incluye ui/ de shadcn)
  features/    Lógica por módulo (clients, projects, briefs, proposals, ...)
  lib/         supabase/ · auth/ · ai/ · currency/ · utils
  db/          schema Drizzle · migraciones · seed
  types/       enums y tipos de dominio
docs/
  technical/   TRD, arquitectura, modelo de datos, integraciones, deploy, seguridad
  product/     PRD, alcance, roadmap, módulo de finanzas
  ux-ui/       design system, flujos, pantallas
  decisions/   ADRs
scripts/       seed, sync de tasas, migraciones, importadores de catálogo
public/        assets estáticos no sensibles
```

## `noma-ops` (privado · conocimiento interno)

Conocimiento operativo, comercial y estratégico del estudio: procesos, fricciones,
onboarding, pricing, taxonomía y análisis de servicios, SLA, análisis de presupuestos,
plantillas de propuesta, y el insumo de datos (`data/`, `context/`) con sus extractores.

## Relación entre ambos

- `noma-app` define la **estructura técnica** (tipos, schemas, componentes, lógica).
- `noma-ops` contiene el **contenido estratégico** (catálogo real, pricing, criterios).
- La app referencia el conocimiento interno por **puntero**, sin copiar contenido sensible.
- Los importadores de catálogo (`scripts/data/import_services*.ts`) viven aquí y leen su
  insumo desde `noma-ops` vía la variable `NOMA_DATA_DIR` (por defecto `../noma-ops`).

Ver los ADR de la separación en `noma-ops/docs/decisions/`.
