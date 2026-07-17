"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteEmailTemplate } from "./template-actions";

export function TemplateDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("¿Eliminar esta plantilla?")) return;
        startTransition(async () => {
          const res = await deleteEmailTemplate(id);
          if (res.ok) router.refresh();
          else toast.error(res.error);
        });
      }}
      className="text-muted-foreground hover:text-destructive"
      aria-label="Eliminar plantilla"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
