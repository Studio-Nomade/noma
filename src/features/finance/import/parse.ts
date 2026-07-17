import Papa from "papaparse";
import ExcelJS from "exceljs";

export interface ParsedTable {
  headers: string[];
  rows: Record<string, string>[];
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
  const ws = wb.worksheets[0];
  if (!ws) return { headers: [], rows: [] };

  const headers: string[] = [];
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell, col) => {
    headers[col - 1] = String(cell.value ?? "").trim();
  });

  const rows: Record<string, string>[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, string> = {};
    let hasValue = false;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const key = headers[col - 1];
      if (!key) return;
      const val = cell.value;
      const str = val === null || val === undefined ? "" : String(val);
      obj[key] = str.trim();
      if (str.trim() !== "") hasValue = true;
    });
    if (hasValue) rows.push(obj);
  });

  return { headers: headers.filter(Boolean), rows };
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
