# Informe mensual de solicitudes (job del día 1)

Cron `GET /api/cron/monthly-reports` (Vercel, día 1 a las 08:20 hora de Chile). Va
apagado por defecto: se enciende con `CRON_MONTHLY_REPORTS_ENABLED=true`.

## Qué hace

Para cada canal de correo activo que tenga `monthly_report.enabled` informa el **mes
anterior**:

1. **Cifras** (`features/reports/metrics.ts`, puro), con los mismos criterios que el
   panel de Asana:
   - Considera solo tareas de primer nivel: los duplicados de Zapier viven como
     subtareas.
   - «Del mes»: tareas creadas en el mes, en hora de Chile.
   - «Finalizadas en la sección»: tareas completas de la sección `<Mes> | <AAAA>`.
   - «Atrasadas»: tareas incompletas con fecha de entrega vencida.
   - Prioridad Alta o Urgente.
   - Distribución por el campo `breakdown_field` (por ejemplo «Área …» o
     «Cliente»).
2. **Retrabajo**: rondas de entrega por solicitud, donde 1 significa aprobada en la
   primera entrega.
   - Fuentes, en este orden:
     - entregas enviadas por Noma (`request_deliveries`, máximo de `round`);
     - el campo numérico **«Rondas de entrega»** del tablero;
     - si no hay ninguna de las dos, los comentarios «Entrega NN» del equipo (cualquier
       mayúscula, hasta 80 tareas por corrida).
   - Indicadores:
     - % aprobado en la primera entrega;
     - rondas promedio y rondas de cambios;
     - solicitudes con 3 o más rondas;
     - «solicitudes de ajuste»: tickets nuevos cuyo nombre empieza con
       Ajustes / Correcciones / Cambios / Últimos cambios.
3. **Borrador** del correo en la casilla de servicio, desde el alias, con la plantilla
   08 «Informe mensual», el asunto `B&D – <Cliente> | Informe Mensual de Solicitudes -
   <Mes> <Año>` y destinatarios `to`/`cc`.
   - Los hallazgos se redactan desde las cifras (comparación con el mes anterior,
     cierre, retrabajo y criticidad).
   - La propuesta queda para la Dirección.
   - **No se envía.**
4. **Tarea** en «Mis tareas» de `assignee_gid`, con la ficha de cifras y un checklist:
   - Métricas de Asana;
   - Canva;
   - PDF adjunto al borrador;
   - revisión y envío.

   Vence el 3.er día hábil.
5. **Sincroniza** el campo «Rondas de entrega» de las tareas cuyas rondas se
   conocieron por Noma o por los comentarios, para que el panel de Asana las promedie.

Es idempotente por canal y mes (`monthly_reports`). Si una corrida falla, la siguiente
la reintenta; si ya quedó en `drafted`, no hace nada.

## Rondas de entrega en el día a día

Cada entrega que Noma envía («ENTREGA NN») escribe la ronda en el campo numérico
«Rondas de entrega» de la tarea, si el proyecto lo tiene. En el panel **Métricas** se
agrega un gráfico con el promedio (o la suma) de ese campo por sección mensual.

## Configuración (`noma-ops/data/email-channels.json` → `email_channels.monthly_report`)

```json
"monthly_report": {
  "enabled": true,
  "client_label": "Cliente A",
  "service": "Plan mensual",
  "to": ["equipo@cliente.cl"],
  "cc": ["persona@studionomade.cl"],
  "assignee_gid": "123",
  "breakdown_field": "Área"
}
```

Se carga con `scripts/email-channels-seed.ts --apply`.

## Ejecución manual

`GET /api/cron/monthly-reports?month=2026-11&alias=<alias>&dry=1` con
`Authorization: Bearer $CRON_SECRET`:

- `dry=1` solo calcula y devuelve las cifras.
- Sin `dry`, crea el borrador y la tarea.
- Sin `month`, informa el mes anterior.
