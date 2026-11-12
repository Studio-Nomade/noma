# Solicitudes por correo (canal email)

Extiende el motor de solicitudes (`client_requests`), que hasta ahora solo recibía
WhatsApp, con un canal de correo. Cada cliente escribe a un alias propio
(`cliente@studionomade.cl`) que es **alias de Gmail de una única casilla de servicio**
(`NOMA_REQUESTS_MAILBOX`). Noma crea la tarea en Asana sin Asana AI, confirma en el mismo
hilo con un folio correlativo y mantiene el ciclo entrega → ajustes en ese hilo.

> Los alias reales, clientes, gids de Asana y dominios autorizados son dato operativo:
> viven en `noma-ops/data/email-channels.json`, no en este repositorio.

## Ciclo

Los correos al cliente usan 7 plantillas con la identidad de Studio Nomade
(`src/features/email/email-templates/`, HTML Mustache + texto plano). Todas van en
el mismo hilo y, salvo la confirmación, muestran solo lo nuevo:

| #   | Correo                  | Lo dispara                                                      | En Asana                                         |
| --- | ----------------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| 01  | Solicitud recibida      | Correo nuevo al alias                                           | Crea la tarea (Por revisar vía regla)            |
| 02  | Comentario recibido     | Respuesta del cliente con datos o una pregunta                  | Comentario; fecha y prioridad si cambian         |
| 03  | Tenemos una consulta    | Comentario `CONSULTA` (o `CONSULTA BLOQUEA`)                    | Sin cambio                                       |
| 04  | Entrega NN              | Comentario `ENTREGA NN` + un archivo por línea (`Nombre: link`) | Enviado a cliente                                |
| 05  | Ajustes recibidos       | Respuesta con cambios sobre una entrega                         | Con ajustes (reabre)                             |
| 06  | Solicitud aprobada      | Respuesta que aprueba la última entrega                         | Aprobado · ¿Ticket Activo? Finalizado · completa |
| 07  | Solicitud en evaluación | Estado → «Fuera de alcance / En evaluación»                     | **Borrador** en Gmail para revisión humana       |

**Folio:** `PREFIJO-MES-NNNN` (`G360-NOV-0042`): mes de ingreso en America/Santiago y
correlativo por cliente que no se reinicia. Los folios antiguos (`EQ-0142`) se siguen
reconociendo en el asunto.

**Respuestas del cliente:** se clasifican con IA (`reply-classify.ts`) en approval ·
adjustments · info · question · empty · ambiguous. Sin entrega enviada no hay
aprobación ni ajustes; ante la duda, `ambiguous` (02 + Estado _Por revisar_); un
«gracias» sin contenido no genera correo. Sin IA configurada no hay acuse: solo el
comentario (y se reabre la tarea si estaba cerrada).

**IA:** `REQUESTS_AI_PROVIDER` = `anthropic` (default si hay `ANTHROPIC_API_KEY`;
`REQUESTS_ANTHROPIC_MODEL`, default `claude-sonnet-5-5`) u `openai`. La extracción
llena además cliente final, canal, formato, estructura (p. ej. orden de cuñas),
indicaciones, material y datos faltantes.

**Campos de la tarea** (solo si existen en el proyecto): Prioridad (baja → _Normal_),
Ingreso Solicitud = Correo, Formato / Canal o Canal (multi), Cliente final o Cliente
(cliente final, p. ej. en proyectos de agencias intermediarias) y Folio NOMA (texto).

### Ciclo base

1. **Correo nuevo a un alias** → `client_request` (`channel = 'email'`) + tarea en el
   proyecto de Asana del cliente: sección del mes (`Octubre | 2026`, se crea si falta) o
   sección fija, nombre `[FOLIO] Título`, descripción (resumen, detalle, links, correo
   original), `due_on` con la fecha pedida, responsable por defecto, campo `Prioridad`
   si existe y adjuntos del correo. La extracción usa el proveedor OpenAI existente con
   salida estructurada (JSON Schema estricto); si falla, una heurística toma el asunto
   como título y resuelve fechas relativas ("lunes AM") contra la fecha del correo en
   America/Santiago.
2. **Confirmación en el mismo hilo**: Noma responde desde el alias con `threadId` +
   `In-Reply-To` + `References`, HTML + texto, asunto `Re: <asunto>` (sin folio: cambiar el asunto separa el hilo en Gmail). Sale
   antes de subir los adjuntos a la tarea, para que un corte por tiempo no la retrase.
   Destinatarios: el remitente (From). El `Reply-To` solo se usa si también es remitente
   autorizado. Los demás To/Cc externos van en copia (máx. 10), salvo que el alias haya
   llegado en copia oculta: entonces se responde solo al remitente.
3. **Entrega**: un comentario en la tarea que empieza con `ENTREGA 01` **en mayúsculas**
   (cualquier número 1–999) y trae link(s) envía al solicitante (y CC) la entrega en el
   hilo, registra la ronda en `request_deliveries` (idempotente por story) y fija el campo
   `Estado` en "Enviado a cliente" si esa opción existe. En minúsculas («Entrega 01»,
   «entrega 1:») también vale, pero solo si esa es la primera línea completa y el
   comentario trae un link para el cliente. "Entrega 2 queda para mañana" es conversación
   interna y no dispara nada. **Equipo en copia** (entregas y consultas): quien comenta
   (ejecuta) y el responsable de la tarea (supervisa) van en copia junto al cliente, solo
   si son del dominio del estudio; quedan guardados en `cc_emails` para el resto del hilo.
   Si la tarea no tiene responsable, se asigna a quien comentó. Los links de Asana (menciones,
   tareas) nunca se envían. El texto libre del comentario va como nota en el correo. Sin
   links, Noma no envía y lo comenta.
4. **Respuesta del cliente** (mismo `threadId`, `References` conocidas o folio en el
   asunto): se publica como **comentario** en la tarea original, sin el texto citado ni la
   firma (el comentario avisa cuando se omitió algo) y con los adjuntos subidos. Si la tarea estaba completada se reabre y `Estado`
   pasa a "Con ajustes" si existe. Nunca crea una tarea nueva.
   - **Con ajustes** sobre una entrega: además del correo del cliente, Noma deja un
     comentario con los ajustes extraídos (lista numerada, referencias y dudas por
     confirmar) y el acuse 05 lleva en copia al responsable de la tarea.
   - **Aprobación**: la tarea queda Aprobado, completada y con Ticket Finalizado.
5. **Sin loops**: lo que envía la propia casilla/alias se ignora; las respuestas
   automáticas (fuera de oficina, rebotes) se ignoran; los comentarios del usuario de
   Asana de Noma (dueño de `ASANA_ACCESS_TOKEN` o `NOMA_ASANA_BOT_USER_GID`) nunca
   disparan correos. **Remitentes no autorizados** no crean tareas: el evento queda en
   `review` y se avisa a Slack (`SLACK_OPERATIONS_WEBHOOK_URL`).

Un remitente está autorizado si **(a)** el From está autenticado y **(b)** su dominio está
en `allowed_sender_domains` del canal (incluye subdominios) o su correo está en
`client_contacts` del cliente. En una respuesta detectada solo por folio, además se
acepta al solicitante o CC originales.

- **Autenticación** (`sender-auth.ts`): se lee el primer `Authentication-Results` (el que
  antepone `mx.google.com`) y se exige `dmarc=pass`, o `dkim=pass` / `spf=pass` alineados
  con el dominio del From. Correo interno del Workspace sin ese encabezado solo vale si
  el From es del dominio del estudio. Las respuestas en hilo sin autenticar también van a
  `review`. `NOMA_EMAIL_SENDER_AUTH=off` la desactiva (solo diagnóstico).
- **Respaldo ARC**: remitentes en Microsoft 365 sin SPF publicado ni DKIM propio, y los
  correos que una regla del Workspace redirige a otro buzón, llegan a Gmail solo con
  `arc=pass`. Si el encabezado de Gmail dice `arc=pass`, la cadena ARC es continua
  (i=1..N, sin duplicados), **todos** los selladores son de confianza
  (`NOMA_EMAIL_TRUSTED_ARC_SEALERS`, por defecto `google.com,microsoft.com`) y el
  `ARC-Authentication-Results` i=1 trae dmarc/dkim/spf en `pass` alineado con el From,
  el remitente se da por autenticado. Exigir selladores confiables en toda la cadena
  evita reciclar un i=1 legítimo bajo un sello propio.
- **Direcciones**: se parsean sobre el encabezado crudo (RFC 5322: el `<…>` fuera de
  comillas) y las encoded-words se decodifican solo en el nombre visible, así que un
  nombre como `"Jefe <jefe@cliente.cl>" <x@otro.com>` no suplanta al cliente.
- **Dominios públicos** (gmail.com, outlook.com…) no se aceptan en
  `allowed_sender_domains`: esos remitentes van en `client_contacts` con la dirección.
- **Copia permanente** (`always_cc` del canal, máx. 5): direcciones que van en copia en
  todos los correos del hilo (confirmación, consultas, entregas, acuses), p. ej. la
  supervisora del cliente. Se agregan primero, sin duplicar al solicitante, y se guardan
  en `client_requests.cc_emails` al crear la solicitud.
- **Correo redirigido** (regla de enrutamiento del administrador desde otra casilla, sin
  el alias en To/Cc/Delivered-To/X-Original-To/X-Forwarded-To): el canal se resuelve por
  el dominio del remitente, solo si pertenece a **un único** canal activo. Como el alias
  no es visible se responde al remitente y a las copias permanentes.
- **Reenvío del equipo** (`forwarded.ts`): si el remitente es del dominio del estudio,
  está autenticado y el cuerpo trae un mensaje reenviado (Gmail, Outlook o Apple Mail,
  en español o inglés) de alguien de afuera, la solicitud queda **a nombre del
  remitente original**. Se rutea por el alias o, si se reenvió a la casilla, por el
  dominio del remitente original; tiene que ser un remitente autorizado del canal.
  La confirmación va al remitente original, con copia a quienes iban en su correo, a
  quien reenvió y a las copias permanentes. La tarea muestra «Reenviado por». Un
  reenvío de una respuesta con folio existente no abre otra solicitud: queda en
  `review` con aviso para sumarla a esa tarea. Reenviar como adjunto (`.eml`) no se
  reconoce: hay que reenviar en línea.
- **Diseño → desarrollo** (`design-link.ts`): al crear la tarea, si el correo trae
  diseños de Canva (`canva.com/design/<id>` o links cortos `canva.link/…`, que se
  resuelven), se busca otra tarea del mismo proyecto de los últimos 120 días que
  comparta el diseño: primero en Noma (correo original o links de sus entregas) y
  después en la descripción de las tareas recientes del tablero. Si existe, se deja
  un comentario en cada tarea con el enlace a la otra («Diseño relacionado» /
  «Desarrollo relacionado»). Es degradable: si falla, la solicitud sigue igual.
- **Remitentes ignorados** (`ignored_senders` del canal): direcciones exactas que se
  descartan antes de la IA y sin aviso (p. ej. un flujo de servicio al cliente que
  comparte dominio con el cliente). El evento queda `ignored`.
- **Pauta del cliente** (`brief_guide`, `ai_fields`): texto que se entrega a la IA junto
  al correo (los campos del formulario de solicitudes del cliente, sus opciones de
  formato…). Con pauta, la extracción llena `brief` (punto de la pauta → lo que dice el
  correo, va a la tarea como «Brief»), `field_choices` (opciones exactas de campos de
  Asana) y sugiere en `missing_info` lo que la pauta considera útil y falta. En la
  confirmación aparece como «Para agilizar»: es opcional para el cliente y el equipo
  avanza igual; no se envía ningún correo adicional por esto. `ai_fields` es la lista de campos que la IA puede
  completar; Estado, Prioridad, Ticket, Ingreso, Folio y Correo de contacto quedan
  siempre fuera. Las opciones que no existen en el proyecto se ignoran.
- **Avisos al equipo en Slack** (`team-events.ts`, mismo webhook del canal): mensajes de
  una línea con el folio y el link a la tarea, sin repetir el contenido.
  - 📦 _Entrega NN enviada_ — al salir el correo de una entrega.
  - 🔁 _El cliente pidió ajustes a la Entrega NN_ — etiqueta al responsable con su
    usuario de **Slack** (no el de Asana), resuelto por correo con `NOMA_SLACK_USER_IDS`
    (`correo=UXXXX,correo=UYYYY`); sin ID usa su nombre y, sin responsable, pide asignar.
  - ✅ _Aprobada por el cliente y cerrada_ (respuesta de aprobación) o _Cerrada por
    <nombre>_ (alguien del equipo completa la tarea en Asana).
- **Asignación → Planificada** (`task-lifecycle.ts`): cuando alguien del equipo asigna
  una tarea de un tablero con canal de correo que está en «Por revisar» (o sin Estado),
  `Estado` pasa a «Planificada». Una tarea más avanzada no retrocede, y las
  asignaciones del bot no cuentan. El webhook escucha `assigned` y `marked_complete`
  además de comentarios y cambios de campo; para sumar los filtros a webhooks ya
  registrados: `npm run asana:register-webhooks -- --base-url … --apply --filters`.
- **Slack por canal** (`slack_webhook_env`): nombre de una variable
  `SLACK_<CANAL>_WEBHOOK_URL` definida en Vercel; los avisos del canal (solicitud nueva,
  remitente no autorizado, correo sin solicitud) van a ese webhook. Sin variable, o si
  no está definida, se usa `SLACK_OPERATIONS_WEBHOOK_URL`. La URL nunca va en el
  archivo de canales.

## Arquitectura

```
Gmail (alias → casilla) ──watch──▶ Pub/Sub ──push──▶ POST /api/webhooks/gmail
                                                     │ token (+OIDC) · history.list
                                                     ▼
                                     email_inbound_events (cola durable, SKIP LOCKED)
                                                     │ after() / cron
                                                     ▼
                         processor.ts ── respuesta? ──▶ comentario Asana (+reabrir)
                                │ no
                                ▼
            alias → canal → remitente autorizado? ──no──▶ review + Slack
                                │ sí
                                ▼
     extract.ts (OpenAI) → client_request + folio → tarea Asana → confirmación en hilo

Asana (comentario "ENTREGA NN") ──webhook──▶ POST /api/webhooks/asana?project=<gid>
                                             │ X-Hook-Signature
                                             ▼
                              deliveries.ts → correo en hilo + Estado + registro

Vercel Cron ──▶ GET /api/cron/email-maintenance
               renueva watch · reconcilia history y cola · reconcilia comentarios Asana
```

| Pieza                               | Archivo                                                                                                                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bypass de sesión para webhooks/cron | `src/lib/self-authenticated-paths.ts`, `src/middleware.ts`                                                                                                                  |
| Esquema                             | `email_channels`, `email_inbound_events`, `email_mailbox_state`, `request_deliveries`, `folio_counters`, `asana_webhooks` + columnas `email_*`/`folio` en `client_requests` |
| Cliente Gmail (casilla)             | `src/features/email/inbox.ts`                                                                                                                                               |
| MIME, ruteo, folio, citas, fechas   | `mime.ts`, `addresses.ts`, `folio.ts`, `quote-strip.ts`, `dates.ts`                                                                                                         |
| Extracción                          | `src/features/email/extract.ts` (LLM inyectable)                                                                                                                            |
| Cola, history, procesador           | `store.ts`, `sync.ts`, `processor.ts`, `requests.ts`                                                                                                                        |
| Entregas                            | `src/features/email/deliveries.ts`, `delivery-command.ts`                                                                                                                   |
| Asana                               | `src/features/asana/asana.ts` (operaciones nuevas), `webhook-events.ts`, `webhook-store.ts`, `custom-fields.ts`                                                             |
| Plantillas de correo                | `src/features/email/templates.ts`                                                                                                                                           |
| Scripts                             | `scripts/email-channels-seed.ts`, `scripts/asana-register-webhooks.ts`                                                                                                      |

### Idempotencia y reintentos

- Cola: único por `gmail_message_id`; fallidos se reintentan hasta 5 veces (cron).
  Los eventos se reclaman de a uno y **por hilo**: mientras un mensaje de un `threadId`
  está en proceso, otro del mismo hilo no se toma (evita dos folios para "la solicitud"
  y "olvidé el adjunto"). Los reclamos se serializan con `pg_advisory_xact_lock`.
- Tiempo: el push solo empieza eventos durante 20 s y el cron durante ~20 s (las
  funciones se cortan a los 60 s). Lo que no alcanza queda `pending`; un evento cortado
  a mitad queda `processing` y el cron lo retoma a los 15 min, reanudando desde el
  progreso guardado (extracción, solicitud, confirmación, adjuntos subidos).
- Solicitud: única por `source_message_id = email:<Message-ID>`; folio asignado en la
  misma transacción (upsert atómico de `folio_counters`), así un duplicado no consume
  número.
- Asana y confirmación usan un reclamo previo (`asana_attempted_at`,
  `email_acknowledged_at`). Si el proveedor rechaza con **4xx** (incluido 429) se libera y
  se reintenta. Un **5xx** o un corte de red es ambiguo (pudo completarse): se conserva el
  reclamo y el evento queda en **`review`**, no en `done`, para que alguien confirme si la
  tarea existe o si la confirmación llegó.
- Respuestas: el `storyGid` publicado y los adjuntos subidos se guardan en el payload
  del evento para no repetirlos en un reintento.
- Entregas: `request_deliveries.asana_story_gid` único. `failed` (4xx de Gmail) se
  reintenta; `unknown` (5xx o corte: envío ambiguo) y `rejected` (sin links) no.
- La reconciliación de entregas pagina todos los comentarios de la tarea (hasta 1.000).
- Webhooks de Asana: las firmas solo se validan contra filas `active`. Si
  `createWebhook` falla, el script deja la fila en `failed`.

### Estados de `email_inbound_events`

`pending` · `processing` · `done` · `failed` · `ignored` (envío propio, automático, sin
alias) · `review` (remitente no autorizado o sin autenticar, respuesta sin tarea, o tarea
/ confirmación en estado ambiguo: revisar la nota del evento). Para aprobar un
remitente: agregar el dominio al canal o el contacto al cliente y volver el evento a
`pending`; el siguiente cron lo procesa.

## Variables de entorno

Nuevas:

- `NOMA_REQUESTS_MAILBOX` — casilla de servicio cuyos alias reciben solicitudes.
- `NOMA_GMAIL_PUBSUB_TOPIC` — `projects/<proyecto>/topics/<topic>` para `users.watch`.
- `NOMA_GMAIL_PUSH_TOKEN` — token compartido en la URL de la suscripción push.
- `NOMA_GMAIL_PUSH_AUDIENCE` — opcional; activa la validación OIDC del push. Si se
  define, `NOMA_GMAIL_PUSH_SERVICE_ACCOUNT` es obligatoria (si falta, el push responde 503).
- `NOMA_GMAIL_PUSH_SERVICE_ACCOUNT` — cuenta de servicio esperada en el OIDC.
- `NOMA_EMAIL_SENDER_AUTH` — opcional; `off` desactiva la verificación DMARC/DKIM/SPF.
- `NOMA_EMAIL_TRUSTED_ARC_SEALERS` — opcional; selladores ARC de confianza separados por
  coma (por defecto `google.com,microsoft.com`). Vacío desactiva el respaldo ARC.
- `NOMA_GMAIL_WATCH_LABEL_ID` — opcional; limita watch/history a una etiqueta.
- `NOMA_ASANA_BOT_USER_GID` — opcional; si falta se usa `users/me` del token central.
- `NOMA_SLACK_USER_IDS` — opcional; `correo=UXXXX,…` para etiquetar al responsable en
  los avisos de ajustes. No es secreta, pero vive en Vercel para no versionar al equipo.

Reutilizadas: `ASANA_ACCESS_TOKEN`, `ASANA_WORKSPACE_GID` (script de webhooks),
`NOMA_TOKEN_ENCRYPTION_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `CRON_SECRET`, `SLACK_OPERATIONS_WEBHOOK_URL`,
`NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN`, `NEXT_PUBLIC_SITE_URL`, `NOMA_DATA_DIR`.

## Crons y banderas

El middleware deja pasar `/api/webhooks/*` y `/api/cron/*` sin sesión
(`src/lib/self-authenticated-paths.ts`); cada handler valida su propia credencial.
Los crons, además, tienen una bandera y **parten apagados** (`src/lib/cron.ts`):
sin la bandera en `true` responden `200 {"ok":true,"skipped":…}` y no hacen nada.
La credencial se valida antes que la bandera (sin `CRON_SECRET` → 503; Bearer
incorrecto → 401).

| Cron (`vercel.json`)          | Horario (UTC) | Bandera                          | Qué hace al encenderlo                                                                                                                                                                                                                           |
| ----------------------------- | ------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/api/cron/whatsapp-drain`    | 04:15 diario  | `CRON_WHATSAPP_DRAIN_ENABLED`    | Procesa la cola de mensajes entrantes de WhatsApp, incluidos fallidos: crea solicitudes y tareas en Asana, consume horas de bolsa y **responde por WhatsApp** al remitente (confirmación o aviso de número no autorizado).                       |
| `/api/cron/retainers-open`    | 03:05 día 1   | `CRON_RETAINERS_OPEN_ENABLED`    | Abre el período del mes de cada bolsa activa y aplica el arrastre de horas. Idempotente por `retainer_periods_retainer_start_unique`.                                                                                                            |
| `/api/cron/email-maintenance` | 10:40 diario  | `CRON_EMAIL_MAINTENANCE_ENABLED` | Renueva el watch de Gmail, recupera correos perdidos, procesa la cola del canal correo (crea tareas y **responde al cliente**), marca entregas trabadas y reconcilia comentarios «ENTREGA NN» de Asana (**puede enviar la entrega al cliente**). |

Orden sugerido para encender: `retainers-open` (solo base de datos) →
`email-maintenance` (cuando el piloto de correo esté listo) → `whatsapp-drain`
(después de revisar el backlog).

## Puesta en marcha (checklist)

0. **Antes de encender los crons**: hasta ahora el middleware redirigía a `/login`
   todas las llamadas sin sesión a `/api`, así que en producción los crons y
   `/api/webhooks/whatsapp` nunca se ejecutaban. Con las banderas apagadas el merge
   no cambia nada para los crons; el webhook de WhatsApp sí empieza a recibir (solo
   encola). Antes de encender `CRON_WHATSAPP_DRAIN_ENABLED`, revisar el backlog
   (`select status, count(*) from whatsapp_inbound_events group by 1`); antes de
   `CRON_RETAINERS_OPEN_ENABLED`, que los retainers activos sean los correctos.
1. **Migración**: merge a `main` aplica `0048_email_intake` (GitHub Action) y re-aplica
   RLS. En local: `npm run db:deploy`.
2. **Alias "Enviar como"**: en la casilla de servicio, Gmail → Configuración → Cuentas →
   "Enviar como", agregar cada alias. Sin esto Gmail reescribe el From a la casilla.
3. **OAuth**: en Google Cloud (mismo OAuth client de Supabase) habilitar Gmail API y
   agregar el scope `https://www.googleapis.com/auth/gmail.modify` en la pantalla de
   consentimiento (app Internal). Luego, con la casilla de servicio, entrar una vez a
   `/login?mailbox=requests` y aceptar (el middleware deja pasar esa URL con sesión
   abierta solo a esa casilla). El refresh token queda en `user_integrations`.
4. **Pub/Sub**: habilitar Cloud Pub/Sub; crear el topic; dar rol _Pub/Sub Publisher_ a
   `gmail-api-push@system.gserviceaccount.com` en el topic; crear una suscripción
   **push** a `https://<deploy>/api/webhooks/gmail?token=<NOMA_GMAIL_PUSH_TOKEN>`
   (recomendado: autenticación OIDC con una cuenta de servicio; audiencia =
   `NOMA_GMAIL_PUSH_AUDIENCE` y esa cuenta en `NOMA_GMAIL_PUSH_SERVICE_ACCOUNT`).
   Reintento con backoff exponencial.
5. **Asana**: `ASANA_ACCESS_TOKEN` debe ser de un **usuario bot dedicado** (p. ej.
   "Noma"), miembro de los proyectos. Sus comentarios nunca disparan correos, así que si
   el token fuera de una persona, esa persona no podría enviar entregas. Opcional: fijar
   `NOMA_ASANA_BOT_USER_GID`. Crear en cada proyecto (si se quiere) el campo enum
   `Estado` con opciones "Enviado a cliente" y "Con ajustes", y `Prioridad`
   (Baja/Media/Alta/Urgente). Si no existen, Noma simplemente no los toca.
6. **Canales**: completar `noma-ops/data/email-channels.json` (ver
   `scripts/email-channels.example.json`), revisar con `npm run email:seed-channels` y
   aplicar con `-- --apply` contra la base de producción.
7. **Webhooks de Asana** (filtros: `comment_added` y `enum_custom_field_changed`; un
   webhook registrado antes de la migración `0050` solo escucha comentarios y hay que
   borrarlo y registrarlo de nuevo para el correo 07): con el deploy arriba, `npm run asana:register-webhooks --
--base-url https://<deploy>` (dry-run) y luego con `--apply`. Usa la misma
   `DATABASE_URL` que el deploy.
8. **Watch de Gmail**: con `CRON_EMAIL_MAINTENANCE_ENABLED=true`, llamar una vez al cron
   (`curl -H "Authorization: Bearer $CRON_SECRET" https://<deploy>/api/cron/email-maintenance`)
   para crear el watch y fijar el `historyId` inicial (no hay backfill de correos
   anteriores). Luego corre diario.
9. **Prueba**: correo desde un dominio autorizado al alias piloto → tarea + confirmación;
   comentar `ENTREGA 01 <link>` → correo en el hilo; responder → comentario en Asana.
   Probar también un correo desde una cuenta personal (debe quedar en `review`).

### Cron

`vercel.json` lo programa una vez al día (límite de Vercel Hobby). Con Pro conviene cada
10 minutos (`*/10 * * * *`) para recuperar pushes o webhooks perdidos más rápido. El
watch de Gmail dura 7 días, así que la renovación diaria basta.

## Plan de despliegue

1. Activar **un cliente piloto** (los demás canales con `status: "paused"`).
2. Mantener el flujo actual (Zapier) en paralelo **una semana** como respaldo,
   idealmente sin su paso de creación de tareas para el piloto, para no duplicar tareas
   ni confirmaciones.
3. Revisar diariamente `email_inbound_events` en `failed`/`review`, la calidad de los
   títulos/fechas extraídos y que las respuestas queden en el hilo correcto.
4. Apagar Zapier del piloto y activar el resto de canales uno a uno.
