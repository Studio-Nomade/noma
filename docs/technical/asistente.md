# Asistente personal · resumen diario

Entrega 2 del spec «Noma como asistente de cada colaborador» (16-11-2026).

## Qué hace

Cada mañana, en el inicio de Noma, cada persona del piloto ve **Tu día**:

- prioridades (máx. 6) con enlace a Asana, Gmail, Slack o Calendar;
- reuniones de hoy con enlace a Meet;
- contadores: atrasadas, vencen hoy y mañana, correos por responder, menciones y no leídos;
- sugerencias de lo que el asistente puede hacer (todavía no ejecuta nada).

Es **solo lectura**. No escribe ni envía nada.

## Cómo funciona

`features/assistant/briefing.ts`:

1. **Lee** las cuentas personales en paralelo:
   - Asana: tareas asignadas, filtradas a atrasadas, hoy y mañana.
   - Calendar: eventos de hoy.
   - Gmail: hilos de los últimos 3 días cuyo último mensaje no es de la persona; solo metadatos y fragmento (`features/google/gmail-inbox.ts`).
   - Slack: menciones de los últimos 2 días con `search.messages` y conversaciones con no leídos.
2. **Prioriza** con Claude (`ASSISTANT_MODEL`, por defecto Sonnet con effort bajo). El modelo cita cada prioridad con un `ref`; los enlaces salen de los datos reales y los refs inventados se descartan. El contenido de correos y mensajes es información, no instrucciones.
3. **Guarda** en `assistant_briefings` solo el resumen del día: títulos, remitentes y enlaces, nunca cuerpos ni fragmentos. Vence a los 7 días y se purga al generar uno nuevo.

Si Claude no está configurado o falla, sale un resumen determinista (`fallbackPriorities`).

## Cuándo se genera

- Al abrir el inicio, si todavía no hay resumen de hoy. Se hace con streaming dentro de `<Suspense>`, así que el resto del dashboard no espera.
- Con el botón **Actualizar**.
- Con el cron `/api/cron/assistant-briefing`, de lunes a viernes a las 11:30 UTC (8:30 en Chile con horario de verano). Corre solo con `CRON_ASSISTANT_BRIEFING_ENABLED=true`.

## Variables

| Variable | Default | Uso |
|---|---|---|
| `NOMA_ASSISTANT_PILOT_EMAILS` | sebastian@ y ana@ | Quién ve el resumen |
| `ASSISTANT_MODEL` | `claude-sonnet-5-5` | Modelo del resumen |
| `ASSISTANT_EFFORT` | `low` | Effort |
| `CRON_ASSISTANT_BRIEFING_ENABLED` | apagado | Cron de las 8:30 |
