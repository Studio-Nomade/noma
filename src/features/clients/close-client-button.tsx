"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { closeClient } from "./actions";

export function CloseClientButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClose() {
    if (
      !window.confirm(
        "¿Marcar este cliente como Cerrado? No se elimina, solo cambia su estado.",
      )
    )
      return;
    startTransition(async () => {
      const result = await closeClient(id);
      if (result.ok) {
        toast.success("Cliente marcado como Cerrado");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button variant="outline" onClick={handleClose} disabled={pending}>
      {pending ? "Cerrando…" : "Cerrar cliente"}
    </Button>
  );
}
