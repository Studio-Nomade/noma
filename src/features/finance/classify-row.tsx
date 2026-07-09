"use client";

import { useRef, useTransition } from "react";
import { classifyDocument } from "./documents-actions";

type Opt = { id: string; code: string; name: string };

/**
 * Fila de clasificación: 3 selects (cuenta / centro de costo / línea) que
 * guardan al presionar "Guardar" (o al cambiar la cuenta contable, que es lo
 * mínimo requerido para que el documento salga de la bandeja).
 */
export function ClassifyRow({
  docId,
  ledgers,
  centers,
  lines,
}: {
  docId: string;
  ledgers: Opt[];
  centers: Opt[];
  lines: Opt[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      await classifyDocument(formData);
    });
  }

  return (
    <form ref={formRef} action={submit} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={docId} />
      <select
        name="ledgerAccountId"
        required
        className="border-border bg-background rounded-md border px-2 py-1 text-xs"
        defaultValue=""
      >
        <option value="" disabled>
          Cuenta contable…
        </option>
        {ledgers.map((o) => (
          <option key={o.id} value={o.id}>
            {o.code} · {o.name}
          </option>
        ))}
      </select>
      <select
        name="businessLineId"
        className="border-border bg-background rounded-md border px-2 py-1 text-xs"
        defaultValue=""
      >
        <option value="">Línea…</option>
        {lines.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <select
        name="costCenterId"
        className="border-border bg-background rounded-md border px-2 py-1 text-xs"
        defaultValue=""
      >
        <option value="">Centro de costo…</option>
        {centers.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="bg-foreground text-background rounded-md px-3 py-1 text-xs disabled:opacity-50"
      >
        {pending ? "…" : "Guardar"}
      </button>
    </form>
  );
}
