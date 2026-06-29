# Módulos de SLA (taxonomía + modelo)

El SLA se compone de módulos reutilizables. Al seleccionar servicios en una
cotización, Noma sugiere/arma el SLA con los módulos correspondientes.

## Categorías de módulo

| Categoría | Cuándo se incluye | Ejemplos |
|---|---|---|
| `general` | Siempre (fijos) | Información General, Responsabilidades, SLOs, Proceso de trabajo, Cronograma, Exclusiones, Facturación, Modificación, Rescisión, Vigencia y Aceptación |
| `scope` | Si el servicio asociado está en la propuesta | Alcance Branding, Alcance Manual de Marca, Alcance Web, Alcance Migración, Alcance Audiovisual… |
| `annex` | Condicional (regla) | Anexo Mantención (si hay servicio de mantención) |

## Orden sugerido (del análisis)

Información General → Responsabilidades → Descripción de servicios (módulos
`scope`) → SLOs → Proceso de trabajo → Cronograma → Exclusiones → Facturación →
Modificación → Rescisión → Vigencia y Aceptación → Anexos.

## Modelo `sla_modules`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `name` | text | ej. "Alcance Web" |
| `category` | enum `general/scope/annex` | |
| `area` | enum área, nullable | para módulos `scope` |
| `related_service_id` | uuid → services, nullable | activa el módulo si el servicio está en la propuesta |
| `text_base` | text | con variables `{{cliente}}`, `{{proyecto}}`, `{{plazo}}` |
| `variables` | jsonb | definición de variables editables |
| `activation_rule` | text/jsonb | ej. "siempre", "si service_id ∈ propuesta", "si hay mantención" |
| `order` | int | orden sugerido |
| `status` | enum activo/inactivo | |

## Generación (futuro `generated_slas`)

Entrada: propuesta + servicios seleccionados → resuelve módulos `general` +
`scope` (por servicio) + `annex` (por regla) → reemplaza variables → arma
documento → preview → export PDF. Ver ADR-009 (por escribir).
