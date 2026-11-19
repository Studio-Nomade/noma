# Avisos de Asana en Slack (bot Noma)

Cada proyecto de Asana se vincula a un canal de Slack y **solo el bot Noma** (`SLACK_BOT_TOKEN`, `xoxb-…`) publica los avisos. No existe ningún camino que publique con un token de usuario. Si un agente necesita avisar a alguien, comenta en Asana con la mención y Noma lo lleva a Slack.

## Tablas (migración 0065)

| Tabla | Para qué |
|---|---|
| `asana_slack_links` | Proyecto de Asana ↔ canal de Slack, prefijo de folio, eventos activos (`events`), `active`. |
| `slack_task_threads` | Un hilo por tarea. Las subtareas usan el hilo de su solicitud raíz (hasta 3 niveles). |
| `slack_notify_log` | Idempotencia: cada story se publica una vez aunque Asana reintente. |
| `people_identities` | Persona por correo: usuario de Asana ↔ usuario de Slack. Se llena sola y se corrige a mano. |

## Flujo

`/api/webhooks/asana?project=<gid>` valida la firma y, en `after()`, llama a `notifyAsanaStory` (`features/slack-notify/process.ts`) por cada story:

1. Busca el vínculo activo del proyecto del webhook; sin vínculo no publica nada.
2. Clasifica la story (`storyEventKind`) y revisa que el evento esté encendido en `events`.
3. Reserva la clave `story:<gid>` en `slack_notify_log`. Si ya estaba, termina.
4. Arma el mensaje y lo publica en el hilo de la tarea, o abre el hilo.
5. Si la publicación falla, libera la clave para que un reintento lo envíe.

Las menciones se traducen con `people_identities`, luego `NOMA_SLACK_USER_IDS` y luego `users.lookupByEmail`. Si no hay usuario de Slack, va el nombre en negrita, sin mención. Los comentarios de la cuenta de Noma también se avisan. Los comandos del flujo de correo (`ENTREGA`, `CONSULTA`, `CLIENTE`) siguen igual: en Slack se avisa el comentario si menciona a alguien, sin repetir el correo.

## Eventos

Mensajes cortos: una línea con el evento, la mención al responsable y «Abrir en Asana». Solo el comentario lleva un extracto (máx. 200 caracteres). Todos los eventos vienen encendidos por defecto y se apagan por vínculo en `events`.

| Evento | Story de Asana | Estado |
|---|---|---|
| `mention` | `comment_added` con `data-asana-type="user"` | Entrega 2 |
| `reopened` | `marked_incomplete` | Entrega 2 |
| `state_change` · `assigned` · `completed` · `new_task` | `enum_custom_field_changed` · `assigned` · `marked_complete` · tarea nueva | Entrega 4 |

`marked_incomplete` se sumó a los filtros del webhook (`HANDLED_STORY_SUBTYPES`). El mantenimiento de webhooks actualiza los filtros de los webhooks ya registrados.

## Puesta en marcha

1. **App de Slack «Noma».** Permisos del bot: `chat:write`, `chat:write.public`, `users:read`, `users:read.email`, `channels:read` y `groups:read`. Después, reinstalar la app y guardar el `xoxb-…` como `SLACK_BOT_TOKEN` en Vercel. En los canales privados hay que invitar a @Noma.
2. **Migración.** `npm run db:deploy` con la base de producción.
3. **Vínculos.** El insumo vive en `noma-ops/data/asana-slack-links.json` (formato en `scripts/asana-slack-links.example.json`).
   - Revisar con `npm run slack:seed-links` (dry-run).
   - Cargar con `npm run slack:seed-links -- --apply`. Sin `--reset`, conserva `active` y `events` de los vínculos que ya existen.
4. **Personas.** `npm run slack:seed-links -- --people --apply` (opcional: también se llenan solas con el primer aviso).
5. **Webhooks.** Hasta la entrega 3 (registro automático por vínculo), registrar el webhook de un proyecto nuevo con:
   `npm run asana:register-webhooks -- --base-url https://<deploy> --project <gid> --apply`
