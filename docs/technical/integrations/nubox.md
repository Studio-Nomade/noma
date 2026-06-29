# Integración Nubox (técnica)

**Estado:** preparada, **no implementada en V1**.
Objetivo: crear un documento (factura) en Nubox desde una propuesta aprobada,
**como borrador para revisión** (no emisión automática).

## Capa de código
`src/integrations/nubox/`
- `client.ts` — `NuboxClient.createInvoiceDraft()` (lanza `NotImplementedError` en V1).
- `types.ts` — `NuboxInvoiceDraft`, `NuboxLineItem`, `NuboxDocumentResponse`.
- `mappers.ts` — `buildNuboxDraft()` (datos tributarios + ítems → borrador, calcula
  neto/IVA/total con `IVA_RATE`).
- `index.ts` — exports.

## Variables de entorno
```
NUBOX_API_URL=
NUBOX_CLIENT_ID=
NUBOX_CLIENT_SECRET=
```

## Modelo de datos
Tabla `invoices` (FKs a `client`, `project`, `proposal`):
`nuboxId`, `status` (enum), `folio`, `glosa`, `paymentTerms`, `netAmount`,
`ivaAmount`, `totalAmount`, `balanceDue`, `lineItems` (snapshot de servicios),
`documentCreatedAt`, `issuedAt`, `dueAt`, `paidAt`.

## Flujo previsto (V2) — sin emisión automática
1. Propuesta **Aprobada** → acción "Preparar factura".
2. Seleccionar servicios facturables → `buildNuboxDraft()` (neto/IVA/total).
3. Revisar datos tributarios del cliente (RUT, razón social, giro, dirección).
4. Crear registro `invoices` con `status='Preparado para facturar'`.
5. `nubox.createInvoiceDraft(draft)` → `status='Borrador creado en Nubox'`,
   guardar `nuboxId`.
6. Emisión manual en Nubox → al confirmar, `status='Emitido'` (+ `issuedAt`, `folio`).
7. Seguimiento de pago vía Chipax → `Pagado` / `Vencido`.
8. `logSync({ integration:'nubox', action:'create', ... })` en cada paso.

## Consideraciones
- **Regla dura:** nunca emitir automáticamente; siempre borrador + revisión.
- Validar datos tributarios obligatorios antes de crear el documento.
- Manejo de errores con `IntegrationError`; credenciales solo server-side.
