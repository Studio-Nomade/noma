import { z } from "zod";
import {
  AREAS,
  CURRENCIES,
  QUOTER_LEARNING_KINDS,
  QUOTER_LEARNING_SCOPES,
} from "@/types/enums";
import { SERVICE_TIERS } from "@/features/services/tiers";

/**
 * Contratos de salida del cotizador con IA. Se convierten a JSON Schema para
 * los JSON outputs de Claude: sin mínimos/máximos numéricos (se validan después
 * en `normalize.ts`), con `nullable` en vez de campos opcionales.
 */

// ── 1. Notas de reunión → brief ──────────────────────────────
export const briefAiSchema = z.object({
  executive_summary: z
    .string()
    .describe("Resumen ejecutivo de la reunión en 2–4 oraciones."),
  client_context: z
    .string()
    .describe("Qué hace el cliente, su negocio, mercado y momento actual."),
  explicit_need: z
    .string()
    .describe("Lo que el cliente pidió con sus palabras."),
  implicit_need: z
    .string()
    .describe("Lo que necesita aunque no lo dijo (lectura del estudio)."),
  core_problem: z.string().describe("El problema de negocio de fondo."),
  objectives: z.array(z.string()).describe("Objetivos concretos, máx. 5."),
  target_audience: z
    .string()
    .describe("Público objetivo, o '' si no se habló."),
  main_area: z.enum(AREAS).describe("Área principal del estudio."),
  involved_areas: z
    .array(z.enum(AREAS))
    .describe("Otras áreas involucradas (sin repetir la principal)."),
  requested_services: z
    .array(z.string())
    .describe("Servicios que el cliente pidió, en sus palabras."),
  suggested_service_ids: z
    .array(z.string())
    .describe(
      "ids de servicios del catálogo que corresponden a la necesidad (solo ids que aparecen en el catálogo).",
    ),
  answered: z
    .array(
      z.object({
        area: z.enum(AREAS),
        key: z.string().describe("Clave de la pregunta del brief del área."),
        answer: z.string(),
      }),
    )
    .describe("Preguntas del brief por área que las notas responden."),
  pending: z
    .array(
      z.object({
        area: z.enum(AREAS).nullable(),
        question: z.string(),
      }),
    )
    .describe(
      "Información que falta para cotizar bien, como pregunta concreta para el cliente.",
    ),
  deadlines: z.string().describe("Plazos o fechas mencionados, o ''."),
  budget: z.string().describe("Presupuesto mencionado (texto literal), o ''."),
  decision_makers: z.string().describe("Quién decide y quién aprueba, o ''."),
  risks: z.array(z.string()),
  next_steps: z.array(z.string()),
  commercial_recommendation: z
    .string()
    .describe(
      "Recomendación comercial para el estudio (cómo abordar la propuesta).",
    ),
  close_probability: z
    .number()
    .describe("Probabilidad de cierre 0–100 según señales de la reunión."),
  client_profile: z
    .object({
      industry: z.string().nullable(),
      website: z.string().nullable(),
      instagram: z.string().nullable(),
      linkedin: z.string().nullable(),
      comuna: z.string().nullable(),
      region: z.string().nullable(),
      rut: z.string().nullable(),
      legal_name: z.string().nullable(),
      notes: z
        .string()
        .nullable()
        .describe(
          "Datos útiles del cliente para la ficha (tamaño, canales, historia).",
        ),
    })
    .describe(
      "Datos de la ficha del cliente mencionados en la reunión; null si no aparecen.",
    ),
  contacts: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().nullable(),
        email: z.string().nullable(),
        phone: z.string().nullable(),
      }),
    )
    .describe(
      "Personas del cliente que aparecen en la reunión (no el equipo de Studio Nomade).",
    ),
});
export type BriefAiOutput = z.infer<typeof briefAiSchema>;

// ── 2. Brief → borrador de propuesta ─────────────────────────
export const customServiceSchema = z.object({
  name: z.string().describe("Nombre del servicio, como en el catálogo."),
  area: z.enum(AREAS),
  subarea: z.string().nullable(),
  unit: z
    .string()
    .nullable()
    .describe(
      "Único · Mensual · Trimestral · Anual · Por pieza · Por unidad · Por hora · Por jornada",
    ),
  description: z.string(),
  methodology: z
    .array(z.string())
    .describe("Etapas o pasos del servicio, en orden."),
  deliverables: z.array(z.string()),
  exclusions: z.array(z.string()),
  estimated_time: z.string().describe("Plazo, p. ej. '2–3 semanas'."),
  based_on_service_id: z
    .string()
    .nullable()
    .describe(
      "id del servicio del catálogo del que es un ajuste, o null si es nuevo.",
    ),
});

export const draftLineSchema = z.object({
  kind: z
    .enum(["catalogo", "personalizado"])
    .describe(
      "catalogo: servicio existente tal cual. personalizado: nuevo o ajustado.",
    ),
  service_id: z
    .string()
    .nullable()
    .describe("id del catálogo si kind = catalogo; null si es personalizado."),
  tier: z.enum(SERVICE_TIERS),
  quantity: z.number().describe("Cantidad (entero ≥ 1)."),
  unit_price: z
    .number()
    .nullable()
    .describe(
      "Valor por unidad que propones. null = usar el valor del catálogo.",
    ),
  currency: z.enum(CURRENCIES),
  rationale: z
    .string()
    .describe(
      "Por qué este servicio y cómo llegaste al valor: días de trabajo, precedentes con su valor, aprendizajes aplicados.",
    ),
  custom: customServiceSchema
    .nullable()
    .describe(
      "Ficha completa si kind = personalizado; null si es del catálogo.",
    ),
});

export const proposalDraftSchema = z.object({
  title: z
    .string()
    .describe("Título de la propuesta: 'Cliente | Qué se propone'."),
  summary_for_team: z
    .string()
    .describe(
      "Para el equipo: cómo armaste la propuesta y qué revisar antes de enviar (3–6 oraciones).",
    ),
  confidence: z.enum(["alta", "media", "baja"]),
  lines: z.array(draftLineSchema),
  discount: z
    .object({
      label: z.string(),
      kind: z.enum(["percent", "uf"]),
      value: z.number(),
      rationale: z.string(),
    })
    .nullable()
    .describe(
      "Descuento comercial solo si corresponde (p. ej. pack multiservicio).",
    ),
  sections: z.object({
    context: z.string(),
    diagnosis: z.string(),
    main_objective: z.string(),
    specific_objectives: z.string().describe("Viñetas con '• '."),
    scope: z.string(),
    work_stages: z
      .array(z.object({ title: z.string(), description: z.string() }))
      .describe(
        "Etapas generales del proyecto, en orden (título corto + descripción breve).",
      ),
    deliverables: z
      .array(z.object({ title: z.string(), description: z.string() }))
      .describe(
        "Entregables generales (título + detalle opcional, '' si no hay).",
      ),
    timeline: z.string(),
    client_requirements: z.string(),
    exclusions: z.string(),
    commercial_conditions: z.string(),
    next_action: z.string(),
  }),
  team: z
    .array(
      z.object({
        member_id: z.string().describe("id del EQUIPO DISPONIBLE."),
        role: z
          .string()
          .describe(
            "Rol en este proyecto (p. ej. 'Dirección Creativa y Estrategia').",
          ),
      }),
    )
    .describe("Equipo que se muestra en la propuesta, en orden."),
  open_questions: z
    .array(z.string())
    .describe(
      "Lo que hay que confirmar con el cliente antes o después de enviar.",
    ),
  applied_learning_ids: z
    .array(z.string())
    .describe("ids de los aprendizajes de la memoria que aplicaste."),
  precedent_ids: z
    .array(z.string())
    .describe("ids de los precedentes que usaste como referencia."),
});
export type ProposalDraft = z.infer<typeof proposalDraftSchema>;
export type DraftLine = z.infer<typeof draftLineSchema>;

// ── 3. Propuesta final vs borrador → aprendizajes ───────────
export const learningsAiSchema = z.object({
  learnings: z
    .array(
      z.object({
        kind: z.enum(QUOTER_LEARNING_KINDS),
        scope: z.enum(QUOTER_LEARNING_SCOPES),
        area: z.enum(AREAS).nullable(),
        service_id: z.string().nullable(),
        industry: z.string().nullable(),
        statement: z
          .string()
          .describe(
            "Regla accionable en una oración, en imperativo, para futuras propuestas.",
          ),
        rationale: z
          .string()
          .describe("De qué cambio o resultado sale (con valores)."),
        replaces_learning_id: z
          .string()
          .nullable()
          .describe(
            "id de un aprendizaje vigente que esta regla corrige o reemplaza, o null.",
          ),
      }),
    )
    .describe("0 a 5 reglas nuevas. Vacío si no hay nada generalizable."),
});
export type LearningsAiOutput = z.infer<typeof learningsAiSchema>;

// ── 4. Presupuesto histórico (PDF en texto) → precedente ─────
export const precedentDigestSchema = z.object({
  client_name: z.string().nullable(),
  title: z.string(),
  summary: z
    .string()
    .describe(
      "Qué se cotizó y para qué, en 2–4 oraciones (alcance, no marketing).",
    ),
  lines: z.array(
    z.object({
      name: z.string(),
      amount: z.number().nullable(),
      currency: z.enum(CURRENCIES).nullable(),
      unit: z.string().nullable(),
      quantity: z.number().nullable(),
      note: z
        .string()
        .nullable()
        .describe(
          "Alcance breve, valor original vs oferta, o condición del ítem.",
        ),
    }),
  ),
  total_uf: z
    .number()
    .nullable()
    .describe("Total neto en UF si se puede calcular, o null."),
  conditions: z
    .string()
    .nullable()
    .describe("Condiciones comerciales: forma de pago, vigencia, descuentos."),
});
export type PrecedentDigest = z.infer<typeof precedentDigestSchema>;
