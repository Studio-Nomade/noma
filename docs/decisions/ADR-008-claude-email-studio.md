# ADR-008 — Claude como motor de Email Studio

**Estado:** Aceptado · **Fecha:** 2026-10-20 · **Modifica:** [ADR-004](ADR-004-ai-provider.md)

## Contexto

ADR-004 dejó a Anthropic fuera de los proveedores de IA. El hito "Generador de mailings"
lleva Email Studio de un plan estructurado de una sola llamada a un **orquestador con tool
use**: inspeccionar el diseño, recortar y componer assets, comparar vistas previas contra
el diseño, preguntar al usuario y publicar. El método se desarrolló y probó con Claude
sobre los envíos reales del estudio.

## Decisión

- Se agrega **Anthropic** como proveedor habilitable, **solo para Email Studio** por ahora,
  centralizado a nivel Studio Nomade con `ANTHROPIC_API_KEY` (server-side, una key por
  entorno).
- El proveedor de Email Studio es **configurable**: `EMAIL_STUDIO_AI_PROVIDER=anthropic|openai`
  (default `anthropic`). El modelo se elige con `EMAIL_STUDIO_ANTHROPIC_MODEL`
  (default `claude-opus-5-5`); `EMAIL_STUDIO_OPENAI_MODEL` se mantiene para el modo `openai`.
- Ambos proveedores implementan la misma interfaz en `src/lib/ai/provider.ts`; el resto de
  Email Studio (validación Zod, compilador, revisiones, límites por usuario/hora) no depende
  del proveedor.
- El bucle de tool use tiene **tope de iteraciones** y de imágenes por turno. `_ai_runs`
  registra además `provider` e `iterations`.
- Se mantienen las reglas de ADR-004: llamadas solo server-side, sin almacenar prompts ni
  salidas del modelo, y degradación al trabajo manual si la API no está configurada o falla.
- WhatsApp y Propuestas siguen en OpenAI/Gemini según ADR-004.

## Consecuencias

- Hay que cargar `ANTHROPIC_API_KEY` en Vercel (preview y producción) antes de activar el
  orquestador.
- Se puede volver a OpenAI cambiando una variable, sin migraciones.
- Ampliar Anthropic a otros flujos requiere un ADR nuevo.
