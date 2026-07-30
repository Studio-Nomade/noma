"use client";

import { useActionState } from "react";
import { requestTimeOff } from "./portal-actions";

export function TimeOffForm() {
  const [state, action, pending] = useActionState(requestTimeOff, null);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <select
          name="type"
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="vacation">Vacaciones</option>
          <option value="permission">Permiso</option>
          <option value="medical_leave">Licencia</option>
        </select>
        <input
          name="startDate"
          type="date"
          required
          aria-label="Fecha de inicio"
          className="border-input h-9 rounded-md border px-3 text-sm"
        />
        <input
          name="endDate"
          type="date"
          required
          aria-label="Fecha de término"
          className="border-input h-9 rounded-md border px-3 text-sm"
        />
      </div>
      <textarea
        name="reason"
        rows={2}
        placeholder="Comentario opcional"
        className="border-input w-full rounded-md border px-3 py-2 text-sm"
      />
      {state && !state.ok && (
        <p className="text-sm text-[var(--status-red)]">{state.error}</p>
      )}
      {state?.ok && (
        <p className="text-sm text-[var(--status-green)]">
          Solicitud enviada a Personas.
        </p>
      )}
      <button
        disabled={pending}
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
      >
        {pending ? "Enviando…" : "Solicitar"}
      </button>
    </form>
  );
}
