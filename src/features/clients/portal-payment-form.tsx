"use client";

import { useActionState } from "react";
import { CircleCheck, WalletCards } from "lucide-react";
import { reportPortalPayment } from "./portal-payment-actions";

export function PortalPaymentForm({
  token,
  kind,
  entityId,
  amount,
  reported,
}: {
  token: string;
  kind: "invoice" | "sales-order";
  entityId: string;
  amount: number;
  reported: boolean;
}) {
  const [state, action, pending] = useActionState(reportPortalPayment, null);
  if (reported || state?.ok) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--status-emerald)]">
        <CircleCheck className="size-3.5" /> Pago informado
      </span>
    );
  }
  return (
    <details className="relative">
      <summary className="hover:bg-accent inline-flex cursor-pointer list-none items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium">
        <WalletCards className="size-3.5" /> Informar pago
      </summary>
      <form
        action={action}
        className="bg-background border-border absolute right-0 z-20 mt-2 w-72 space-y-3 rounded-xl border p-4 text-left shadow-lg"
      >
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="entityId" value={entityId} />
        <label className="block text-xs">
          <span className="text-muted-foreground mb-1 block">Monto pagado</span>
          <input
            name="amount"
            type="number"
            min="1"
            step="1"
            defaultValue={Math.round(amount)}
            required
            className="border-border w-full rounded-md border px-2 py-1.5"
          />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground mb-1 block">Fecha de pago</span>
          <input
            name="paidAt"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
            className="border-border w-full rounded-md border px-2 py-1.5"
          />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground mb-1 block">
            Referencia (opcional)
          </span>
          <input
            name="reference"
            maxLength={160}
            placeholder="Transferencia, banco o comprobante"
            className="border-border w-full rounded-md border px-2 py-1.5"
          />
        </label>
        {state && !state.ok && (
          <p className="text-xs text-[var(--status-red)]">{state.error}</p>
        )}
        <button
          disabled={pending}
          className="bg-foreground text-background w-full rounded-md px-3 py-2 text-xs font-medium disabled:opacity-50"
        >
          {pending ? "Enviando…" : "Notificar a Finanzas"}
        </button>
        <p className="text-muted-foreground text-[10px]">
          El saldo se actualiza cuando Finanzas valida y concilia el pago.
        </p>
      </form>
    </details>
  );
}
