/**
 * Puntaje de conciliación propuesta entre un movimiento bancario y un
 * documento abierto (función pura, testeable).
 *
 * - Monto exacto contra el saldo del documento (requisito).
 * - Ventana de fechas: el abono llega entre 5 días antes de la emisión y 120
 *   días después; dentro de 45 días suma más.
 * - RUT o nombre del contacto en la glosa suman.
 * - Los abonos de factoring (Financia Capital, Xepelin…) no se proponen contra
 *   facturas de clientes: corresponden a cesiones y se concilian aparte.
 */

const FACTORING_PATTERNS = [
  /financia/i,
  /xepelin/i,
  /x capital/i,
  /factoring/i,
  /\bcbp\b/i,
];

export function isFactoringGlosa(glosa: string): boolean {
  return FACTORING_PATTERNS.some((re) => re.test(glosa));
}

const STOP = new Set([
  "spa",
  "ltda",
  "limitada",
  "sa",
  "s.a.",
  "eirl",
  "y",
  "de",
  "la",
  "el",
  "cia",
  "compania",
  "sociedad",
  "comercial",
  "servicios",
  "inversiones",
]);

function nameTokens(name: string | null | undefined): string[] {
  return (name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !STOP.has(t));
}

export interface MatchTxn {
  fecha: string;
  glosa: string;
  monto: number;
  tipo: "ABONO" | "CARGO";
}

export interface MatchDoc {
  fechaEmision: string;
  saldo: number;
  contactRut: string | null;
  contactName: string | null;
}

const DAY = 86_400_000;

/** Devuelve el puntaje (0 = no proponer). */
export function scoreMatch(txn: MatchTxn, doc: MatchDoc): number {
  if (Math.round(doc.saldo) !== Math.round(txn.monto)) return 0;
  if (txn.tipo === "ABONO" && isFactoringGlosa(txn.glosa)) return 0;

  const days =
    (new Date(txn.fecha).getTime() - new Date(doc.fechaEmision).getTime()) /
    DAY;
  if (days < -5 || days > 120) return 0;

  let score = 50;
  if (days <= 45) score += 20;
  const glosa = txn.glosa
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  const rutNum = (doc.contactRut ?? "").split("-")[0].replace(/\./g, "");
  if (rutNum && glosa.replace(/\./g, "").includes(rutNum)) score += 20;
  if (nameTokens(doc.contactName).some((t) => glosa.includes(t))) score += 15;
  return Math.min(score, 100);
}
