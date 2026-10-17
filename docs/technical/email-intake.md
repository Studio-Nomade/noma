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
   `In-Reply-To` + `References`, HTML + texto, asunto `Re: <asunto> [EQ-0142]`.
3. **Entrega**: un comentario en la tarea que empieza con `ENTREGA 01` (cualquier número)
   y trae link(s) envía al solicitante (y CC originales) la entrega en el hilo, registra
   la ronda en `request_deliveries` (idempotente por story) y fija el campo `Estado` en
   "Enviado a cliente" si esa opción existe. Sin links, Noma no envía y lo comenta.
4. **Respuesta del cliente** (mismo `threadId`, `References` conocidas o folio en el
   asunto): se publica como **comentario** en la tarea original, sin el texto citado ni la
   firma y con los adjuntos subidos. Si la tarea estaba completada se reabre y `Estado`
   pasa a "Con ajustes" si existe. Nunca crea una tarea nueva.
5. **Sin loops**: lo que envía la propia casilla/alias se ignora; las respuestas
   automáticas (fuera de oficina, rebotes) se ignoran; los comentarios del usuario de
   Asana de Noma (dueño de `ASANA_ACCESS_TOKEN` o `NOMA_ASANA_BOT_USER_GID`) nunca
   disparan correos. **Remitentes no autorizados** no crean tareas: el evento queda en
   `review` y se avisa a Slack (`SLACK_OPERATIONS_WEBHOOK_URL`).

Un remitente está autorizado si su dominio está en `allowed_sender_domains` del canal
(incluye subdominios) o si su correo está en `client_contacts` del cliente. En una
respuesta detectada solo por folio, además se acepta al solicitante o CC originales.

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
- Solicitud: única por `source_message_id = email:<Message-ID>`; folio asignado en la
  misma transacción (upsert atómico de `folio_counters`), así un duplicado no consume
  número.
- Asana y confirmación usan un reclamo previo (`asana_attempted_at`,
  `email_acknowledged_at`). Si el proveedor rechaza con HTTP se libera y se reintenta;
  si fue un corte de red ambiguo se conserva y queda para revisión manual (no duplicar).
- Respuestas: el `storyGid` publicado y los adjuntos subidos se guardan en el payload
  del evento para no repetirlos en un reintento.
- Entregas: `request_deliveries.asana_story_gid` único. `failed` se reintenta;
  `unknown` (envío ambiguo) y `rejected` (sin links) no.

### Estados de `email_inbound_events`

`pending` · `processing` · `done` · `failed` · `ignored` (envío propio, automático, sin
alias) · `review` (remitente no autorizado o respuesta sin tarea). Para aprobar un
remitente: agregar el dominio al canal o el contacto al cliente y volver el evento a
`pending`; el siguiente cron lo procesa.

## Variables de entorno

Nuevas:

- `NOMA_REQUESTS_MAILBOX` — casilla de servicio cuyos alias reciben solicitudes.
- `NOMA_GMAIL_PUBSUB_TOPIC` — `projects/<proyecto>/topics/<topic>` para `users.watch`.
- `NOMA_GMAIL_PUSH_TOKEN` — token compartido en la URL de la suscripción push.
- `NOMA_GMAIL_PUSH_AUDIENCE` — opcional; activa la validación OIDC del push.
- `NOMA_GMAIL_PUSH_SERVICE_ACCOUNT` — opcional; cuenta de servicio esperada en el OIDC.
- `NOMA_GMAIL_WATCH_LABEL_ID` — opcional; limita watch/history a una etiqueta.
- `NOMA_ASANA_BOT_USER_GID` — opcional; si falta se usa `users/me` del token central.

Reutilizadas: `ASANA_ACCESS_TOKEN`, `ASANA_WORKSPACE_GID` (script de webhooks),
`NOMA_TOKEN_ENCRYPTION_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `CRON_SECRET`, `SLACK_OPERATIONS_WEBHOOK_URL`,
`NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN`, `NEXT_PUBLIC_SITE_URL`, `NOMA_DATA_DIR`.

## Puesta en marcha (checklist)

1. **Migración**: merge a `main` aplica `0048_email_intake` (GitHub Action) y re-aplica
   RLS. En local: `npm run db:deploy`.
2. **Alias "Enviar como"**: en la casilla de servicio, Gmail → Configuración → Cuentas →
   "Enviar como", agregar cada alias. Sin esto Gmail reescribe el From a la casilla.
3. **OAuth**: en Google Cloud (mismo OAuth client de Supabase) habilitar Gmail API y
   agregar el scope `https://www.googleapis.com/auth/gmail.modify` en la pantalla de
   consentimiento (app Internal). Luego, con la casilla de servicio, entrar una vez a
   `/login?mailbox=requests` y aceptar. El refresh token queda en `user_integrations`.
4. **Pub/Sub**: habilitar Cloud Pub/Sub; crear el topic; dar rol _Pub/Sub Publisher_ a
   `gmail-api-push@system.gserviceaccount.com` en el topic; crear una suscripción
   **push** a `https://<deploy>/api/webhooks/gmail?token=<NOMA_GMAIL_PUSH_TOKEN>`
   (opcional: autenticación OIDC con una cuenta de servicio y audiencia =
   `NOMA_GMAIL_PUSH_AUDIENCE`). Reintento con backoff exponencial.
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
