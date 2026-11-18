"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setProgramSlackWebhook } from "./meetings-actions";

export type ProgramSlackStatus = {
  /** Variable del programa (lo editable aquí). */
  own: string | null;
  /** Variable efectiva y de dónde sale. */
  effective: string | null;
  source: "programa" | "canal de correo" | "operativo";
  defined: boolean;
};

/**
 * Canal de Slack donde caen los avisos del programa (minutas, paquetes). Se
 * guarda el nombre de la variable de entorno con el webhook, nunca la URL.
 */
export function SlackChannelForm({
  programId,
  status,
}: {
  programId: string;
  status: ProgramSlackStatus;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status.own ?? "");
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const r = await setProgramSlackWebhook({ programId, env: value });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        !value.trim()
          ? "Los avisos vuelven al canal operativo general"
          : r.data.defined
            ? "Canal de Slack guardado"
            : "Guardado, pero la variable aún no existe en Vercel: mientras tanto se usa el canal operativo",
      );
      router.refresh();
    });
  }

  const hint =
    status.source === "operativo"
      ? "Hoy los avisos salen por el canal operativo general."
      : status.defined
        ? `Avisos por ${status.effective} (${status.source}).`
        : `${status.effective} no está definida en el servidor: se usa el canal operativo.`;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <p className="text-muted-foreground text-xs">
          Avisos en Slack (variable del webhook) · {hint}
        </p>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="SLACK_APPSCINCO_WEBHOOK_URL"
          className="h-8 w-72 font-mono text-xs"
          aria-label="Variable del webhook de Slack"
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={pending || value.trim() === (status.own ?? "")}
        onClick={save}
      >
        <Hash className="size-4" />
        {pending ? "Guardando…" : "Guardar canal"}
      </Button>
    </div>
  );
}
