# Proyectos nuevos de Asana → carpeta en Drive y canal de Slack

Reemplaza el Zap «Crear Canal y Carpeta en Drive | Asana». Código:
`src/features/project-setup/` · endpoint `/api/cron/project-setup` (cron de Vercel cada 10 min).

## Reglas

- Se activa con **proyectos** nuevos de Asana en un equipo de área (A&A, A&D,
  B&D, CE, WD). SN · Operations & Governance queda fuera. Las tareas de los
  proyectos generales no cuentan (esos clientes van por el canal general).
- El nombre debe ser `Cliente | Proyecto`; si no, Noma deja una nota en la
  descripción pidiendo renombrarlo.
- **Drive** (unidad compartida del área): carpeta `CLIENTE` (se reutiliza si
  existe, sin importar mayúsculas ni tildes) y subcarpeta
  `AAAAMMDD_PROYECTO` (fecha de creación del proyecto, Santiago).
- **Slack**: canal `proy-cliente-proyecto` (sin área).
  - Si existe, se usa (el bot se une).
  - Si el cliente no tiene canal, se crea e invita a los miembros del proyecto
    de Asana (por correo).
  - Si el cliente ya tiene otro canal, Noma crea la tarea
    «Noma · ¿Qué canal de Slack usamos?» en el proyecto y avisa en Slack. El
    equipo comenta `CANAL NUEVO` o `CANAL #nombre`; Noma lo aplica y cierra la
    tarea.
- Al terminar, Noma deja en la descripción del proyecto `Noma · Carpeta:` y
  `Noma · Canal de Slack:` (marcas de idempotencia) y publica en el canal los
  links de Asana y Drive.
- Las secciones del sidebar de Slack son personales: la app no puede ubicar el
  canal en el grupo del área de cada persona.

## Puesta en marcha

1. **Slack**: en la app de Noma (api.slack.com → OAuth & Permissions) agregar
   los *Bot Token Scopes* `channels:read`, `groups:read`, `channels:manage`,
   `channels:join`, `chat:write`, `users:read`, `users:read.email`;
   reinstalar en el workspace y guardar el *Bot User OAuth Token* como
   `SLACK_BOT_TOKEN` en Vercel.
2. **Drive**: operations@ debe ser *Administrador de contenido* en las cinco
   unidades y volver a entrar en `/login?mailbox=requests` (agrega el scope
   `drive`).
3. **Vercel**: `CRON_PROJECT_SETUP_ENABLED=true`. Opcional:
   `NOMA_PROJECT_SETUP_SINCE` (ISO; por defecto 2026-11-24 00:00 Santiago):
   solo se preparan proyectos creados desde esa fecha.
4. **Cron**: `vercel.json` llama a `/api/cron/project-setup` cada 10 minutos,
   de lunes a viernes entre 08:00 y 20:59 de Santiago (`*/10 11-23 * * 1-5`,
   UTC). Requiere el plan Pro de Vercel. Autentica con `CRON_SECRET`, como el
   resto de los cron.

## Avisos

Cuando el canal queda definido (creado, reutilizado o elegido con `CANAL …`),
Noma lo vincula a los avisos de Asana (`asana_slack_links`, pantalla
`/settings/slack-links`) y registra el webhook del proyecto: desde ese momento
el bot avisa en ese canal las tareas nuevas, asignaciones, cambios de Estado,
menciones y cierres, con un hilo por tarea.
