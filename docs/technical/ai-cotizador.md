# Cotizador con IA

Flujo para pasar de una reunión de diagnóstico (máx. 30 min) a una propuesta en Borrador
en pocos minutos, con una memoria que aprende de cada propuesta. Decisiones en
[ADR-009](../decisions/ADR-009-claude-cotizador.md).

## Flujo

1. **Oportunidad → Brief → Notas.** Se pega el texto, el enlace de Drive (notas de Gemini) o
   un archivo.
2. **Procesar notas** (`processNotes` → `features/quoter/brief.ts`): Claude arma el brief
   (contexto, necesidad explícita e implícita, problema, objetivos, respuestas por área,
   preguntas pendientes, presupuesto, plazos, decisores, servicios sugeridos del catálogo).
   - Completa la **ficha del cliente** solo en campos vacíos (rubro, web, redes, comuna,
     región, RUT, razón social, notas, contacto principal) y agrega los contactos del
     cliente con correo. Nunca pisa datos cargados.
   - Sin IA o si falla, usa la heurística (`features/ai/brief-processor.ts`) y avisa.
3. **Aprobar brief** (sin cambios).
4. **Cotizar con IA** (`features/quoter/draft-action.ts`), con indicaciones opcionales. Claude
   recibe:
   - método del estudio (`prompt.ts`, genérico);
   - catálogo completo con niveles, rangos y **valores ya cotizados** por servicio;
   - **memoria** activa que aplica (global, áreas del proyecto, servicios, cliente, rubro);
   - **precedentes** parecidos (búsqueda por texto en español + mismo cliente + áreas);
   - brief, ficha e historial del cliente, equipo disponible, UF del día.
     Devuelve servicios (catálogo o personalizados) con nivel, cantidad, valor y justificación;
     descuento; 12 secciones; etapas y entregables; equipo; preguntas abiertas.
5. **Validación** (`normalize.ts`): ids inexistentes, niveles apagados, duplicados,
   cantidades y descuentos fuera de rango se corrigen o descartan con aviso.
6. **Propuesta en Borrador:** servicios en `proposal_services` (valor propio solo si difiere
   del catálogo), servicios personalizados creados como **«En revisión»** (START habilitado,
   GROWTH creado y apagado), equipo, descuento y secciones. La etapa comercial pasa a
   Propuesta.
7. En la propuesta, el panel **Cotizador con IA** muestra el porqué de cada línea, avisos,
   preguntas para el cliente, memoria y precedentes usados, y **Enseñar a Noma**.

## Memoria y aprendizaje

- `quoter_learnings`: reglas activas de inmediato. Origen `equipo` (escritas o semilla) o
  `ia` (deducidas). Se ven, editan y desactivan en **Propuestas → Memoria del cotizador**
  (`/proposals/memoria`).
- Al pasar una propuesta a **Enviada** (o enviarla por correo), **Aprobada** o
  **Rechazada**, `learnFromProposal` (en `after()`):
  1. guarda la propuesta como precedente con sus valores finales;
  2. compara el borrador de la IA con lo enviado (`learn-diff.ts`: servicios agregados o
     quitados, nivel, cantidad, valor, descuento, secciones reescritas) y lee el hilo de
     Seguimiento;
  3. pide a Claude 0–5 reglas generalizables y las agrega; si una corrige a otra, la anterior
     se desactiva.
     Es idempotente por propuesta y evento. Una propuesta enviada sin borrador de IA ni
     comentarios solo queda como precedente.
- El historial de valores por servicio sale de las propuestas Enviadas/Aprobadas/Rechazadas.

## Carga inicial (producción)

El insumo vive en `noma-ops` (`NOMA_DATA_DIR`, default `../noma-ops`):

```bash
npm run quoter:seed-learnings                          # revisa (dry-run)
npm run quoter:seed-learnings -- --apply               # data/quoter/learnings-seed.json
npm run quoter:import-precedents -- --apply --digest   # data/processed (PDF en texto) + resumen con Claude
```

Ambos son idempotentes. `--digest` llama a Claude Sonnet una vez por presupuesto sin resumen.

## Variables

`ANTHROPIC_API_KEY` (ya existe), `QUOTER_AI_PROVIDER`, `QUOTER_BRIEF_MODEL`,
`QUOTER_DRAFT_MODEL`, `QUOTER_DRAFT_EFFORT`, `QUOTER_LEARNING_MODEL`. `ANTHROPIC_BASE_URL`
solo para pruebas locales con un servidor simulado.

## Registro

- `quoter_runs`: cada llamada (brief, draft, learning) con estado, modelo, duración, contexto
  usado y salida estructurada.
- `ai_usage`: tokens por llamada (`quoter_brief`, `quoter_draft`, `quoter_learning`,
  `quoter_precedent_digest`).
