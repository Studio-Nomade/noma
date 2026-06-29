/**
 * Enums de dominio de Noma — fuente única de verdad.
 * Se usan en el schema Drizzle, los schemas Zod y la UI (labels).
 */

// ── Áreas del estudio ────────────────────────────────────────
export const AREAS = ["B&D", "WD", "A&D", "A&A", "CE", "MP", "SN"] as const;
export type Area = (typeof AREAS)[number];

export const AREA_LABELS: Record<Area, string> = {
  "B&D": "Branding & Design",
  WD: "Web Design",
  "A&D": "Architecture & Design",
  "A&A": "Audiovisual & Animation",
  CE: "Clínica de Emprendimientos",
  MP: "Mercado Público",
  SN: "Studio Nomade · Operations",
};

// ── Moneda ───────────────────────────────────────────────────
export const CURRENCIES = ["CLP", "USD", "UF"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = "UF";

// ── Cliente ──────────────────────────────────────────────────
export const CLIENT_STATUSES = [
  "Prospecto",
  "Cliente activo",
  "Cliente recurrente",
  "Pausado",
  "Cerrado",
] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

// ── Proyecto ─────────────────────────────────────────────────
export const PROJECT_STATUSES = [
  "Levantamiento",
  "Brief recibido",
  "Propuesta en desarrollo",
  "Propuesta enviada",
  "Aprobado",
  "En desarrollo",
  "Pausado",
  "Cerrado",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const COMMERCIAL_STAGES = [
  "Nuevo lead",
  "Levantamiento",
  "Diagnóstico",
  "Propuesta",
  "Negociación",
  "Aprobado",
  "Perdido",
  "Stand by",
] as const;
export type CommercialStage = (typeof COMMERCIAL_STAGES)[number];

export const PRIORITIES = ["Alta", "Media", "Baja"] as const;
export type Priority = (typeof PRIORITIES)[number];

// Tipos de proyecto por área (desplegable dependiente del área).
// Derivado del levantamiento de presupuestos — ver docs/services/project-types.md.
export const PROJECT_TYPES_BY_AREA: Record<Area, string[]> = {
  "B&D": [
    "Desarrollo de Marca / Identidad",
    "Rediseño / Refresh de Marca",
    "Manual de Marca",
    "Naming",
    "Packaging",
    "Editorial & Presentaciones",
    "Papelería & Implementación",
    "Gestión de RRSS / Marketing Digital",
    "Merchandising",
  ],
  WD: [
    "Diseño y Desarrollo Web",
    "Rediseño Web",
    "Landing / Minisitio",
    "E-commerce",
    "Migración Web",
    "Mantención Web",
    "SEO / Google Ads",
  ],
  "A&D": [
    "Diseño de Stand / Ferias",
    "Interiorismo / Remodelación",
    "Memoria Constructiva",
    "Supervisión & Ejecución de Obra",
    "Render & Modelado 3D",
    "Packaging",
  ],
  "A&A": [
    "Video Corporativo",
    "Comercial / Spot",
    "Cápsula / Documental",
    "Cobertura de Evento",
    "Animación / Motion Graphics",
    "Fotografía / Sesión",
  ],
  CE: [
    "Branding para Emprendimientos",
    "Identidad Express",
    "Plan Clínica de Emprendimiento",
  ],
  MP: [
    "Producción Gráfica / Impresión",
    "Licitación / Mercado Público",
    "Gestión RRSS Sector Público",
  ],
  SN: ["Operaciones", "Gobernanza", "Interno"],
};

// ── Brief ────────────────────────────────────────────────────
export const BRIEF_STATUSES = ["Borrador", "Completado"] as const;
export type BriefStatus = (typeof BRIEF_STATUSES)[number];

// ── Propuesta ────────────────────────────────────────────────
export const PROPOSAL_STATUSES = [
  "Borrador",
  "En revisión",
  "Enviada",
  "Aprobada",
  "Rechazada",
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

// ── Servicio ─────────────────────────────────────────────────
export const SERVICE_STATUSES = ["Activo", "Inactivo"] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

// Nivel de complejidad de servicios compuestos (Desarrollo de Marca, planes…)
export const COMPLEXITY_LEVELS = [
  "Light",
  "Medium",
  "Regular",
  "Bold",
] as const;
export type ComplexityLevel = (typeof COMPLEXITY_LEVELS)[number];

// Tipo de precio: UF (servicio), unitario CLP (merch), rango o variable
export const PRICE_TYPES = ["uf", "unit", "range", "variable"] as const;
export type PriceType = (typeof PRICE_TYPES)[number];

// ── Finanzas / Facturación (preparación V2/V3) ───────────────
export const INVOICE_STATUSES = [
  "No facturado",
  "Preparado para facturar",
  "Borrador creado en Nubox",
  "Emitido",
  "Pagado",
  "Vencido",
  "Anulado",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

// Estado financiero manual del cliente (mientras no haya sync con Chipax)
export const FINANCIAL_STATUSES = [
  "Sin información",
  "Al día",
  "Con saldo pendiente",
  "Moroso",
] as const;
export type FinancialStatus = (typeof FINANCIAL_STATUSES)[number];

// Integraciones externas (para el registro de sincronización)
export const INTEGRATIONS = ["chipax", "nubox"] as const;
export type Integration = (typeof INTEGRATIONS)[number];

// ── Equipo / roles ───────────────────────────────────────────
export const TEAM_ROLES = ["admin", "user"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

// ── Enlaces externos ─────────────────────────────────────────
export const LINK_TYPES = [
  "drive",
  "figma",
  "asana",
  "notion",
  "slack",
  "canva",
  "meet",
  "calendar",
  "other",
] as const;
export type LinkType = (typeof LINK_TYPES)[number];

export const LINK_ENTITY_TYPES = ["client", "project", "proposal"] as const;
export type LinkEntityType = (typeof LINK_ENTITY_TYPES)[number];

// ── Documentos de contexto ───────────────────────────────────
export const DOC_CATEGORIES = [
  "presupuesto",
  "sla",
  "proceso",
  "plantilla",
  "referencia",
  "otro",
] as const;
export type DocCategory = (typeof DOC_CATEGORIES)[number];

// ── Base de conocimiento ─────────────────────────────────────
export const KNOWLEDGE_CATEGORIES = [
  "process",
  "best-practice",
  "tool-guide",
  "onboarding",
] as const;
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

// ── Secciones de propuesta (orden de render + contrato IA) ───
export const PROPOSAL_SECTIONS = [
  "context",
  "diagnosis",
  "main_objective",
  "specific_objectives",
  "scope",
  "work_stages",
  "deliverables",
  "timeline",
  "client_requirements",
  "exclusions",
  "team",
  "commercial_conditions",
] as const;
export type ProposalSection = (typeof PROPOSAL_SECTIONS)[number];

export const PROPOSAL_SECTION_LABELS: Record<ProposalSection, string> = {
  context: "Contexto",
  diagnosis: "Diagnóstico inicial",
  main_objective: "Objetivo general",
  specific_objectives: "Objetivos específicos",
  scope: "Alcance",
  work_stages: "Etapas de trabajo",
  deliverables: "Entregables",
  timeline: "Cronograma estimado",
  client_requirements: "Requerimientos al cliente",
  exclusions: "Exclusiones",
  team: "Equipo involucrado",
  commercial_conditions: "Condiciones comerciales",
};
