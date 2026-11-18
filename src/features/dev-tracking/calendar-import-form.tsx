"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { importCalendarMeetings } from "./meetings-actions";

/**
 * Trae al programa las reuniones de Calendar cuyo título empieza con el
 * prefijo (basta con que la casilla de operaciones esté invitada).
 */
export function CalendarImportForm({
  programId,
  prefix,
  mailbox,
}: {
  programId: string;
  prefix: string | null;
  mailbox: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(prefix ?? "");
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      const r = await importCalendarMeetings({ programId, prefix: value });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const { found, created, transcripts } = r.data;
      toast.success(
        created
          ? `${created} reunión(es) nuevas desde Calendar${transcripts ? ` · ${transcripts} con notas de Gemini` : ""}`
          : found
            ? `Calendar al día (${found} reuniones ya vinculadas)${transcripts ? ` · ${transcripts} notas nuevas` : ""}`
            : `No hay reuniones en Calendar que empiecen con «${value}»`,
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <p className="text-muted-foreground text-xs">
          Reuniones de Calendar que empiezan con
          {mailbox ? ` (con ${mailbox} invitada)` : ""}
        </p>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="WD - AppsCinco"
          className="h-8 w-60"
          aria-label="Prefijo del título en Calendar"
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={pending || value.trim().length < 3}
        onClick={run}
      >
        <CalendarSearch className="size-4" />
        {pending ? "Buscando…" : "Traer de Calendar"}
      </Button>
    </div>
  );
}
