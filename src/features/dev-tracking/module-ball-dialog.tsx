"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateModuleBall } from "./actions";

export function ModuleBallDialog({
  module,
}: {
  module: {
    id: string;
    code: string;
    name: string;
    ballOwner: string | null;
    ballWhat: string | null;
    nextFollowUp: string | null;
    progress: number;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function onSubmit(formData: FormData) {
    start(async () => {
      const result = await updateModuleBall({
        moduleId: module.id,
        ballOwner: String(formData.get("ballOwner") ?? ""),
        ballWhat: String(formData.get("ballWhat") ?? ""),
        nextFollowUp: String(formData.get("nextFollowUp") ?? ""),
        progress: Number(formData.get("progress") ?? module.progress),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Seguimiento actualizado");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" aria-label="Editar seguimiento">
            <Pencil className="size-3.5" />
            Editar
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {module.code} · {module.name}
          </DialogTitle>
          <DialogDescription>
            Quién tiene la pelota, qué se espera y cuándo se revisa.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ballOwner">La pelota está en</Label>
              <Input
                id="ballOwner"
                name="ballOwner"
                defaultValue={module.ballOwner ?? ""}
                placeholder="Persona o área"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nextFollowUp">Próximo seguimiento</Label>
              <Input
                id="nextFollowUp"
                name="nextFollowUp"
                type="date"
                defaultValue={module.nextFollowUp ?? ""}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ballWhat">Qué se espera</Label>
            <Textarea
              id="ballWhat"
              name="ballWhat"
              rows={3}
              defaultValue={module.ballWhat ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="progress">Avance (%)</Label>
            <Input
              id="progress"
              name="progress"
              type="number"
              min={0}
              max={100}
              defaultValue={module.progress}
              className="w-28"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
