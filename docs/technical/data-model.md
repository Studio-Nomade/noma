# Modelo de datos · Noma

Postgres (Supabase) modelado con Drizzle. Todas las tablas incluyen: `id uuid` (PK),
`created_at`, `updated_at` (timestamptz) y `created_by uuid` (→ `auth.users`).

Convención de dinero: cada importe es un par `*_amount numeric` + `*_currency` (enum
`currency` = `CLP | USD | UF`). Ver [ADR-005](../decisions/ADR-005-moneda-uf.md).

## Enums

| Enum                 | Valores                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `area`               | `B&D`, `WD`, `A&D`, `A&A`, `CE`, `SN`                                                                                |
| `client_status`      | Prospecto, Cliente activo, Cliente recurrente, Pausado, Cerrado                                                      |
| `project_status`     | Levantamiento, Brief recibido, Propuesta en desarrollo, Propuesta enviada, Aprobado, En desarrollo, Pausado, Cerrado |
| `commercial_stage`   | Nuevo lead, Levantamiento, Diagnóstico, Propuesta, Negociación, Aprobado, Perdido, Stand by                          |
| `priority`           | Alta, Media, Baja                                                                                                    |
| `brief_status`       | Borrador, Completado                                                                                                 |
| `proposal_status`    | Borrador, En revisión, Enviada, Aprobada, Rechazada                                                                  |
| `service_status`     | Activo, Inactivo                                                                                                     |
| `team_role`          | admin, user                                                                                                          |
| `currency`           | CLP, USD, UF                                                                                                         |
| `link_type`          | drive, figma, asana, notion, slack, canva, meet, calendar, other                                                     |
| `doc_category`       | presupuesto, sla, proceso, plantilla, referencia, otro                                                               |
| `knowledge_category` | process, best-practice, tool-guide, onboarding                                                                       |

> Las áreas mapean a: B&D Branding & Design · WD Web Design · A&D Architecture & Design ·
> A&A Audiovisual & Animation · CE Clínica de Emprendimientos · SN Studio Nomade
> (Operations & Governance).

## Entidades

### clients

`company_name*`, `contact_name`, `contact_role`, `email`, `phone`, `industry`, `website`,
`instagram`, `linkedin`, `status` (client_status, default Prospecto), `internal_notes`.
No se eliminan → se marcan `Cerrado`.

### projects

`name*`, `client_id*` → clients (RESTRICT), `area*`, `project_type`, `description`,
`main_objective`, `start_date`, `delivery_date`, `budget_amount` + `budget_currency`,
`status` (default Levantamiento), `commercial_stage` (default Nuevo lead), `priority`
(default Media), `responsible_id` → team_members, `next_action`, `internal_notes`.

### briefs (1:1 con project)

`project_id*` (único) → projects, `client_id` → clients, `area*`, `project_name`,
`main_objective`, `problem`, `target_audience`, `expected_outcome`, `ideal_deadline`,
`budget_amount` + `budget_currency`, `available_materials`, `general_comments`,
`specific_fields jsonb` (preguntas por área), `status` (default Borrador).

### services (biblioteca global)

`name*`, `area*`, `description`, `deliverables`, `estimated_time`, `price_min_amount`,
`price_max_amount`, `price_currency` (default UF), `requirements`, `status` (default Activo),
`related_services uuid[]`.

### proposals

`project_id*` → projects, `client_id` → clients, `title*`, y las 12 secciones de texto:
`context`, `diagnosis`, `main_objective`, `specific_objectives`, `scope`, `work_stages`,
`deliverables`, `timeline`, `client_requirements`, `exclusions`, `team`,
`commercial_conditions`. Además `estimated_value_amount` + `estimated_value_currency`
(default UF), `status` (default Borrador), `next_action`, `version` (default 1).

### proposal_services (join N:N)

`proposal_id*` → proposals (CASCADE), `service_id*` → services (RESTRICT), `position int`,
`custom_price_amount`, `custom_price_currency`. Único por (`proposal_id`, `service_id`).

### resource_links (polimórfica)

`entity_type` (client | project | proposal), `entity_id uuid`, `type` (link_type),
`label`, `url`. Índice por (`entity_type`, `entity_id`).

### studio_config (singleton)

`studio_name`, `tagline`, `email`, `phone`, `website`, `address`,
`commercial_conditions_template`.

### team_members (usuarios internos + perfil onboarding)

`user_id` → auth.users, `name`, `team_role`, `area`, `email`, `status`, `tools jsonb`,
`access_references jsonb` (referencias a gestor de contraseñas — **nunca** secretos en claro),
`repos jsonb`, `notes`.

### knowledge_docs

`title`, `area`, `category` (knowledge_category), `content` (markdown), `links jsonb`.

### context_documents

`title`, `doc_category`, `area`, `tags jsonb`, `storage_path` (Supabase Storage),
`mime_type`, `source`, `notes`.

### exchange_rates

`date` (único), `uf_clp numeric`, `usd_clp numeric`. Poblada por `rates:sync`.

### activity_log (alimenta "Actividad reciente")

`entity_type`, `entity_id`, `action`, `actor_id` → auth.users.

## Relaciones

```
Client 1 ──── N Project 1 ──── 1 Brief
                       1 ──── N Proposal N ──── N Service   (vía proposal_services)
resource_links ── polimórfico ──> Client | Project | Proposal
Service (biblioteca global)        StudioConfig (singleton)
team_members ── user_id ──> auth.users
```

## Reglas de negocio

1. Un brief por proyecto (1:1).
2. Múltiples propuestas por proyecto (versionado vía `version`).
3. `proposal_services` referencia servicios por ID; el precio puede sobrescribirse por propuesta.
4. Clientes y propuestas no se eliminan (se marcan Cerrado / Rechazada).
5. Todo proyecto tiene cliente (`client_id` obligatorio).
6. Proyectos activos deben tener `next_action`.
7. Servicios inactivos no aparecen en la selección de propuestas.
