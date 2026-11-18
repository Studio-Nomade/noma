"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setMeetingArchived } from "./meetings-actions";

/** «Ya procesada»: la reunión queda como historial y el ciclo no la toma. */
export function ArchiveMeetingButton({
  meetingId,
  archived,
}: {
  meetingId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      title={
        archived
          ? "Volver a procesarla en Noma (minuta y solicitudes)"
          : "Ya se procesó fuera de Noma: no generar minuta ni solicitudes"
      }
      onClick={() =>
        start(async () => {
          const r = await setMeetingArchived(meetingId, !archived);
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          toast.success(
            archived
              ? "La reunión vuelve al ciclo de Noma"
              : "Marcada como procesada fuera de Noma",
          );
          router.refresh();
        })
      }
    >
      {pending ? "…" : archived ? "Reabrir" : "Ya procesada"}
    </Button>
  );
}
