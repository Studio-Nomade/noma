import type {
  FinDocumentType,
  DocumentDirection,
  BankTxnType,
} from "@/types/enums";
import { parseChileanNumber, parseFlexibleDate, normalizeRut } from "./format";
import type {
  ColumnMapping,
  ParsedDocument,
  ParsedTransaction,
  RejectedRow,
} from "./types";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Nombres de columna alternativos por campo. Nubox exporta con encabezados
 * distintos según el reporte ("Registro de Ventas" → "Fecha Docto", "Tipo Doc";
 * "Todos los documentos" → "Fecha", "Documento"). Los alias permiten importar
 * ambos sin que el usuario re-mapee.
 */
const FIELD_ALIASES: Record<string, string[]> = {
  tipoDoc: ["tipo doc", "documento", "tipo documento", "tipo dte"],
  folio: ["folio", "nro", "numero", "n documento"],
  rutContacto: ["rut cliente", "rut proveedor", "rut", "rut receptor"],
  nombreContacto: ["razon social", "cliente", "proveedor", "nombre"],
  fechaEmision: ["fecha docto", "fecha", "fecha emision", "fecha documento"],
  fechaVencimiento: ["fecha vencimiento", "vencimiento"],
  exento: ["monto exento"],
  neto: ["monto neto", "neto"],
  iva: ["monto iva", "monto iva recuperable", "iva"],
  total: ["monto total", "total"],
};

/**
 * Toma el valor de una columna: primero el mapeo explícito (case/acento
 * insensible) y, si esa columna no está en el archivo, prueba los alias del
 * campo. Así funcionan los distintos formatos de export de Nubox.
 */
function pick(
  row: Record<string, string>,
  mapping: ColumnMapping,
  field: string,
): string {
  const keys = Object.keys(row);
  const findBy = (target: string) => {
    const t = norm(target);
    const k = keys.find((x) => norm(x) === t);
    return k ? row[k] : undefined;
  };

  const col = mapping[field];
  if (col) {
    const v = findBy(col);
    if (v !== undefined && v !== "") return v;
  }
  for (const alias of FIELD_ALIASES[field] ?? []) {
    const v = findBy(alias);
    if (v !== undefined && v !== "") return v;
  }
  return "";
}

function detectDocType(
  tipoDoc: string,
  direction: DocumentDirection,
): FinDocumentType {
  const t = tipoDoc.toLowerCase();
  // Reconoce los códigos cortos de Nubox (N/C-EL, BOL-VO…) además del texto
  // largo y los códigos SII. Sin esto, la exportación de Nubox clasifica las
  // notas de crédito y boletas como facturas.
  if (/\bn\/?c\b|61|nota.*cr|cr[eé]dito/.test(t)) return "NOTA_CREDITO";
  if (/\bn\/?d\b|56|nota.*d[eé]|d[eé]bito/.test(t)) return "NOTA_DEBITO";
  if (/honorario|48/.test(t)) return "BOLETA_HONORARIOS";
  if (/\bbol\b|\b39\b|\b41\b|boleta/.test(t)) return "BOLETA";
  return direction === "VENTA" ? "FACTURA_VENTA" : "FACTURA_COMPRA";
}

export function mapDocuments(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  direction: DocumentDirection,
): { valid: ParsedDocument[]; rejected: RejectedRow[]; warnings: string[] } {
  const valid: ParsedDocument[] = [];
  const rejected: RejectedRow[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  rows.forEach((row, i) => {
    const rowIndex = i + 2; // fila 1 = encabezados
    let folio = pick(row, mapping, "folio").trim();
    const fechaEmision = parseFlexibleDate(pick(row, mapping, "fechaEmision"));
    const tipoDoc = pick(row, mapping, "tipoDoc").trim();
    const type = detectDocType(tipoDoc, direction);

    if (!fechaEmision) {
      rejected.push({
        rowIndex,
        reason: "Fecha de emisión inválida o ausente",
      });
      return;
    }
    // Los resúmenes de boletas de Nubox (Integración SII) vienen sin folio:
    // se genera uno sintético por fecha para no perder el ingreso en reportes.
    if (!folio) {
      if (type === "BOLETA") {
        folio = `BOL-${fechaEmision.toISOString().slice(0, 10)}`;
      } else {
        rejected.push({ rowIndex, reason: "Sin folio" });
        return;
      }
    }

    const rut = normalizeRut(pick(row, mapping, "rutContacto"));
    const nombre = pick(row, mapping, "nombreContacto").trim() || "Sin nombre";

    let neto = parseChileanNumber(pick(row, mapping, "neto"));
    const iva = parseChileanNumber(pick(row, mapping, "iva"));
    const exento = parseChileanNumber(pick(row, mapping, "exento"));
    let total = parseChileanNumber(pick(row, mapping, "total"));

    if (total === 0 && (neto !== 0 || iva !== 0 || exento !== 0)) {
      total = neto + iva + exento;
    }
    if (neto === 0 && total !== 0 && (iva !== 0 || exento !== 0)) {
      neto = total - iva - exento;
    }

    // Notas de crédito restan: monto negativo
    const sign = type === "NOTA_CREDITO" ? -1 : 1;

    const dupKey = `${type}|${folio}|${rut}`;
    const isDuplicate = seen.has(dupKey);
    seen.add(dupKey);

    const fechaVenc = parseFlexibleDate(pick(row, mapping, "fechaVencimiento"));

    valid.push({
      rowIndex,
      tipoDoc,
      type,
      folio,
      rut,
      nombre,
      fechaEmision: fechaEmision.toISOString(),
      fechaVencimiento: fechaVenc ? fechaVenc.toISOString() : null,
      neto: Math.round(neto) * sign,
      iva: Math.round(iva) * sign,
      exento: Math.round(exento) * sign,
      total: Math.round(total) * sign,
      isDuplicate,
    });
  });

  if (valid.length && valid.every((d) => d.total === 0)) {
    warnings.push(
      "Todos los montos quedaron en $0. Revisa el mapeo de las columnas de montos.",
    );
  }

  return { valid, rejected, warnings };
}

export function mapTransactions(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
): { valid: ParsedTransaction[]; rejected: RejectedRow[]; warnings: string[] } {
  const valid: ParsedTransaction[] = [];
  const rejected: RejectedRow[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  const hasMontoUnico = Boolean(mapping.monto);

  rows.forEach((row, i) => {
    const rowIndex = i + 2;
    const fecha = parseFlexibleDate(pick(row, mapping, "fecha"));
    if (!fecha) {
      rejected.push({ rowIndex, reason: "Fecha inválida o ausente" });
      return;
    }

    const glosa = pick(row, mapping, "glosa").trim() || "(sin glosa)";
    let monto = 0;
    let tipo: BankTxnType;

    if (hasMontoUnico) {
      const m = parseChileanNumber(pick(row, mapping, "monto"));
      tipo = m >= 0 ? "ABONO" : "CARGO";
      monto = Math.abs(m);
    } else {
      const cargo = Math.abs(parseChileanNumber(pick(row, mapping, "cargo")));
      const abono = Math.abs(parseChileanNumber(pick(row, mapping, "abono")));
      if (abono > 0) {
        tipo = "ABONO";
        monto = abono;
      } else if (cargo > 0) {
        tipo = "CARGO";
        monto = cargo;
      } else {
        rejected.push({ rowIndex, reason: "Sin monto (cargo/abono en 0)" });
        return;
      }
    }

    const saldoRaw = pick(row, mapping, "saldo");
    const saldo = saldoRaw ? parseChileanNumber(saldoRaw) : null;

    const dupKey = `${fecha.toISOString()}|${tipo}|${Math.round(monto)}|${glosa}`;
    const isDuplicate = seen.has(dupKey);
    seen.add(dupKey);

    valid.push({
      rowIndex,
      fecha: fecha.toISOString(),
      glosa,
      monto: Math.round(monto),
      tipo,
      saldo: saldo !== null ? Math.round(saldo) : null,
      isDuplicate,
    });
  });

  if (valid.length === 0 && rejected.length > 0) {
    warnings.push("No se reconoció ninguna fila. Revisa el mapeo de columnas.");
  }

  return { valid, rejected, warnings };
}
