/**
 * Enums de dominio de Noma — fuente única de verdad.
 * Se usan en el schema Drizzle, los schemas Zod y la UI (labels).
 */

// ── Áreas del estudio ────────────────────────────────────────
// Nota: los valores nuevos se agregan al FINAL para que la migración de Postgres
// use `ALTER TYPE ... ADD VALUE` sin recrear el enum ni tocar filas existentes.
export const AREAS = [
  "B&D",
  "WD",
  "A&D",
  "A&A",
  "CE",
  "MP",
  "SN",
  "CSM",
  "STR",
] as const;
export type Area = (typeof AREAS)[number];

export const AREA_LABELS: Record<Area, string> = {
  "B&D": "Branding & Design",
  WD: "Web Design",
  "A&D": "Architecture & Design",
  "A&A": "Audiovisual & Animation",
  CE: "Clínica de Emprendimientos",
  MP: "Mercado Público",
  SN: "Studio Nomade · Operations",
  CSM: "Content & Social Media",
  STR: "Strategy / Consultoría",
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

// Valores nuevos al final (ADD VALUE sin recrear el enum).
export const COMMERCIAL_STAGES = [
  "Nuevo lead",
  "Levantamiento",
  "Diagnóstico",
  "Propuesta",
  "Negociación",
  "Aprobado",
  "Perdido",
  "Stand by",
  "Lead calificado",
  "Reunión inicial agendada",
  "Traspasado a operación",
] as const;
export type CommercialStage = (typeof COMMERCIAL_STAGES)[number];

// Orden y agrupación de columnas del Pipeline (Kanban). "Levantamiento" y
// "Diagnóstico" se pliegan bajo "Reunión inicial agendada"; el resto mapea 1:1.
// Este orden es de presentación — el enum mantiene compatibilidad con datos previos.
export const PIPELINE_STAGES: readonly CommercialStage[] = [
  "Nuevo lead",
  "Lead calificado",
  "Reunión inicial agendada",
  "Propuesta",
  "Negociación",
  "Aprobado",
  "Traspasado a operación",
  "Perdido",
  "Stand by",
] as const;

// Etapas heredadas que se muestran dentro de una columna del Pipeline nuevo.
export const STAGE_ALIASES: Partial<Record<CommercialStage, CommercialStage>> = {
  Levantamiento: "Reunión inicial agendada",
  Diagnóstico: "Reunión inicial agendada",
};

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
  CSM: [
    "Gestión de RRSS / Community Management",
    "Grilla de Contenidos",
    "Diseño de Piezas / Reels",
    "Pauta / Ads",
    "Email Marketing",
    "Apertura de Canales",
  ],
  STR: [
    "Diagnóstico Estratégico",
    "Workshop",
    "Documento Estratégico",
    "Acompañamiento Mensual",
    "Consultoría",
  ],
};

// ── Brief ────────────────────────────────────────────────────
// Legacy ("Borrador"/"Completado") se conservan al inicio por compatibilidad con
// filas existentes; los 9 estados del flujo inteligente se agregan al final.
export const BRIEF_STATUSES = [
  "Borrador",
  "Completado",
  "Sin reunión agendada",
  "Reunión agendada",
  "Reunión realizada",
  "Notas pendientes",
  "Notas importadas",
  "Procesando notas",
  "Brief sugerido",
  "Brief en revisión",
  "Brief aprobado",
] as const;
export type BriefStatus = (typeof BRIEF_STATUSES)[number];

// ── Reunión de brief ─────────────────────────────────────────
export const MEETING_STATUSES = [
  "Agendada",
  "Realizada",
  "Cancelada",
] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

// ── Notas de reunión (Gemini/Drive/manual) ───────────────────
export const NOTE_SOURCES = ["drive", "paste", "file", "link"] as const;
export type NoteSource = (typeof NOTE_SOURCES)[number];

export const NOTE_SOURCE_LABELS: Record<NoteSource, string> = {
  drive: "Google Drive",
  paste: "Texto pegado",
  file: "Archivo cargado",
  link: "Enlace",
};

// Resultado del matching de notas (Opción A — Drive). Se usa en Inc. D.
export const NOTE_MATCH_STATUSES = [
  "auto",
  "candidates",
  "not_found",
  "manual",
] as const;
export type NoteMatchStatus = (typeof NOTE_MATCH_STATUSES)[number];

// Campos del brief general (bloque común). Orden de render.
export const BRIEF_GENERAL_FIELDS = [
  { key: "contextGeneral", label: "Contexto general del cliente" },
  { key: "mainObjective", label: "Objetivo principal" },
  { key: "problem", label: "Problema o necesidad del cliente" },
  { key: "targetAudience", label: "Público objetivo" },
  { key: "expectedOutcome", label: "Qué espera lograr" },
  { key: "idealDeadline", label: "Plazo ideal" },
  { key: "availableMaterials", label: "Material disponible" },
  { key: "budgetMentioned", label: "Presupuesto mencionado" },
  { key: "decisionMakers", label: "Tomadores de decisión" },
  { key: "urgency", label: "Urgencia" },
  { key: "restrictions", label: "Restricciones" },
  { key: "generalComments", label: "Comentarios generales" },
  { key: "pendingInfo", label: "Información pendiente" },
  { key: "recommendedNextAction", label: "Próxima acción recomendada" },
] as const;
export type BriefGeneralFieldKey = (typeof BRIEF_GENERAL_FIELDS)[number]["key"];

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

// ── SLA (Acuerdo de Nivel de Servicio) ───────────────────────
export const SLA_STATUSES = [
  "Borrador",
  "Revisado",
  "Firmado",
  "Enviado",
] as const;
export type SlaStatus = (typeof SLA_STATUSES)[number];

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

// ── Solicitud CFO (traspaso a operación) ─────────────────────
export const CFO_REQUEST_STATUSES = [
  "Pendiente",
  "En revisión",
  "Aprobada",
  "Rechazada",
] as const;
export type CfoRequestStatus = (typeof CFO_REQUEST_STATUSES)[number];

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

// ─────────────────────────────────────────────────────────────
// Módulo CFO / Finanzas — dominio contable (ledger, banco, docs)
// Valores en MAYÚSCULA porque son códigos internos (no labels de UI);
// los labels legibles se derivan en la UI. Portado del MVP financiero.
// ─────────────────────────────────────────────────────────────

// Tipo de contacto contable (clientes / proveedores)
export const CONTACT_TYPES = ["CLIENTE", "PROVEEDOR", "AMBOS"] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

// Dirección del documento tributario
export const DOCUMENT_DIRECTIONS = ["VENTA", "COMPRA"] as const;
export type DocumentDirection = (typeof DOCUMENT_DIRECTIONS)[number];

// Tipo de documento tributario
export const FIN_DOCUMENT_TYPES = [
  "FACTURA_VENTA",
  "FACTURA_COMPRA",
  "NOTA_CREDITO",
  "NOTA_DEBITO",
  "BOLETA",
  "BOLETA_HONORARIOS",
] as const;
export type FinDocumentType = (typeof FIN_DOCUMENT_TYPES)[number];

// Estado de pago/tributario del documento contable
export const FIN_DOCUMENT_STATUSES = [
  "EMITIDA",
  "PAGADA",
  "PARCIAL",
  "VENCIDA",
  "ANULADA",
  "CONCILIADA",
] as const;
export type FinDocumentStatus = (typeof FIN_DOCUMENT_STATUSES)[number];

// Ciclo de vida / eliminación lógica (nunca borrado físico)
export const RECORD_STATUSES = [
  "ACTIVO",
  "ANULADO",
  "IGNORADO",
  "ARCHIVADO",
  "ELIMINADO_LOGICO",
] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

// Movimiento bancario: abono (entra) / cargo (sale)
export const BANK_TXN_TYPES = ["ABONO", "CARGO"] as const;
export type BankTxnType = (typeof BANK_TXN_TYPES)[number];

// Estado de conciliación de un movimiento bancario
export const BANK_TXN_STATUSES = [
  "PENDIENTE",
  "CONCILIADO",
  "PARCIAL",
  "IGNORADO",
] as const;
export type BankTxnStatus = (typeof BANK_TXN_STATUSES)[number];

// Tipo de cuenta del plan de cuentas
export const LEDGER_ACCOUNT_TYPES = [
  "INGRESO",
  "COSTO",
  "GASTO",
  "ACTIVO",
  "PASIVO",
  "PATRIMONIO",
] as const;
export type LedgerAccountType = (typeof LEDGER_ACCOUNT_TYPES)[number];

// Tipo de importación (fuente del archivo)
export const IMPORT_TYPES = [
  "NUBOX_VENTAS",
  "NUBOX_COMPRAS",
  "CARTOLA_BANCARIA",
] as const;
export type ImportType = (typeof IMPORT_TYPES)[number];

// Estado de un lote de importación
export const IMPORT_STATUSES = ["BORRADOR", "CONFIRMADO", "RECHAZADO"] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

// Estado de una conciliación (reversible, nunca se borra)
export const RECONCILIATION_STATUSES = ["ACTIVA", "REVERTIDA"] as const;
export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];

// Campo de comparación de una regla de clasificación automática
export const RULE_MATCH_FIELDS = ["CONTACTO", "RUT", "GLOSA", "MONTO"] as const;
export type RuleMatchField = (typeof RULE_MATCH_FIELDS)[number];

// Momento de cobranza (correo al cliente según el ciclo del proyecto)
export const COBRANZA_MOMENTS = ["INICIO", "TERMINO", "RECORDATORIO"] as const;
export type CobranzaMoment = (typeof COBRANZA_MOMENTS)[number];

export const COBRANZA_MOMENT_LABELS: Record<CobranzaMoment, string> = {
  INICIO: "Inicio de proyecto",
  TERMINO: "Término de proyecto",
  RECORDATORIO: "Recordatorio de pago",
};

// Estado de un correo de cobranza
export const COBRANZA_STATUSES = ["ENVIADO", "PENDIENTE", "ERROR"] as const;
export type CobranzaStatus = (typeof COBRANZA_STATUSES)[number];

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
