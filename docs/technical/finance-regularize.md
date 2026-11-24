# Regularización de Finanzas desde la carpeta local

`scripts/finance-regularize.ts` carga en Noma lo que vive en la carpeta
`02_FINANCE` de Sebastián, para que la cobranza (P1–P8 y seguimiento a 7 días)
solo persiga facturas realmente impagas.

| Paso | Fuente | Resultado en Noma |
|---|---|---|
| Facturas y notas de crédito de 2026 | Consolidado de Nubox (CSV) + XML de cada mes (las posteriores al consolidado) | `fin_documents` (VENTA) y `fin_contacts` enlazados al cliente por RUT |
| Notas de crédito | Misma contraparte, mismo total y emitida antes | Factura `ANULADA` con observación |
| Cesiones a factoring | Columna «Cedido» del consolidado y carpetas `04_Factoring/AAAAMMDD_Factoring DTE NNN - Entidad` | `cobranza_cases.factoring_*`: la cobranza no la persigue |
| Cartolas BCI de 2026 | `Cartolas Banco BCI/2026*.xlsx` (cartola histórica y export de movimientos) | `bank_transactions` sin duplicar, en la cuenta BCI |
| Conciliación automática | Monto exacto, fecha (≤ 45 días), RUT o nombre en la glosa; solo coincidencias únicas; también 2–3 facturas del mismo cliente en un pago | `reconciliations` con nota «Conciliación automática» |
| Saldadas en Nubox sin abono en las cartolas | Estado de cobro `BALANCED` | `CONCILIADA` con observación |

Es idempotente y nunca borra ni cambia montos ya cargados. Sin `--apply` corre
en simulación dentro de una transacción que se revierte. Siempre deja un
informe Markdown con lo que queda por cobrar y los abonos sin conciliar.

```bash
FINANCE_DIR=".../02_FINANCE" REPORT_DIR="..." npx tsx scripts/finance-regularize.ts            # simulación
FINANCE_DIR=".../02_FINANCE" REPORT_DIR="..." npx tsx scripts/finance-regularize.ts --apply    # guarda
FINANCE_DIR=".../02_FINANCE" npx tsx scripts/finance-regularize.ts --read-only                  # solo lee la carpeta
```

La importación de cartolas en la UI también reconoce el export de movimientos
de BCI («Fecha de transacción», «Glosa detalle», «Ingreso (+)», «Egreso (-)»)
y suma a la glosa el nombre y RUT de la contraparte.
