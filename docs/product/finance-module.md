# Módulo Finanzas / Facturación (roadmap V2/V3)

Studio Nomade usa **Chipax** (gestión financiera) y **Nubox** (facturación). Noma
no implementa estas integraciones en V1, pero **deja preparada la arquitectura de
datos** para soportarlas y evolucionar hacia un **portal cliente** con estado
financiero.

## Dos líneas de integración

### 1. Chipax — visualización financiera (lectura)

Consultar facturas emitidas, estados de pago, vencimientos, montos pendientes,
historial y métricas (cuentas por cobrar, días promedio de pago). La ficha del
cliente mostrará una sección tipo portal:

- Datos del cliente: RUT, razón social, giro.
- Facturación histórica · Total pendiente · Días promedio de pago.
- Tabla de facturas: folio, emisión, total, saldo, estado, vencimiento, PDF/XML.

### 2. Nubox — creación de factura (escritura, sin emisión automática)

Desde una **propuesta aprobada** → seleccionar servicios facturables → revisar
datos tributarios → calcular neto/IVA/total → **crear borrador** en Nubox →
guardar `nuboxId` → actualizar estado de facturación → sincronizar seguimiento
desde Chipax. **Nunca emite sin revisión humana.**

## Preparación en V1 (ya implementado)

- **Cliente**: campos tributarios (`rut`, `legalName`/razón social, `taxActivity`/
  giro, `taxAddress`, `billingEmail`, `billingNotes`, `financialStatus` manual,
  `chipaxId`). Editables en la ficha del cliente.
- **Tabla `invoices`**: estructura Nubox (`nuboxId`, `status`, `folio`, `glosa`,
  `paymentTerms`, `netAmount`, `ivaAmount`, `totalAmount`, `balanceDue`,
  `lineItems`, fechas de creación/emisión/vencimiento/pago, FKs a cliente/proyecto/
  propuesta). Sin UI de emisión todavía.
- **`integration_sync_log`**: registro de cada sincronización con Chipax/Nubox.
- **Capa de integraciones** desacoplada en `src/integrations/{chipax,nubox}`
  (cliente API stub, tipos, mappers, errores). Métodos lanzan `NotImplementedError`
  en V1.

## Estados de facturación (`invoices.status`)

`No facturado → Preparado para facturar → Borrador creado en Nubox → Emitido →
Pagado / Vencido / Anulado`.

## Estado financiero del cliente (manual, mientras no haya Chipax)

`Sin información · Al día · Con saldo pendiente · Moroso`.

## Documentación técnica

- [chipax.md](../technical/integrations/chipax.md)
- [nubox.md](../technical/integrations/nubox.md)
