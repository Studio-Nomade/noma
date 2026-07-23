"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { toast } from "sonner";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mapHeaders, templateCsv, type RawRow } from "./import";
import { importClients, type ImportSummary } from "./import-actions";

type Parsed = {
  rows: RawRow[];
  fileName: string;
  recognized: string[];
  ignored: string[];
};

export function BulkImportDialog({ trigger }: { trigger: React.ReactElement }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  function reset() {
    setParsed(null);
    setSummary(null);
    setDragging(false);
  }

  function downloadTemplate() {
    // BOM para que Excel respete los acentos al abrir el CSV.
    const blob = new Blob(["﻿" + templateCsv()], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-clientes-noma.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(file: File) {
    if (!/\.(csv|txt)$/i.test(file.name)) {
      toast.error("El archivo debe ser un CSV.");
      return;
    }
    setSummary(null);
    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      // Chipax/Excel exportan con ";" y Google Sheets con ",": autodetecta.
      delimitersToGuess: [";", ",", "\t", "|"],
      complete: (res) => {
        const rows = (res.data as RawRow[]).filter((r) =>
          Object.values(r).some((v) => (v ?? "").trim()),
        );
        if (!rows.length) {
          toast.error("El CSV no tiene filas con datos.");
          return;
        }
        const { map, ignored } = mapHeaders(Object.keys(rows[0]));
        setParsed({
          rows,
          fileName: file.name,
          recognized: Object.keys(map),
          ignored,
        });
      },
      error: () => toast.error("No se pudo leer el archivo."),
    });
  }

  async function run() {
    if (!parsed) return;
    setBusy(true);
    const res = await importClients(parsed.rows);
    setBusy(false);
    if (res.ok) {
      setSummary(res.data);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const noName =
    parsed && !parsed.recognized.length
      ? "No se reconoció ninguna columna."
      : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Carga masiva de clientes</DialogTitle>
          <DialogDescription>
            Arrastra un CSV con tus clientes. Se actualizan los que ya existan
            (según su RUT) y se crean los nuevos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* ── Resultado ── */}
          {summary ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg bg-[var(--status-emerald-bg)] px-4 py-3 text-sm text-[var(--status-emerald)]">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>
                  <strong>{summary.creados}</strong> creados ·{" "}
                  <strong>{summary.actualizados}</strong> actualizados
                </span>
              </div>

              {summary.ignoradas.length > 0 && (
                <p className="text-muted-foreground text-xs">
                  Columnas ignoradas: {summary.ignoradas.join(", ")}
                </p>
              )}

              {summary.errores.length > 0 && (
                <div className="border-border rounded-lg border p-3">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--status-amber)]">
                    <AlertTriangle className="size-3.5" />
                    {summary.errores.length}{" "}
                    {summary.errores.length === 1
                      ? "fila con problema"
                      : "filas con problemas"}
                  </p>
                  <ul className="text-muted-foreground max-h-32 space-y-0.5 overflow-y-auto text-xs">
                    {summary.errores.map((e) => (
                      <li key={e.fila}>
                        Fila {e.fila}: {e.motivo}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : parsed ? (
            /* ── Preview ── */
            <div className="space-y-3">
              <div className="border-border flex items-center justify-between gap-2 rounded-lg border p-3">
                <div className="flex min-w-0 items-center gap-2">
                  <FileSpreadsheet className="text-muted-foreground size-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {parsed.fileName}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {parsed.rows.length}{" "}
                      {parsed.rows.length === 1 ? "fila" : "filas"} ·{" "}
                      {parsed.recognized.length} columnas reconocidas
                    </p>
                  </div>
                </div>
                <button
                  onClick={reset}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  aria-label="Quitar archivo"
                >
                  <X className="size-4" />
                </button>
              </div>

              {parsed.ignored.length > 0 && (
                <p className="text-muted-foreground text-xs">
                  <span className="text-[var(--status-amber)]">
                    Se ignorarán:
                  </span>{" "}
                  {parsed.ignored.join(", ")}
                </p>
              )}
              {noName && (
                <p className="text-xs text-[var(--status-red)]">{noName}</p>
              )}

              <div className="border-border overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      {parsed.recognized.slice(0, 5).map((h) => (
                        <th
                          key={h}
                          className="px-2.5 py-1.5 text-left font-medium"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 3).map((r, i) => (
                      <tr key={i} className="border-border border-t">
                        {parsed.recognized.slice(0, 5).map((h) => (
                          <td
                            key={h}
                            className="text-muted-foreground max-w-[9rem] truncate px-2.5 py-1.5"
                          >
                            {r[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.rows.length > 3 && (
                <p className="text-muted-foreground text-xs">
                  Vista previa de las primeras 3 filas.
                </p>
              )}
            </div>
          ) : (
            /* ── Dropzone ── */
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
                dragging
                  ? "border-foreground bg-accent"
                  : "border-border hover:border-foreground/40 hover:bg-accent/40",
              )}
            >
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
              <UploadCloud className="text-muted-foreground size-7" />
              <p className="text-sm font-medium">
                Arrastra el CSV aquí o haz clic para elegirlo
              </p>
              <p className="text-muted-foreground text-xs">
                Acepta separador «;» o «,» · máx. 2.000 filas
              </p>
            </label>
          )}

          <button
            onClick={downloadTemplate}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium"
          >
            <Download className="size-3.5" />
            Descargar plantilla CSV
          </button>
        </div>

        <DialogFooter>
          {summary ? (
            <Button onClick={() => setOpen(false)}>Listo</Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Cancelar
              </Button>
              <Button onClick={run} disabled={!parsed || busy || !!noName}>
                {busy
                  ? "Importando…"
                  : parsed
                    ? `Importar ${parsed.rows.length} clientes`
                    : "Importar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
