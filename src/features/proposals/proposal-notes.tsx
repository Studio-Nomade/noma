"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ProposalNote } from "@/db/schema";
import { addProposalNote } from "./actions";

function when(d: Date) {
  return new Date(d).toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProposalNotes({
  rootId,
  notes,
}: {
  rootId: string;
  notes: ProposalNote[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    if (!body.trim()) return;
    startTransition(async () => {
      const res = await addProposalNote(rootId, body);
      if (res.ok) {
        setBody("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div>
      <h2 className="font-heading mb-3 text-sm font-medium">Seguimiento</h2>
      <div className="space-y-2">
        <Textarea
          rows={2}
          value={body}
          placeholder="Comentario, feedback del cliente, ajuste de valor…"
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={add} disabled={pending || !body.trim()}>
            <Send className="size-4" />
            {pending ? "Guardando…" : "Comentar"}
          </Button>
        </div>
      </div>

      {notes.length > 0 && (
        <ul className="mt-4 space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="border-border border-l-2 pl-3">
              <p className="text-sm whitespace-pre-wrap">{n.body}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {n.authorEmail ?? "—"} · {when(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
