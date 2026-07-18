"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  UploadCloud,
  FileText,
  FileCode2,
  CheckCircle2,
  AlertTriangle,
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
import type { DocumentDirection } from "@/types/enums";
import { bulkUploadFiles, type BulkFileResult } from "./bulk-file-actions";

type Kind = "pdf" | "xml";

function Dropzone({
  kind,
  files,
  onAdd,
  onClear,
}: {
  kind: Kind;
  files: File[];
  onAdd: (fs: File[]) => void;
  onClear: () => void;
}) {
  const [drag, setDrag] = useState(false);
  const Icon = kind === "pdf" ? FileText : FileCode2;
  const ext = kind === "pdf" ? ".pdf" : ".xml";

  function filter(list: FileList | null): File[] {
    return [...(list ?? [])].filter((f) =>
      f.name.toLowerCase().endsWith(ext),
    );
  }

  return (
    <div className="flex-1">
      <p className="mb-1.5 text-xs font-medium tracking-wide uppercase">
        {kind.toUpperCase()}
      </p>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          onAdd(filter(e.dataTransfer.files));
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
          drag
            ? "border-foreground bg-accent"
            : "border-border hover:border-foreground/40 hover:bg-accent/40",
        )}
      >
        <input
          type="file"
          accept={ext}
          multiple
          className="sr-only"
          onChange={(e) => {
            onAdd(filter(e.target.files));
            e.target.value = "";
          }}
        />
        <Icon className="text-muted-foreground size-6" />
        <p className="text-xs font-medium">
          Arrastra los {kind.toUpperCase()} aquí
        </p>
        <p className="text-muted-foreground text-[11px]">o haz clic</p>
      </label>

      {files.length > 0 && (
        <div className="mt-2">
          <div className="text-muted-foreground mb-1 flex items-center justify-between text-[11px]">
            <span>
              {files.length} {files.length === 1 ? "archivo" : "archivos"}
            </span>
            <button onClick={onClear} className="hover:text-foreground">
              Quitar todos
            </button>
          </div>
          <ul className="max-h-24 space-y-0.5 overflow-y-auto text-[11px]">
            {files.slice(0, 30).map((f, i) => (
              <li key={i} className="text-muted-foreground truncate">
                {f.name}
              </li>
            ))}
            {files.length > 30 && (
              <li className="text-muted-foreground/70">
                +{files.length - 30} más…
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export function BulkFilesDialog({
  direction,
  trigger,
}: {
  direction: DocumentDirection;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pdfs, setPdfs] = useState<File[]>([]);
  const [xmls, setXmls] = useState<File[]>([]);
  const [result, setResult] = useState<BulkFileResult | null>(null);

  const total = pdfs.length + xmls.length;

  function reset() {
    setPdfs([]);
    setXmls([]);
    setResult(null);
  }

  async function run() {
    setBusy(true);
    const fd = new FormData();
    fd.set("direction", direction);
    for (const f of [...pdfs, ...xmls]) fd.append("files", f);
    const res = await bulkUploadFiles(fd);
    setBusy(false);
    if (res.ok) {
      setResult(res.data);
      setPdfs([]);
      setXmls([]);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cargar PDF y XML masivamente</DialogTitle>
          <DialogDescription>
            Arrastra los archivos. Cada uno se enlaza por el folio del nombre,
            con el formato <strong>TIPO_FOLIO_RUT</strong> (ej.
            “FAC-EL_450_76160170-9.pdf”, “FAC-EE_699_….xml”).
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 rounded-lg bg-[var(--status-emerald-bg)] px-4 py-3 text-sm text-[var(--status-emerald)]">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>
                <strong>{result.attached}</strong> archivos adjuntados a{" "}
                <strong>{result.matchedFolios.length}</strong> documentos
              </span>
            </div>
            {result.unmatched.length > 0 && (
              <div className="border-border rounded-lg border p-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--status-amber)]">
                  <AlertTriangle className="size-3.5" />
                  {result.unmatched.length} sin enlazar
                </p>
                <ul className="text-muted-foreground max-h-40 space-y-0.5 overflow-y-auto text-xs">
                  {result.unmatched.map((u, i) => (
                    <li key={i}>
                      <span className="text-foreground">{u.file}</span> —{" "}
                      {u.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.extracted > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-[var(--status-blue-bg)] px-4 py-3 text-sm text-[var(--status-blue)]">
                <FileCode2 className="size-4 shrink-0" />
                <span>
                  Detalle extraído de <strong>{result.extracted}</strong>{" "}
                  {result.extracted === 1 ? "XML" : "XML"} — líneas y clasificación
                  sugerida (línea de negocio / servicio).
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2 sm:flex-row">
            <Dropzone
              kind="pdf"
              files={pdfs}
              onAdd={(fs) => setPdfs((p) => [...p, ...fs])}
              onClear={() => setPdfs([])}
            />
            <Dropzone
              kind="xml"
              files={xmls}
              onAdd={(fs) => setXmls((p) => [...p, ...fs])}
              onClear={() => setXmls([])}
            />
          </div>
        )}

        <DialogFooter>
          {result ? (
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
              <Button onClick={run} disabled={busy || total === 0}>
                <UploadCloud className="size-4" />
                {busy ? "Cargando…" : `Cargar ${total || ""} archivos`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
