"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Receipt, Save, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/currency/format";
import { INVOICE_STATUSES, type InvoiceStatus } from "@/types/enums";
import type { Invoice } from "@/db/schema";
import { consolidateInvoice, updateInvoice } from "./actions";

export function InvoiceManager({
  proposalId,
  invoice,
}: {
  proposalId: string;
  invoice: Invoice | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [folio, setFolio] = useState(invoice?.folio ?? "");
  const [nuboxId, setNuboxId] = useState(invoice?.nuboxId ?? "");
  const [pdfUrl, setPdfUrl] = useState(invoice?.pdfUrl ?? "");
  const [xmlUrl, setXmlUrl] = useState(invoice?.xmlUrl ?? "");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        if (ok) toast.success(ok);
        router.refresh();
      } else toast.error(res.error ?? "Error");
    });
  }

  if (!invoice) {
    return (
      <div>
        <p className="text-muted-foreground mb-3 text-sm">
          Consolida el anticipo del 50% para preparar la factura en Nubox.
        </p>
        <Button
          onClick={() => run(() => consolidateInvoice(proposalId, {}), "Factura consolidada")}
          disabled={pending}
        >
          <Receipt className="size-4" />
          Consolidar factura (50% inicial)
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <StatusBadge value={invoice.status} />
        <Button
          size="sm"
          variant="outline"
          onClick={() => run(() => consolidateInvoice(proposalId, {}), "Recalculado")}
          disabled={pending}
        >
          <RefreshCw className="size-4" />
          Recalcular 50%
        </Button>
      </div>

      <dl className="space-y-1 text-sm">
        <Row label="Neto" value={formatMoney(invoice.netAmount, "CLP")} />
        <Row label="IVA 19%" value={formatMoney(invoice.ivaAmount, "CLP")} />
        <Row label="Total" value={formatMoney(invoice.totalAmount, "CLP")} strong />
      </dl>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Folio</Label>
          <Input value={folio} onChange={(e) => setFolio(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>ID Nubox</Label>
          <Input value={nuboxId} onChange={(e) => setNuboxId(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Link PDF factura</Label>
          <Input value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div className="space-y-1.5">
          <Label>Link XML factura</Label>
          <Input value={xmlUrl} onChange={(e) => setXmlUrl(e.target.value)} placeholder="https://…" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={invoice.status}
          onValueChange={(v) =>
            v &&
            run(() => updateInvoice(invoice.id, proposalId, { status: v as InvoiceStatus }))
          }
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INVOICE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={() =>
            run(
              () => updateInvoice(invoice.id, proposalId, { folio, nuboxId, pdfUrl, xmlUrl }),
              "Factura actualizada",
            )
          }
          disabled={pending}
        >
          <Save className="size-4" />
          Guardar datos
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? "font-semibold" : "font-medium"}>{value}</dd>
    </div>
  );
}
