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

/** Toma el valor de una columna según el mapeo, tolerando espacios/mayúsculas. */
function pick(
  row: Record<string, string>,
  mapping: ColumnMapping,
  field: string,
): string {
  const col = mapping[field];
  if (!col) return "";
  if (row[col] !== undefined) return row[col];
  // fallback case-insensitive
  const key = Object.keys(row).find(
    (k) => k.toLowerCase() === col.toLowerCase(),
  );
  return key ? row[key] : "";
}

function detectDocType(
  tipoDoc: string,
  direction: DocumentDirection,
): FinDocumentType {
  const t = tipoDoc.toLowerCase();
  if (/61|nota.*cr|cr[eé]dito/.test(t)) return "NOTA_CREDITO";
  if (/56|nota.*d[eé]|d[eé]bito/.test(t)) return "NOTA_DEBITO";
  if (/\b39\b|\b41\b|boleta/.test(t)) return "BOLETA";
  if (/honorario|48/.test(t)) return "BOLETA_HONORARIOS";
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
    const folio = pick(row, mapping, "folio").trim();
    const fechaEmision = parseFlexibleDate(pick(row, mapping, "fechaEmision"));

    if (!folio) {
      rejected.push({ rowIndex, reason: "Sin folio" });
      return;
    }
    if (!fechaEmision) {
      rejected.push({
        rowIndex,
        reason: "Fecha de emisión inválida o ausente",
      });
      return;
    }

    const tipoDoc = pick(row, mapping, "tipoDoc").trim();
    const type = detectDocType(tipoDoc, direction);
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
