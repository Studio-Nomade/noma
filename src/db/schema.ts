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
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import {
  AREAS,
  CURRENCIES,
  CLIENT_STATUSES,
  PROJECT_STATUSES,
  COMMERCIAL_STAGES,
  PRIORITIES,
  BRIEF_STATUSES,
  MEETING_STATUSES,
  NOTE_SOURCES,
  CFO_REQUEST_STATUSES,
  CONTACT_PROFILES,
  PROPOSAL_STATUSES,
  SERVICE_STATUSES,
  COMPLEXITY_LEVELS,
  PRICE_TYPES,
  SLA_STATUSES,
  INVOICE_STATUSES,
  FINANCIAL_STATUSES,
  INTEGRATIONS,
  TEAM_ROLES,
  LINK_TYPES,
  LINK_ENTITY_TYPES,
  DOC_CATEGORIES,
  KNOWLEDGE_CATEGORIES,
  CONTACT_TYPES,
  DOCUMENT_DIRECTIONS,
  FIN_DOCUMENT_TYPES,
  FIN_DOCUMENT_STATUSES,
  RECORD_STATUSES,
  BANK_TXN_TYPES,
  BANK_TXN_STATUSES,
  LEDGER_ACCOUNT_TYPES,
  IMPORT_TYPES,
  IMPORT_STATUSES,
  RECONCILIATION_STATUSES,
  RULE_MATCH_FIELDS,
  COBRANZA_MOMENTS,
  COBRANZA_STATUSES,
  ANNOUNCEMENT_CATEGORIES,
  SURVEY_TYPES,
  SURVEY_STATUSES,
  SURVEY_QUESTION_TYPES,
  SURVEY_ASSIGNMENT_STATUSES,
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
export const meetingStatusEnum = pgEnum("meeting_status", MEETING_STATUSES);
export const noteSourceEnum = pgEnum("note_source", NOTE_SOURCES);
export const cfoRequestStatusEnum = pgEnum(
  "cfo_request_status",
  CFO_REQUEST_STATUSES,
);
export const contactProfileEnum = pgEnum("contact_profile", CONTACT_PROFILES);
export const proposalStatusEnum = pgEnum("proposal_status", PROPOSAL_STATUSES);
export const serviceStatusEnum = pgEnum("service_status", SERVICE_STATUSES);
export const complexityLevelEnum = pgEnum(
  "complexity_level",
  COMPLEXITY_LEVELS,
);
export const priceTypeEnum = pgEnum("price_type", PRICE_TYPES);
export const slaStatusEnum = pgEnum("sla_status", SLA_STATUSES);
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
export const announcementCategoryEnum = pgEnum(
  "announcement_category",
  ANNOUNCEMENT_CATEGORIES,
);
export const surveyTypeEnum = pgEnum("survey_type", SURVEY_TYPES);
export const surveyStatusEnum = pgEnum("survey_status", SURVEY_STATUSES);
export const surveyQuestionTypeEnum = pgEnum(
  "survey_question_type",
  SURVEY_QUESTION_TYPES,
);
export const surveyAssignmentStatusEnum = pgEnum(
  "survey_assignment_status",
  SURVEY_ASSIGNMENT_STATUSES,
);

// ── Enums del módulo CFO / Finanzas ──────────────────────────
export const contactTypeEnum = pgEnum("contact_type", CONTACT_TYPES);
export const documentDirectionEnum = pgEnum(
  "document_direction",
  DOCUMENT_DIRECTIONS,
);
export const finDocumentTypeEnum = pgEnum(
  "fin_document_type",
  FIN_DOCUMENT_TYPES,
);
export const finDocumentStatusEnum = pgEnum(
  "fin_document_status",
  FIN_DOCUMENT_STATUSES,
);
export const recordStatusEnum = pgEnum("record_status", RECORD_STATUSES);
export const bankTxnTypeEnum = pgEnum("bank_txn_type", BANK_TXN_TYPES);
export const bankTxnStatusEnum = pgEnum("bank_txn_status", BANK_TXN_STATUSES);
export const ledgerAccountTypeEnum = pgEnum(
  "ledger_account_type",
  LEDGER_ACCOUNT_TYPES,
);
export const importTypeEnum = pgEnum("import_type", IMPORT_TYPES);
export const importStatusEnum = pgEnum("import_status", IMPORT_STATUSES);
export const reconciliationStatusEnum = pgEnum(
  "reconciliation_status",
  RECONCILIATION_STATUSES,
);
export const ruleMatchFieldEnum = pgEnum("rule_match_field", RULE_MATCH_FIELDS);
export const cobranzaMomentEnum = pgEnum("cobranza_moment", COBRANZA_MOMENTS);
export const cobranzaStatusEnum = pgEnum("cobranza_status", COBRANZA_STATUSES);

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
  // Ubicación. `region` es text (no enum) — ver CHILE_REGIONS en types/enums.
  comuna: text("comuna"),
  region: text("region"),
  billingEmail: text("billing_email"),
  billingNotes: text("billing_notes"),
  financialStatus:
    financialStatusEnum("financial_status").default("Sin información"),
  chipaxId: text("chipax_id"), // ID externo en Chipax
  // ── Portal del cliente ──
  // El token ES la credencial: el cliente no tiene cuenta, así que quien tenga
  // el enlace entra. Por eso se genera con randomBytes (nunca secuencial ni
  // derivado del id), es único y se puede revocar poniéndolo en null.
  portalToken: text("portal_token").unique(),
  portalTokenAt: timestamp("portal_token_at", { withTimezone: true }),
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
  phone: text("phone"), // para la firma de correo
  birthDate: date("birth_date"),
  // Firma de correo (HTML generado por el constructor de perfil).
  emailSignature: text("email_signature"),
  ...timestamps,
});

// ── comunicación interna ────────────────────────────────────
export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => teamMembers.id, { onDelete: "restrict" }),
    category: announcementCategoryEnum("category").default("novedad").notNull(),
    pinned: boolean("pinned").default(false).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    attachments: jsonb("attachments")
      .$type<{ label: string; url: string }[]>()
      .default([])
      .notNull(),
    ...timestamps,
  },
  (table) => [
    index("announcements_published_idx").on(table.publishedAt),
    index("announcements_author_idx").on(table.authorId),
  ],
);

export const announcementReads = pgTable(
  "announcement_reads",
  {
    announcementId: uuid("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    teamMemberId: uuid("team_member_id")
      .notNull()
      .references(() => teamMembers.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.announcementId, table.teamMemberId] }),
    index("announcement_reads_member_idx").on(table.teamMemberId),
  ],
);

// ── encuestas RRHH ──────────────────────────────────────────
export const surveys = pgTable(
  "surveys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    type: surveyTypeEnum("type").notNull(),
    isAnonymous: boolean("is_anonymous").notNull(),
    status: surveyStatusEnum("status").default("borrador").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdBy: uuid("created_by"),
    minResponsesToReveal: integer("min_responses_to_reveal")
      .default(3)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("surveys_status_idx").on(table.status)],
);

export const surveyQuestions = pgTable(
  "survey_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    surveyId: uuid("survey_id")
      .notNull()
      .references(() => surveys.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    type: surveyQuestionTypeEnum("type").notNull(),
    label: text("label").notNull(),
    options: jsonb("options").$type<string[]>().default([]).notNull(),
    required: boolean("required").default(true).notNull(),
  },
  (table) => [index("survey_questions_survey_idx").on(table.surveyId)],
);

export const surveyAssignments = pgTable(
  "survey_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    surveyId: uuid("survey_id")
      .notNull()
      .references(() => surveys.id, { onDelete: "cascade" }),
    teamMemberId: uuid("team_member_id")
      .notNull()
      .references(() => teamMembers.id, { onDelete: "cascade" }),
    status: surveyAssignmentStatusEnum("status").default("pendiente").notNull(),
    invitedAt: timestamp("invited_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("survey_assignments_survey_member_unique").on(
      table.surveyId,
      table.teamMemberId,
    ),
  ],
);

export const surveyResponses = pgTable(
  "survey_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    surveyId: uuid("survey_id")
      .notNull()
      .references(() => surveys.id, { onDelete: "cascade" }),
    respondentId: uuid("respondent_id").references(() => teamMembers.id, {
      onDelete: "set null",
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("survey_responses_survey_idx").on(table.surveyId)],
);

export const surveyAnswers = pgTable(
  "survey_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    responseId: uuid("response_id")
      .notNull()
      .references(() => surveyResponses.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => surveyQuestions.id, { onDelete: "cascade" }),
    valueNumber: numeric("value_number", { precision: 8, scale: 2 }),
    valueText: text("value_text"),
    valueOption: text("value_option"),
  },
  (table) => [index("survey_answers_response_idx").on(table.responseId)],
);

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
    // ── Brief inteligente (Inc. B) ──
    // Bloque general ampliado
    contextGeneral: text("context_general"),
    budgetMentioned: text("budget_mentioned"),
    decisionMakers: text("decision_makers"),
    urgency: text("urgency"),
    restrictions: text("restrictions"),
    pendingInfo: text("pending_info"),
    recommendedNextAction: text("recommended_next_action"),
    // Bloques del brief sugerido
    commercialRecs: text("commercial_recs"),
    risks: text("risks"),
    nextSteps: text("next_steps"),
    // Respuestas por área: { [area]: { [questionKey]: string } }
    areaBlocks: jsonb("area_blocks")
      .$type<Record<string, Record<string, string>>>()
      .default({}),
    // Áreas involucradas del brief (la principal es `area`)
    involvedAreas: areaEnum("involved_areas").array().default([]).notNull(),
    // Extracción estructurada de la IA (contrato en features/ai/brief-processor)
    aiExtraction: jsonb("ai_extraction").$type<Record<string, unknown>>(),
    // Aprobación / versionado
    approvedVersionId: uuid("approved_version_id"),
    approvedBy: uuid("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    status: briefStatusEnum("status").default("Sin reunión agendada").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("briefs_project_id_unique").on(t.projectId)],
);

// ── brief_notes (notas de reunión importadas) ────────────────
export const briefNotes = pgTable(
  "brief_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    meetingId: uuid("meeting_id").references(() => briefMeetings.id, {
      onDelete: "set null",
    }),
    source: noteSourceEnum("source").notNull(),
    // Origen (Drive) — se completa en Inc. D
    driveFileId: text("drive_file_id"),
    driveUrl: text("drive_url"),
    fileName: text("file_name"),
    rawText: text("raw_text"),
    // Matching sugerido (Inc. D)
    matchStatus: text("match_status"),
    matchCandidates: jsonb("match_candidates")
      .$type<Record<string, unknown>[]>()
      .default([]),
    importedBy: uuid("imported_by"),
    importedByEmail: text("imported_by_email"),
    ...timestamps,
  },
  (t) => [index("brief_notes_project_idx").on(t.projectId)],
);

// ── brief_versions (historial/aprobaciones del brief) ────────
export const briefVersions = pgTable(
  "brief_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    briefId: uuid("brief_id")
      .notNull()
      .references(() => briefs.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    version: integer("version").default(1).notNull(),
    // Snapshot completo del brief al momento de generar/aprobar.
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().default({}),
    aiExtraction: jsonb("ai_extraction").$type<Record<string, unknown>>(),
    isApproved: boolean("is_approved").default(false).notNull(),
    approvedBy: uuid("approved_by"),
    approvedByEmail: text("approved_by_email"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("brief_versions_brief_idx").on(t.briefId)],
);

// ── brief_meetings (reuniones de brief; Calendar/Meet en Inc. C) ──
export const briefMeetings = pgTable(
  "brief_meetings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    objective: text("objective"),
    agenda: text("agenda"),
    // área principal + áreas involucradas de la reunión
    area: areaEnum("area"),
    areas: areaEnum("areas").array().default([]).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    durationMin: integer("duration_min").default(45).notNull(),
    // responsable comercial (team_member) + organizador (usuario que agenda)
    responsibleId: uuid("responsible_id").references(() => teamMembers.id, {
      onDelete: "set null",
    }),
    organizerId: uuid("organizer_id"), // auth.users.id
    organizerEmail: text("organizer_email"),
    // participantes internos (equipo) y externos (contactos del cliente)
    internalParticipants: jsonb("internal_participants")
      .$type<{ id?: string; name?: string; email?: string }[]>()
      .default([]),
    externalParticipants: jsonb("external_participants")
      .$type<{ name?: string; email: string }[]>()
      .default([]),
    // metadata de Google (se completa al integrar Calendar/Meet — Inc. C)
    calendarEventId: text("calendar_event_id"),
    calendarLink: text("calendar_link"),
    meetLink: text("meet_link"),
    status: meetingStatusEnum("status").default("Agendada").notNull(),
    ...timestamps,
  },
  (t) => [index("brief_meetings_project_idx").on(t.projectId)],
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
    .$type<
      (
        | {
            kind?: "stage";
            name: string;
            start: string;
            end: string;
          }
        | {
            kind: "milestone";
            date: string;
            title?: string;
            description: string;
          }
      )[]
    >()
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
    role: text("role"), // cargo
    isPrimary: boolean("is_primary").default(false).notNull(),
    // Perfiles complementarios: un contacto puede ser varios a la vez
    // (administrativo / comercial / facturacion). Definen qué se le envía.
    profiles: contactProfileEnum("profiles").array().default([]).notNull(),
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

// ── slas (Acuerdo de Nivel de Servicio, generado desde la propuesta) ──
export const slas = pgTable("slas", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id")
    .notNull()
    .references(() => proposals.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  clientId: uuid("client_id").references(() => clients.id, {
    onDelete: "set null",
  }),
  status: slaStatusEnum("status").default("Borrador").notNull(),
  // parámetros que ayudan a redactar el documento
  params: jsonb("params")
    .$type<{
      lugar?: string;
      rondasCambios?: number;
      plazoAprobacionDias?: number;
      vigenciaMeses?: number;
      condicionesPago?: string;
    }>()
    .default({}),
  // secciones redactadas (generadas + editadas)
  sections: jsonb("sections")
    .$type<{ label: string; body: string }[]>()
    .default([]),
  // firma electrónica (representante legal)
  signedByName: text("signed_by_name"),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  ...timestamps,
});

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
    // archivos de la factura (Nubox) — link a PDF/XML
    pdfUrl: text("pdf_url"),
    xmlUrl: text("xml_url"),
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

// ── cfo_requests (solicitud a finanzas al traspasar a operación) ──
export const cfoRequests = pgTable(
  "cfo_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    proposalId: uuid("proposal_id").references(() => proposals.id, {
      onDelete: "set null",
    }),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    status: cfoRequestStatusEnum("status").default("Pendiente").notNull(),
    notes: text("notes"),
    requestedBy: uuid("requested_by"),
    requestedByEmail: text("requested_by_email"),
    resolvedBy: uuid("resolved_by"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("cfo_requests_project_idx").on(t.projectId)],
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

// ═════════════════════════════════════════════════════════════
// Módulo CFO / Finanzas — capa contable (portada del MVP)
// Montos en numeric(16,2): CLP puede acumular agregados grandes; se usa
// mayor precisión que el 14,2 del resto de Noma (que trabaja en UF).
// Eliminación lógica vía `record_status` (nunca borrado físico).
// ═════════════════════════════════════════════════════════════

// ── import_batches (auditoría de cada carga) ─────────────────
export const importBatches = pgTable(
  "import_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: importTypeEnum("type").notNull(),
    status: importStatusEnum("status").default("BORRADOR").notNull(),
    fileName: text("file_name").notNull(),
    storagePath: text("storage_path"),
    rowsDetected: integer("rows_detected").default(0).notNull(),
    rowsValid: integer("rows_valid").default(0).notNull(),
    rowsRejected: integer("rows_rejected").default(0).notNull(),
    rowsInserted: integer("rows_inserted").default(0).notNull(),
    totalNeto: numeric("total_neto", { precision: 16, scale: 2 })
      .default("0")
      .notNull(),
    totalIva: numeric("total_iva", { precision: 16, scale: 2 })
      .default("0")
      .notNull(),
    totalBruto: numeric("total_bruto", { precision: 16, scale: 2 })
      .default("0")
      .notNull(),
    summary: jsonb("summary").$type<Record<string, unknown>>(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("import_batches_type_status_idx").on(t.type, t.status)],
);

// ── import_templates (mapeo de columnas reutilizable) ────────
export const importTemplates = pgTable("import_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: importTypeEnum("type").notNull(),
  columnMapping: jsonb("column_mapping")
    .$type<Record<string, string>>()
    .default({})
    .notNull(),
  ...timestamps,
});

// ── fin_contacts (clientes/proveedores contables) ───────────
// Noma `clients` no modela proveedores; esta tabla los cubre y enlaza
// (opcionalmente) con el cliente comercial vía client_id.
export const finContacts = pgTable(
  "fin_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rut: text("rut").notNull(),
    name: text("name").notNull(),
    type: contactTypeEnum("type").default("AMBOS").notNull(),
    email: text("email"),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    status: recordStatusEnum("status").default("ACTIVO").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("fin_contacts_rut_type_unique").on(t.rut, t.type),
    index("fin_contacts_name_idx").on(t.name),
  ],
);

// ── ledger_accounts (plan de cuentas, árbol) ─────────────────
export const ledgerAccounts = pgTable("ledger_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  type: ledgerAccountTypeEnum("type").notNull(),
  parentId: uuid("parent_id").references((): AnyPgColumn => ledgerAccounts.id, {
    onDelete: "set null",
  }),
  // Cruce opcional con las áreas del estudio (servicios ↔ plan de cuentas).
  area: areaEnum("area"),
  status: recordStatusEnum("status").default("ACTIVO").notNull(),
  ...timestamps,
});

// ── cost_centers ─────────────────────────────────────────────
export const costCenters = pgTable("cost_centers", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  status: recordStatusEnum("status").default("ACTIVO").notNull(),
  ...timestamps,
});

// ── business_lines ───────────────────────────────────────────
export const businessLines = pgTable("business_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  status: recordStatusEnum("status").default("ACTIVO").notNull(),
  ...timestamps,
});

// ── classification_rules (clasificación automática de docs) ──
export const classificationRules = pgTable(
  "classification_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    matchField: ruleMatchFieldEnum("match_field").notNull(),
    matchOperator: text("match_operator").default("equals").notNull(), // equals|contains|gte|lte
    matchValue: text("match_value").notNull(),
    ledgerAccountId: uuid("ledger_account_id").references(
      () => ledgerAccounts.id,
      { onDelete: "set null" },
    ),
    costCenterId: uuid("cost_center_id").references(() => costCenters.id, {
      onDelete: "set null",
    }),
    businessLineId: uuid("business_line_id").references(
      () => businessLines.id,
      {
        onDelete: "set null",
      },
    ),
    priority: integer("priority").default(100).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (t) => [index("classification_rules_active_idx").on(t.isActive, t.priority)],
);

// ── bank_accounts ────────────────────────────────────────────
export const bankAccounts = pgTable("bank_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  bank: text("bank").notNull(),
  name: text("name").notNull(),
  number: text("number"),
  currency: currencyEnum("currency").default("CLP").notNull(),
  saldo: numeric("saldo", { precision: 16, scale: 2 }).default("0").notNull(),
  ...timestamps,
});

// ── fin_documents (ventas + compras, vista contable) ─────────
export const finDocuments = pgTable(
  "fin_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    direction: documentDirectionEnum("direction").notNull(),
    type: finDocumentTypeEnum("type").notNull(),
    folio: text("folio").notNull(),
    contactId: uuid("contact_id").references(() => finContacts.id, {
      onDelete: "set null",
    }),
    // Enlace opcional a la factura comercial del proyecto (Noma `invoices`).
    invoiceId: uuid("invoice_id").references(() => invoices.id, {
      onDelete: "set null",
    }),
    fechaEmision: date("fecha_emision").notNull(),
    fechaVencimiento: date("fecha_vencimiento"),
    neto: numeric("neto", { precision: 16, scale: 2 }).default("0").notNull(),
    iva: numeric("iva", { precision: 16, scale: 2 }).default("0").notNull(),
    exento: numeric("exento", { precision: 16, scale: 2 })
      .default("0")
      .notNull(),
    total: numeric("total", { precision: 16, scale: 2 }).default("0").notNull(),
    montoConciliado: numeric("monto_conciliado", { precision: 16, scale: 2 })
      .default("0")
      .notNull(),
    status: finDocumentStatusEnum("status").default("EMITIDA").notNull(),
    recordStatus: recordStatusEnum("record_status").default("ACTIVO").notNull(),
    periodoSii: text("periodo_sii"), // YYYY-MM
    ledgerAccountId: uuid("ledger_account_id").references(
      () => ledgerAccounts.id,
      { onDelete: "set null" },
    ),
    costCenterId: uuid("cost_center_id").references(() => costCenters.id, {
      onDelete: "set null",
    }),
    businessLineId: uuid("business_line_id").references(
      () => businessLines.id,
      {
        onDelete: "set null",
      },
    ),
    // Vínculo opcional con el catálogo comercial (cruza finanzas ↔ servicios).
    // Se sugiere al extraer el detalle del XML; editable a mano.
    serviceId: uuid("service_id").references(() => services.id, {
      onDelete: "set null",
    }),
    importBatchId: uuid("import_batch_id").references(() => importBatches.id, {
      onDelete: "set null",
    }),
    sourceFile: text("source_file"),
    observacion: text("observacion"),
    // Archivos originales del SII (PDF/XML) en el bucket privado `invoices`.
    // Se guarda el PATH dentro del bucket (no la URL): la descarga usa un enlace
    // firmado de corta duración generado al momento.
    pdfPath: text("pdf_path"),
    xmlPath: text("xml_path"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("fin_documents_natural_unique").on(
      t.direction,
      t.type,
      t.folio,
      t.contactId,
    ),
    index("fin_documents_direction_fecha_idx").on(t.direction, t.fechaEmision),
    index("fin_documents_status_idx").on(t.status),
    index("fin_documents_periodo_idx").on(t.periodoSii),
  ],
);

// ── fin_document_lines (detalle de líneas) ───────────────────
export const finDocumentLines = pgTable(
  "fin_document_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => finDocuments.id, { onDelete: "cascade" }),
    descripcion: text("descripcion").notNull(),
    cantidad: numeric("cantidad", { precision: 16, scale: 2 })
      .default("1")
      .notNull(),
    precio: numeric("precio", { precision: 16, scale: 2 })
      .default("0")
      .notNull(),
    monto: numeric("monto", { precision: 16, scale: 2 }).default("0").notNull(),
  },
  (t) => [index("fin_document_lines_document_idx").on(t.documentId)],
);

// ── bank_transactions (movimientos de cartola) ───────────────
export const bankTransactions = pgTable(
  "bank_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bankAccountId: uuid("bank_account_id")
      .notNull()
      .references(() => bankAccounts.id, { onDelete: "cascade" }),
    fecha: date("fecha").notNull(),
    glosa: text("glosa").notNull(),
    monto: numeric("monto", { precision: 16, scale: 2 }).notNull(),
    tipo: bankTxnTypeEnum("tipo").notNull(),
    saldo: numeric("saldo", { precision: 16, scale: 2 }),
    status: bankTxnStatusEnum("status").default("PENDIENTE").notNull(),
    recordStatus: recordStatusEnum("record_status").default("ACTIVO").notNull(),
    montoConciliado: numeric("monto_conciliado", { precision: 16, scale: 2 })
      .default("0")
      .notNull(),
    importBatchId: uuid("import_batch_id").references(() => importBatches.id, {
      onDelete: "set null",
    }),
    sourceFile: text("source_file"),
    ...timestamps,
  },
  (t) => [
    index("bank_transactions_account_fecha_idx").on(t.bankAccountId, t.fecha),
    index("bank_transactions_status_idx").on(t.status),
  ],
);

// ── reconciliations (conciliación N-a-N, reversible) ─────────
export const reconciliations = pgTable(
  "reconciliations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: reconciliationStatusEnum("status").default("ACTIVA").notNull(),
    note: text("note"),
    difference: numeric("difference", { precision: 16, scale: 2 })
      .default("0")
      .notNull(),
    createdById: uuid("created_by_id"), // auth.users.id (sin FK)
    revertedById: uuid("reverted_by_id"),
    revertedAt: timestamp("reverted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("reconciliations_status_idx").on(t.status)],
);

export const reconciliationDocuments = pgTable(
  "reconciliation_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reconciliationId: uuid("reconciliation_id")
      .notNull()
      .references(() => reconciliations.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => finDocuments.id, { onDelete: "cascade" }),
    amountApplied: numeric("amount_applied", {
      precision: 16,
      scale: 2,
    }).notNull(),
  },
  (t) => [index("reconciliation_documents_doc_idx").on(t.documentId)],
);

export const reconciliationTransactions = pgTable(
  "reconciliation_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reconciliationId: uuid("reconciliation_id")
      .notNull()
      .references(() => reconciliations.id, { onDelete: "cascade" }),
    bankTransactionId: uuid("bank_transaction_id")
      .notNull()
      .references(() => bankTransactions.id, { onDelete: "cascade" }),
    amountApplied: numeric("amount_applied", {
      precision: 16,
      scale: 2,
    }).notNull(),
  },
  (t) => [index("reconciliation_transactions_txn_idx").on(t.bankTransactionId)],
);

// ── cobranza_templates (plantillas de correo de cobranza) ────
export const cobranzaTemplates = pgTable("cobranza_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  moment: cobranzaMomentEnum("moment").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  status: text("status").default("Activo").notNull(),
  ...timestamps,
});

// ── cobranza_messages (bitácora de correos enviados/en cola) ──
export const cobranzaMessages = pgTable(
  "cobranza_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, {
      onDelete: "set null",
    }),
    templateId: uuid("template_id").references(() => cobranzaTemplates.id, {
      onDelete: "set null",
    }),
    moment: cobranzaMomentEnum("moment").notNull(),
    fromEmail: text("from_email").notNull(),
    toEmail: text("to_email").notNull(),
    ccEmails: jsonb("cc_emails").$type<string[]>().default([]),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: cobranzaStatusEnum("status").default("PENDIENTE").notNull(),
    error: text("error"),
    sentById: uuid("sent_by_id"), // auth.users.id
    sentByEmail: text("sent_by_email"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("cobranza_messages_client_idx").on(t.clientId),
    index("cobranza_messages_created_idx").on(t.createdAt),
  ],
);

// ── Tipos inferidos ──────────────────────────────────────────
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Brief = typeof briefs.$inferSelect;
export type NewBrief = typeof briefs.$inferInsert;
export type BriefMeeting = typeof briefMeetings.$inferSelect;
export type NewBriefMeeting = typeof briefMeetings.$inferInsert;
export type BriefNote = typeof briefNotes.$inferSelect;
export type NewBriefNote = typeof briefNotes.$inferInsert;
export type BriefVersion = typeof briefVersions.$inferSelect;
export type NewBriefVersion = typeof briefVersions.$inferInsert;
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
export type Sla = typeof slas.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type CfoRequest = typeof cfoRequests.$inferSelect;
export type NewCfoRequest = typeof cfoRequests.$inferInsert;
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

// ── Módulo CFO / Finanzas ────────────────────────────────────
export type FinContact = typeof finContacts.$inferSelect;
export type NewFinContact = typeof finContacts.$inferInsert;
export type LedgerAccount = typeof ledgerAccounts.$inferSelect;
export type NewLedgerAccount = typeof ledgerAccounts.$inferInsert;
export type CostCenter = typeof costCenters.$inferSelect;
export type BusinessLine = typeof businessLines.$inferSelect;
export type ClassificationRule = typeof classificationRules.$inferSelect;
export type FinDocument = typeof finDocuments.$inferSelect;
export type NewFinDocument = typeof finDocuments.$inferInsert;
export type FinDocumentLine = typeof finDocumentLines.$inferSelect;
export type NewFinDocumentLine = typeof finDocumentLines.$inferInsert;
export type BankAccount = typeof bankAccounts.$inferSelect;
export type NewBankAccount = typeof bankAccounts.$inferInsert;
export type BankTransaction = typeof bankTransactions.$inferSelect;
export type NewBankTransaction = typeof bankTransactions.$inferInsert;
export type Reconciliation = typeof reconciliations.$inferSelect;
export type ReconciliationDocument =
  typeof reconciliationDocuments.$inferSelect;
export type ReconciliationTransaction =
  typeof reconciliationTransactions.$inferSelect;
export type ImportBatch = typeof importBatches.$inferSelect;
export type NewImportBatch = typeof importBatches.$inferInsert;
export type ImportTemplate = typeof importTemplates.$inferSelect;
export type NewImportTemplate = typeof importTemplates.$inferInsert;
export type CobranzaTemplate = typeof cobranzaTemplates.$inferSelect;
export type NewCobranzaTemplate = typeof cobranzaTemplates.$inferInsert;
export type CobranzaMessage = typeof cobranzaMessages.$inferSelect;
export type NewCobranzaMessage = typeof cobranzaMessages.$inferInsert;
