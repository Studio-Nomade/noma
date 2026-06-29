# ADR-007 · Base de datos de servicios (modular + UF)

Estado: aceptado · Fecha: 2026-06-29

## Contexto

Studio Nomade tiene insumos comerciales reales: un Excel maestro de Branding (56
servicios con UF y CLP) y 94 presupuestos PDF (2025–2026). Queremos un catálogo de
servicios rico y modular que alimente cotizaciones y SLA, no una lista plana.

## Decisión

1. **Taxonomía** `Área → Subárea → Servicio → Módulos`, con `complexity_level`
   (Light/Medium/Regular/Bold) para servicios compuestos. Ver
   `docs/services/service-taxonomy.md`.
2. **Modelo modular**: extender `services` y agregar `service_modules` +
   `service_module_links` (N:N). Los módulos pueden venderse solos y componen
   servicios; alimentan alcance, entregables, valor y SLA.
   Ver `docs/services/services-data-model.md`.
3. **Moneda**: el valor se guarda en **UF**; el CLP es de presentación, recalculado
   con la UF diaria (`exchange_rates`). La UF de referencia del Excel (37.000) solo
   sirve para derivar UF de filas que venían solo en CLP.
4. **Nueva área `MP` (Mercado Público)** se agrega al enum de áreas.
5. **Datos crudos y credenciales fuera de git** (`/data` gitignored; el
   `client_secret.json` no se versiona).

## Consecuencias

- Migración de schema: nuevos campos en `services` + 2 tablas nuevas + enum `MP`.
- Importador idempotente desde `/data/normalized`.
- Las áreas distintas de Branding requieren extraer sus PDF antes de tener
  catálogo (no hay Excel maestro aún).

## Relacionado

- ADR-008 (generador de cotizaciones) y ADR-009 (generador de SLA) — por escribir
  cuando se aborden esas piezas.
