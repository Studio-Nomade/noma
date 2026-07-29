"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { attachInvoiceDte } from "./actions";

export function DteUploadForm({ invoiceId }: { invoiceId: string }) {
  const [state, action, pending] = useActionState(attachInvoiceDte, null);
  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success("Archivos DTE adjuntados");
    else toast.error(state.error);
  }, [state]);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <label className="border-border hover:bg-accent/40 flex cursor-pointer flex-col items-center rounded-lg border border-dashed p-5 text-center">
        <UploadCloud className="text-muted-foreground mb-2 size-5" />
        <span className="text-sm font-medium">Adjuntar PDF y/o XML</span>
        <span className="text-muted-foreground text-xs">
          El XML completa folio, fechas y montos
        </span>
        <input
          name="files"
          type="file"
          accept=".pdf,.xml,application/pdf,application/xml,text/xml"
          multiple
          className="sr-only"
        />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Subiendo…" : "Guardar archivos"}
      </Button>
    </form>
  );
}
