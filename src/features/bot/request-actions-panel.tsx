"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { closeRequest, updateRequestScope } from "./request-actions";

export function RequestActionsPanel({
  requestId,
  scopeClass,
  status,
  asanaUrl,
}: {
  requestId: string;
  scopeClass: string;
  status: string;
  asanaUrl: string | null;
}) {
  const [scope, setScope] = useState(scopeClass);
  const [pending, startTransition] = useTransition();

  function saveScope(value: string) {
    setScope(value);
    startTransition(async () => {
      const result = await updateRequestScope(requestId, value);
      if (result.ok) toast.success("Clasificación actualizada.");
      else toast.error(result.error);
    });
  }

  function close() {
    startTransition(async () => {
      const result = await closeRequest(requestId);
      if (result.ok) toast.success("Solicitud cerrada.");
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-52 space-y-1.5">
        <Label htmlFor="request-scope">Clasificación de alcance</Label>
        <select
          id="request-scope"
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          value={scope}
          disabled={pending}
          onChange={(event) => saveScope(event.target.value)}
        >
          <option value="in_scope">Dentro de alcance</option>
          <option value="additional">Adicional</option>
          <option value="unknown">Por revisar</option>
        </select>
      </div>
      {status !== "closed" && (
        <Button variant="outline" disabled={pending} onClick={close}>
          <CheckCircle2 />
          Marcar cerrada
        </Button>
      )}
      {asanaUrl && (
        <a
          href={asanaUrl}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants()}
        >
          <ExternalLink />
          Abrir en Asana
        </a>
      )}
    </div>
  );
}
