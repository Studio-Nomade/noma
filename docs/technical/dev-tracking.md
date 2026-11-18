# Seguimiento de desarrollo y ciclo de reuniones

Módulo `src/features/dev-tracking/`. Un **programa** por proyecto de desarrollo (`dev_programs`) reemplaza el tablero HTML a mano: módulos con hitos, roadmaps, PR integrados y bitácora, alimentados por Asana (qué), GitHub (cuándo) y el arquitecto (plan). La clave común es el **código de roadmap** (`R74`, `NDes-006`; `roadmap-code.ts`).

## Vistas

- `/projects/[id]/seguimiento`: Resumen, Módulos, Hoja de ruta, Roadmaps, Bitácora, Reuniones.
- `/projects/[id]/seguimiento/reuniones/[meetingId]`: la minuta de una reunión con sus solicitudes propuestas, preguntas abiertas y cifras dichas.

## Ciclo de reuniones

1. **Agendar** (`meetings-actions.ts`): por tipo (`dev_meeting_types`, con cadencia y asistentes por defecto) o puntual. El evento se crea con Meet desde la casilla `NOMA_REQUESTS_MAILBOX` (misma autorización que el ingreso de solicitudes) para que la transcripción de Gemini quede en su Drive. La descripción lleva la agenda previa: agenda fija del tipo + dónde está la pelota de cada módulo. Si la casilla no está conectada, la reunión queda en Noma sin evento.
2. **Detectar** (`minutes.ts`, cron `meetings-digest`, cada media hora en horario hábil con `CRON_MEETINGS_DIGEST_ENABLED=true`): las reuniones agendadas cuyo fin pasó hace 10 min se marcan `realizada`; se busca en el Drive de la casilla un doc reciente (`searchRecentDocs` + `matchNotes`) y, si el match es claro, se vincula (`transcrita`). Si hay varios candidatos o no aparece, la UI permite **vincular** el enlace a mano y **procesar ahora**.
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
