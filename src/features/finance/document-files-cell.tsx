"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText, FileCode2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDocumentFileUrl, type FileKind } from "./file-actions";

/**
 * Botón de descarga por fila. Solo descarga: la subida vive en la carga masiva
 * de arriba de la tabla. Si el archivo no está en la BD, el botón se muestra
 * desactivado y translúcido (no clickeable).
 */
function DownloadButton({
  documentId,
  kind,
  present,
}: {
  documentId: string;
  kind: FileKind;
  present: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const Icon = kind === "pdf" ? FileText : FileCode2;

  async function download() {
    setBusy(true);
    const res = await getDocumentFileUrl(documentId, kind);
    setBusy(false);
    if (res.ok) window.open(res.data.url, "_blank");
    else toast.error(res.error);
  }

  if (!present) {
    return (
      <span
        aria-disabled="true"
        title={`${kind.toUpperCase()} no cargado`}
        className="border-border/60 text-muted-foreground/40 pointer-events-none inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-dashed px-1.5 py-1 text-[10px] font-medium opacity-60"
      >
        <Icon className="size-3" />
        {kind.toUpperCase()}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={download}
      title={`Descargar ${kind.toUpperCase()}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-medium transition-colors disabled:opacity-50",
        "border-[var(--status-emerald)]/40 text-[var(--status-emerald)] hover:bg-[var(--status-emerald-bg)]",
      )}
    >
      <Icon className="size-3" />
      {kind.toUpperCase()}
    </button>
  );
}

export function DocumentFilesCell({
  documentId,
  hasPdf,
  hasXml,
}: {
  documentId: string;
  hasPdf: boolean;
  hasXml: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <DownloadButton documentId={documentId} kind="pdf" present={hasPdf} />
      <DownloadButton documentId={documentId} kind="xml" present={hasXml} />
    </div>
  );
}
