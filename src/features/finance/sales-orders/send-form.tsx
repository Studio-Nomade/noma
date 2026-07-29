"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sendSalesOrder } from "./actions";

export function SalesOrderSendForm({
  salesOrderId,
  folio,
  clientName,
  defaultEmail,
}: {
  salesOrderId: string;
  folio: string;
  clientName: string;
  defaultEmail: string;
}) {
  const [to, setTo] = useState(defaultEmail);
  const [subject, setSubject] = useState(
    `Nota de Venta ${folio} · Studio Nomade`,
  );
  const [body, setBody] = useState(
    `Hola ${clientName},\n\nAdjuntamos la nota de venta ${folio} con las condiciones acordadas y su esquema de facturación.`,
  );
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-3">
      <Input
        type="email"
        aria-label="Destinatario"
        placeholder="correo@cliente.cl"
        value={to}
        onChange={(event) => setTo(event.target.value)}
      />
      <Input
        aria-label="Asunto"
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
      />
      <Textarea
        aria-label="Mensaje"
        rows={5}
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      <Button
        disabled={pending || !to}
        onClick={() =>
          startTransition(async () => {
            const result = await sendSalesOrder(salesOrderId, {
              to: [to],
              cc: [],
              subject,
              body,
            });
            if (result.ok) toast.success("Nota de venta enviada");
            else toast.error(result.error);
          })
        }
      >
        <Send className="size-4" />
        {pending ? "Enviando…" : "Enviar con PDF"}
      </Button>
    </div>
  );
}
