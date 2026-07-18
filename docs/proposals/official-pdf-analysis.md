# Levantamiento de cotizaciones oficiales

## Muestra revisada

Se contrastó el índice de 94 presupuestos (2025-2026), el texto extraído y una muestra visual renderizada de:

- `WD_N260623 - Punta Volcanes | Diseño y Desarrollo Web` (8 slides).
- `B&D_N260513 - Todo Carnes | Go To Market...` (37 slides).
- `A&A_N260429 Equifax | Producción Audiovisual - Comercial TV` (10 slides).
- Los 15 SVG de `ARCHIVO MAESTRO NOMADE` y los 8 SVG de Punta Volcanes.

Todos usan página 1440x810 (16:9) y fueron generados en Canva.

## Sistema visual observado

Constantes: fondo negro editorial o crema, marca pequeña en las esquinas, titulares condensados en mayúsculas y a gran escala, folio/contacto discreto, composición asimétrica y alto contraste. El naranja `#f48134`, el negro `#191919`/`#1d1d1b`, el crema `#ecf0ee` y blanco son verificables en SVG y PDFs.

Variables: collage/textura, color secundario de campaña, fotografías, cantidad de servicios y extensión metodológica. En Todo Carnes aparece celeste grisáceo y collage; Punta Volcanes conserva naranja. Estas variaciones corresponden al proyecto, no prueban todavía una paleta oficial fija por área.

## Slides recurrentes

Portada/marca, declaración de estudio, separador de área, contexto/objetivo, alcance, detalle de servicio, metodología, equipo, inversión, condiciones y cierre. Los decks largos repiten bloques de servicio/metodología; los breves omiten contexto o cronograma.

## Tipografía

La implementación usa las fuentes oficiales entregadas: Cook Gothif Bold para títulos y San Diego Medium/SemiBold para textos. Los eyebrow conservan la tipografía existente del producto. El gesto manuscrito permanece contenido en las láminas oficiales rasterizadas; su archivo editable no fue entregado.

## Decisión

La plantilla se reconstruye en React/HTML y en componentes equivalentes de `@react-pdf/renderer`. Los SVG vectorizados se conservan como referencia, no como documento editable. Los colores por área no comprobados usan naranja de marca como fallback.
