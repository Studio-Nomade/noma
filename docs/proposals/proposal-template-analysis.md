# Análisis de la plantilla de cotización

Basado en el texto real de los 94 presupuestos (`data/processed/pdf_text/`) y los
SVG del deck. Insumo para el generador de propuestas (Fase 4).

## Estructura observada del deck (16:9)

1. **Portada** — año, "PROPUESTA Comercial", código `AREA_NAAMMDD`, área (BRANDING
   / WEB design / …), marca Studio Nomade.
2. **Contexto / entendimiento** (a veces).
3. **Objetivo**.
4. **Metodología / etapas** — por semanas (fuerte en Branding: Kick Off →
   Levantamiento → Identidad → Cambios → Manual).
5. **Servicios** — un bloque por servicio con:
   `título · valor (UF + IVA) · incluye (alcance) · "no considera" (exclusiones) ·
unidad (único/mensual/trimestral)`.
6. **Equipo Principal** — persona + **rol** (ej. Anna Sanhueza · Dirección Creativa).
   El rol es texto editable por propuesta.
7. **Inversión / valores** — subtotal en UF, **IVA 19%**, total.
8. **Condiciones comerciales / forma de pago**.
9. **Cierre** — contacto Studio Nomade.

## Reglas de negocio detectadas

- **Moneda: UF**. CLP es de presentación (UF diaria). **IVA 19%** se suma al total.
- Servicios con **tipo de valor**: único, mensual, trimestral → afecta cómo se
  totaliza (recurrentes vs únicos).
- Servicios con **niveles** (ej. Mantención Light/…): coincide con `complexity_level`.
- Cada servicio puede traer su **alcance** y sus **exclusiones** propias.

## Diferencias por área

- **WD**: catálogo de servicios + exclusiones + planes de mantención.
- **B&D / CE**: metodología por etapas semanales + entregables por etapa.
- **MP (Mercado Público)** y **A&A / A&D**: pendiente de revisar en detalle (sus
  PDFs ya están en `data/processed/pdf_text/`).

Ver la estructura propuesta para Noma en
[proposal-template-structure.md](proposal-template-structure.md).
