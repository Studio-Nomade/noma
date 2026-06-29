# ADR-002 — Modelo de datos y acceso a datos

**Estado:** Aceptado · **Fecha:** 2026-06-29

## Contexto

El prototipo Base44 modelaba relaciones con arreglos de IDs (`selected_services: string[]`) y
links externos como columnas sueltas. Queremos un modelo relacional limpio en Postgres,
preparado para reportes, integraciones y portal cliente.

## Decisión

- **Postgres relacional vía Drizzle.** Entidades: `clients`, `projects`, `briefs` (1:1 con
  proyecto), `proposals`, `services`, `studio_config`, `team_members`, `knowledge_docs`,
  `context_documents`, `exchange_rates`, `activity_log`.
- **Tabla join `proposal_services`** (en vez de `string[]`) para la relación N:N
  propuesta↔servicio, con `position` y `custom_price` opcional.
- **`resource_links` polimórfica** (`entity_type` + `entity_id` + `type` + `url`) para enlaces
  externos (Drive, Figma, Asana, Slack, Canva, Meet, Calendar). Prepara las integraciones.
- **Convención de dinero:** todo monto se guarda como par `*_amount` (numeric) + `*_currency`
  (enum CLP/USD/UF). Conversión al vuelo con `exchange_rates`. Ver [ADR-005](ADR-005-moneda-uf.md).
- **Briefs:** campos generales tipados + `specific_fields jsonb` para preguntas por área.
- **Acceso a datos server-only** (Server Components/Actions); autorización en capa de servicio.
  **RLS habilitada** con baseline "solo usuarios autenticados".

## Consecuencias

- Consultas y orden de servicios en propuestas más limpios; valores monetarios consistentes.
- `jsonb` en briefs da flexibilidad por área a costa de validación en aplicación (Zod por área).
- RLS granular (por organización/cliente) se difiere al portal cliente V2.

Detalle completo en [`docs/technical/data-model.md`](../technical/data-model.md).
