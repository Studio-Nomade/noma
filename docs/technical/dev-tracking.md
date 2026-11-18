# Seguimiento de desarrollo y ciclo de reuniones

Módulo `src/features/dev-tracking/`. Un **programa** por proyecto de desarrollo (`dev_programs`) reemplaza el tablero HTML a mano: módulos con hitos, roadmaps, PR integrados y bitácora, alimentados por Asana (qué), GitHub (cuándo) y el arquitecto (plan). La clave común es el **código de roadmap** (`R74`, `NDes-006`; `roadmap-code.ts`).

## Vistas

- `/projects/[id]/seguimiento`: Resumen, Módulos, Hoja de ruta, Roadmaps, Bitácora, Reuniones.
- `/projects/[id]/seguimiento/reuniones/[meetingId]`: la minuta de una reunión con sus solicitudes propuestas, preguntas abiertas y cifras dichas.

## Ciclo de reuniones

1. **Agendar** (`meetings-actions.ts`): por tipo (`dev_meeting_types`, con cadencia y asistentes por defecto) o puntual. El evento se crea con Meet desde la casilla `NOMA_REQUESTS_MAILBOX` (misma autorización que el ingreso de solicitudes) para que la transcripción de Gemini quede en su Drive. La descripción lleva la agenda previa: agenda fija del tipo + dónde está la pelota de cada módulo. Si la casilla no está conectada, la reunión queda en Noma sin evento.
2. **Detectar** (`minutes.ts`, cron `meetings-digest`, una vez al día hábil a las 19:45 de Santiago con `CRON_MEETINGS_DIGEST_ENABLED=true`; para procesar apenas termina la reunión, «Procesar ahora» en la pestaña Reuniones): las reuniones agendadas cuyo fin pasó hace 10 min se marcan `realizada`; se busca en el Drive de la casilla un doc reciente (`searchRecentDocs` + `matchNotes`) y, si el match es claro, se vincula (`transcrita`). Si hay varios candidatos o no aparece, la UI permite **vincular** el enlace a mano y **procesar ahora**.
3. **Resumir**: `readDriveDoc` → Claude (`callClaudeStructured`, modelo `DEV_MINUTES_ANTHROPIC_MODEL`, por defecto `claude-sonnet-5-5`) con el schema `minutes-schema.ts`: resumen, asistentes, temas, acuerdos, decisiones pendientes, **confirmado sin desarrollo**, **cifras dichas** (siempre marcadas `dicho` hasta verificación), **solicitudes** con prefijo por canal (`OP-01`, `CO-01`…), área, tipo, entorno, prioridad, evidencia y destino, y **preguntas abiertas** con la persona que debe responder. Reglas en el prompt: lenguaje de negocio, planificación de Operaciones solo como sugerencia, sin observaciones sobre personas.
4. **Guardar** (`persistMinutes`): `dev_meeting_minutes`, `dev_backlog` (estado `propuesta`), `dev_questions` (`abierta`); reprocesar reemplaza la minuta y las propuestas no tocadas. La reunión pasa a `resumida`, queda línea en `dev_log`.
5. **Avisar**: borrador del correo de minuta en la casilla (`createDraft`, **no se envía**) y aviso en Slack con el enlace a la minuta en Noma. Nada sale al cliente sin aprobación.
   El aviso va al canal del programa: `dev_programs.slack_webhook_env` (se edita en **Reuniones → Avisos en Slack** o con `slackWebhookEnv` en `program.json`); si está vacío, el `slack_webhook_env` del canal de correo del proyecto; si tampoco hay, `SLACK_OPERATIONS_WEBHOOK_URL`. Se guarda el **nombre** de la variable, nunca la URL. El enlace usa `NEXT_PUBLIC_SITE_URL` o, si falta, el dominio de producción de Vercel (`VERCEL_PROJECT_PRODUCTION_URL`); sin URL absoluta el aviso va sin enlace.

### Reuniones creadas fuera de Noma

Si la reunión se agenda en el Calendar de una persona (no desde Noma), basta con **invitar a la casilla de operaciones** y que el título empiece con el prefijo del programa (`dev_programs.calendar_title_prefix`, p. ej. «WD - AppsCinco»). En la pestaña Reuniones, «Traer de Calendar» guarda el prefijo y vincula los eventos de las últimas y próximas 3 semanas (`calendar-sync.ts`, `source = 'calendar'`); el cron diario hace lo mismo para todos los programas. Al terminar la reunión, Google adjunta al evento el documento de notas de Gemini: la sincronización lo toma como transcripción (`transcrita`) sin buscar en Drive. Para que la casilla pueda leerlo, las notas deben compartirse con los invitados (configuración de Meet del organizador → Registros de reuniones → compartir notas con los invitados) o compartirse a mano con la casilla.

Siguiente fase (F8): aprobar/editar/descartar solicitudes en la pestaña Backlog, agruparlas en roadmaps, crearlas en Asana (una tarea por funcionalidad, campo Roadmap) y armar un paquete por roadmap para el arquitecto.

## Variables

| Variable | Para qué |
|---|---|
| `NOMA_REQUESTS_MAILBOX` | Casilla que organiza las reuniones y recibe los borradores (ya existe). |
| `CRON_MEETINGS_DIGEST_ENABLED` | Enciende el cron (parte apagado). |
| `DEV_MINUTES_ANTHROPIC_MODEL`, `DEV_MINUTES_ANTHROPIC_EFFORT` | Opcionales; por defecto `claude-sonnet-5-5` / `medium`. |
| `SLACK_OPERATIONS_WEBHOOK_URL` | Aviso de minuta lista si el programa no tiene canal propio (ya existe). |
| `SLACK_<PROGRAMA>_WEBHOOK_URL` | Webhook del canal del programa (p. ej. `SLACK_APPSCINCO_WEBHOOK_URL`); su nombre se guarda en el programa. |

## Importar un programa existente

`npm run dev-tracking:import -- <slug>` lee `${NOMA_DATA_DIR}/data/dev-tracking/<slug>/` (ver cabecera de `scripts/dev-tracking-import.ts`). El insumo es privado y vive en `noma-ops`.

## Backlog y paso a Asana (F8)

Pestaña **Backlog** de `/projects/[id]/seguimiento` (`backlog-board.tsx`, `backlog-actions.ts`):

- Las solicitudes nacen `propuesta` desde la minuta. Se **aprueban**, **editan** (área, tipo, entorno, prioridad, destino, roadmap, evidencia) o **descartan**, de a una o por lote.
- **Agrupar** (`grouping.ts`, `grouping-actions.ts`, `grouping-panel.tsx`): un roadmap agrupa varias solicitudes; es la unidad que se entrega, se nombra en Asana y se empaqueta. Las aprobadas sin agrupar (`grouped_at` nulo) muestran **«Proponer agrupación»**: Claude (`dev_grouping`, mismo modelo que la minuta) las reparte en grupos de cuatro tipos — *roadmap en curso* (un `dev_roadmap` no `en_prod` o un módulo activo), *roadmap nuevo* `R##` (mejoras y correcciones), *módulo nuevo* `NDes-###` o *sin roadmap* (soporte, datos, para más adelante) — con nombre y motivo. La salida se normaliza (sin códigos inventados ni repetidos; lo que falte va por reglas, que también son el respaldo sin IA). Sebastián cambia tipo o nombre y mueve solicitudes entre grupos; **«Confirmar»** reserva de una vez los códigos nuevos (`roadmap-numbering.ts`, atómico, con vista previa), crea los `dev_roadmap` en `pendiente`, fija `roadmap_code`, `destination` y `grouped_at`. «Desagrupar» devuelve una solicitud que aún no está en Asana (el código reservado queda como roadmap en curso, sin perderse). Volver a propuesta o descartar también deshace la agrupación.
- **«Crear en Asana»** (hasta 15 por vez, solo agrupadas) crea una tarea por solicitud (una por funcionalidad, en lenguaje de negocio) en el proyecto del programa, sección «Backlog priorizado» (la aprobación de Sebastián equivale a priorizar; flujo del proyecto: Solicitudes / Inbox → Backlog priorizado → En curso → Validación / QA → Completadas → «<Mes> (cerradas)»): nombre `R## · título`, descripción con código, detalle, quién la planteó, evidencia y enlace a la minuta; campos por nombre si existen en el proyecto (Tipo de solicitud, Prioridad, Entorno, Área, Mes de Trabajo, texto «Roadmap»). Si falta la opción del mes en «Mes de Trabajo», la crea. Marca «¿Ticket Activo?» = Si. Espera ~20 s a que corra la regla del tablero y recién entonces fija «Estado» = Priorizado y reafirma la sección. La solicitud pasa a `en_asana` con su `asana_task_gid`, que también se suma a `dev_roadmaps.asana_task_gids`.
- **Paquetes para el arquitecto**: **uno por roadmap** (`buildRoadmapPackages`). Toma las agrupadas con código (aprobadas o en Asana) que aún no están en un paquete y arma un YAML `PKG-AAAA-MM-DD-NN` por cada `R##` / `NDes-###` (`package-yaml.ts`) con `roadmap {codigo, titulo, tipo, reservado_por_noma}`, las reuniones de origen, las solicitudes por prioridad y las preguntas abiertas de esas reuniones; se guarda en `dev_packages` (`armado`). El arquitecto no reagrupa: decide el orden técnico dentro del paquete. Al recibir el resultado, el `roadmap` informado solo completa solicitudes sin código.

## API de servicio para el arquitecto (F4)

Rutas `/api/dev-tracking/[programId]/*`, fuera del middleware de sesión, con `Authorization: Bearer DEV_TRACKING_API_TOKEN` (sin la variable, la API está apagada). El `programId` es el `id` de `dev_programs`.

| Método y ruta | Para qué |
|---|---|
| `GET …/modulos` | Estado actual: módulos con hitos, pelota, preguntas abiertas, siguiente `R##` y `NDes-###`. Para abrir la sesión con contexto. |
| `GET …/paquetes?estado=armado` | Paquetes pendientes de recoger. |
| `GET …/paquetes/[code]` | El YAML del paquete (`Accept: application/json` → JSON con el YAML dentro). La primera lectura lo marca `entregado`. |
| `GET` / `POST …/siguiente-roadmap` | Ver / reservar el siguiente código (`{tipo: "mejora" \| "correccion" \| "modulo"}`). |
| `POST …/resultados` | Resultado de la sesión (schema `resultSchema` en `architect-sync.ts`): `paquete`, `roadmap`, `solicitudes[{id, veredicto, hito, asana_gid, nota}]`, `preguntas_nuevas`, `modulos[{codigo, avance, pelota, hitos[{nombre, estado, fecha, prs}], …}]`, `bitacora`, `desplegado[{repo, numero, titulo, fecha, roadmap}]` (Lambda y APK, que no tienen evento automático). Marca las solicitudes `verificada`, actualiza módulos e hitos (cada cambio de estado deja línea en la bitácora), crea preguntas y registra despliegues. |
| `POST …/bitacora` | Atajo: `{modulo?, texto}`. |

Instrucción para el proyecto de Claude Code: `docs/technical/dev-tracking-claude-code.md`.
