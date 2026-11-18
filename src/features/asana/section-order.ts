/**
 * Orden de las tareas de una sección por folio, de mayor a menor: la
 * solicitud más nueva (folio más alto) queda primera. Reglas puras.
 */

export type SectionTask = { gid: string; name: string };
export type SectionMove = { task: string; before: string };

/** Número del folio en el nombre («[EQX-NOV-0593] …» → 593), o null. */
export function folioNumber(name: string): number | null {
  const match = /^\s*\[[A-Z0-9]+-[A-Z]{3}-(\d+)\]/i.exec(name);
  return match ? Number(match[1]) : null;
}

/** Orden deseado: con folio de mayor a menor; sin folio al final, como están. */
export function desiredFolioOrder(tasks: readonly SectionTask[]): string[] {
  const withFolio = tasks
    .map((task, index) => ({ task, index, folio: folioNumber(task.name) }))
    .filter((item) => item.folio !== null)
    .sort((a, b) => b.folio! - a.folio! || a.index - b.index)
    .map((item) => item.task.gid);
  const rest = tasks
    .filter((task) => folioNumber(task.name) === null)
    .map((task) => task.gid);
  return [...withFolio, ...rest];
}

/**
 * Movimientos mínimos («insertar X antes de Y») para llegar al orden deseado.
 * Sin cambios → lista vacía.
 */
export function planFolioOrder(tasks: readonly SectionTask[]): SectionMove[] {
  const desired = desiredFolioOrder(tasks);
  const current = tasks.map((task) => task.gid);
  const moves: SectionMove[] = [];
  for (let index = 0; index < desired.length; index += 1) {
    const want = desired[index];
    if (current[index] === want) continue;
    moves.push({ task: want, before: current[index] });
    current.splice(current.indexOf(want), 1);
    current.splice(index, 0, want);
  }
  return moves;
}
