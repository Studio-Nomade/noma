# Reuniones por Slack (#noma-reuniones)

Un hilo del canal es una reunión. Solo las personas de `NOMA_SLACK_AGENT_EMAILS`
(por ahora Sebastián y Ana) pueden pedirlas.

## Flujo

1. **Pedido.** Mensaje nuevo en el canal («Agenda con Equifax el lunes 11:00,
   Chao Deudas D2C, con manuel.gutierrez1@equifax.com y Pablo Ahumada»). Claude
   lo convierte en una propuesta: título `ÁREA - Cliente | Tipo`, fecha y hora
   (America/Santiago), duración (30 min por defecto), invitados y agenda. Los
   nombres sin correo se buscan en `client_contacts` y `team_members`; si no hay
   un único resultado, la propuesta lo avisa. Quien pide siempre va invitado.
2. **Ajustes y aprobación.** En el hilo: cualquier ajuste («a las 12», «suma a
   Cata») rehace la propuesta; `ok` la agenda; `cancelar` la descarta.
3. **Agendar.** El evento se crea con Meet desde la casilla de operaciones
   (`NOMA_REQUESTS_MAILBOX`), que es la organizadora: así las notas de Gemini
   quedan en su Drive. Se crea la carpeta
   `05_Reuniones y Minutas/ÁREA/CLIENTE/AAAAMMDD_Tipo` en la unidad Operations.
   Ya agendada, un ajuste en el hilo queda como «cambio propuesto» y se aplica
   con `ok` (Google avisa a los invitados); `cancelar` cancela el evento.
4. **Notas y minuta** (cron `studio-meetings`, cada 15 min en horario hábil, o
   `procesar` en el hilo). Terminada la reunión, busca las notas de Gemini
   (adjuntas al evento o por título en el Drive de operations@), las mueve a la
   carpeta (o deja una copia si no puede moverlas), arma la minuta con Claude en
   un Google Doc en la misma carpeta y publica el resumen en el hilo.
5. **Aprobar la minuta.** Cualquier mensaje en el hilo ajusta la minuta (se
   reescribe el Doc). `aprobar` deja un **borrador** en el Gmail de quien pidió
   la reunión: externos en Para, equipo en Cc, asunto
   `Minuta | Cliente - Tipo - DD-MM-AAAA`, minuta en el cuerpo y el PDF adjunto.
   Nada se envía solo.

Las notas internas de la minuta (observaciones sobre personas, riesgos) se
muestran en Slack y nunca van al Doc ni al correo.

## Configuración

| Variable | Para qué | Por defecto |
|---|---|---|
| `NOMA_SLACK_MEETINGS_CHANNEL` | ID del canal | #noma-reuniones |
| `NOMA_MEETINGS_DRIVE_ID` | Unidad compartida Operations | Operations & Governance |
| `NOMA_MEETINGS_ROOT_FOLDER` | Carpeta `05_Reuniones y Minutas` | la de 04_OPERATIONS |
| `CRON_STUDIO_MEETINGS_ENABLED` | Enciende el cron | apagado |

Requisitos:

- La app Noma está en el canal (evento `message.groups`, permiso
  `groups:history`).
- operations@ entró a `/login?mailbox=requests` (scope `drive`) y es
  Administradora de contenido de la unidad Operations.
- Quien aprueba minutas tiene el scope `gmail.compose`: tras este cambio, cada
  persona entra una vez a «Mis conexiones › Reconectar Google».

Tabla: `studio_meetings` (migración 0071).
