"use client";

import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  MobileDetailsCard,
  MobileField,
} from "@/components/shared/mobile-details-card";
import {
  SortButton,
  type SortDirection,
} from "@/components/shared/sort-button";
import { formatMoney } from "@/lib/currency/format";
import { markDocumentPaid, anularDocument } from "./documents-actions";
import { DocumentFilesCell } from "./document-files-cell";
import { formatDate, toNum } from "./helpers";
import type { FinanceDocumentListItem } from "./queries";

const TYPE_LABELS: Record<string, string> = {
  FACTURA_VENTA: "Factura",
  FACTURA_COMPRA: "Factura",
  NOTA_CREDITO: "N. Crédito",
  NOTA_DEBITO: "N. Débito",
  BOLETA: "Boleta",
  BOLETA_HONORARIOS: "B. Honorarios",
};

type DocumentSortKey =
  | "type"
  | "folio"
  | "contactName"
  | "fechaEmision"
  | "fechaVencimiento"
  | "neto"
  | "total"
  | "status";

const NUMERIC_KEYS = new Set<DocumentSortKey>(["neto", "total"]);

export function DocumentsTable({
  rows,
  contactLabel,
}: {
  rows: FinanceDocumentListItem[];
  contactLabel: string;
}) {
  const [sortKey, setSortKey] = useState<DocumentSortKey>("fechaEmision");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const comparison = NUMERIC_KEYS.has(sortKey)
          ? toNum(a[sortKey]) - toNum(b[sortKey])
          : String(a[sortKey] ?? "").localeCompare(
              String(b[sortKey] ?? ""),
              "es",
              { numeric: true, sensitivity: "base" },
            );
        return sortDirection === "asc" ? comparison : -comparison;
      }),
    [rows, sortDirection, sortKey],
  );

  function sortBy(key: DocumentSortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  const headers: Array<{
    key: DocumentSortKey;
    label: string;
    align?: "left" | "right";
  }> = [
    { key: "type", label: "Tipo" },
    { key: "folio", label: "Folio" },
    { key: "contactName", label: contactLabel },
    { key: "fechaEmision", label: "Emisión" },
    { key: "fechaVencimiento", label: "Vence" },
    { key: "neto", label: "Neto", align: "right" },
    { key: "total", label: "Total", align: "right" },
    { key: "status", label: "Estado" },
  ];

  return (
    <>
      <div className="space-y-2 md:hidden">
        {sortedRows.map((document) => {
          const openable =
            document.status === "EMITIDA" ||
            document.status === "PARCIAL" ||
            document.status === "VENCIDA";
          return (
            <MobileDetailsCard
              key={document.id}
              title={`${TYPE_LABELS[document.type] ?? document.type} · ${document.folio}`}
              subtitle={document.contactName ?? "Sin contacto"}
              badge={<StatusBadge value={document.status} size="xs" />}
              actions={
                <>
                  <DocumentFilesCell
                    documentId={document.id}
                    hasPdf={!!document.pdfPath}
                    hasXml={!!document.xmlPath}
                  />
                  {openable && (
                    <>
                      <form action={markDocumentPaid}>
                        <input type="hidden" name="id" value={document.id} />
                        <button
                          type="submit"
                          className="min-h-10 px-2 text-xs text-[var(--status-emerald)]"
                        >
                          Marcar pagado
                        </button>
                      </form>
                      <form action={anularDocument}>
                        <input type="hidden" name="id" value={document.id} />
                        <button
                          type="submit"
                          className="text-muted-foreground min-h-10 px-2 text-xs hover:text-[var(--status-red)]"
                        >
                          Anular
                        </button>
                      </form>
                    </>
                  )}
                </>
              }
            >
              <dl className="space-y-2">
                <MobileField label="RUT">
                  {document.contactRut ?? "—"}
                </MobileField>
                <MobileField label="Emisión">
                  {formatDate(document.fechaEmision)}
                </MobileField>
                <MobileField label="Vencimiento">
                  {formatDate(document.fechaVencimiento)}
                </MobileField>
                <MobileField label="Neto">
                  {formatMoney(toNum(document.neto), "CLP")}
                </MobileField>
                <MobileField label="Total">
                  <span className="font-medium">
                    {formatMoney(toNum(document.total), "CLP")}
                  </span>
                </MobileField>
              </dl>
            </MobileDetailsCard>
          );
        })}
      </div>
      <div className="glass-solid hidden overflow-hidden rounded-xl md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-border border-b text-left text-xs">
              {headers.map((header) => (
                <th key={header.key} className="px-4 py-3">
                  <SortButton
                    label={header.label}
                    active={sortKey === header.key}
                    direction={sortDirection}
                    onClick={() => sortBy(header.key)}
                    align={header.align}
                  />
                </th>
              ))}
              <th className="px-4 py-3 text-right">Archivos</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((document) => {
              const openable =
                document.status === "EMITIDA" ||
                document.status === "PARCIAL" ||
                document.status === "VENCIDA";
              return (
                <tr key={document.id} className="border-border/60 border-b">
                  <td className="px-4 py-3">
                    {TYPE_LABELS[document.type] ?? document.type}
                  </td>
                  <td className="px-4 py-3 font-medium">{document.folio}</td>
                  <td className="px-4 py-3">
                    <span className="block max-w-[200px] truncate">
                      {document.contactName ?? "—"}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {document.contactRut ?? ""}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {formatDate(document.fechaEmision)}
                  </td>
                  <td className="px-4 py-3">
                    {formatDate(document.fechaVencimiento)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatMoney(toNum(document.neto), "CLP")}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatMoney(toNum(document.total), "CLP")}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={document.status} />
                  </td>
                  <td className="px-4 py-3">
                    <DocumentFilesCell
                      documentId={document.id}
                      hasPdf={!!document.pdfPath}
                      hasXml={!!document.xmlPath}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {openable && (
                      <div className="flex justify-end gap-3">
                        <form action={markDocumentPaid}>
                          <input type="hidden" name="id" value={document.id} />
                          <button
                            type="submit"
                            className="text-xs text-[var(--status-emerald)] hover:underline"
                          >
                            Marcar pagado
                          </button>
                        </form>
                        <form action={anularDocument}>
                          <input type="hidden" name="id" value={document.id} />
                          <button
                            type="submit"
                            className="text-muted-foreground text-xs hover:text-[var(--status-red)]"
                          >
                            Anular
                          </button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
