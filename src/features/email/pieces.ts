/**
 * Piezas de una solicitud: cuando una solicitud de correo trae varias piezas,
 * el equipo la divide en subtareas de Asana (una por pieza y responsable).
 * Cada subtarea entrega por su cuenta, pero todo sale en el mismo hilo del
 * cliente. Este módulo concentra las reglas puras (sin red ni base de datos).
 */

export type PieceSubtask = { gid: string; name: string; completed: boolean };

/** Nombre de la pieza tal como lo lee el cliente en el correo. */
export function pieceLabel(name: string | null | undefined): string | null {
  const label = (name ?? "").replace(/\s+/g, " ").trim();
  return label ? label.slice(0, 140) : null;
}

export type PieceApprovalPlan = {
  /** Subtarea aprobada (la de la última entrega), si la entrega fue de una pieza. */
  approved: { gid: string; name: string } | null;
  /** Piezas que siguen abiertas después de esta aprobación. */
  remaining: { gid: string; name: string }[];
  /** true → se cierra la solicitud completa (flujo de siempre). */
  closeRequest: boolean;
};

/**
 * Qué hacer cuando el cliente aprueba: si la solicitud tiene piezas abiertas
 * (además de la que se acaba de aprobar), se aprueba solo esa pieza y la
 * solicitud sigue abierta. Sin piezas, o con todas cerradas, se cierra entera.
 */
export function planPieceApproval(input: {
  subtasks: readonly PieceSubtask[];
  /** Tarea donde se comentó la última entrega enviada (null si no se sabe). */
  deliveredTaskGid: string | null;
}): PieceApprovalPlan {
  const delivered = input.deliveredTaskGid
    ? (input.subtasks.find((task) => task.gid === input.deliveredTaskGid) ??
      null)
    : null;
  const remaining = input.subtasks
    .filter((task) => !task.completed && task.gid !== delivered?.gid)
    .map(({ gid, name }) => ({ gid, name }));
  return {
    approved: delivered ? { gid: delivered.gid, name: delivered.name } : null,
    remaining,
    closeRequest: remaining.length === 0,
  };
}

export type PieceFieldValue = {
  gid: string;
  name?: string;
  resource_subtype?: string;
  text_value?: string | null;
  enum_value?: { gid: string } | null;
  multi_enum_values?: { gid: string }[] | null;
};

/** Campos propios de cada pieza: no se copian desde la solicitud. */
const PIECE_OWN_FIELDS = [
  "estado",
  "rondas de entrega",
  "formato",
  "reunion de brief",
];
/** Campos que siempre deben coincidir con la solicitud. */
const PIECE_MIRROR_FIELDS = ["folio noma"];

function fold(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?]/g, "")
    .trim()
    .toLowerCase();
}

function isEmpty(field: PieceFieldValue | undefined) {
  if (!field) return true;
  switch (field.resource_subtype) {
    case "text":
      return !field.text_value?.trim();
    case "enum":
      return !field.enum_value?.gid;
    case "multi_enum":
      return !field.multi_enum_values?.length;
    default:
      return false;
  }
}

function valueOf(field: PieceFieldValue): string | string[] | null {
  switch (field.resource_subtype) {
    case "text":
      return field.text_value?.trim() ? field.text_value.trim() : null;
    case "enum":
      return field.enum_value?.gid ?? null;
    case "multi_enum":
      return field.multi_enum_values?.length
        ? field.multi_enum_values.map((option) => option.gid)
        : null;
    default:
      return null;
  }
}

/**
 * Valores a fijar en una subtarea (pieza) a partir de la solicitud: completa
 * solo los campos vacíos (no pisa lo que puso el equipo), salvo el folio, que
 * siempre queda igual al de la solicitud. Estado, rondas, formato y brief son
 * de cada pieza y no se copian.
 */
export function pieceFieldValues(
  parent: readonly PieceFieldValue[],
  piece: readonly PieceFieldValue[],
): Record<string, string | string[]> {
  const own = new Map(piece.map((field) => [field.gid, field]));
  const out: Record<string, string | string[]> = {};
  for (const field of parent) {
    const name = fold(field.name);
    if (PIECE_OWN_FIELDS.includes(name)) continue;
    const value = valueOf(field);
    if (value === null) continue;
    const current = own.get(field.gid);
    if (PIECE_MIRROR_FIELDS.includes(name)) {
      if (current && valueOf(current) !== value) out[field.gid] = value;
      continue;
    }
    if (current && isEmpty(current)) out[field.gid] = value;
  }
  return out;
}

/** Proyectos de los que hay que sacar la pieza para que no se vea duplicada. */
export function duplicatedProjects(
  parentProjects: readonly { gid: string }[],
  pieceProjects: readonly { gid: string }[],
): string[] {
  const parent = new Set(parentProjects.map((project) => project.gid));
  return pieceProjects
    .map((project) => project.gid)
    .filter((gid) => parent.has(gid));
}
