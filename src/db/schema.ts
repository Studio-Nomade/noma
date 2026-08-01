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
  check,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
  SERVICE_PRIORITIES,
  DISCOUNT_KINDS,
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
  LEDGER_ACCOUNT_KINDS,
  SALES_ORDER_STATUSES,
  BILLING_ITEM_TYPES,
  BILLING_ITEM_STATUSES,
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
  COURSE_PROVIDERS,
  COURSE_LEVELS,
  COURSE_ENROLLMENT_STATUSES,
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
export const servicePriorityEnum = pgEnum(
  "service_priority",
  SERVICE_PRIORITIES,
);
export const discountKindEnum = pgEnum("discount_kind", DISCOUNT_KINDS);
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
export const courseProviderEnum = pgEnum("course_provider", COURSE_PROVIDERS);
export const courseLevelEnum = pgEnum("course_level", COURSE_LEVELS);
export const courseEnrollmentStatusEnum = pgEnum(
  "course_enrollment_status",
  COURSE_ENROLLMENT_STATUSES,
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
export const ledgerAccountKindEnum = pgEnum(
  "ledger_account_kind",
  LEDGER_ACCOUNT_KINDS,
);
export const salesOrderStatusEnum = pgEnum(
  "sales_order_status",
  SALES_ORDER_STATUSES,
);
export const billingItemTypeEnum = pgEnum(
  "billing_item_type",
  BILLING_ITEM_TYPES,
);
export const billingItemStatusEnum = pgEnum(
  "billing_item_status",
  BILLING_ITEM_STATUSES,
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
  paymentTermDays: integer("payment_term_days").default(30).notNull(),
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

// ── employees (maestro laboral; no reemplaza una nómina) ─────
export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamMemberId: uuid("team_member_id")
      .unique()
      .references(() => teamMembers.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    rut: text("rut").notNull().unique(),
    roleTitle: text("role_title").notNull(),
    area: areaEnum("area"),
    status: text("status").default("ACTIVO").notNull(),
    baseSalaryAmount: numeric("base_salary_amount", {
      precision: 16,
      scale: 2,
    }).notNull(),
    baseSalaryCurrency: currencyEnum("base_salary_currency")
      .default("CLP")
      .notNull(),
    startDate: date("start_date"),
    ...timestamps,
  },
  (t) => [index("employees_status_idx").on(t.status, t.name)],
);

export const employeeDocuments = pgTable(
  "employee_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    title: text("title").notNull(),
    period: date("period"),
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull(),
    visibility: text("visibility").default("employee").notNull(),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    index("employee_documents_employee_idx").on(
      t.employeeId,
      t.category,
      t.period,
    ),
  ],
);

export const employeeTimeOff = pgTable(
  "employee_time_off",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    type: text("type").default("vacation").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    days: numeric("days", { precision: 6, scale: 2 }).notNull(),
    status: text("status").default("pending").notNull(),
    reason: text("reason"),
    reviewedBy: uuid("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("employee_time_off_employee_idx").on(
      t.employeeId,
      t.status,
      t.startDate,
    ),
  ],
);

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

// ── capacitaciones RRHH ─────────────────────────────────────
export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    provider: courseProviderEnum("provider").default("domestika").notNull(),
    url: text("url").notNull(),
    area: areaEnum("area"),
    level: courseLevelEnum("level").default("inicial").notNull(),
    durationMin: integer("duration_min"),
    description: text("description"),
    thumbnailUrl: text("thumbnail_url"),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [index("courses_active_idx").on(table.active)],
);

export const courseEnrollments = pgTable(
  "course_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    teamMemberId: uuid("team_member_id")
      .notNull()
      .references(() => teamMembers.id, { onDelete: "cascade" }),
    status: courseEnrollmentStatusEnum("status").default("asignado").notNull(),
    assignedBy: uuid("assigned_by"),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    progressPct: integer("progress_pct").default(0).notNull(),
    certificateUrl: text("certificate_url"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("course_enrollments_course_member_unique").on(
      table.courseId,
      table.teamMemberId,
    ),
    index("course_enrollments_member_idx").on(table.teamMemberId),
  ],
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
  asanaProjectGid: text("asana_project_gid"),
  ...timestamps,
});

// ── Email Studio (proyectos de desarrollo de correo) ────────
export const emailStudioProjects = pgTable(
  "email_studio_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    nomaProjectId: uuid("noma_project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    description: text("description"),
    status: text("status").default("active").notNull(),
    subject: text("subject").default("Nuevo correo").notNull(),
    previewText: text("preview_text").default("").notNull(),
    emailWidth: integer("email_width").default(700).notNull(),
    canvasColor: text("canvas_color").default("#f4f4f1").notNull(),
    bodyColor: text("body_color").default("#ffffff").notNull(),
    textColor: text("text_color").default("#333333").notNull(),
    currentDocument: jsonb("current_document").$type<unknown>(),
    currentDocumentVersion: integer("current_document_version")
      .default(0)
      .notNull(),
    generationMode: text("generation_mode"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("email_studio_projects_client_idx").on(
      table.clientId,
      table.updatedAt,
    ),
    index("email_studio_projects_status_idx").on(table.status, table.updatedAt),
    check(
      "email_studio_projects_status_check",
      sql`${table.status} in ('active', 'archived')`,
    ),
    check(
      "email_studio_projects_document_version_check",
      sql`${table.currentDocumentVersion} >= 0`,
    ),
    check(
      "email_studio_projects_width_check",
      sql`${table.emailWidth} between 560 and 720`,
    ),
  ],
);

export const emailStudioAssets = pgTable(
  "email_studio_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => emailStudioProjects.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    status: text("status").default("active").notNull(),
    label: text("label").notNull(),
    originalName: text("original_name").notNull(),
    storagePath: text("storage_path").notNull(),
    publicUrl: text("public_url"),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    optimized: boolean("optimized").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    index("email_studio_assets_project_idx").on(
      table.projectId,
      table.createdAt,
    ),
    check(
      "email_studio_assets_role_check",
      sql`${table.role} in ('reference', 'asset')`,
    ),
    check(
      "email_studio_assets_status_check",
      sql`${table.status} in ('active', 'archived')`,
    ),
    check("email_studio_assets_size_check", sql`${table.sizeBytes} > 0`),
  ],
);

export const emailStudioTemplates = pgTable(
  "email_studio_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    sourceProjectId: uuid("source_project_id").references(
      () => emailStudioProjects.id,
      { onDelete: "set null" },
    ),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => emailStudioAssets.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    alt: text("alt").default("").notNull(),
    href: text("href"),
    status: text("status").default("active").notNull(),
    ...timestamps,
  },
  (table) => [
    index("email_studio_templates_client_idx").on(
      table.clientId,
      table.status,
      table.updatedAt,
    ),
    check(
      "email_studio_templates_status_check",
      sql`${table.status} in ('active', 'archived')`,
    ),
  ],
);

export const emailStudioElements = pgTable(
  "email_studio_elements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => emailStudioProjects.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    position: integer("position").default(0).notNull(),
    assetId: uuid("asset_id").references(() => emailStudioAssets.id, {
      onDelete: "cascade",
    }),
    templateId: uuid("template_id").references(() => emailStudioTemplates.id, {
      onDelete: "set null",
    }),
    label: text("label").notNull(),
    content: text("content"),
    href: text("href"),
    alt: text("alt").default("").notNull(),
    align: text("align").default("center").notNull(),
    fontSize: integer("font_size").default(16).notNull(),
    color: text("color").default("#333333").notNull(),
    backgroundColor: text("background_color").default("#111111").notNull(),
    padding: text("padding").default("16px 32px").notNull(),
    ...timestamps,
  },
  (table) => [
    index("email_studio_elements_project_idx").on(
      table.projectId,
      table.position,
    ),
    check(
      "email_studio_elements_type_check",
      sql`${table.type} in ('image', 'text', 'button', 'spacer', 'template')`,
    ),
    check("email_studio_elements_position_check", sql`${table.position} >= 0`),
    check(
      "email_studio_elements_align_check",
      sql`${table.align} in ('left', 'center', 'right')`,
    ),
    check(
      "email_studio_elements_font_size_check",
      sql`${table.fontSize} between 1 and 72`,
    ),
  ],
);

export const emailStudioVariables = pgTable(
  "email_studio_variables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => emailStudioProjects.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    sample: text("sample").default("").notNull(),
    required: boolean("required").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("email_studio_variables_project_key_unique").on(
      table.projectId,
      table.key,
    ),
  ],
);

export const emailStudioRevisions = pgTable(
  "email_studio_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => emailStudioProjects.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    documentVersion: integer("document_version").notNull(),
    generationMode: text("generation_mode"),
    editorState: jsonb("editor_state").$type<unknown>().notNull(),
    document: jsonb("document").$type<unknown>(),
    ...timestamps,
  },
  (table) => [
    index("email_studio_revisions_project_idx").on(
      table.projectId,
      table.createdAt,
    ),
    check(
      "email_studio_revisions_kind_check",
      sql`${table.kind} in ('checkpoint', 'generated', 'restored')`,
    ),
  ],
);

export const emailStudioAiRuns = pgTable(
  "email_studio_ai_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => emailStudioProjects.id, { onDelete: "cascade" }),
    status: text("status").default("running").notNull(),
    model: text("model").notNull(),
    assetCount: integer("asset_count").default(0).notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    durationMs: integer("duration_ms"),
    responseId: text("response_id"),
    failureCode: text("failure_code"),
    ...timestamps,
  },
  (table) => [
    index("email_studio_ai_runs_project_idx").on(
      table.projectId,
      table.createdAt,
    ),
    index("email_studio_ai_runs_actor_idx").on(
      table.createdBy,
      table.createdAt,
    ),
    check(
      "email_studio_ai_runs_status_check",
      sql`${table.status} in ('running', 'completed', 'failed')`,
    ),
  ],
);

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
  // Texto enriquecido seguro (noma-rich:v1); acepta noma-list:v1 histórico.
  methodology: text("methodology"),
  deliverables: text("deliverables"),
  exclusions: text("exclusions"),
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
  ledgerAccountId: uuid("ledger_account_id")
    .unique()
    .references((): AnyPgColumn => ledgerAccounts.id, {
      onDelete: "set null",
    }),
  ...timestamps,
});

// ── service_subareas (taxonomía administrable por área) ──────
export const serviceSubareas = pgTable(
  "service_subareas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    area: areaEnum("area").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("service_subareas_area_name_unique").on(t.area, t.name),
    index("service_subareas_area_idx").on(t.area, t.name),
    check("service_subareas_name_not_blank", sql`btrim(${t.name}) <> ''`),
  ],
);

// ── service_variants (Start → Enterprise) ───────────────────
export const serviceVariants = pgTable(
  "service_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    tier: text("tier").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    audience: text("audience"),
    focus: text("focus"),
    description: text("description"),
    methodology: text("methodology"),
    deliverables: text("deliverables"),
    exclusions: text("exclusions"),
    estimatedTime: text("estimated_time"),
    priceMinAmount: numeric("price_min_amount", { precision: 14, scale: 2 }),
    priceMaxAmount: numeric("price_max_amount", { precision: 14, scale: 2 }),
    priceCurrency: currencyEnum("price_currency").default("UF").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("service_variants_service_tier_unique").on(t.serviceId, t.tier),
    index("service_variants_service_idx").on(t.serviceId),
    check(
      "service_variants_tier_check",
      sql`${t.tier} in ('START', 'GROWTH', 'PERFORMANCE', 'ENTERPRISE')`,
    ),
    check(
      "service_variants_price_min_nonnegative",
      sql`${t.priceMinAmount} is null or ${t.priceMinAmount} >= 0`,
    ),
    check(
      "service_variants_price_max_nonnegative",
      sql`${t.priceMaxAmount} is null or ${t.priceMaxAmount} >= 0`,
    ),
    check(
      "service_variants_price_range_check",
      sql`${t.priceMinAmount} is null or ${t.priceMaxAmount} is null or ${t.priceMaxAmount} >= ${t.priceMinAmount}`,
    ),
  ],
);

// ── service_packages (combinaciones reutilizables) ──────────
export const servicePackages = pgTable("service_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  objective: text("objective"),
  niche: text("niche"),
  description: text("description"),
  status: serviceStatusEnum("status").default("Activo").notNull(),
  suggestedByAi: boolean("suggested_by_ai").default(false).notNull(),
  ...timestamps,
});

export const servicePackageItems = pgTable(
  "service_package_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => servicePackages.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    variantTier: text("variant_tier").default("START").notNull(),
    quantity: integer("quantity").default(1).notNull(),
    position: integer("position").default(0).notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("service_package_items_unique").on(t.packageId, t.serviceId),
    index("service_package_items_package_idx").on(t.packageId, t.position),
    check(
      "service_package_items_tier_check",
      sql`${t.variantTier} in ('START', 'GROWTH', 'PERFORMANCE', 'ENTERPRISE')`,
    ),
    check(
      "service_package_items_quantity_check",
      sql`${t.quantity} between 1 and 99`,
    ),
    check("service_package_items_position_check", sql`${t.position} >= 0`),
  ],
);

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
  // Agrega una lámina específica para clientes con fee mensual.
  includeMonthlyFeeCondition: boolean("include_monthly_fee_condition")
    .default(false)
    .notNull(),
  estimatedValueAmount: numeric("estimated_value_amount", {
    precision: 14,
    scale: 2,
  }),
  estimatedValueCurrency: currencyEnum("estimated_value_currency").default(
    "UF",
  ),
  status: proposalStatusEnum("status").default("Borrador").notNull(),
  nextAction: text("next_action"),
  // Descuento comercial editable (se muestra en el PDF tras la sumatoria).
  // Se aplica sobre el neto, antes de IVA (convención SII).
  discountLabel: text("discount_label"),
  discountKind: discountKindEnum("discount_kind"),
  discountValue: numeric("discount_value", { precision: 14, scale: 2 }),
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
    variantTier: text("variant_tier").default("START").notNull(),
    position: integer("position").default(0).notNull(),
    // Cantidad (ej. 3 videos del mismo servicio) y prioridad (recargo).
    quantity: integer("quantity").default(1).notNull(),
    priority: servicePriorityEnum("priority").default("Normal").notNull(),
    customPriceAmount: numeric("custom_price_amount", {
      precision: 14,
      scale: 2,
    }),
    customPriceCurrency: currencyEnum("custom_price_currency"),
  },
  (t) => [
    uniqueIndex("proposal_services_unique").on(t.proposalId, t.serviceId),
    check(
      "proposal_services_variant_tier_check",
      sql`${t.variantTier} in ('START', 'GROWTH', 'PERFORMANCE', 'ENTERPRISE')`,
    ),
    check(
      "proposal_services_quantity_check",
      sql`${t.quantity} between 1 and 999`,
    ),
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
    phone: text("phone"),
    role: text("role"), // cargo
    isPrimary: boolean("is_primary").default(false).notNull(),
    // Perfiles complementarios: un contacto puede ser varios a la vez
    // (administrativo / comercial / facturacion). Definen qué se le envía.
    profiles: contactProfileEnum("profiles").array().default([]).notNull(),
    ...timestamps,
  },
  (t) => [index("client_contacts_client_idx").on(t.clientId)],
);

// ── Agente de WhatsApp por proyecto ─────────────────────────
export const botChannels = pgTable(
  "bot_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    asanaProjectGid: text("asana_project_gid"),
    status: text("status").default("active").notNull(),
    contextPack: jsonb("context_pack").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("bot_channels_project_unique").on(t.projectId),
    index("bot_channels_client_idx").on(t.clientId),
    index("bot_channels_status_idx").on(t.status),
  ],
);

export const botAuthorizedSenders = pgTable(
  "bot_authorized_senders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    botChannelId: uuid("bot_channel_id")
      .notNull()
      .references(() => botChannels.id, { onDelete: "cascade" }),
    clientContactId: uuid("client_contact_id").references(
      () => clientContacts.id,
      { onDelete: "set null" },
    ),
    displayName: text("display_name").notNull(),
    phone: text("phone").notNull(),
    profile: text("profile").notNull(),
    status: text("status").default("active").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("bot_authorized_senders_active_phone_unique")
      .on(t.phone)
      .where(sql`${t.status} = 'active'`),
    index("bot_authorized_senders_channel_idx").on(t.botChannelId),
    index("bot_authorized_senders_contact_idx").on(t.clientContactId),
  ],
);

export const retainers = pgTable(
  "retainers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    unit: text("unit").notNull(),
    quotaPerPeriod: numeric("quota_per_period", {
      precision: 12,
      scale: 2,
    }).notNull(),
    periodType: text("period_type").default("monthly").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    status: text("status").default("active").notNull(),
    rolloverPolicy: text("rollover_policy").default("none").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("retainers_active_project_unique")
      .on(t.projectId)
      .where(sql`${t.status} = 'active'`),
    index("retainers_client_status_idx").on(t.clientId, t.status),
  ],
);

export const retainerPeriods = pgTable(
  "retainer_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    retainerId: uuid("retainer_id")
      .notNull()
      .references(() => retainers.id, { onDelete: "cascade" }),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    quota: numeric("quota", { precision: 12, scale: 2 }).notNull(),
    consumed: numeric("consumed", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    remaining: numeric("remaining", { precision: 12, scale: 2 }).notNull(),
    status: text("status").default("open").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("retainer_periods_retainer_start_unique").on(
      t.retainerId,
      t.periodStart,
    ),
    index("retainer_periods_status_idx").on(t.status, t.periodEnd),
  ],
);

export const clientRequests = pgTable(
  "client_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    botChannelId: uuid("bot_channel_id").references(() => botChannels.id, {
      onDelete: "set null",
    }),
    senderId: uuid("sender_id").references(() => botAuthorizedSenders.id, {
      onDelete: "set null",
    }),
    retainerPeriodId: uuid("retainer_period_id").references(
      () => retainerPeriods.id,
      { onDelete: "set null" },
    ),
    estimatedUnits: numeric("estimated_units", { precision: 12, scale: 2 }),
    retainerConsumedAt: timestamp("retainer_consumed_at", {
      withTimezone: true,
    }),
    // Referencia lógica (sin FK por el orden de declaración de tablas) a la
    // conversación exacta que originó la solicitud.
    conversationId: uuid("conversation_id"),
    sourceMessageId: text("source_message_id"),
    idempotencyKey: text("idempotency_key"),
    channel: text("channel").default("whatsapp").notNull(),
    rawText: text("raw_text").notNull(),
    normalizedSummary: text("normalized_summary"),
    scopeClass: text("scope_class").default("unknown").notNull(),
    predictedScopeClass: text("predicted_scope_class"),
    scopeReason: text("scope_reason"),
    scopeCorrectedAt: timestamp("scope_corrected_at", { withTimezone: true }),
    asanaTaskGid: text("asana_task_gid"),
    asanaUrl: text("asana_url"),
    asanaAttemptedAt: timestamp("asana_attempted_at", { withTimezone: true }),
    status: text("status").default("captured").notNull(),
    createdVia: text("created_via").default("bot").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("client_requests_source_message_unique")
      .on(t.sourceMessageId)
      .where(sql`${t.sourceMessageId} is not null`),
    uniqueIndex("client_requests_idempotency_unique")
      .on(t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
    index("client_requests_client_created_idx").on(t.clientId, t.createdAt),
    index("client_requests_analytics_idx").on(
      t.clientId,
      t.createdAt,
      t.scopeClass,
      t.status,
    ),
    index("client_requests_project_created_idx").on(t.projectId, t.createdAt),
    index("client_requests_conversation_idx").on(t.conversationId),
    index("client_requests_retainer_period_idx").on(t.retainerPeriodId),
    index("client_requests_status_idx").on(t.status),
  ],
);

export const botConversations = pgTable(
  "bot_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    botChannelId: uuid("bot_channel_id")
      .notNull()
      .references(() => botChannels.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").references(() => botAuthorizedSenders.id, {
      onDelete: "set null",
    }),
    phone: text("phone").notNull(),
    status: text("status").default("open").notNull(),
    lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("bot_conversations_channel_idx").on(t.botChannelId),
    index("bot_conversations_phone_status_idx").on(t.phone, t.status),
    uniqueIndex("bot_conversations_open_channel_phone_unique")
      .on(t.botChannelId, t.phone)
      .where(sql`${t.status} = 'open'`),
  ],
);

export const botMessages = pgTable(
  "bot_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => botConversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    waMessageId: text("wa_message_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("bot_messages_conversation_created_idx").on(
      t.conversationId,
      t.createdAt,
    ),
    uniqueIndex("bot_messages_wa_message_unique")
      .on(t.waMessageId)
      .where(sql`${t.waMessageId} is not null`),
  ],
);

export const whatsappInboundEvents = pgTable(
  "whatsapp_inbound_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    waMessageId: text("wa_message_id").notNull().unique(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    error: text("error"),
    ...timestamps,
  },
  (t) => [
    index("whatsapp_inbound_events_status_idx").on(t.status, t.createdAt),
  ],
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

export const emailSignatures = pgTable("email_signatures", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  area: areaEnum("area"),
  role: text("role").notNull(),
  senderName: text("sender_name").notNull(),
  senderEmail: text("sender_email").notNull(),
  signatureHtml: text("signature_html").notNull(),
  signatureText: text("signature_text").notNull(),
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

// ── user_connections (OAuth per-user; tokens siempre cifrados) ──
// Google conserva su flujo histórico en user_integrations. Esta tabla normaliza
// las conexiones personales nuevas (Asana, Slack y futuros proveedores).
export const userConnections = pgTable(
  "user_connections",
  {
    userId: uuid("user_id").notNull(), // auth.users.id
    provider: text("provider").notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    externalAccountId: text("external_account_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>().default({}).notNull(),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.provider] }),
    index("user_connections_user_idx").on(t.userId),
  ],
);

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

// ── sales_orders (nota de venta; congela la cotización aceptada) ──
export const salesOrders = pgTable(
  "sales_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    folio: text("folio").notNull().unique(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "restrict" }),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "restrict" })
      .unique(),
    status: salesOrderStatusEnum("status").default("BORRADOR").notNull(),
    emissionDate: date("emission_date").notNull(),
    dueDate: date("due_date"),
    subtotalAmount: numeric("subtotal_amount", {
      precision: 16,
      scale: 2,
    }).notNull(),
    ivaAmount: numeric("iva_amount", { precision: 16, scale: 2 }).notNull(),
    totalAmount: numeric("total_amount", { precision: 16, scale: 2 }).notNull(),
    currency: currencyEnum("currency").default("CLP").notNull(),
    notes: text("notes"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("sales_orders_client_idx").on(t.clientId),
    index("sales_orders_project_idx").on(t.projectId),
  ],
);

export const salesOrderLines = pgTable(
  "sales_order_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    salesOrderId: uuid("sales_order_id")
      .notNull()
      .references(() => salesOrders.id, { onDelete: "cascade" }),
    position: integer("position").default(0).notNull(),
    businessLine: areaEnum("business_line").notNull(),
    serviceId: uuid("service_id").references(() => services.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull(),
    quantity: integer("quantity").default(1).notNull(),
    priceAmount: numeric("price_amount", {
      precision: 16,
      scale: 2,
    }).notNull(),
    currency: currencyEnum("currency").default("UF").notNull(),
    discountAmount: numeric("discount_amount", {
      precision: 16,
      scale: 2,
    })
      .default("0")
      .notNull(),
    totalAmount: numeric("total_amount", {
      precision: 16,
      scale: 2,
    }).notNull(),
    ...timestamps,
  },
  (t) => [index("sales_order_lines_order_idx").on(t.salesOrderId)],
);

export const salesOrderBillingItems = pgTable(
  "sales_order_billing_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    salesOrderId: uuid("sales_order_id")
      .notNull()
      .references(() => salesOrders.id, { onDelete: "cascade" }),
    order: integer("order").default(0).notNull(),
    label: text("label").notNull(),
    type: billingItemTypeEnum("type").default("PORCENTAJE").notNull(),
    value: numeric("value", { precision: 16, scale: 2 }).notNull(),
    calculatedAmount: numeric("calculated_amount", {
      precision: 16,
      scale: 2,
    }).notNull(),
    tentativeDate: date("tentative_date"),
    deliverable: text("deliverable"),
    status: billingItemStatusEnum("status").default("PENDIENTE").notNull(),
    invoiceId: uuid("invoice_id").references((): AnyPgColumn => invoices.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    index("sales_order_billing_items_order_idx").on(t.salesOrderId),
    index("sales_order_billing_items_invoice_idx").on(t.invoiceId),
  ],
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
    salesOrderId: uuid("sales_order_id").references(() => salesOrders.id, {
      onDelete: "set null",
    }),
    billingItemId: uuid("billing_item_id")
      .unique()
      .references(() => salesOrderBillingItems.id, {
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
    estimatedPaymentDate: date("estimated_payment_date"),
    paidAt: date("paid_at"),
    ...timestamps,
  },
  (t) => [
    index("invoices_client_idx").on(t.clientId),
    index("invoices_project_idx").on(t.projectId),
    index("invoices_sales_order_idx").on(t.salesOrderId),
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
  kind: ledgerAccountKindEnum("kind").default("CUENTA").notNull(),
  description: text("description"),
  parentId: uuid("parent_id").references((): AnyPgColumn => ledgerAccounts.id, {
    onDelete: "set null",
  }),
  serviceId: uuid("service_id")
    .unique()
    .references(() => services.id, {
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
    executionCount: integer("execution_count").default(0).notNull(),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("classification_rules_active_idx").on(t.isActive, t.priority)],
);

// ── reconciliation_rules (automatizaciones de conciliación) ──
export const reconciliationRules = pgTable("reconciliation_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  matchType: text("match_type").notNull(), // RUT | MONTO | FOLIO | DESCRIPCION
  isActive: boolean("is_active").default(true).notNull(),
  executionCount: integer("execution_count").default(0).notNull(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  ...timestamps,
});

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

// ── payment_reports (cliente informa un pago desde su portal) ──
// Punto de extensión para una futura pasarela: hoy registra la declaración del
// cliente y la deja pendiente de validación por Finanzas.
export const paymentReports = pgTable(
  "payment_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => finDocuments.id, {
      onDelete: "set null",
    }),
    salesOrderId: uuid("sales_order_id").references(() => salesOrders.id, {
      onDelete: "set null",
    }),
    amount: numeric("amount", { precision: 16, scale: 2 }).notNull(),
    paidAt: date("paid_at").notNull(),
    reference: text("reference"),
    status: text("status").default("PENDIENTE").notNull(),
    ...timestamps,
  },
  (t) => [
    index("payment_reports_client_idx").on(t.clientId),
    index("payment_reports_status_idx").on(t.status, t.createdAt),
  ],
);

// ── Tipos inferidos ──────────────────────────────────────────
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type EmailStudioProject = typeof emailStudioProjects.$inferSelect;
export type NewEmailStudioProject = typeof emailStudioProjects.$inferInsert;
export type EmailStudioAsset = typeof emailStudioAssets.$inferSelect;
export type EmailStudioElement = typeof emailStudioElements.$inferSelect;
export type EmailStudioVariable = typeof emailStudioVariables.$inferSelect;
export type EmailStudioTemplate = typeof emailStudioTemplates.$inferSelect;
export type EmailStudioRevision = typeof emailStudioRevisions.$inferSelect;
export type EmailStudioAiRun = typeof emailStudioAiRuns.$inferSelect;
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
export type ServiceSubarea = typeof serviceSubareas.$inferSelect;
export type ServiceVariant = typeof serviceVariants.$inferSelect;
export type ServicePackage = typeof servicePackages.$inferSelect;
export type ServicePackageItem = typeof servicePackageItems.$inferSelect;
export type ServiceModule = typeof serviceModules.$inferSelect;
export type NewServiceModule = typeof serviceModules.$inferInsert;
export type ServiceModuleLink = typeof serviceModuleLinks.$inferSelect;
export type Proposal = typeof proposals.$inferSelect;
export type NewProposal = typeof proposals.$inferInsert;
export type ProposalService = typeof proposalServices.$inferSelect;
export type ProposalTeam = typeof proposalTeam.$inferSelect;
export type ProposalNote = typeof proposalNotes.$inferSelect;
export type ClientContact = typeof clientContacts.$inferSelect;
export type BotChannel = typeof botChannels.$inferSelect;
export type BotAuthorizedSender = typeof botAuthorizedSenders.$inferSelect;
export type Retainer = typeof retainers.$inferSelect;
export type RetainerPeriod = typeof retainerPeriods.$inferSelect;
export type ClientRequest = typeof clientRequests.$inferSelect;
export type BotConversation = typeof botConversations.$inferSelect;
export type BotMessage = typeof botMessages.$inferSelect;
export type WhatsappInboundEvent = typeof whatsappInboundEvents.$inferSelect;
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
