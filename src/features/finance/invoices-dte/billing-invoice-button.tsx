"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createInvoiceForBillingItem } from "./actions";

export function BillingInvoiceButton({
  salesOrderId,
  billingItemId,
}: {
  salesOrderId: string;
  billingItemId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await createInvoiceForBillingItem(
            salesOrderId,
            billingItemId,
          );
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Factura preparada desde el hito");
          router.push(`/finanzas/ingresos/${result.data.id}`);
        })
      }
    >
      <ReceiptText className="size-4" />
      {pending ? "Creando…" : "Facturar"}
    </Button>
  );
}
