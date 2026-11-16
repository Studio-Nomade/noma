# ADR-009 — Claude como motor del cotizador (brief y propuestas)

**Estado:** Aceptado · **Fecha:** 2026-11-15 · **Modifica:** [ADR-004](ADR-004-ai-provider.md),
[ADR-008](ADR-008-claude-email-studio.md)

## Contexto

El flujo comercial de Noma (oportunidad → reunión de diagnóstico → notas → brief → propuesta)
tenía la arquitectura lista pero sin IA: el brief se armaba con una heurística de palabras
clave y "Generar con IA" era un stub. Mientras tanto el estudio cotizó en chats de Claude
con buen resultado, pero ese criterio
se perdía de un chat a otro. Además, el canal de solicitudes por correo ya validó en
producción el patrón de llamadas a Claude con JSON outputs, registro de tokens y degradación
sin IA.

## Decisión

- **Claude es el proveedor por defecto del cotizador**, con la misma `ANTHROPIC_API_KEY`
  centralizada. Configurable por entorno: `QUOTER_AI_PROVIDER=anthropic|openai|off`.
  - Notas → brief: `QUOTER_BRIEF_MODEL` (default `claude-sonnet-5-5`, effort `low`).
  - Brief aprobado → borrador de propuesta: `QUOTER_DRAFT_MODEL` (default
    `claude-opus-5-5`, effort `medium`).
  - Aprendizajes al enviar/aprobar/rechazar: `QUOTER_LEARNING_MODEL` (default Sonnet).
- **Se mantiene la aprobación del brief** antes de cotizar (decisión de Sebastián).
- **Memoria propia en la base**, no en el chat: `quoter_learnings` (reglas),
  `proposal_precedents` (presupuestos históricos y propuestas de Noma) y el historial de
  valores cotizados por servicio. Cada borrador usa catálogo + precedentes + memoria.
- **Aprendizaje automático:** al pasar una propuesta a Enviada, Aprobada o Rechazada, Noma
  compara el borrador de la IA con lo que quedó y con el hilo de seguimiento, y agrega reglas
  **activas de inmediato** (decisión de Sebastián). El equipo puede desactivarlas o editarlas
  en «Memoria del cotizador» y enseñar reglas propias.
- **Servicios personalizados** que propone la IA se crean en el catálogo con estado
  **«En revisión»**: se pueden cotizar de inmediato y Dirección de Arte o superadmin los
  activa.
- Se guarda el **borrador estructurado** (`quoter_runs.output`) porque es la base del
  aprendizaje. Sigue sin guardarse el prompt; `ai_usage` registra modelo, tokens y tiempo.
- El método genérico vive en el repo; los **valores y criterios reales** (semilla de memoria,
  presupuestos históricos) viven en `noma-ops` y se cargan con importadores.
- Salida estructurada por JSON outputs (`output_config.format`); catálogo y memoria van en
  bloques de system con caché efímera.

## Consecuencias

- La función que arma el borrador puede tardar 1–3 minutos: la página del brief declara
  `maxDuration = 300` (Fluid Compute).
- Si la API falla, el brief cae a la heurística y la propuesta se puede crear a mano.
- Ampliar la IA a otros flujos (WhatsApp, Slack) requiere su propio ADR.
