import type { Area } from "@/types/enums";

export type BriefField = { key: string; label: string; multiline?: boolean };

/** Preguntas específicas del brief según el área del proyecto. */
export const BRIEF_FIELDS_BY_AREA: Record<Area, BriefField[]> = {
  "B&D": [
    { key: "has_name", label: "¿Tiene nombre la marca? ¿Cuál?" },
    { key: "has_identity", label: "¿Tiene identidad/logo previo?" },
    {
      key: "competitors",
      label: "Competidores / referentes del rubro",
      multiline: true,
    },
    {
      key: "personality",
      label: "Personalidad deseada de la marca",
      multiline: true,
    },
    { key: "references", label: "Referentes visuales", multiline: true },
    {
      key: "dislikes",
      label: "Marcas o estilos que NO le gustan",
      multiline: true,
    },
    {
      key: "applications",
      label: "Aplicaciones necesarias (papelería, RRSS, etc.)",
      multiline: true,
    },
  ],
  WD: [
    { key: "current_site", label: "¿Tiene sitio actual? (URL)" },
    {
      key: "site_type",
      label: "Tipo de sitio (one page, corporativo, e-commerce…)",
    },
    { key: "sections", label: "Secciones requeridas", multiline: true },
    { key: "platform", label: "Plataforma preferida (WordPress, etc.)" },
    { key: "integrations", label: "Integraciones necesarias", multiline: true },
    { key: "references", label: "Referentes de sitios", multiline: true },
  ],
  "A&D": [
    {
      key: "project_type",
      label: "Tipo de proyecto (stand, interiorismo, obra…)",
    },
    { key: "surface", label: "Superficie aproximada (m²)" },
    { key: "location", label: "Ubicación" },
    { key: "budget_ref", label: "Presupuesto estimado" },
    {
      key: "regulations",
      label: "Normativa / permisos relevantes",
      multiline: true,
    },
    { key: "references", label: "Referentes", multiline: true },
  ],
  "A&A": [
    {
      key: "piece_type",
      label: "Tipo de pieza (video corporativo, spot, cápsula…)",
    },
    { key: "duration", label: "Duración estimada" },
    { key: "script", label: "¿Guión disponible?" },
    { key: "locations", label: "Locaciones", multiline: true },
    { key: "distribution", label: "Distribución / canales", multiline: true },
    { key: "references", label: "Referentes audiovisuales", multiline: true },
  ],
  CE: [
    { key: "stage", label: "Etapa del emprendimiento" },
    { key: "has_brand", label: "¿Tiene marca/identidad?" },
    { key: "business_model", label: "Modelo de negocio", multiline: true },
    { key: "goal", label: "Objetivo dentro del programa", multiline: true },
  ],
  MP: [
    { key: "item_type", label: "Tipo de producto / licitación" },
    { key: "quantity", label: "Cantidad / tiraje" },
    { key: "specs", label: "Especificaciones técnicas", multiline: true },
    { key: "deadline", label: "Plazo de entrega" },
    { key: "organism", label: "Organismo / mandante" },
  ],
  SN: [
    { key: "process_type", label: "Tipo de proceso interno" },
    { key: "areas_involved", label: "Áreas involucradas" },
    { key: "goal", label: "Objetivo interno", multiline: true },
  ],
};
