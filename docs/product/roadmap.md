# Roadmap · Noma

## v1.0 — MVP interno (fases 0–7)

Dashboard · Clientes · Proyectos · Briefs · Propuestas (manual, IA preparada) · Servicios
(UF) · Configuración · Onboarding + Contexto/Documentación · Moneda CLP/USD/UF.

Ejecución por fases:

- **Fase 0** — Setup y documentación base.
- **Fase 1** — Arquitectura, design system, modelo de datos, auth, módulo de moneda.
- **Fase 2** — Clientes, Servicios, Proyectos.
- **Fase 3** — Briefs.
- **Fase 4** — Propuestas/cotizaciones.
- **Fase 5** — Dashboard operativo.
- **Fase 6** — Onboarding interno + Contexto/Documentación.
- **Fase 7** — Producción (app.studionomade.cl) y preparación de integraciones.

## v1.1 — Seguimiento

Recordatorios de próxima acción · historial de cambios por proyecto · filtros avanzados del
pipeline · activación de **generación de propuestas con IA** · export PDF.

## v1.2 — Portal cliente (solo lectura)

Acceso externo con login email/contraseña · vista de propuesta con branding · estado de
avance.

## v2.0 — Gestión operativa

Integraciones activas (Google Drive/Calendar, Asana, Slack, Canva) · estado de avance desde
Asana · hitos y fechas de entrega · tickets/solicitudes de cliente.

## v2.1 — Reportes comerciales

Tasa de cierre por área · valor promedio de propuesta · tiempo promedio de conversión.

## v2/v3 — Módulo Finanzas / Facturación

Integración con **Chipax** (visualización financiera del cliente: facturas, saldos,
vencimientos, días promedio de pago) y **Nubox** (creación de factura desde propuesta
aprobada, como borrador para revisión — sin emisión automática). La arquitectura de datos
ya está preparada en V1 (campos tributarios en cliente, tabla `invoices`,
`integration_sync_log`, capa `src/integrations/{chipax,nubox}`).
Ver [finance-module.md](finance-module.md).
