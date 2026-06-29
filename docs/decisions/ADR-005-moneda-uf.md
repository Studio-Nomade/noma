# ADR-005 — Moneda multi-divisa (CLP / USD / UF)

**Estado:** Aceptado · **Fecha:** 2026-06-29

## Contexto

Studio Nomade **cobra principalmente en UF** (Unidad de Fomento, indexada a inflación) para
proteger el valor de sus servicios, pero también maneja CLP y USD. Las cotizaciones requieren
conversión actualizada al día.

## Decisión

- **Enum `currency` = CLP | USD | UF.** Todo monto se almacena como par `*_amount` (numeric) +
  `*_currency`. **UF es el valor por defecto** en servicios y propuestas.
- **Tabla `exchange_rates`** (`date`, `uf_clp`, `usd_clp`) poblada por un **sync diario** desde
  **mindicador.cl** (indicadores del Banco Central de Chile, sin API key). Script
  `npm run rates:sync` (programable vía cron de Vercel).
- **Conversión al vuelo** en presentación: se muestra el monto en su moneda original y sus
  equivalencias usando la tasa del día (o la última disponible).
- Precisión: UF con 2 decimales en monto, tasa UF/CLP con la que entrega la fuente;
  redondeo de CLP a entero.

## Consecuencias

- Las cotizaciones se mantienen consistentes pese a la inflación.
- Dependencia de un servicio externo gratuito → se guarda histórico en `exchange_rates` y se
  contempla **fallback a la API de la CMF** si mindicador no responde.
- El conversor debe degradar con elegancia: si no hay tasa del día, usa la última conocida y
  lo señala.
