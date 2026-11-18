"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelDevMeeting } from "./meetings-actions";

export function CancelMeetingButton({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await cancelDevMeeting(meetingId);
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          toast.success(
            r.data.calendarCancelled
              ? "Reunión cancelada y evento eliminado de Calendar"
              : `Reunión cancelada en Noma${r.data.reason ? ` (Calendar: ${r.data.reason})` : ""}`,
          );
          router.refresh();
        })
      }
    >
      {pending ? "Cancelando…" : "Cancelar"}
    </Button>
  );
}
