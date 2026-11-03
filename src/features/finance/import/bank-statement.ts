/**
 * Detección del formato de cartola bancaria dentro de una planilla (función
 * pura). La cartola de cuenta corriente de BCI ("CartolaHistorica") trae un
 * encabezado con datos de la empresa y un resumen del período; la tabla de
 * movimientos parte más abajo, en la fila que dice
 * "Fecha | Sucursal | Descripción | N° Documento | Cheques y otros cargos |
 *  Depósitos y Abono | Saldo diario".
 */

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

export interface StatementLayout {
  /** Índice (0-based) de la fila de encabezados dentro de la matriz. */
  headerIndex: number;
  /** "BCI_CARTOLA" cuando se reconoce la cartola de BCI. */
  layout: "TABLA" | "BCI_CARTOLA";
  /** Período declarado en la cartola ("01-09-2026 al 30-09-2026"). */
  periodo: string | null;
}

/**
 * Busca la fila de encabezados. Si en las primeras 80 filas hay una con
 * "Fecha" y "Saldo diario" (o "Cheques y otros cargos"), es una cartola BCI.
 * Si no, la tabla empieza en la primera fila (formato plano de siempre).
 */
export function detectStatementLayout(matrix: string[][]): StatementLayout {
  const limit = Math.min(matrix.length, 80);
  for (let i = 0; i < limit; i++) {
    const cells = matrix[i].map((c) => norm(c ?? ""));
    const hasFecha = cells.includes("fecha");
    const hasBanco =
      cells.includes("saldo diario") ||
      cells.some((c) => c.startsWith("cheques y otros cargos"));
    if (hasFecha && hasBanco) {
      return {
        headerIndex: i,
        layout: "BCI_CARTOLA",
        periodo: findPeriodo(matrix, i),
      };
    }
  }
  return { headerIndex: 0, layout: "TABLA", periodo: null };
}

function findPeriodo(matrix: string[][], before: number): string | null {
  for (let i = 0; i < before; i++) {
    for (const cell of matrix[i]) {
      const m =
        /(\d{2}[-/]\d{2}[-/]\d{4})\s+al\s+(\d{2}[-/]\d{2}[-/]\d{4})/i.exec(
          cell ?? "",
        );
      if (m) return `${m[1]} al ${m[2]}`;
    }
  }
  return null;
}

/**
 * Convierte la matriz en filas con encabezado. Ignora columnas sin título y
 * filas totalmente vacías (las cartolas BCI dejan celdas combinadas vacías).
 */
export function tableFromMatrix(
  matrix: string[][],
  headerIndex: number,
): { headers: string[]; rows: Record<string, string>[] } {
  const headerRow = matrix[headerIndex] ?? [];
  const headers = headerRow.map((h) => (h ?? "").trim());
  const rows: Record<string, string>[] = [];
  for (let i = headerIndex + 1; i < matrix.length; i++) {
    const obj: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((key, col) => {
      if (!key) return;
      const v = (matrix[i][col] ?? "").trim();
      obj[key] = v;
      if (v) hasValue = true;
    });
    if (hasValue) rows.push(obj);
  }
  return { headers: headers.filter(Boolean), rows };
}

/** Valor de celda de ExcelJS a texto (fechas, fórmulas y texto enriquecido). */
export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const d = value;
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getUTCFullYear()}`;
  }
  if (typeof value === "object") {
    const v = value as {
      richText?: { text: string }[];
      text?: string;
      result?: unknown;
    };
    if (Array.isArray(v.richText))
      return v.richText.map((r) => r.text).join("");
    if (typeof v.text === "string") return v.text;
    if (v.result !== undefined) return cellToString(v.result);
  }
  return String(value);
}
