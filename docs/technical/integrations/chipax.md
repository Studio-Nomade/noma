# Integración Chipax (técnica)

**Estado:** preparada, **no implementada en V1**.
Objetivo: leer la información financiera del cliente y mostrarla en Noma (portal).

## Capa de código
`src/integrations/chipax/`
- `client.ts` — `ChipaxClient` (métodos lanzan `NotImplementedError` en V1).
- `types.ts` — `ChipaxInvoice`, `ChipaxClientFinance`, `ClientFinanceView`.
- `mappers.ts` — `mapChipaxFinance()` (externo → modelo de la UI).
- `index.ts` — exports.

Registro de sincronización: `src/integrations/sync-log.ts` → tabla
`integration_sync_log`.

## Variables de entorno
```
CHIPAX_API_URL=
CHIPAX_APP_ID=
CHIPAX_SECRET_KEY=
```

## Modelo de datos
- `clients.chipaxId` — ID externo del cliente en Chipax.
- `clients.rut` / `legalName` — para hacer match si no hay `chipaxId`.
- La vista financiera se arma en tiempo de lectura (no se persiste obligatoriamente);
  si se desea cache, usar la tabla `invoices`.

## Flujo previsto (V2)
1. En la ficha del cliente, si `chipax.isConfigured()`, llamar
   `chipax.getClientFinance({ rut, chipaxId })`.
2. `mapChipaxFinance()` → render de resumen + tabla de facturas (folio, emisión,
   vencimiento, total, saldo, estado, PDF/XML si la API lo entrega).
3. `logSync({ integration:'chipax', action:'pull', status, entityType:'client', entityId })`.

## Consideraciones
- Manejo de errores con `IntegrationError`.
- Rate limiting y cache según límites de la API de Chipax.
- Autenticación: revisar el esquema real de Chipax (app id + secret / token).
- Seguridad: credenciales solo server-side (env), nunca al cliente.
