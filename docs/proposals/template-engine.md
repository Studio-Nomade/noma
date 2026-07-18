# Proposal Template Engine

Flujo implementado:

`queries` → `buildProposalPdfData` → modelo `ProposalTemplateData` → `ProposalDeck` (preview) / `renderProposalPdf` (PDF 16:9).

La versión actual se identifica como `studio-nomade-2026`. El endpoint `/proposals/[id]/pdf` y el flujo de envío continúan usando la misma función pública, por lo que no cambia el contrato del MVP.

La normalización resuelve cadencia única/mensual/trimestral desde `services.unit`, separa sus totales en UF, conserva ítems directos en CLP y presenta conversión referencial con IVA 19%.

Los temas solo fijan colores comprobados del sistema Nomade. Futuras plantillas pueden agregar una estrategia de tema por área sin alterar consultas ni rutas.

## Assets oficiales

`templates/assets.ts` centraliza portadas fijas, logos por área y retratos del equipo. En propuestas multiárea, los servicios se agrupan por área y cada grupo comienza con su portada oficial. Las láminas generales usan el logo Nomade; los servicios usan el logo del área con variante clara u oscura según el fondo.

Los retratos se resuelven primero desde `team_members.photo_url` y, si falta, por nombre normalizado contra `public/assets/team`. Las láminas SVG se usan en preview y su equivalente PNG en el render PDF.
