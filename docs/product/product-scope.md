# Alcance V1 · Noma

## Dentro de V1

- Auth Google Workspace SSO + roles admin/user (todos ven todo).
- Design system editorial tokenizado + componentes base.
- **Clientes**: CRUD, detalle, proyectos asociados.
- **Servicios**: biblioteca por área (precios en UF).
- **Proyectos**: estado operativo + etapa comercial + prioridad + próxima acción + links.
- **Briefs**: campos generales + específicos por área (JSON).
- **Propuestas**: secciones editables a mano, selección de servicios, estados, versiones,
  copiar al portapapeles.
- **Dashboard** operativo.
- **Configuración** del estudio + equipo interno.
- **Onboarding interno** + base de conocimiento (accesos por referencia segura).
- **Contexto/Documentación**: carga de archivos a Supabase Storage.
- **Moneda** CLP/USD/UF con conversor diario.
- Scaffolding de integraciones (`resource_links`) y de IA (`LLMProvider`).

## Fuera de V1 (preparado, no implementado)

- Portal cliente (V2).
- Generación de propuestas con IA "viva".
- Export PDF pixel-perfect (V1 = copiar + vista imprimible).
- Integraciones reales con Google/Asana/Slack/Canva (V1 = links manuales).
- Firma digital, facturación, timetracking, notificaciones automáticas.

## Prioridad de módulos

| Prioridad | Módulos                                                            |
| --------- | ------------------------------------------------------------------ |
| P0        | Auth · Design system · Clientes · Servicios · Proyectos · Moneda   |
| P1        | Briefs · Propuestas · Dashboard · Configuración                    |
| P2        | Onboarding · Contexto/Documentación · Scaffolding de integraciones |
