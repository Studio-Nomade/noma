"use client";

import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import {
  linkEmployeeToMember,
  reviewTimeOff,
  uploadEmployeeDocument,
} from "./portal-actions";

type EmployeeOption = { id: string; name: string };
type MemberOption = { id: string; name: string; email: string | null };

export function EmployeeIdentityLink({
  employeeId,
  members,
}: {
  employeeId: string;
  members: MemberOption[];
}) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label="Vincular usuario"
      defaultValue=""
      disabled={pending}
      className="border-input bg-background h-8 max-w-44 rounded-md border px-2 text-xs"
      onChange={(event) => {
        const memberId = event.target.value;
        if (!memberId) return;
        startTransition(async () => {
          const result = await linkEmployeeToMember(employeeId, memberId);
          if (result.ok) toast.success("Identidad vinculada.");
          else toast.error(result.error);
        });
      }}
    >
      <option value="">Vincular usuario…</option>
      {members.map((member) => (
        <option key={member.id} value={member.id}>
          {member.name} {member.email ? `· ${member.email}` : ""}
        </option>
      ))}
    </select>
  );
}

export function EmployeeDocumentUpload({
  employees,
  financeOnly = false,
}: {
  employees: EmployeeOption[];
  financeOnly?: boolean;
}) {
  const [state, action, pending] = useActionState(uploadEmployeeDocument, null);
  return (
    <form action={action} className="glass rounded-xl p-5">
      <h2 className="font-heading font-medium">Cargar al expediente</h2>
      <p className="text-muted-foreground mt-1 text-xs">
        PDF o imagen privada, máximo 10 MB.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <select
          name="employeeId"
          required
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="">Seleccionar colaborador</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>
        <select
          name="category"
          required
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          {!financeOnly && <option value="contract">Contrato</option>}
          {!financeOnly && <option value="annex">Anexo</option>}
          <option value="payroll">Liquidación</option>
          <option value="payment">Comprobante de pago</option>
          <option value="pension">Cotizaciones</option>
          {!financeOnly && (
            <option value="medical_leave">Licencia médica</option>
          )}
          {!financeOnly && <option value="vacation">Vacaciones</option>}
          {!financeOnly && <option value="certificate">Certificado</option>}
          {!financeOnly && <option value="other">Otro</option>}
        </select>
        <input
          name="title"
          required
          placeholder="Título del documento"
          className="border-input h-9 rounded-md border px-3 text-sm"
        />
        <input
          name="period"
          type="date"
          aria-label="Período o fecha"
          className="border-input h-9 rounded-md border px-3 text-sm"
        />
        <input
          name="file"
          type="file"
          required
          accept=".pdf,image/jpeg,image/png,image/webp"
          className="border-input file:bg-muted h-9 rounded-md border text-xs file:mr-3 file:h-full file:border-0 file:px-3"
        />
        <input
          name="notes"
          placeholder="Nota opcional"
          className="border-input h-9 rounded-md border px-3 text-sm"
        />
      </div>
      {state && !state.ok && (
        <p className="mt-3 text-sm text-[var(--status-red)]">{state.error}</p>
      )}
      {state?.ok && (
        <p className="mt-3 text-sm text-[var(--status-green)]">
          Documento cargado correctamente.
        </p>
      )}
      <button
        disabled={pending}
        className="bg-primary text-primary-foreground mt-4 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Cargando…" : "Cargar documento"}
      </button>
    </form>
  );
}

export function TimeOffReview({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  function decide(decision: "approved" | "rejected") {
    startTransition(async () => {
      const result = await reviewTimeOff(id, decision);
      if (result.ok) {
        toast.success(
          decision === "approved"
            ? "Solicitud aprobada."
            : "Solicitud rechazada.",
        );
      } else {
        toast.error(result.error);
      }
    });
  }
  return (
    <div className="flex gap-2">
      <button
        disabled={pending}
        onClick={() => decide("approved")}
        className="bg-primary text-primary-foreground rounded-md px-2.5 py-1.5 text-xs"
      >
        Aprobar
      </button>
      <button
        disabled={pending}
        onClick={() => decide("rejected")}
        className="border-input rounded-md border px-2.5 py-1.5 text-xs"
      >
        Rechazar
      </button>
    </div>
  );
}
