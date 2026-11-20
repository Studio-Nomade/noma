# Avisos de Asana en Slack (bot Noma)

Cada proyecto de Asana se vincula a un canal de Slack y **solo el bot Noma** (`SLACK_BOT_TOKEN`, `xoxb-…`) publica los avisos. No existe ningún camino que publique con un token de usuario. Si un agente necesita avisar a alguien, comenta en Asana con la mención y Noma lo lleva a Slack.

## Tablas (migración 0065)

| Tabla | Para qué |
|---|---|
| `asana_slack_links` | Proyecto de Asana ↔ canal de Slack, prefijo de folio, eventos activos (`events`), `active`. |
| `slack_task_threads` | Un hilo por tarea. Las subtareas usan el hilo de su solicitud raíz (hasta 3 niveles). |
| `slack_notify_log` | Idempotencia: cada story se publica una vez aunque Asana reintente. También guarda la tarea, el tipo y el cuerpo, para agrupar en 60 s (migración 0066). |
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

| Evento | Origen en Asana | Mensaje |
|---|---|---|
| `mention` | story `comment_added` con `data-asana-type="user"` | 💬 menciones · autor comentó en *tarea* · link + extracto |
| `reopened` | story `marked_incomplete` | 🔁 Tarea reabierta · *tarea* por X · Estado · responsable · link |
| `state_change` | story `enum_custom_field_changed` del campo **Estado** (con cambio real) | 🔄 *tarea* · Estado: Anterior → *Nuevo* · por X · responsable · link |
| `assigned` | story `assigned` | 👤 @persona, te asignaron *tarea* · Entrega · link |
| `completed` | story `marked_complete` | ✅ Tarea cerrada · *tarea* por X · link |
| `new_task` | evento `task` `added` con el proyecto como padre (no subtareas) | 🆕 *tarea* · Responsable · Entrega · Prioridad · link (abre el hilo) |

**Agrupación (60 s):** si ya hubo un aviso de la misma tarea en el canal en los últimos 60 s, el evento nuevo se suma como otra línea a ese mensaje (`chat.update`) en vez de publicar otro. Por ejemplo, reabierta + Estado + comentario quedan en un solo mensaje.

**Proyectos de correo (Grado 360, Equifax):** `new_task`, `state_change` y `completed` los avisa el flujo de solicitudes (solicitud nueva, entrega, ajustes, cierre), también por el bot y en el hilo (ver «Flujo de solicitudes por el bot»). El módulo suma ahí las menciones, las reaperturas y las asignaciones.

`marked_incomplete` y el evento `task` `added` se sumaron a los filtros del webhook (`WEBHOOK_FILTERS`). El mantenimiento de webhooks actualiza los filtros de los webhooks ya registrados.

## Puesta en marcha

1. **App de Slack «Noma».** Permisos del bot: `chat:write`, `chat:write.public`, `users:read`, `users:read.email`, `channels:read` y `groups:read`. Después, reinstalar la app y guardar el `xoxb-…` como `SLACK_BOT_TOKEN` en Vercel. En los canales privados hay que invitar a @Noma.
2. **Migración.** `npm run db:deploy` con la base de producción.
3. **Vínculos.** El insumo vive en `noma-ops/data/asana-slack-links.json` (formato en `scripts/asana-slack-links.example.json`).
   - Revisar con `npm run slack:seed-links` (dry-run).
   - Cargar con `npm run slack:seed-links -- --apply`. Sin `--reset`, conserva `active` y `events` de los vínculos que ya existen.
4. **Personas.** `npm run slack:seed-links -- --people --apply` (opcional: también se llenan solas con el primer aviso).
5. **Webhooks.** `CRON_SLACK_NOTIFY_ENABLED=true` en Vercel. El cron `slack-notify` (diario, 07:50 Santiago) los registra solo; ver la sección siguiente.

## Webhooks y mantención (entrega 3)

El cron `/api/cron/slack-notify` corre en Vercel cada día y también acepta `Bearer NOMA_SCHEDULER_SECRET`, por si se quiere una pasada más frecuente desde pg_cron. Con `?dry=1` solo informa qué haría.

1. **`ensureLinkWebhooks`.** Decide qué hacer con cada vínculo (`planWebhook`):
   - **Activo sin webhook vivo:** lo registra. Borra los webhooks previos con el mismo target, crea uno nuevo y Asana hace el handshake contra este deploy (`prepareRegistration` → `createWebhook` → `completeRegistration`). Es igual que `asana:register-webhooks`, pero desde el servidor.
   - **Activo con un webhook que Asana desactivó por fallas o que ya no existe:** lo recrea.
   - **Apagado:** borra su webhook, salvo en los proyectos del flujo de correo, que lo necesitan igual.
2. **`reconcileLinkStories`.** Revisa las tareas modificadas en las últimas 24 h, nunca antes de la fecha del vínculo. Las menciones y reaperturas que no estén en `slack_notify_log` se avisan ahora. No revisa las subtareas que no están en el proyecto.

Los filtros de los webhooks ya registrados los mantiene al día `syncWebhookFilters` (cron `email-maintenance`).

**El webhook atiende dos flujos.** El aviso de Slack corre en todo proyecto vinculado. El flujo de solicitudes (ENTREGA/CONSULTA/CLIENTE, «Planificada» al asignar, cierre) corre solo en los proyectos de un canal de correo (`isEmailChannelProject`). Así un webhook en CFO o COO no aplica reglas de solicitudes.

## Flujo de solicitudes por el bot (entrega 6)

Los avisos del flujo de correo (`notifyNewClientRequest` y `notifyTeamEvent`) reciben la tarea de Asana (`thread: { projectGid, taskGid }`):

- **Proyecto con vínculo activo** (Grado 360, Equifax): el bot Noma publica en el canal vinculado, en el hilo de la solicitud. El aviso de solicitud nueva abre el hilo, con el mismo contenido de siempre (folio, cliente final, canal, prioridad, entrega, quién pide, «Sin responsable» y «Abrir en Asana»). Entrega, ajustes, aprobación de pieza y cierre caen en ese hilo y se agrupan en 60 s con los demás avisos de la tarea; por ejemplo, el cliente pide ajustes y Noma reabre la tarea.
- **Sin vínculo, o si el bot falla:** el webhook del canal (`slack_webhook_env`) de siempre. Cuando todos los canales de correo estén vinculados, esa columna y las variables de webhook se pueden retirar.

Por eso, en los proyectos de correo el módulo no repite `new_task`, `state_change` ni `completed`: esos avisos los da el flujo de solicitudes, con su contenido propio y en el mismo hilo.
