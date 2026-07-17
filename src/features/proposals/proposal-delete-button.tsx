"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteProposal } from "./actions";

export function ProposalDeleteButton({
  id,
  redirectTo,
  compact = false,
}: {
  id: string;
  redirectTo?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (
      !window.confirm(
        "¿Eliminar esta propuesta? Esta acción no se puede deshacer.",
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteProposal(id);
      if (res.ok) {
        toast.success("Propuesta eliminada");
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="text-muted-foreground hover:text-destructive"
        aria-label="Eliminar propuesta"
      >
        <Trash2 className="size-4" />
      </button>
    );
  }

  return (
    <Button variant="outline" onClick={handleDelete} disabled={pending}>
      <Trash2 className="size-4" />
      {pending ? "Eliminando…" : "Eliminar"}
    </Button>
  );
}
