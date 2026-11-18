"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addLogEntry } from "./actions";

export function LogForm({
  programId,
  modules,
}: {
  programId: string;
  modules: { id: string; code: string }[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();

  function onSubmit(formData: FormData) {
    start(async () => {
      const result = await addLogEntry({
        programId,
        moduleId: String(formData.get("moduleId") ?? ""),
        text: String(formData.get("text") ?? ""),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      formRef.current?.reset();
      toast.success("Anotado en la bitácora");
      router.refresh();
    });
  }

  return (
    <form ref={formRef} action={onSubmit} className="space-y-3">
      <Textarea
        name="text"
        rows={2}
        required
        minLength={3}
        placeholder="Qué pasó hoy (acuerdo, decisión, bloqueo…)"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          name="moduleId"
          defaultValue=""
          className="border-input bg-background h-8 rounded-md border px-2 text-sm"
          aria-label="Módulo"
        >
          <option value="">Sin módulo</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.code}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : "Anotar"}
        </Button>
      </div>
    </form>
  );
}
