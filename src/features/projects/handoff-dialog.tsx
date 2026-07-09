"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { handoffToOperations } from "./handoff-action";

export function HandoffDialog({
  projectId,
  trigger,
}: {
  projectId: string;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [asanaUrl, setAsanaUrl] = useState("");
  const [cfoNotes, setCfoNotes] = useState("");

  async function submit() {
    setBusy(true);
    const res = await handoffToOperations(projectId, {
      asanaManualUrl: asanaUrl,
      cfoNotes,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Oportunidad traspasada a operación", {
        description: res.data.asanaConnected
          ? "Tarea creada en Asana y solicitud CFO registrada."
          : "Solicitud CFO registrada. Asana: agrega el link manualmente si aplica.",
      });
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Traspasar a operación</DialogTitle>
          <DialogDescription>
            Crea la tarea en Asana (si está configurado), registra la solicitud
            CFO y mueve la oportunidad a “Traspasado a operación”.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Link de Asana (opcional, si ya existe)</Label>
            <Input
              value={asanaUrl}
              onChange={(e) => setAsanaUrl(e.target.value)}
              placeholder="https://app.asana.com/…"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Notas para el CFO (opcional)</Label>
            <Textarea
              rows={3}
              value={cfoNotes}
              onChange={(e) => setCfoNotes(e.target.value)}
              placeholder="Condiciones de pago, anticipo, alertas de facturación…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Traspasando…" : "Traspasar a operación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
