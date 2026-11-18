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

Siguiente fase (F8): aprobar/editar/descartar solicitudes en la pestaña Backlog, crearlas en Asana (una tarea por funcionalidad, campo Roadmap) y armar el paquete para el arquitecto.

## Variables

| Variable | Para qué |
|---|---|
| `NOMA_REQUESTS_MAILBOX` | Casilla que organiza las reuniones y recibe los borradores (ya existe). |
| `CRON_MEETINGS_DIGEST_ENABLED` | Enciende el cron (parte apagado). |
| `DEV_MINUTES_ANTHROPIC_MODEL`, `DEV_MINUTES_ANTHROPIC_EFFORT` | Opcionales; por defecto `claude-sonnet-5-5` / `medium`. |
| `SLACK_OPERATIONS_WEBHOOK_URL` | Aviso de minuta lista (ya existe). |

## Importar un programa existente

`npm run dev-tracking:import -- <slug>` lee `${NOMA_DATA_DIR}/data/dev-tracking/<slug>/` (ver cabecera de `scripts/dev-tracking-import.ts`). El insumo es privado y vive en `noma-ops`.

## Backlog y paso a Asana (F8)

Pestaña **Backlog** de `/projects/[id]/seguimiento` (`backlog-board.tsx`, `backlog-actions.ts`):

- Las solicitudes nacen `propuesta` desde la minuta. Se **aprueban**, **editan** (área, tipo, entorno, prioridad, destino, roadmap, evidencia) o **descartan**, de a una o por lote.
- Para una solicitud aprobada sin roadmap, **«Asignar R##»** o **«Nuevo módulo NDes»** reserva el siguiente correlativo del programa (`roadmap-numbering.ts`, atómico) y crea el `dev_roadmap` en `pendiente`.
- **«Crear en Asana»** crea una tarea por solicitud (una por funcionalidad, en lenguaje de negocio) en el proyecto del programa, sección «Backlog» (se crea si falta): nombre `R## · título`, descripción con código, detalle, quién la planteó, evidencia y enlace a la minuta; campos por nombre si existen en el proyecto (Tipo de solicitud, Prioridad, Entorno, Área, Mes de Trabajo, texto «Roadmap»). Después de crear fija «Estado» (Backlog / Priorizado) y reafirma la sección, el orden que esquiva la regla del tablero. La solicitud pasa a `en_asana` con su `asana_task_gid`.
- **Paquete para el arquitecto**: con las aprobadas de una reunión arma el YAML `PKG-AAAA-MM-DD-NN` (`package-yaml.ts`) y lo guarda en `dev_packages` (`armado`).

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
