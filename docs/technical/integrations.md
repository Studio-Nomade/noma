# Integraciones · Noma

Studio Nomade ya opera con un ecosistema de herramientas. En V1 Noma **documenta y enlaza**
(no integra automáticamente). Toda integración futura se apoya en la tabla `resource_links`.

## Estado por herramienta

| Herramienta             | Uso en el estudio                                                                      | V1 (Noma)                           | Futuro                                          |
| ----------------------- | -------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------- |
| **Google Drive**        | Unidades compartidas por área → carpetas cliente → subcarpetas por proyecto (fechadas) | Link a carpeta por cliente/proyecto | Crear carpetas y leer documentos vía API        |
| **Gemini / Meet Notes** | Notas de reuniones en Drive                                                            | Link a la minuta                    | Vincular minutas automáticamente                |
| **Google Calendar**     | Agendamiento                                                                           | —                                   | Mostrar próximas reuniones por cliente/proyecto |
| **Google Meet**         | Reuniones                                                                              | Guardar link de reunión             | —                                               |
| **Slack**               | Canales por cliente/proyecto/área                                                      | Link a canal                        | Alertas y resúmenes                             |
| **Asana**               | Control de proyectos (réplica por áreas)                                               | Link a proyecto Asana               | Extraer estado de avance (portal cliente)       |
| **Canva**               | Presentaciones y piezas editables                                                      | Link a presentación                 | —                                               |

## `resource_links` (modelo)

`entity_type` (client | project | proposal) · `entity_id` · `type` (drive, figma, asana,
notion, slack, canva, meet, calendar, other) · `label` · `url`.

Esto permite que, al activar una integración, ya exista el lugar donde viven los enlaces y su
tipo, sin migración de datos.

## IA (preparada)

`src/lib/ai/provider.ts` expone `LLMProvider.generateProposal(input)` con el
`response_json_schema` de las 12 secciones. Activación en v1.1 con Anthropic Claude
(server-side). Ver [ADR-004](../decisions/ADR-004-ai-provider.md).

## Portal cliente (V2)

La arquitectura deja preparado:

- Login email/contraseña para clientes (además del SSO interno).
- RLS por cliente sobre proyectos/propuestas.
- Estado de avance idealmente leído desde Asana.
- Tickets/solicitudes inicialmente vía botón a formulario Asana / correo / canal.
