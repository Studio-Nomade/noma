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
