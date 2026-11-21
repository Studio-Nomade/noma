# Plantillas SLA por área y servicio

Estado: implementado en rama `feat/sla-templates` · 2026-11-21

## Qué resuelve

Antes, todos los SLA salían del mismo texto genérico (`src/features/sla/generate.ts`)
con la lista de nombres de servicio. Ahora cada área puede tener su SLA estándar y
cada servicio sus cláusulas propias. El flujo no cambia:

cliente → proyecto → propuesta **Aprobada** → `/proposals/[id]/sla` → Generar SLA →
completar datos → firmar → correo de inicio con SLA + propuesta.

## Modelo

Tabla `sla_templates` (migración `0069_sla_templates`):

| Fila                  | `service_id`                       | Contenido                                                          |
| --------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| Plantilla de área     | `null` (una por área)              | `sections` con variables `{{clave}}`, `service_block`, `variables` |
| Cláusulas de servicio | id del servicio (una por servicio) | `clauses` con variables                                            |

## Generación

`generateSla` busca la plantilla del primer área del proyecto que tenga una
(`getAreaSlaTemplate`). Si existe:

1. Arma un bloque por servicio de la propuesta con `service_block`, usando la
   variante contratada (Start → Enterprise): descripción, metodología,
   entregables, exclusiones, plazo y valor.
2. Agrega al bloque las cláusulas del servicio (`getServiceSlaClauses`).
3. Reemplaza `{{servicios}}` y `{{servicios_lista}}` en las secciones del área.
4. Las variables sin valor quedan como `[completar: clave]` y el editor las lista
   antes de firmar.

Si el área no tiene plantilla, se usa el texto genérico de siempre.

Las variables `source: "param"` que no son parámetros base aparecen como campos
en el formulario del SLA y se guardan en `slas.params.campos`.

El PDF usa el color y el nombre del área principal (`AREA_THEME`).

## Importar contenido (desde noma-ops)

El contenido comercial (catálogo, precios y texto de los SLA) vive en noma-ops.

```bash
# catálogo del área con sus 4 niveles
npx tsx scripts/data/import_area_services.ts data/normalized/<area>_services_<año>.json --dry-run
npx tsx scripts/data/import_area_services.ts data/normalized/<area>_services_<año>.json
# plantilla SLA del área + cláusulas por servicio (después del catálogo)
npx tsx scripts/data/import_sla_templates.ts data/normalized/<area>_sla_templates.json
```

Los formatos se validan con `scripts/data/catalog-file.ts`.
