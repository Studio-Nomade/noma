# Integraciones · Noma

Studio Nomade ya opera con un ecosistema de herramientas. Noma combina enlaces guardados en
`resource_links`, integraciones globales del estudio y conexiones OAuth personales.

## Modelos de conexión

- **Google Workspace** ya es per-user mediante Supabase Auth. Su refresh token se mantiene en
  `user_integrations` para no romper Gmail, Calendar, Meet y Drive.
- **Asana operacional** usa `ASANA_ACCESS_TOKEN` central para traspasos y resumen de proyectos.
  Este acceso no se reemplaza por la futura conexión personal.
- **Asana y Slack personales** usan `user_connections`, con PK `(user_id, provider)`. Access y
  refresh tokens se cifran con AES-256-GCM antes de persistirse.
- **OpenAI y Gemini** son cuentas API centrales del estudio configuradas por entorno. No existe
  un flujo para conectar suscripciones personales.

`NOMA_TOKEN_ENCRYPTION_KEY` debe ser base64 de exactamente 32 bytes. Se genera con
`openssl rand -base64 32`, se configura en `.env.local` y Vercel, y nunca se versiona. Su
rotación requiere volver a conectar las cuentas existentes.

Los callbacks OAuth viven bajo `/api/integrations/<provider>/callback`, validan `state` contra
una cookie httpOnly/SameSite=Lax y nunca entregan tokens al cliente. La desconexión intenta
revocar el acceso externo y siempre elimina el registro local.

### Asana personal

La conexión personal solicita identidad y lectura de usuarios, proyectos y tareas. El callback
guarda la identidad de la cuenta y el workspace principal dentro de la metadata cifrada de
`user_connections`. El dashboard usa exclusivamente el token del usuario autenticado para
mostrar sus tareas abiertas; nunca reutiliza `ASANA_ACCESS_TOKEN`, que permanece reservado para
las automatizaciones operacionales del estudio.

Los access tokens se renuevan server-side antes de expirar. Si Asana no informa una nueva
duración, Noma aplica una vigencia conservadora de una hora. Una falla de red, configuración o
autorización degrada la tarjeta a un estado reconectable y no bloquea la carga del dashboard.

### Slack personal

Slack entrega el user token dentro de `authed_user`; Noma lo cifra y guarda junto al usuario y
workspace conectados. El dashboard consulta hasta 20 conversaciones de las que el usuario es
miembro y completa su conteo de no leídos con un fan-out acotado. El resultado saneado se cachea
por usuario durante 60 segundos y solo expone nombre, contador y deep-link a Slack.

Los tokens personales no expiran salvo revocación o rotación. Respuestas como `invalid_auth`,
`token_revoked` o `missing_scope` degradan la tarjeta y permiten volver a conectar la cuenta.
Un feed de menciones queda fuera de alcance porque requiere permisos y disponibilidad de API
adicionales.

## Estado por herramienta

| Herramienta             | Uso en el estudio                                                                      | V1 (Noma)                           | Futuro                                   |
| ----------------------- | -------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------- |
| **Google Drive**        | Unidades compartidas por área → carpetas cliente → subcarpetas por proyecto (fechadas) | Link a carpeta por cliente/proyecto | Crear carpetas y leer documentos vía API |
| **Gemini / Meet Notes** | Notas de reuniones en Drive                                                            | Link a la minuta                    | Vincular minutas automáticamente         |
| **Google Calendar**     | Agendamiento                                                                           | Agenda semanal + crear reuniones    | Sincronización incremental               |
| **Google Meet**         | Reuniones                                                                              | Guardar link de reunión             | —                                        |
| **Slack**               | Canales por cliente/proyecto/área                                                      | Link a canal                        | Alertas y resúmenes                      |
| **Asana**               | Control de proyectos (réplica por áreas)                                               | Estado de tarea/proyecto vinculado  | Portal cliente                           |
| **Canva**               | Presentaciones y piezas editables                                                      | Link a presentación                 | —                                        |

## `resource_links` (modelo)

`entity_type` (client | project | proposal) · `entity_id` · `type` (drive, figma, asana,
notion, slack, canva, meet, calendar, other) · `label` · `url`.

Esto permite que, al activar una integración, ya exista el lugar donde viven los enlaces y su
tipo, sin migración de datos.

Los enlaces de Asana admiten dos modelos operativos: una oportunidad puede vincularse a una
**tarea principal** dentro de un proyecto general o a un **proyecto independiente**. El
dashboard detecta el tipo por la URL, consulta el recurso correspondiente y muestra solo
avance/cierre; no replica las tareas en Noma.

## IA centralizada

`/integrations` muestra si `OPENAI_API_KEY` y `GEMINI_API_KEY` están configuradas sin revelar
sus valores. Los administradores pueden probar cada conexión mediante una llamada server-side
mínima. Anthropic queda fuera de esta etapa. El procesador de briefs conserva su mock hasta
que se active un proveedor real detrás del contrato `BriefExtraction`.

## Portal cliente (V2)

La arquitectura deja preparado:

- Login email/contraseña para clientes (además del SSO interno).
- RLS por cliente sobre proyectos/propuestas.
- Estado de avance idealmente leído desde Asana.
- Tickets/solicitudes inicialmente vía botón a formulario Asana / correo / canal.
