# Análisis de SLA

De `scripts/data/extract_sla_modules.py` sobre 3 SLA. Texto en
`data/processed/sla_text/`, encabezados en `data/processed/sla_segments.json`.

## Muestras

| SLA                             | Páginas | Servicios cubiertos                                                                       |
| ------------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| Alianza Ciberseguridad (B&D+WD) | 8       | Benchmark, Key Visual & Guía, Web (WP+Elementor), Propuesta socios + **anexo Mantención** |
| Todo Carnes (B&D)               | 11      | Estrategia, Catálogo, Audiovisual, Stand, LinkedIn B2B, Web                               |
| IDEA (WD)                       | 4       | UX/UI, Desarrollo Web, Migración                                                          |

## Estructura común (muy consistente)

**Secciones generales (en los 3):**

1. **Información General** — partes, cliente, proyecto, fecha.
2. **Esquema de Responsabilidades** — Studio Nomade vs cliente.
3. **Descripción de los Servicios** — un sub-bloque por servicio.
4. **Objetivos de Nivel de Servicio (SLOs)** — tiempos de respuesta, niveles.
5. **Proceso de trabajo / aprobación** — levantamiento → desarrollo → avance →
   revisión → ajustes → aprobación → cierre de etapa.
6. **Cronograma General**.
7. **Exclusiones**.
8. **Esquema de facturación** (algunos).
9. **Procedimientos de Modificación del SLA**.
10. **Procedimientos de Rescisión**.
11. **Vigencia y Aceptación**.

**Anexos opcionales:** Mantención mensual (capacidad creativa, niveles de
solicitud, planes de capacidad, KPIs).

## Conclusión

El SLA = **módulos generales fijos** + **módulos de alcance por servicio**
(insertados según los servicios cotizados) + **anexos** condicionales (ej.
Mantención). Esto habilita la generación automática desde los servicios de la
propuesta. Ver [sla-modules.md](sla-modules.md).
