# Noma en Slack: conversación y solicitudes CFO (entrega 1A)

Código: `src/features/slack-agent/` · endpoint `POST /api/webhooks/slack/events`
(Events API de la app «Noma»). Spec: `20261111_Spec_Noma_en_Slack_Asistente_Conversacional.md`.

## Qué hace

- **Mensaje directo con Noma** (solo `NOMA_SLACK_AGENT_EMAILS`, por defecto
  sebastian@ y ana@): Claude con herramientas de **solo lectura**:
  - `resumen_del_dia` (el mismo resumen de las 08:30),
  - `agenda` (Google Calendar de quien pregunta),
  - `tareas_asana` (tareas abiertas de los proyectos vinculados, por proyecto,
    responsable o vencimiento),
  - `por_cobrar` (facturas abiertas sin ceder ni anular),
  - `buscar_cliente` y `solicitudes_recientes`.

  Responde en el mismo DM con el contexto de los últimos 12 mensajes. Crear
  tareas, reuniones o correos llega en la entrega 1B (aprobaciones con
  botones). Cualquier otra persona recibe un aviso de que aún no está
  habilitada.
- **«[SOLICITUD]» en #general-finanzas** (`NOMA_SLACK_CFO_CHANNEL`): Claude
  extrae tipo, cliente-proyecto, descripción, monto, fecha requerida,
  comentarios y enlace, y crea la tarea en **CFO | Finanzas & Administración**
  (sección `NOMA_CFO_REQUEST_SECTION`, por defecto «2. Pagos y Compromisos
  Activos», con la fecha requerida como vencimiento). Responde en el hilo con
  el link. Reemplaza el Zap «Solicitudes y Tareas | CFO».
- Firma verificada (`SLACK_SIGNING_SECRET`), respuesta en < 3 s y proceso con
  `after()`. Los reintentos de Slack se ignoran y cada evento se procesa una
  sola vez (`slack_notify_log`, clave `slack-event:<event_id>`).
- Consumo de IA en `ai_usage` con `feature` = `slack_agent_ops` y
  `slack_cfo_request`, para medir cuánto usan los agentes antes de decidir una
  suscripción aparte (D-02).

## Puesta en marcha (una vez, después del deploy)

1. **Slack → api.slack.com/apps → Noma**
   - *OAuth & Permissions → Bot Token Scopes*: agregar `im:history`,
     `im:read`, `im:write` y `channels:history` (además de los que ya tiene).
     Reinstalar la app.
   - *App Home → Show Tabs*: activar **Messages Tab** y «Allow users to send
     Slash commands and messages from the messages tab».
   - *Event Subscriptions*: activar, Request URL
     `https://noma.studionomade.cl/api/webhooks/slack/events` (debe decir
     Verified) y en *Subscribe to bot events* agregar `message.im` y
     `message.channels`. Guardar.
2. **Vercel** (Production): `SLACK_SIGNING_SECRET` = *Basic Information → App
   Credentials → Signing Secret*. Redeploy.
3. **#general-finanzas**: invitar al bot con `/invite @Noma` (sin estar en el
   canal no recibe los mensajes).
4. **Zapier**: con la primera solicitud creada por Noma, apagar el Zap
   «Solicitudes y Tareas | CFO».
