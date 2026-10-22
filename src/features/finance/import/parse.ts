import Papa from "papaparse";
import ExcelJS from "exceljs";
import {
  cellToString,
  detectStatementLayout,
  tableFromMatrix,
} from "./bank-statement";

export interface ParsedTable {
  headers: string[];
  rows: Record<string, string>[];
  /** Presente cuando se reconoce un formato bancario conocido (cartola BCI). */
  meta?: { layout: "BCI_CARTOLA"; periodo: string | null };
}

/** Decodifica un buffer intentando UTF-8 y cayendo a latin1 si hay caracteres inválidos. */
function decodeBuffer(buffer: Buffer): string {
  const utf8 = buffer.toString("utf8");
  if (utf8.includes("�")) return buffer.toString("latin1");
  return utf8;
}

function parseCsv(buffer: Buffer): ParsedTable {
  const text = decodeBuffer(buffer);
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    delimiter: "", // autodetección (soporta , y ;)
    transformHeader: (h) => h.trim(),
  });
  const rows = (result.data || []).filter((r) =>
    Object.values(r).some((v) => String(v ?? "").trim() !== ""),
  );
  const headers = result.meta.fields?.map((f) => f.trim()) ?? [];
  return { headers, rows };
}

async function parseXlsx(buffer: Buffer): Promise<ParsedTable> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  // La cartola BCI viene en la hoja "CartolaHistorica"; si no, la primera.
  const ws =
    wb.worksheets.find(
      (w) => w.name.trim().toLowerCase() === "cartolahistorica",
    ) ?? wb.worksheets[0];
  if (!ws) return { headers: [], rows: [] };

  const matrix: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cells[col - 1] = cellToString(cell.value).trim();
    });
    matrix[rowNumber - 1] = Array.from(cells, (c) => c ?? "");
  });
  for (let i = 0; i < matrix.length; i++) matrix[i] = matrix[i] ?? [];

  const layout = detectStatementLayout(matrix);
  const { headers, rows } = tableFromMatrix(matrix, layout.headerIndex);
  return {
    headers,
    rows,
    meta:
      layout.layout === "BCI_CARTOLA"
        ? { layout: layout.layout, periodo: layout.periodo }
        : undefined,
  };
}

/** Detecta el tipo de archivo por extensión y lo parsea a tabla. */
export async function parseFile(
  buffer: Buffer,
  fileName: string,
): Promise<ParsedTable> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm")) {
    return parseXlsx(buffer);
  }
  if (lower.endsWith(".xls")) {
    // exceljs no lee el formato binario .xls antiguo
    throw new Error(
      "El formato .xls antiguo no es compatible. Guarda el archivo como .xlsx o .csv.",
    );
  }
  return parseCsv(buffer);
}
