"use client";

import { useActionState, useRef } from "react";
import { createEmployee } from "./employee-actions";
import { AREAS, AREA_LABELS } from "@/types/enums";

export function EmployeeForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    async (previous: Awaited<ReturnType<typeof createEmployee>> | null, data: FormData) => {
      const result = await createEmployee(previous, data);
      if (result.ok) formRef.current?.reset();
      return result;
    },
    null,
  );
  return (
    <form
      ref={formRef}
      action={action}
      className="glass grid gap-3 rounded-xl p-5 md:grid-cols-2"
    >
      <h2 className="font-heading md:col-span-2 font-medium">
        Agregar empleado
      </h2>
      <Field name="name" label="Nombre completo" required />
      <Field name="rut" label="RUT" placeholder="12.345.678-9" required />
      <Field name="roleTitle" label="Cargo" required />
      <label className="text-sm">
        <span className="text-muted-foreground mb-1 block text-xs">Área</span>
        <select
          name="area"
          className="border-border bg-background w-full rounded-md border px-3 py-2"
        >
          <option value="">Sin área</option>
          {AREAS.map((area) => (
            <option key={area} value={area}>
              {AREA_LABELS[area]}
            </option>
          ))}
        </select>
      </label>
      <Field
        name="baseSalaryAmount"
        label="Sueldo base"
        type="number"
        min="1"
        step="1"
        required
      />
      <label className="text-sm">
        <span className="text-muted-foreground mb-1 block text-xs">Moneda</span>
        <select
          name="baseSalaryCurrency"
          defaultValue="CLP"
          className="border-border bg-background w-full rounded-md border px-3 py-2"
        >
          <option value="CLP">CLP</option>
          <option value="UF">UF</option>
          <option value="USD">USD</option>
        </select>
      </label>
      {state && !state.ok && (
        <p className="text-sm text-[var(--status-red)] md:col-span-2">
          {state.error}
        </p>
      )}
      <div className="flex justify-end md:col-span-2">
        <button
          disabled={pending}
          className="bg-foreground text-background rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Crear empleado"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="text-sm">
      <span className="text-muted-foreground mb-1 block text-xs">{label}</span>
      <input
        {...props}
        className="border-border w-full rounded-md border px-3 py-2"
      />
    </label>
  );
}
