"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { deleteClient } from "./actions";

/** Palabra que hay que escribir para confirmar. */
const CONFIRM_WORD = "BORRAR";

export function DeleteClientDialog({
  id,
  name,
  trigger,
}: {
  id: string;
  name: string;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);

  const confirmed = word.trim().toUpperCase() === CONFIRM_WORD;

  async function run() {
    if (!confirmed) return;
    setBusy(true);
    const res = await deleteClient(id);
    setBusy(false);
    if (res.ok) {
      toast.success(`"${name}" fue eliminado`);
      setOpen(false);
      setWord("");
      router.refresh();
    } else {
      // Puede fallar por proyectos/facturas asociados: el motivo es accionable.
      toast.error(res.error);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setWord("");
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Borrar cliente</DialogTitle>
          <DialogDescription>
            Vas a eliminar <strong className="text-foreground">{name}</strong> y
            sus contactos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
            style={{
              color: "var(--status-red)",
              background: "var(--status-red-bg)",
            }}
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Esta acción es <strong>irreversible</strong>. No se puede deshacer.
            </span>
          </div>

          <div className="grid gap-1.5">
            <Label>
              Escribe <strong>{CONFIRM_WORD}</strong> para confirmar
            </Label>
            <Input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder={CONFIRM_WORD}
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === "Enter" && confirmed) run();
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            onClick={run}
            disabled={!confirmed || busy}
            style={
              confirmed && !busy
                ? { background: "var(--status-red)", color: "white" }
                : undefined
            }
          >
            {busy ? "Borrando…" : "Borrar definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
