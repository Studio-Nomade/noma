# Solicitudes por correo (canal email)

Extiende el motor de solicitudes (`client_requests`), que hasta ahora solo recibía
WhatsApp, con un canal de correo. Cada cliente escribe a un alias propio
(`cliente@studionomade.cl`) que es **alias de Gmail de una única casilla de servicio**
(`NOMA_REQUESTS_MAILBOX`). Noma crea la tarea en Asana sin Asana AI, confirma en el mismo
hilo con un folio correlativo y mantiene el ciclo entrega → ajustes en ese hilo.

> Los alias reales, clientes, gids de Asana y dominios autorizados son dato operativo:
> viven en `noma-ops/data/email-channels.json`, no en este repositorio.

## Ciclo

1. **Correo nuevo a un alias** → `client_request` (`channel = 'email'`) + tarea en el
   proyecto de Asana del cliente: sección del mes (`Octubre | 2026`, se crea si falta) o
   sección fija, nombre `[FOLIO] Título`, descripción (resumen, detalle, links, correo
   original), `due_on` con la fecha pedida, responsable por defecto, campo `Prioridad`
   si existe y adjuntos del correo. La extracción usa el proveedor OpenAI existente con
   salida estructurada (JSON Schema estricto); si falla, una heurística toma el asunto
   como título y resuelve fechas relativas ("lunes AM") contra la fecha del correo en
   America/Santiago.
2. **Confirmación en el mismo hilo**: Noma responde desde el alias con `threadId` +
   `In-Reply-To` + `References`, HTML + texto, asunto `Re: <asunto> [EQ-0142]`. Sale
   antes de subir los adjuntos a la tarea, para que un corte por tiempo no la retrase.
   Destinatarios: el remitente (From). El `Reply-To` solo se usa si también es remitente
   autorizado. Los demás To/Cc externos van en copia (máx. 10), salvo que el alias haya
   llegado en copia oculta: entonces se responde solo al remitente.
3. **Entrega**: un comentario en la tarea que empieza con `ENTREGA 01` **en mayúsculas**
   (cualquier número 1–999) y trae link(s) envía al solicitante (y CC) la entrega en el
   hilo, registra la ronda en `request_deliveries` (idempotente por story) y fija el campo
   `Estado` en "Enviado a cliente" si esa opción existe. "Entrega 2 queda para mañana"
   (minúsculas) es conversación interna y no dispara nada. Los links de Asana (menciones,
   tareas) nunca se envían. El texto libre del comentario va como nota en el correo. Sin
   links, Noma no envía y lo comenta.
4. **Respuesta del cliente** (mismo `threadId`, `References` conocidas o folio en el
   asunto): se publica como **comentario** en la tarea original, sin el texto citado ni la
   firma (el comentario avisa cuando se omitió algo) y con los adjuntos subidos. Si la tarea estaba completada se reabre y `Estado`
   pasa a "Con ajustes" si existe. Nunca crea una tarea nueva.
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
- **Direcciones**: se parsean sobre el encabezado crudo (RFC 5322: el `<…>` fuera de
  comillas) y las encoded-words se decodifican solo en el nombre visible, así que un
  nombre como `"Jefe <jefe@cliente.cl>" <x@otro.com>` no suplanta al cliente.
- **Dominios públicos** (gmail.com, outlook.com…) no se aceptan en
  `allowed_sender_domains`: esos remitentes van en `client_contacts` con la dirección.

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
- `NOMA_GMAIL_WATCH_LABEL_ID` — opcional; limita watch/history a una etiqueta.
- `NOMA_ASANA_BOT_USER_GID` — opcional; si falta se usa `users/me` del token central.

Reutilizadas: `ASANA_ACCESS_TOKEN`, `ASANA_WORKSPACE_GID` (script de webhooks),
`NOMA_TOKEN_ENCRYPTION_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `CRON_SECRET`, `SLACK_OPERATIONS_WEBHOOK_URL`,
`NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN`, `NEXT_PUBLIC_SITE_URL`, `NOMA_DATA_DIR`.

## Puesta en marcha (checklist)

0. **Antes del merge — crons y webhook de WhatsApp**: hasta ahora el middleware
   redirigía a `/login` todas las llamadas sin sesión a `/api`, así que en producción
   `/api/cron/whatsapp-drain`, `/api/cron/retainers-open` y `/api/webhooks/whatsapp`
   nunca se ejecutaban. Al desplegar este cambio empiezan a correr. Revisar antes el
   backlog (`select status, count(*) from whatsapp_inbound_events group by 1`) y que los
   retainers activos sean los correctos (`ensureCurrentPeriod` es idempotente por
   `retainer_periods_retainer_start_unique`).
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
7. **Webhooks de Asana**: con el deploy arriba, `npm run asana:register-webhooks --
--base-url https://<deploy>` (dry-run) y luego con `--apply`. Usa la misma
   `DATABASE_URL` que el deploy.
8. **Watch de Gmail**: llamar una vez al cron
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
