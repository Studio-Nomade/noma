# Análisis de precios

Basado en `branding_services_master.xlsx` (56 servicios). Salida en
`data/normalized/branding_services.json`.

## UF de referencia

- En todas las filas con UF y CLP, el ratio `CLP / UF` es **exactamente 37.000**.
- → El Excel fue tarifado con **UF = 37.000 CLP** (cercano a la UF real ~38.000).
- **Decisión:** guardamos el valor en **UF** como verdad. El CLP se muestra
  recalculado con la UF diaria (`exchange_rates`), no se congela el 37.000.
- Al importar: si una fila trae solo CLP, se puede derivar UF dividiendo por la UF
  de referencia (37.000) y marcarlo como `derived_uf = true`.

## Tipos de precio (`price_type`)

| Tipo | Qué es | Filas | Ejemplo |
|---|---|---|---|
| `uf` | Servicio tarifado en UF | 43 | Identidad de Marca Completa (15 UF) |
| `clp_unit` | Precio unitario en CLP (merch/impresión) | 13 | tazas, lápices, etc. (sin UF) |

Los `clp_unit` corresponden a **Merchandising & Impresión** (precios por unidad,
volumen variable) → en Noma conviene modelarlos como `price_type = unit` con
`unit` (ej. "c/u") y sin UF fija.

## Rango de valores (servicios en UF)

- Mínimo: 1 UF · Máximo: 35 UF.
- Hitos: identidad básica ~3–8 UF · identidad completa 15–19 UF · planes digitales
  mensuales 8–24 UF · desarrollo técnico hasta 35 UF.

## Pendiente

- Cruzar con los **valores reales de los PDF** (precios efectivamente cotizados)
  para validar el catálogo y detectar descuentos/negociación.
- Extraer precios de áreas no-Branding (WD, A&A, A&D, CE, MP) desde los PDF, ya
  que aún no existe un Excel maestro por área.
