# Modelo de datos de servicios (evolución)

Extiende el `services` actual y agrega soporte modular. Dinero = par
`*_amount` (UF) + recálculo CLP de presentación (no se guarda CLP congelado).

## `services` — campos a agregar

| Campo                         | Tipo                                       | Notas                           |
| ----------------------------- | ------------------------------------------ | ------------------------------- |
| `subarea`                     | text                                       | ej. "Identidad Visual"          |
| `category`                    | text                                       | opcional, agrupación fina       |
| `complexity_level`            | enum `Light/Medium/Regular/Bold`, nullable | servicios compuestos            |
| `price_type`                  | enum `uf / unit / range / variable`        | `unit` = CLP por unidad (merch) |
| `unit`                        | text                                       | ej. "Mensual", "c/u"            |
| `is_composite`                | boolean                                    | true si se arma de módulos      |
| `source_file` / `source_year` | text                                       | trazabilidad del insumo         |

> Ya existen: `name, area, description, deliverables, estimatedTime,
priceMin/MaxAmount, priceCurrency (UF), requirements, status`.

## `service_modules` (nueva)

Módulos reutilizables que componen servicios y pueden venderse solos.

| Campo                          | Tipo                 |
| ------------------------------ | -------------------- |
| `id`                           | uuid                 |
| `name`                         | text                 |
| `area` / `subarea`             | text                 |
| `description` / `deliverables` | text                 |
| `estimated_time`               | text                 |
| `price_amount`                 | numeric (UF)         |
| `can_be_sold_independently`    | boolean              |
| `status`                       | enum activo/inactivo |

## `service_module_links` (puente N:N)

Relaciona servicios compuestos con sus módulos.

| Campo                 | Tipo                   |
| --------------------- | ---------------------- |
| `service_id`          | uuid → services        |
| `module_id`           | uuid → service_modules |
| `order`               | int                    |
| `included_by_default` | boolean                |

## Lógica de composición

Al seleccionar un servicio compuesto en una cotización, sus módulos
(`included_by_default`) se añaden y suman alcance + entregables + valor (UF). El
usuario puede añadir/quitar módulos opcionales. Esto alimenta luego el SLA.

## Importación

`scripts/import-services.ts` leerá `data/normalized/branding_services.json` y
poblará `services` (Branding). Reglas: `price_type` desde el análisis,
`derived_uf` cuando solo había CLP, `source_file = branding_services_master.xlsx`.
Idempotente por `(area, name)`.
