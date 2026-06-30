import {
  pgTable,
  pgEnum,
  uuid,
  text,
  numeric,
  integer,
  boolean,
  date,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import {
  AREAS,
  CURRENCIES,
  CLIENT_STATUSES,
  PROJECT_STATUSES,
  COMMERCIAL_STAGES,
  PRIORITIES,
  BRIEF_STATUSES,
  PROPOSAL_STATUSES,
  SERVICE_STATUSES,
  COMPLEXITY_LEVELS,
  PRICE_TYPES,
  INVOICE_STATUSES,
  FINANCIAL_STATUSES,
  INTEGRATIONS,
  TEAM_ROLES,
  LINK_TYPES,
  LINK_ENTITY_TYPES,
  DOC_CATEGORIES,
  KNOWLEDGE_CATEGORIES,
} from "@/types/enums";

// ── Enums (Postgres) ─────────────────────────────────────────
export const areaEnum = pgEnum("area", AREAS);
export const currencyEnum = pgEnum("currency", CURRENCIES);
export const clientStatusEnum = pgEnum("client_status", CLIENT_STATUSES);
export const projectStatusEnum = pgEnum("project_status", PROJECT_STATUSES);
export const commercialStageEnum = pgEnum(
  "commercial_stage",
  COMMERCIAL_STAGES,
);
export const priorityEnum = pgEnum("priority", PRIORITIES);
export const briefStatusEnum = pgEnum("brief_status", BRIEF_STATUSES);
export const proposalStatusEnum = pgEnum("proposal_status", PROPOSAL_STATUSES);
export const serviceStatusEnum = pgEnum("service_status", SERVICE_STATUSES);
export const complexityLevelEnum = pgEnum(
  "complexity_level",
  COMPLEXITY_LEVELS,
);
export const priceTypeEnum = pgEnum("price_type", PRICE_TYPES);
export const invoiceStatusEnum = pgEnum("invoice_status", INVOICE_STATUSES);
export const financialStatusEnum = pgEnum(
  "financial_status",
  FINANCIAL_STATUSES,
);
export const integrationEnum = pgEnum("integration", INTEGRATIONS);
export const teamRoleEnum = pgEnum("team_role", TEAM_ROLES);
export const linkTypeEnum = pgEnum("link_type", LINK_TYPES);
export const linkEntityTypeEnum = pgEnum("link_entity_type", LINK_ENTITY_TYPES);
export const docCategoryEnum = pgEnum("doc_category", DOC_CATEGORIES);
export const knowledgeCategoryEnum = pgEnum(
  "knowledge_category",
  KNOWLEDGE_CATEGORIES,
);

// Columnas comunes a todas las tablas.
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  // Referencia a auth.users (gestionado por Supabase); sin FK para no acoplar migraciones.
  createdBy: uuid("created_by"),
};

// ── clients ──────────────────────────────────────────────────
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name"),
  contactRole: text("contact_role"),
  email: text("email"),
  phone: text("phone"),
  industry: text("industry"),
  website: text("website"),
  instagram: text("instagram"),
  linkedin: text("linkedin"),
  status: clientStatusEnum("status").default("Prospecto").notNull(),
  internalNotes: text("internal_notes"),
  // ── Datos tributarios / facturación (preparación Chipax/Nubox) ──
  rut: text("rut"),
  legalName: text("legal_name"), // razón social
  taxActivity: text("tax_activity"), // giro
  taxAddress: text("tax_address"),
  billingEmail: text("billing_email"),
  billingNotes: text("billing_notes"),
  financialStatus:
    financialStatusEnum("financial_status").default("Sin información"),
  chipaxId: text("chipax_id"), // ID externo en Chipax
  ...timestamps,
});

// ── team_members ─────────────────────────────────────────────
export const teamMembers = pgTable("team_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"), // auth.users.id
  name: text("name").notNull(),
  teamRole: teamRoleEnum("team_role").default("user").notNull(),
  // cargo por defecto (ej. "Dirección Creativa") + foto de perfil para el deck
  roleTitle: text("role_title"),
  photoUrl: text("photo_url"),
  area: areaEnum("area"),
  email: text("email"),
  status: text("status").default("Activo").notNull(),
  tools: jsonb("tools").$type<string[]>().default([]),
  // Referencias a un gestor de contraseñas externo — NUNCA secretos en claro.
  accessReferences: jsonb("access_references")
    .$type<{ label: string; manager: string; item: string }[]>()
    .default([]),
  repos: jsonb("repos").$type<string[]>().default([]),
  notes: text("notes"),
  ...timestamps,
});

// ── projects ─────────────────────────────────────────────────
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "restrict" }),
  area: areaEnum("area").notNull(), // área principal (= areas[0])
  areas: areaEnum("areas").array().default([]).notNull(),
  projectType: text("project_type"),
  description: text("description"),
  mainObjective: text("main_objective"),
  startDate: date("start_date"),
  deliveryDate: date("delivery_date"),
  budgetAmount: numeric("budget_amount", { precision: 14, scale: 2 }),
  budgetCurrency: currencyEnum("budget_currency").default("UF"),
  status: projectStatusEnum("status").default("Levantamiento").notNull(),
  commercialStage: commercialStageEnum("commercial_stage")
    .default("Nuevo lead")
    .notNull(),
  priority: priorityEnum("priority").default("Media").notNull(),
  // Responsable interno: texto libre en V1 (`responsible`). En Fase 6 se podrá
  // vincular a team_members vía `responsibleId` (reservado, sin uso aún).
  responsible: text("responsible"),
  responsibleId: uuid("responsible_id").references(() => teamMembers.id, {
    onDelete: "set null",
  }),
  nextAction: text("next_action"),
  internalNotes: text("internal_notes"),
  ...timestamps,
});

// ── briefs (1:1 con project) ─────────────────────────────────
export const briefs = pgTable(
  "briefs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    area: areaEnum("area").notNull(),
    projectName: text("project_name"),
    mainObjective: text("main_objective"),
    problem: text("problem"),
    targetAudience: text("target_audience"),
    expectedOutcome: text("expected_outcome"),
    idealDeadline: text("ideal_deadline"),
    budgetAmount: numeric("budget_amount", { precision: 14, scale: 2 }),
    budgetCurrency: currencyEnum("budget_currency").default("UF"),
    availableMaterials: text("available_materials"),
    generalComments: text("general_comments"),
    specificFields: jsonb("specific_fields")
      .$type<Record<string, unknown>>()
      .default({}),
    status: briefStatusEnum("status").default("Borrador").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("briefs_project_id_unique").on(t.projectId)],
);

// ── services (biblioteca global) ─────────────────────────────
export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  area: areaEnum("area").notNull(),
  subarea: text("subarea"),
  category: text("category"),
  description: text("description"),
  deliverables: text("deliverables"),
  estimatedTime: text("estimated_time"),
  complexityLevel: complexityLevelEnum("complexity_level"),
  priceType: priceTypeEnum("price_type").default("uf").notNull(),
  priceMinAmount: numeric("price_min_amount", { precision: 14, scale: 2 }),
  priceMaxAmount: numeric("price_max_amount", { precision: 14, scale: 2 }),
  priceCurrency: currencyEnum("price_currency").default("UF"),
  unit: text("unit"),
  requirements: text("requirements"),
  isComposite: boolean("is_composite").default(false).notNull(),
  status: serviceStatusEnum("status").default("Activo").notNull(),
  relatedServices: uuid("related_services").array().default([]),
  // trazabilidad del insumo de origen (Excel/PDF)
  sourceFile: text("source_file"),
  sourceYear: text("source_year"),
  ...timestamps,
});

// ── service_modules (módulos combinables) ────────────────────
export const serviceModules = pgTable("service_modules", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  area: areaEnum("area").notNull(),
  subarea: text("subarea"),
  description: text("description"),
  deliverables: text("deliverables"),
  estimatedTime: text("estimated_time"),
  priceAmount: numeric("price_amount", { precision: 14, scale: 2 }),
  priceCurrency: currencyEnum("price_currency").default("UF"),
  canBeSoldIndependently: boolean("can_be_sold_independently")
    .default(true)
    .notNull(),
  status: serviceStatusEnum("status").default("Activo").notNull(),
  sourceFile: text("source_file"),
  ...timestamps,
});

// ── service_module_links (servicio compuesto ↔ módulos, N:N) ──
export const serviceModuleLinks = pgTable(
  "service_module_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => serviceModules.id, { onDelete: "cascade" }),
    order: integer("order").default(0).notNull(),
    includedByDefault: boolean("included_by_default").default(true).notNull(),
  },
  (t) => [index("service_module_links_service_idx").on(t.serviceId)],
);

// ── proposals ────────────────────────────────────────────────
export const proposals = pgTable("proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").references(() => clients.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  // 12 secciones
  context: text("context"),
  diagnosis: text("diagnosis"),
  mainObjective: text("main_objective"),
  specificObjectives: text("specific_objectives"),
  scope: text("scope"),
  workStages: text("work_stages"),
  deliverables: text("deliverables"),
  timeline: text("timeline"),
  // Etapas con rango de fechas para la carta Gantt del deck/PDF.
  timelineStages: jsonb("timeline_stages")
    .$type<{ name: string; start: string; end: string }[]>()
    .default([]),
  clientRequirements: text("client_requirements"),
  exclusions: text("exclusions"),
  team: text("team"),
  commercialConditions: text("commercial_conditions"),
  estimatedValueAmount: numeric("estimated_value_amount", {
    precision: 14,
    scale: 2,
  }),
  estimatedValueCurrency: currencyEnum("estimated_value_currency").default(
    "UF",
  ),
  status: proposalStatusEnum("status").default("Borrador").notNull(),
  nextAction: text("next_action"),
  version: integer("version").default(1).notNull(),
  // raíz de la cadena de versiones (la v1 apunta a sí misma).
  rootId: uuid("root_id"),
  ...timestamps,
});

// ── proposal_services (join N:N) ─────────────────────────────
export const proposalServices = pgTable(
  "proposal_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    position: integer("position").default(0).notNull(),
    customPriceAmount: numeric("custom_price_amount", {
      precision: 14,
      scale: 2,
    }),
    customPriceCurrency: currencyEnum("custom_price_currency"),
  },
  (t) => [
    uniqueIndex("proposal_services_unique").on(t.proposalId, t.serviceId),
  ],
);

// ── proposal_team (equipo de la propuesta, con rol por proyecto) ──
export const proposalTeam = pgTable(
  "proposal_team",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => teamMembers.id, { onDelete: "cascade" }),
    roleInProject: text("role_in_project"),
    position: integer("position").default(0).notNull(),
  },
  (t) => [uniqueIndex("proposal_team_unique").on(t.proposalId, t.memberId)],
);

// ── proposal_notes (hilo de seguimiento de la propuesta) ─────
export const proposalNotes = pgTable(
  "proposal_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // se ancla a la raíz para que el hilo persista entre versiones
    rootId: uuid("root_id").notNull(),
    authorId: uuid("author_id"),
    authorEmail: text("author_email"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("proposal_notes_root_idx").on(t.rootId)],
);

// ── resource_links (polimórfica) ─────────────────────────────
export const resourceLinks = pgTable(
  "resource_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: linkEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    type: linkTypeEnum("type").default("other").notNull(),
    label: text("label"),
    url: text("url").notNull(),
    ...timestamps,
  },
  (t) => [index("resource_links_entity_idx").on(t.entityType, t.entityId)],
);

// ── client_contacts (varios correos por cliente) ────────────
export const clientContacts = pgTable(
  "client_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name"),
    email: text("email").notNull(),
    role: text("role"),
    isPrimary: boolean("is_primary").default(false).notNull(),
    ...timestamps,
  },
  (t) => [index("client_contacts_client_idx").on(t.clientId)],
);

// ── email_templates (mantenedor de plantillas de correo) ─────
export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  area: areaEnum("area"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  status: text("status").default("Activo").notNull(),
  ...timestamps,
});

// ── user_integrations (token de Google para enviar como el usuario) ──
export const userIntegrations = pgTable("user_integrations", {
  userId: uuid("user_id").primaryKey(), // auth.users.id
  email: text("email"),
  googleRefreshToken: text("google_refresh_token"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── studio_config (singleton) ────────────────────────────────
export const studioConfig = pgTable("studio_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  studioName: text("studio_name").default("Studio Nomade").notNull(),
  tagline: text("tagline"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  address: text("address"),
  commercialConditionsTemplate: text("commercial_conditions_template"),
  ...timestamps,
});

// ── knowledge_docs ───────────────────────────────────────────
export const knowledgeDocs = pgTable("knowledge_docs", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  area: areaEnum("area"),
  category: knowledgeCategoryEnum("category").default("process").notNull(),
  content: text("content"),
  links: jsonb("links").$type<{ label: string; url: string }[]>().default([]),
  ...timestamps,
});

// ── context_documents ────────────────────────────────────────
export const contextDocuments = pgTable("context_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  docCategory: docCategoryEnum("doc_category").default("otro").notNull(),
  area: areaEnum("area"),
  tags: jsonb("tags").$type<string[]>().default([]),
  storagePath: text("storage_path"),
  mimeType: text("mime_type"),
  source: text("source"),
  notes: text("notes"),
  ...timestamps,
});

// ── exchange_rates ───────────────────────────────────────────
export const exchangeRates = pgTable(
  "exchange_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: date("date").notNull(),
    ufClp: numeric("uf_clp", { precision: 14, scale: 4 }),
    usdClp: numeric("usd_clp", { precision: 14, scale: 4 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("exchange_rates_date_unique").on(t.date)],
);

// ── activity_log ─────────────────────────────────────────────
export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    action: text("action").notNull(),
    actorId: uuid("actor_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("activity_log_created_idx").on(t.createdAt)],
);

// ── invoices (preparación Nubox; sin emisión automática) ─────
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    proposalId: uuid("proposal_id").references(() => proposals.id, {
      onDelete: "set null",
    }),
    status: invoiceStatusEnum("status").default("No facturado").notNull(),
    // ID externo del documento en Nubox (al crear el borrador/emisión).
    nuboxId: text("nubox_id"),
    folio: text("folio"),
    glosa: text("glosa"),
    paymentTerms: text("payment_terms"), // condición de pago
    currency: currencyEnum("currency").default("CLP"),
    netAmount: numeric("net_amount", { precision: 14, scale: 2 }),
    ivaAmount: numeric("iva_amount", { precision: 14, scale: 2 }),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }),
    balanceDue: numeric("balance_due", { precision: 14, scale: 2 }),
    // Servicios facturados (snapshot): [{ serviceId, name, amount }]
    lineItems: jsonb("line_items")
      .$type<{ serviceId?: string; name: string; amount: number }[]>()
      .default([]),
    documentCreatedAt: timestamp("document_created_at", { withTimezone: true }),
    issuedAt: date("issued_at"),
    dueAt: date("due_at"),
    paidAt: date("paid_at"),
    ...timestamps,
  },
  (t) => [
    index("invoices_client_idx").on(t.clientId),
    index("invoices_project_idx").on(t.projectId),
  ],
);

// ── integration_sync_log (registro de sincronización Chipax/Nubox) ──
export const integrationSyncLog = pgTable(
  "integration_sync_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    integration: integrationEnum("integration").notNull(),
    entityType: text("entity_type"), // 'client' | 'invoice' | ...
    entityId: uuid("entity_id"),
    action: text("action").notNull(), // 'pull' | 'push' | 'create' ...
    status: text("status").notNull(), // 'ok' | 'error'
    message: text("message"),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("integration_sync_log_idx").on(t.integration, t.createdAt)],
);

// ── Tipos inferidos ──────────────────────────────────────────
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Brief = typeof briefs.$inferSelect;
export type NewBrief = typeof briefs.$inferInsert;
export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
export type ServiceModule = typeof serviceModules.$inferSelect;
export type NewServiceModule = typeof serviceModules.$inferInsert;
export type ServiceModuleLink = typeof serviceModuleLinks.$inferSelect;
export type Proposal = typeof proposals.$inferSelect;
export type NewProposal = typeof proposals.$inferInsert;
export type ProposalService = typeof proposalServices.$inferSelect;
export type ProposalTeam = typeof proposalTeam.$inferSelect;
export type ProposalNote = typeof proposalNotes.$inferSelect;
export type ClientContact = typeof clientContacts.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type IntegrationSyncLog = typeof integrationSyncLog.$inferSelect;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type NewEmailTemplate = typeof emailTemplates.$inferInsert;
export type ResourceLink = typeof resourceLinks.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type KnowledgeDoc = typeof knowledgeDocs.$inferSelect;
export type ContextDocument = typeof contextDocuments.$inferSelect;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type StudioConfig = typeof studioConfig.$inferSelect;
