"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setEmailStudioProjectStatus } from "./project-actions";
import type { EmailStudioProjectStatus } from "./project-schema";

export function EmailStudioProjectStatusButton({
  id,
  status,
  compact = false,
}: {
  id: string;
  status: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const archived = status === "archived";
  const nextStatus: EmailStudioProjectStatus = archived ? "active" : "archived";

  function handleClick() {
    startTransition(async () => {
      const result = await setEmailStudioProjectStatus(id, nextStatus);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(archived ? "Proyecto restaurado" : "Proyecto archivado");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? "icon-sm" : "sm"}
      onClick={handleClick}
      disabled={pending}
      aria-label={archived ? "Restaurar proyecto" : "Archivar proyecto"}
      title={archived ? "Restaurar proyecto" : "Archivar proyecto"}
    >
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : archived ? (
        <ArchiveRestore />
      ) : (
        <Archive />
      )}
      {!compact && (archived ? "Restaurar" : "Archivar")}
    </Button>
  );
}
