/**
 * Render de los 7 correos del flujo de solicitudes (HTML Mustache + texto).
 *
 * Cada función recibe datos ya resueltos (folio, extracción, links) y arma la
 * vista de su plantilla. El HTML del cliente siempre se escapa (Mustache con
 * `escapeHtml`); las URLs solo pasan si son http(s). Módulo puro.
 */

import Mustache from "mustache";
import { formatSpanishDate, localDateParts, toIsoDate } from "../dates";
import type { EmailExtraction } from "../extract";
import {
  EMAIL_PARTIALS,
  EMAIL_TEMPLATES,
  type EmailTemplateId,
} from "./markup";

export type RenderedEmail = { html: string; text: string };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const DEFAULT_EMAIL_ASSETS_BASE =
  "https://assets.studionomade.cl/mailings/studio-nomade/20261109_correos-solicitudes/01_20261109_noma";

export function emailAssetsBase(
  env: Record<string, string | undefined> = process.env,
) {
  return (
    env.NOMA_EMAIL_ASSETS_BASE?.trim() || DEFAULT_EMAIL_ASSETS_BASE
  ).replace(/\/+$/, "");
}

/** Etapas de la barra de estado del correo. */
export const STAGES = [
  "Recibida",
  "En curso",
  "Entregada",
  "Aprobada",
] as const;
export type Stage = 0 | 1 | 2 | 3;

export function stageSteps(current: Stage, allDone = false) {
  return STAGES.map((label, index) => {
    if (allDone || index < current) return { label, hecho: true };
    if (index === current) return { label, actual: true };
    return { label, pendiente: true };
  });
}

/** Campo Estado de Asana → etapa de la barra (null si no aplica). */
export function stageFromEstado(
  estado: string | null | undefined,
): Stage | null {
  const value = (estado ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (!value) return null;
  if (value.startsWith("aprobado") || value.startsWith("entregado")) return 3;
  if (value.startsWith("enviado a cliente")) return 2;
  if (value.startsWith("por revisar") || value.startsWith("planificada"))
    return 0;
  if (value.startsWith("fuera de alcance")) return null;
  return 1;
}

export function firstName(name: string | null | undefined) {
  return name?.trim().split(/\s+/)[0] || null;
}

function safeUrl(url: string | null | undefined) {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/** `Lun 09 nov 2026 · 12:06` en America/Santiago. */
export function formatStamp(date: Date) {
  const parts = localDateParts(date);
  const time = new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const weekday = new Date(`${toIsoDate(parts)}T12:00:00Z`).getUTCDay();
  return `${WEEKDAYS.at(weekday)} ${pad2(parts.day)} ${MONTHS_SHORT.at(parts.month - 1)} ${parts.year} · ${time}`;
}

/** `09 nov` en America/Santiago. */
export function formatShortDay(date: Date) {
  const parts = localDateParts(date);
  return `${pad2(parts.day)} ${MONTHS_SHORT.at(parts.month - 1)}`;
}

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function monthName(date: Date) {
  return MONTH_NAMES.at(localDateParts(date).month - 1) ?? "";
}

/** Estilo de la pastilla de prioridad (monocromo del design system). */
export function priorityStyle(priority: EmailExtraction["priority"]) {
  switch (priority) {
    case "urgente":
      return {
        label: "Urgente",
        fondo: "#000000",
        texto: "#FFFFFF",
        borde: "#000000",
      };
    case "alta":
      return {
        label: "Alta",
        fondo: "#555555",
        texto: "#FFFFFF",
        borde: "#555555",
      };
    case "media":
      return {
        label: "Media",
        fondo: "#FFFFFF",
        texto: "#333333",
        borde: "#333333",
      };
    default:
      return {
        label: "Normal",
        fondo: "#FFFFFF",
        texto: "#888888",
        borde: "#B0B0B0",
      };
  }
}

type Common = {
  folio: string;
  clientName: string;
  alias: string;
  /** Título de la solicitud, bajo el folio. */
  title?: string | null;
  requesterName?: string | null;
  now?: Date;
  assetsBase?: string;
};

function baseView(
  input: Common,
  extra: {
    titulo: string;
    preheader: string;
    stage: Stage | null;
    allDone?: boolean;
    cierre?: string;
  },
) {
  return {
    folio: input.folio,
    cliente: input.clientName,
    alias_solicitudes: input.alias,
    assets_base: input.assetsBase ?? emailAssetsBase(),
    anio: String(localDateParts(input.now ?? new Date()).year),
    nombre_solicitante: firstName(input.requesterName) ?? "",
    referencia: input.title?.trim() || "",
    titulo: extra.titulo,
    preheader: extra.preheader,
    mostrar_estado: extra.stage !== null,
    pasos: extra.stage === null ? [] : stageSteps(extra.stage, extra.allDone),
    cierre: extra.cierre ?? "Quedamos atentos.",
  };
}

function render(id: EmailTemplateId, view: object): string {
  return Mustache.render(EMAIL_TEMPLATES[id], view, EMAIL_PARTIALS, {
    escape: escapeHtml,
  });
}

function hello(name: string | null | undefined) {
  const first = firstName(name);
  return first ? `Hola ${first},` : "Hola,";
}

function textFooter(input: Common, closing = "Quedamos atentos.") {
  return [
    "",
    closing,
    "Design Team · Studio Nomade",
    "",
    `Responde este correo para todo lo relacionado con ${input.folio}. Las solicitudes nuevas van en un correo aparte a ${input.alias}.`,
  ];
}

function bullets(items: string[], mark = "-") {
  return items.map((item) => `${mark} ${item}`);
}

// ─────────────────────────────────────────────────────────────
// 01 · Solicitud recibida
// ─────────────────────────────────────────────────────────────
export type ConfirmationInput = Common & {
  extraction: EmailExtraction;
  requesterEmail: string;
  receivedAt: Date;
  via?: string;
  attachmentNames?: string[];
};

export function renderConfirmationEmail(
  input: ConfirmationInput,
): RenderedEmail {
  const e = input.extraction;
  const due = e.requested_due_date
    ? formatSpanishDate(e.requested_due_date)
    : "Por confirmar";
  const priority = priorityStyle(e.priority);
  const canal = [e.channels.join(" · "), e.format].filter(Boolean).join(" · ");
  const structureItems = (e.structure?.items ?? []).map((item, index) => ({
    numero: pad2(index + 1),
    titulo: item.title,
    detalle: item.detail ?? "",
    enlaces: item.links
      .filter((link) => safeUrl(link.url))
      .map((link) => ({
        etiqueta: link.label,
        url: link.url,
        nota: link.note ?? "",
      })),
  }));
  const materials = e.materials
    .filter((item) => safeUrl(item.url))
    .map((item) => ({ etiqueta: item.label, url: item.url, tipo: item.kind }));
  const attachments = (input.attachmentNames ?? []).map((nombre) => ({
    nombre,
    peso: "",
  }));
  const requesterLabel = input.requesterName?.trim() || input.requesterEmail;
  const view = {
    ...baseView(
      {
        ...input,
        requesterName: e.requester_first_name ?? input.requesterName,
      },
      {
        titulo: "Solicitud recibida",
        preheader: `Recibimos tu solicitud ${input.folio}${e.deliverable_type ? ` · ${e.deliverable_type}` : ""}${canal ? ` · ${canal}` : ""}.`,
        stage: 0,
      },
    ),
    referencia: "",
    cliente_final: e.end_client ?? "",
    tipo_pieza: e.deliverable_type ?? e.title,
    canal: canal || "Por confirmar",
    fecha_entrega: due,
    prioridad: priority.label,
    prioridad_fondo: priority.fondo,
    prioridad_texto: priority.texto,
    prioridad_borde: priority.borde,
    nombre_completo_solicitante: requesterLabel,
    email_solicitante: input.requesterEmail,
    via_ingreso: input.via ?? "Correo",
    fecha_ingreso: formatStamp(input.receivedAt),
    mes_bolsa: monthName(input.receivedAt),
    resumen: e.summary,
    tiene_estructura: structureItems.length > 0,
    estructura_titulo: e.structure?.title ?? "",
    estructura_subtitulo: e.title,
    estructura: structureItems,
    tiene_consideraciones: e.considerations.length > 0,
    consideraciones: e.considerations,
    tiene_material: materials.length + attachments.length > 0,
    material: materials,
    adjuntos: attachments,
    tiene_pendientes: e.missing_info.length > 0,
    pendientes: e.missing_info,
  };

  const text = [
    hello(e.requester_first_name ?? input.requesterName),
    "",
    `Tu solicitud ingresó correctamente con el folio ${input.folio}. Así la registramos; si algo no calza, respóndenos y lo corregimos.`,
    "",
    `Cliente: ${input.clientName}`,
    ...(e.end_client ? [`Cliente final: ${e.end_client}`] : []),
    `Tipo de pieza: ${view.tipo_pieza}`,
    `Canal / formato: ${view.canal}`,
    `Fecha ideal de entrega: ${due}`,
    `Prioridad: ${priority.label}`,
    "",
    "Qué entendimos:",
    e.summary,
    ...(structureItems.length
      ? [
          "",
          `${view.estructura_titulo}:`,
          ...structureItems.flatMap((item) => [
            `${item.numero}. ${item.titulo}${item.detalle ? ` (${item.detalle})` : ""}`,
            ...item.enlaces.map(
              (link) =>
                `    ${link.etiqueta}${link.nota ? ` · ${link.nota}` : ""}: ${link.url}`,
            ),
          ]),
        ]
      : []),
    ...(e.considerations.length
      ? ["", "A considerar:", ...bullets(e.considerations)]
      : []),
    ...(materials.length || attachments.length
      ? [
          "",
          "Material recibido:",
          ...materials.map((item) => `- ${item.etiqueta}: ${item.url}`),
          ...attachments.map((item) => `- ${item.nombre} (adjunto)`),
        ]
      : []),
    ...(e.missing_info.length
      ? [
          "",
          "Para agilizar (si los tienen, respóndannos en este hilo; igual ya comenzamos):",
          ...bullets(e.missing_info),
        ]
      : []),
    "",
    "Qué sigue:",
    `01. Planificamos la pieza en la bolsa de ${view.mes_bolsa}.`,
    "02. Si necesitamos aclarar algo, te escribimos en este hilo.",
    "03. La Entrega 01 llega aquí mismo, en este hilo.",
    ...textFooter(input),
  ].join("\n");

  return { html: render("01_solicitud_recibida", view), text };
}

// ─────────────────────────────────────────────────────────────
// 02 · Comentario recibido
// ─────────────────────────────────────────────────────────────
export type FieldChange = {
  field: string;
  before: string | null;
  after: string;
};

export type CommentAckInput = Common & {
  receivedAt: Date;
  stage: Stage | null;
  isQuestion: boolean;
  points: string[];
  changes?: FieldChange[];
  files?: { name: string; url?: string | null; type: string }[];
  pending?: string[];
};

export function renderCommentAckEmail(input: CommentAckInput): RenderedEmail {
  const changes = input.changes ?? [];
  const files = input.files ?? [];
  const pending = input.pending ?? [];
  const when = formatStamp(input.receivedAt)
    .replace(/^\S+ /, "")
    .replace(/ \d{4} ·/, " a las");
  const view = {
    ...baseView(input, {
      titulo: "Comentario recibido",
      preheader: `Tu mensaje quedó en la tarea ${input.folio}.`,
      stage: input.stage,
    }),
    fecha_comentario: when,
    es_pregunta: input.isQuestion,
    puntos: input.points,
    tiene_cambios: changes.length > 0,
    cambios: changes.map((change) => ({
      campo: change.field,
      antes: change.before ?? "—",
      ahora: change.after,
    })),
    tiene_archivos: files.length > 0,
    archivos: files.map((file) => ({
      nombre: file.name,
      url: safeUrl(file.url) ?? "",
      tipo: file.type,
    })),
    tiene_pendientes: pending.length > 0,
    pendientes: pending,
  };
  const text = [
    hello(input.requesterName),
    "",
    `Recibimos tu mensaje del ${when} y lo sumamos a la tarea ${input.folio}. ${
      input.isQuestion
        ? "Lo revisamos y te respondemos en este hilo a la brevedad."
        : "El equipo ya lo tiene a la vista y lo considera para la pieza."
    }`,
    ...(input.points.length
      ? ["", "Lo que anotamos:", ...bullets(input.points)]
      : []),
    ...(changes.length
      ? [
          "",
          "Actualizamos en la ficha:",
          ...changes.map(
            (change) =>
              `- ${change.field}: ${change.before ?? "—"} → ${change.after}`,
          ),
        ]
      : []),
    ...(files.length
      ? ["", "Archivos recibidos:", ...files.map((file) => `- ${file.name}`)]
      : []),
    ...(pending.length
      ? ["", "Si lo tienen, nos ayudaría:", ...bullets(pending)]
      : []),
    ...textFooter(input),
  ].join("\n");
  return { html: render("02_comentario_recibido", view), text };
}

// ─────────────────────────────────────────────────────────────
// 03 · Consulta del equipo
// ─────────────────────────────────────────────────────────────
export type ConsultaInput = Common & {
  stage: Stage | null;
  questions: { text: string; hint?: string | null }[];
  blocking: boolean;
  author?: string | null;
};

export function renderConsultaEmail(input: ConsultaInput): RenderedEmail {
  const view = {
    ...baseView(input, {
      titulo: "Tenemos una consulta",
      preheader: `Para avanzar con ${input.folio} necesitamos que nos confirmes ${input.questions.length === 1 ? "un punto" : `${input.questions.length} puntos`}.`,
      stage: input.stage,
    }),
    preguntas: input.questions.map((question, index) => ({
      numero: pad2(index + 1),
      texto: question.text,
      opciones: question.hint ?? "",
    })),
    bloquea_entrega: input.blocking,
    autor: input.author ?? "",
  };
  const text = [
    hello(input.requesterName),
    "",
    "Estamos trabajando en tu solicitud y necesitamos que nos confirmes lo siguiente:",
    "",
    ...input.questions.map(
      (question, index) =>
        `${pad2(index + 1)}. ${question.text}${question.hint ? ` (${question.hint})` : ""}`,
    ),
    "",
    `Responde este correo con tu respuesta. ${
      input.blocking
        ? "La entrega depende de este dato: apenas lo tengamos, seguimos."
        : "Mientras tanto, seguimos avanzando con lo demás."
    }`,
    ...textFooter(input),
  ].join("\n");
  return { html: render("03_consulta_equipo", view), text };
}

// ─────────────────────────────────────────────────────────────
// 04 · Entrega NN
// ─────────────────────────────────────────────────────────────
export type DeliveryFile = {
  label: string;
  url: string;
  detail?: string | null;
};

export type DeliveryInput = Common & {
  round: number;
  files: DeliveryFile[];
  note?: string | null;
  author?: string | null;
  appliedAdjustments?: string[];
  pieceLabel?: string | null;
};

export const ADJUSTMENTS_GUIDE =
  "Escríbelos en tu respuesta. Si es video, indica el minuto (ej. 0:45); si es una pieza gráfica, la lámina o el texto.";

export function renderDeliveryEmail(input: DeliveryInput): RenderedEmail {
  const round = pad2(input.round);
  const applied = input.appliedAdjustments ?? [];
  const files = input.files.filter((file) => safeUrl(file.url));
  const piece = input.pieceLabel?.trim() || "tu solicitud";
  const view = {
    ...baseView(input, {
      titulo: `Entrega ${round}`,
      preheader:
        input.round === 1
          ? `La primera versión está lista para revisar · ${input.folio}.`
          : `Entrega ${round}${applied.length ? ` con ${applied.length === 1 ? "el ajuste aplicado" : `los ${applied.length} ajustes aplicados`}` : ""} · ${input.folio}.`,
      stage: 2,
    }),
    numero_entrega: round,
    es_primera: input.round === 1,
    pieza: piece,
    tiene_ajustes_aplicados: applied.length > 0 && input.round > 1,
    entrega_anterior: pad2(Math.max(1, input.round - 1)),
    ajustes_aplicados: applied,
    archivos: files.map((file) => ({
      etiqueta: file.label,
      detalle: file.detail ?? "",
      url: file.url,
    })),
    nota_equipo: input.note?.trim() ?? "",
    autor: input.author ?? "",
    guia_ajustes: ADJUSTMENTS_GUIDE,
  };
  const text = [
    hello(input.requesterName),
    "",
    input.round === 1
      ? `Te compartimos la primera versión de ${piece}.`
      : `Te compartimos la Entrega ${round} de ${piece}${applied.length ? ", con los ajustes que nos pediste" : ""}.`,
    ...(view.tiene_ajustes_aplicados
      ? [
          "",
          `Ajustes aplicados sobre la Entrega ${view.entrega_anterior}:`,
          ...bullets(applied, "✓"),
        ]
      : []),
    "",
    `Para revisar (Entrega ${round}):`,
    ...files.map(
      (file) =>
        `- ${file.label}${file.detail ? ` (${file.detail})` : ""}: ${file.url}`,
    ),
    ...(view.nota_equipo
      ? ["", view.nota_equipo + (view.autor ? ` — ${view.autor}` : "")]
      : []),
    "",
    "¿Cómo seguimos? Responde este correo:",
    `A. Tiene ajustes: ${ADJUSTMENTS_GUIDE}`,
    "B. Está aprobada: responde «Aprobado» y cerramos la solicitud con esta versión.",
    ...textFooter(input),
  ].join("\n");
  return { html: render("04_entrega", view), text };
}

// ─────────────────────────────────────────────────────────────
// 05 · Ajustes recibidos
// ─────────────────────────────────────────────────────────────
export type AdjustmentsAckInput = Common & {
  reviewedRound: number;
  adjustments: { text: string; reference?: string | null }[];
  doubts?: string[];
  nextDate?: string | null;
};

export function renderAdjustmentsAckEmail(
  input: AdjustmentsAckInput,
): RenderedEmail {
  const doubts = input.doubts ?? [];
  const reviewed = pad2(input.reviewedRound);
  const next = pad2(input.reviewedRound + 1);
  const count = input.adjustments.length;
  const view = {
    ...baseView(input, {
      titulo: "Ajustes recibidos",
      preheader: `Anotamos ${count === 1 ? "1 ajuste" : `${count} ajustes`} sobre la Entrega ${reviewed} · ${input.folio}.`,
      stage: 1,
    }),
    entrega_revisada: reviewed,
    ajustes: input.adjustments.map((adjustment, index) => ({
      numero: pad2(index + 1),
      texto: adjustment.text,
      referencia: adjustment.reference ?? "",
    })),
    tiene_dudas: doubts.length > 0,
    dudas: doubts,
    proxima_entrega: next,
    fecha_proxima: input.nextDate ?? "",
  };
  const text = [
    hello(input.requesterName),
    "",
    `Recibimos tus comentarios sobre la Entrega ${reviewed} y ya están en la tarea. Esto es lo que vamos a ajustar:`,
    "",
    ...input.adjustments.map(
      (adjustment, index) =>
        `${pad2(index + 1)}. ${adjustment.text}${adjustment.reference ? ` [${adjustment.reference}]` : ""}`,
    ),
    ...(doubts.length ? ["", "Para no equivocarnos:", ...bullets(doubts)] : []),
    "",
    `Próxima entrega: Entrega ${next}${input.nextDate ? ` · ${input.nextDate}` : ""}`,
    ...textFooter(input),
  ].join("\n");
  return { html: render("05_ajustes_recibidos", view), text };
}

// ─────────────────────────────────────────────────────────────
// 06 · Solicitud aprobada
// ─────────────────────────────────────────────────────────────
export type ApprovedInput = Common & {
  finalRound: number;
  totalRounds: number;
  receivedAt: Date;
  approvedAt: Date;
  files: DeliveryFile[];
};

export function renderApprovedEmail(input: ApprovedInput): RenderedEmail {
  const final = pad2(input.finalRound);
  const files = input.files.filter((file) => safeUrl(file.url));
  const view = {
    ...baseView(input, {
      titulo: "Solicitud aprobada",
      preheader: `Cerramos ${input.folio} con la Entrega ${final}.`,
      stage: 3,
      allDone: true,
      cierre: "Gracias por la confianza.",
    }),
    entrega_final: final,
    dia_ingreso: formatShortDay(input.receivedAt),
    total_entregas: pad2(input.totalRounds),
    dia_aprobacion: formatShortDay(input.approvedAt),
    archivos_finales: files.map((file) => ({
      etiqueta: file.label,
      detalle: file.detail ?? "",
      url: file.url,
    })),
  };
  const text = [
    `Gracias${firstName(input.requesterName) ? ` ${firstName(input.requesterName)}` : ""}. Cerramos la solicitud ${input.folio} con la Entrega ${final} como versión final.`,
    "",
    `Ingreso: ${view.dia_ingreso} · Entregas: ${view.total_entregas} · Aprobada: ${view.dia_aprobacion}`,
    ...(files.length
      ? [
          "",
          "Versión final:",
          ...files.map((file) => `- ${file.label}: ${file.url}`),
        ]
      : []),
    "",
    `Si necesitas un cambio sobre esta pieza, responde este correo y reabrimos ${input.folio}. Para algo nuevo, escríbenos en un correo aparte.`,
    ...textFooter(input, "Gracias por la confianza."),
  ].join("\n");
  return { html: render("06_solicitud_aprobada", view), text };
}

// ─────────────────────────────────────────────────────────────
// 07 · Solicitud en evaluación (fuera de alcance)
// ─────────────────────────────────────────────────────────────
export type EvaluationInput = Common & {
  summary: string;
  reasons?: string[];
  plan?: string;
  proposalBy?: string | null;
};

export function renderEvaluationEmail(input: EvaluationInput): RenderedEmail {
  const reasons = input.reasons ?? [];
  const plan = input.plan ?? "mensual";
  const view = {
    ...baseView(input, {
      titulo: "Solicitud en evaluación",
      preheader: `Tu solicitud ${input.folio} queda fuera del plan ${plan}: te enviaremos una propuesta.`,
      stage: null,
    }),
    plan,
    resumen: input.summary,
    tiene_motivos: reasons.length > 0,
    motivos: reasons,
    plazo_propuesta: input.proposalBy ?? "",
  };
  const text = [
    hello(input.requesterName),
    "",
    `Recibimos tu solicitud ${input.folio}. Por su alcance, no entra en el plan ${plan}, así que antes de comenzar te enviaremos una propuesta para que la revises.`,
    "",
    "Qué pediste:",
    input.summary,
    ...(reasons.length ? ["", "Por qué:", ...bullets(reasons)] : []),
    "",
    `01. Te enviamos la propuesta${input.proposalBy ? ` ${input.proposalBy}` : ""}, con alcance, plazos y valor.`,
    "02. La revisas y nos cuentas si la ajustamos.",
    "03. Al aprobarla, la planificamos y seguimos en este mismo hilo.",
    ...textFooter(input),
  ].join("\n");
  return { html: render("07_solicitud_en_evaluacion", view), text };
}

// ─────────────────────────────────────────────────────────────
// 08 · Informe mensual de solicitudes
// ─────────────────────────────────────────────────────────────
export type MonthlyReportIndicator = {
  label: string;
  value: string;
  detail?: string | null;
  highlight?: boolean;
};

export type MonthlyReportInput = {
  clientName: string;
  alias: string;
  /** Nombre del servicio o plan contratado. */
  service: string;
  /** Mes informado (cualquier día del mes). */
  month: Date;
  indicators: MonthlyReportIndicator[];
  highlights: string[];
  /** Propuesta para el mes siguiente (opcional). */
  proposal?: string | null;
  attachmentName: string;
  attachmentSize?: string | null;
  now?: Date;
  assetsBase?: string;
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Saludo al equipo del cliente: «Equipo Cliente A». */
export function teamName(clientName: string) {
  return `Equipo ${clientName.trim()}`;
}

/** Identificador del informe para el asunto y la píldora: «Octubre 2026». */
export function monthlyReportLabel(month: Date) {
  const { year } = localDateParts(month);
  return `${capitalize(monthName(month))} ${year}`;
}

/**
 * Asunto del envío mensual (convención B&D para ordenar los envíos):
 * «B&D – Cliente A | Informe Mensual de Solicitudes - Octubre 2026».
 */
export function monthlyReportSubject(clientName: string, month: Date) {
  return `B&D – ${clientName} | Informe Mensual de Solicitudes - ${monthlyReportLabel(month)}`;
}

export function renderMonthlyReportEmail(
  input: MonthlyReportInput,
): RenderedEmail {
  const label = monthlyReportLabel(input.month);
  const mes = monthName(input.month);
  const parts = localDateParts(input.month);
  const next = new Date(Date.UTC(parts.year, parts.month, 15, 12));
  const mesSiguiente = `Para ${monthName(next)}`;
  const view = {
    ...baseView(
      {
        folio: label,
        clientName: input.clientName,
        alias: input.alias,
        title: input.service,
        now: input.now,
        assetsBase: input.assetsBase,
      },
      {
        titulo: "Informe mensual",
        preheader: `Informe de solicitudes de ${mes} · ${input.clientName}. Va adjunto en PDF.`,
        stage: null,
        cierre: "Quedamos atentos a sus comentarios.",
      },
    ),
    // Va al equipo del cliente, nunca a una persona: «Hola Equipo Equifax,».
    nombre_solicitante: teamName(input.clientName),
    mes,
    mes_siguiente: mesSiguiente,
    servicio: input.service,
    indicadores: input.indicators.map((item) => ({
      etiqueta: item.label,
      valor: item.value,
      detalle: item.detail ?? "",
      destacado: Boolean(item.highlight),
    })),
    tiene_hallazgos: input.highlights.length > 0,
    hallazgos: input.highlights,
    propuesta: input.proposal?.trim() || "",
    adjuntos: [
      { nombre: input.attachmentName, peso: input.attachmentSize ?? "" },
    ],
    nota_hilo: `Responde este correo con tus comentarios o dudas sobre el informe. Las solicitudes nuevas van en un correo aparte a ${input.alias}.`,
    pie: `Informe mensual de solicitudes · ${input.clientName}. Lo prepara Noma con los registros del tablero de solicitudes.`,
  };

  const text = [
    `Hola ${teamName(input.clientName)},`,
    "",
    `Te compartimos el informe de solicitudes de ${mes} del servicio ${input.service}. Va adjunto en PDF; abajo está el resumen del mes.`,
    "",
    "Resumen:",
    ...input.indicators.map(
      (item) =>
        `- ${item.label}: ${item.value}${item.detail ? ` (${item.detail})` : ""}`,
    ),
    ...(input.highlights.length
      ? ["", "Lo más relevante:", ...bullets(input.highlights)]
      : []),
    ...(view.propuesta ? ["", `${mesSiguiente}:`, view.propuesta] : []),
    "",
    `Adjunto: ${input.attachmentName}`,
    "",
    "Quedamos atentos a sus comentarios.",
    "Design Team · Studio Nomade",
    "",
    view.nota_hilo,
  ].join("\n");

  return { html: render("08_informe_mensual", view), text };
}
