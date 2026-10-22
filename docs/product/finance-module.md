# Módulo Finanzas / Facturación

Studio Nomade factura en **Nubox**, que se usa **solo como facturador**. Noma es
donde vive el estado real de cada factura: qué se envió, qué se pagó y qué falta
cobrar. La señal de pago es la **cartola del banco (BCI)**, que Finanzas carga a
mano una vez al mes.

## Fuentes de datos

| Fuente | Qué aporta | Cómo entra hoy |
|---|---|---|
| Nubox | Facturas emitidas (folio, fechas, montos), PDF y XML | Exportación CSV/XLSX o XML DTE en **Finanzas → Importar**. La API de Nubox (listar ventas y bajar PDF/XML) queda para cuando el plan la habilite. |
| Banco BCI | Movimientos de la cuenta corriente | **Carga manual mensual** de la cartola XLSX (hoja `CartolaHistorica`) en **Finanzas → Importar**. |
| SII | Registro de Compras y Ventas, estado DTE | Pendiente: lectura con certificado digital en el servidor. |

Regla dura: Noma **nunca emite** facturas. Nubox es el único emisor.

## Carga mensual de la cartola BCI

1. Descargar la cartola del mes desde el banco en formato **Excel (.xlsx)**.
2. **Finanzas → Importar → Cartola bancaria (BCI)**, elegir la cuenta y subir
   el archivo. Noma detecta solo la hoja `CartolaHistorica` y la fila de
   encabezados (`Fecha · Sucursal · Descripción · N° Documento · Cheques y
   otros cargos · Depósitos y Abono · Saldo diario`), aunque la tabla parta
   más abajo del resumen del período.
3. La **vista previa** muestra el período de la cartola, los movimientos
   válidos, los rechazados y los duplicados. Un movimiento se considera
   duplicado si coinciden fecha, tipo, monto, descripción (con su N° de
   documento) y saldo diario; así no se pierden dos pagos iguales del mismo día.
4. Al confirmar, los movimientos quedan **pendientes** de conciliar.
5. En **Finanzas → Banco**, Noma **propone conciliaciones**: abono contra factura
   abierta por **monto exacto**, con el pago entre 5 días antes de la emisión y
   120 días después (más puntaje dentro de 45 días y si la glosa trae el RUT o
   el nombre del cliente). Los abonos de factoring (Financia Capital, Xepelin…)
   no se proponen contra facturas de clientes: se concilian aparte. Toda
   conciliación es reversible.

## Cobranza (desde sales@)

Los correos de cobranza salen **siempre desde sales@** (`NOMA_COBRANZA_FROM`).
Las plantillas base son el **playbook P1–P8**, levantado de los correos reales
del estudio (`src/features/finance/cobranza/playbook.ts`, se cargan con el seed
y se editan en **Cobranza → Plantillas**):

| Código | Uso |
|---|---|
| P1 | Envío de factura (con PDF y XML) |
| P2 | Emisión de varias facturas en un mismo correo |
| P3 | Seguimiento de facturas pendientes (lo genera el seguimiento a 7 días) |
| P4 | Confirmación de pago recibido |
| P5 | Datos de transferencia |
| P6 | Solicitud de orden de compra |
| P7 | Estado de pagos de facturas cedidas a factoring |
| P8 | Aviso de cesión al factoring |

Los datos bancarios del estudio no están en el repositorio: la variable
`{datos_transferencia}` se completa con `NOMA_COBRANZA_DATOS_TRANSFERENCIA`.

### Seguimiento a 7 días

- Un cron de días hábiles (`/api/cron/cobranza-seguimiento`, 10:00 de Chile)
  revisa cada factura de venta abierta. Si pasaron 7 días desde el envío (P1/P2)
  sin pago conciliado, prepara un **P3**, agrupado por cliente. Sin registro de
  envío, cuenta desde la fecha de emisión. Repite cada 7 días hasta 3 veces;
  después queda marcada para revisión humana (la cobranza legal la decide
  Finanzas).
- **No envía** si la factura está pagada o conciliada, anulada, cedida a
  factoring, con fecha de pago comprometida vigente, en cobranza legal o con el
  seguimiento pausado. Estos datos se registran por factura en el panel
  **Cobranza → Seguimiento a 7 días**.
- **Modo borrador por defecto:** el P3 queda en el historial como *Pendiente*
  y Finanzas lo envía con «Reintentar». Solo con `NOMA_COBRANZA_AUTOSEND=true`
  el cron envía solo.

## Modelo de datos

- **`fin_documents`**: ventas y compras contables (desde Nubox/RCV), con
  `monto_conciliado` y estado (`EMITIDA`, `PARCIAL`, `VENCIDA`, `CONCILIADA`…).
- **`bank_transactions`**: movimientos de la cartola.
- **`reconciliations`** (+ documentos y movimientos): conciliación N-a-N,
  reversible.
- **`cobranza_templates`** y **`cobranza_messages`**: plantillas y bitácora de
  correos (enviados, pendientes o con error).
- **`cobranza_cases`**: estado del seguimiento por factura (envío, último
  seguimiento, fecha comprometida, factoring, legal, pausa).
- **`invoices`**: factura comercial ligada a proyecto/propuesta (estructura
  Nubox: `nuboxId`, `folio`, `glosa`, montos y fechas).

## Variables de entorno

| Variable | Para qué |
|---|---|
| `NOMA_COBRANZA_FROM` | Remitente de cobranza (por defecto `sales@studionomade.cl`). |
| `NOMA_COBRANZA_DATOS_TRANSFERENCIA` | Datos bancarios del estudio para las plantillas (texto; `\n` para saltos de línea). |
| `NOMA_COBRANZA_AUTOSEND` | `true` activa el envío automático del seguimiento a 7 días. Sin ella, solo borradores. |
| `CRON_SECRET` | Protege los endpoints de cron. |

## Documentación técnica

- [nubox.md](../technical/integrations/nubox.md)
