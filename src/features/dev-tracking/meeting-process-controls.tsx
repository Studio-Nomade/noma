"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { linkTranscript, processMeetingNow } from "./meetings-actions";

const STATUS_TEXT: Record<string, string> = {
  resumida: "Minuta generada",
  transcrita: "Transcripción vinculada",
  sin_transcripcion:
    "Todavía no aparece la transcripción en el Drive de operaciones",
  candidatos: "Hay varios documentos posibles; vincula el correcto",
  sin_ia: "Claude no está configurado (ANTHROPIC_API_KEY)",
  dry_run: "Simulación",
  error: "No se pudo procesar",
};

export function MeetingProcessControls({
  meetingId,
  status,
  compact,
}: {
  meetingId: string;
  status: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showLink, setShowLink] = useState(false);
  const [url, setUrl] = useState("");
  const canProcess = ["realizada", "transcrita", "resumida"].includes(status);

  function process() {
    start(async () => {
      const r = await processMeetingNow(meetingId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const text = STATUS_TEXT[r.data.status] ?? r.data.status;
      const detail = r.data.detail ? `: ${r.data.detail}` : "";
      if (r.data.status === "resumida") {
        toast.success(
          `${text} · ${r.data.requests ?? 0} solicitudes propuestas`,
        );
      } else if (r.data.status === "error") {
        toast.error(`${text}${detail}`);
      } else {
        toast.message(`${text}${detail}`);
      }
      router.refresh();
    });
  }

  function link() {
    start(async () => {
      const r = await linkTranscript({ meetingId, driveUrlOrId: url });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Transcripción vinculada");
      setShowLink(false);
      setUrl("");
      router.refresh();
    });
  }

  if (!canProcess) return null;
  return (
    <div
      className={
        compact
          ? "flex items-center gap-1"
          : "flex flex-wrap items-center gap-2"
      }
    >
      <Button
        variant={compact ? "ghost" : "outline"}
        size="sm"
        disabled={pending}
        onClick={process}
      >
        {pending
          ? "Procesando…"
          : status === "resumida"
            ? "Regenerar minuta"
            : "Procesar ahora"}
      </Button>
      {!showLink ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setShowLink(true)}
        >
          Vincular transcripción
        </Button>
      ) : (
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            link();
          }}
        >
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enlace del doc de Gemini en Drive"
            className="h-8 w-64 text-xs"
          />
          <Button type="submit" size="sm" disabled={pending || url.length < 10}>
            Vincular
          </Button>
        </form>
      )}
    </div>
  );
}
