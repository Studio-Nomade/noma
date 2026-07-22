"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/currency/format";
import {
  COBRANZA_MOMENTS,
  COBRANZA_MOMENT_LABELS,
  type CobranzaMoment,
} from "@/types/enums";
import { fillTemplate } from "./variables";
import { sendCobranza } from "./actions";
import type { ComposerClient } from "./queries";

type Template = {
  id: string;
  name: string;
  moment: CobranzaMoment;
  subject: string;
  body: string;
};

type Prefill = {
  clientId?: string;
  projectId?: string;
  invoiceId?: string;
  moment?: CobranzaMoment;
};

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function CobranzaComposer({
  clients,
  templates,
  studioName,
  senderName,
  senderEmail,
  prefill,
}: {
  clients: ComposerClient[];
  templates: Template[];
  studioName: string;
  senderName: string;
  senderEmail: string;
  prefill?: Prefill;
}) {
  const [clientId, setClientId] = useState(prefill?.clientId ?? "");
  const [projectId, setProjectId] = useState(prefill?.projectId ?? "");
  const [invoiceId, setInvoiceId] = useState(prefill?.invoiceId ?? "");
  const [moment, setMoment] = useState<CobranzaMoment>(
    prefill?.moment ?? "INICIO",
  );
  const [templateId, setTemplateId] = useState("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const client = useMemo(
    () => clients.find((c) => c.id === clientId) ?? null,
    [clients, clientId],
  );
  const project = useMemo(
    () => client?.projects.find((p) => p.id === projectId) ?? null,
    [client, projectId],
  );
  const invoice = useMemo(
    () => client?.invoices.find((i) => i.id === invoiceId) ?? null,
    [client, invoiceId],
  );
  const momentTemplates = templates.filter((t) => t.moment === moment);

  const vars = useMemo(() => {
    const now = new Date();
    return {
      cliente: client?.name ?? "",
      contacto: client?.contactName || client?.name || "",
      proyecto: project?.name ?? "",
      monto: invoice ? formatMoney(invoice.total, "CLP") : "",
      folio: invoice?.folio ?? "",
      mes: MESES[now.getMonth()],
      anio: String(now.getFullYear()),
      estudio: studioName,
      remitente: senderName,
    };
  }, [client, project, invoice, studioName, senderName]);

  // Al elegir cliente, precarga el correo destinatario.
  useEffect(() => {
    if (client?.email) setTo(client.email);
  }, [client]);

  // Cuando cambia el momento, elige la primera plantilla de ese momento.
  useEffect(() => {
    const first = templates.find((t) => t.moment === moment);
    setTemplateId(first?.id ?? "");
  }, [moment, templates]);

  // Aplica la plantilla (rellena asunto/cuerpo con variables) al cambiar
  // plantilla o el contexto (cliente/proyecto/factura).
  const tpl = templates.find((t) => t.id === templateId);
  useEffect(() => {
    if (!tpl) return;
    setSubject(fillTemplate(tpl.subject, vars));
    setBody(fillTemplate(tpl.body, vars));
  }, [tpl, vars]);

  function onSend() {
    startTransition(async () => {
      const res = await sendCobranza({
        clientId: clientId || undefined,
        projectId: projectId || undefined,
        invoiceId: invoiceId || undefined,
        templateId: templateId || undefined,
        moment,
        to,
        cc,
        subject,
        body,
      });
      if (res.ok) {
        if (res.data.status === "ENVIADO") {
          toast.success(`Correo enviado desde ${senderEmail}.`);
        } else {
          toast.warning(
            `Correo encolado (pendiente): ${res.data.reason ?? "sin remitente autorizado"}.`,
          );
        }
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="glass space-y-4 rounded-xl p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Labeled label="Cliente">
          <select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setProjectId("");
              setInvoiceId("");
            }}
            className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Selecciona un cliente…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Labeled>

        <Labeled label="Momento de cobranza">
          <select
            value={moment}
            onChange={(e) => setMoment(e.target.value as CobranzaMoment)}
            className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
          >
            {COBRANZA_MOMENTS.map((m) => (
              <option key={m} value={m}>
                {COBRANZA_MOMENT_LABELS[m]}
              </option>
            ))}
          </select>
        </Labeled>

        <Labeled label="Proyecto (opcional)">
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={!client}
            className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">—</option>
            {client?.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Labeled>

        <Labeled label="Factura (opcional)">
          <select
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
            disabled={!client}
            className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">—</option>
            {client?.invoices
              .filter((i) => !projectId || i.projectId === projectId)
              .map((i) => (
                <option key={i.id} value={i.id}>
                  #{i.folio ?? "s/folio"} · {formatMoney(i.total, "CLP")}
                </option>
              ))}
          </select>
        </Labeled>

        <Labeled label="Plantilla">
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
          >
            {momentTemplates.length === 0 && (
              <option value="">(sin plantillas para este momento)</option>
            )}
            {momentTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Labeled>

        <Labeled label={`Para (desde ${senderEmail})`}>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="cliente@empresa.cl"
            className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </Labeled>
      </div>

      <Labeled label="CC (opcional)">
        <input
          value={cc}
          onChange={(e) => setCc(e.target.value)}
          placeholder="copia@studionomade.cl"
          className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
        />
      </Labeled>

      <Labeled label="Asunto">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
        />
      </Labeled>

      <Labeled label="Mensaje">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
        />
      </Labeled>

      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-xs">
          Variables:{" "}
          {"{cliente} {contacto} {proyecto} {monto} {folio} {mes} {anio}"}
        </p>
        <button
          onClick={onSend}
          disabled={pending}
          className="bg-foreground text-background rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Enviando…" : "Enviar cobranza"}
        </button>
      </div>
    </div>
  );
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-muted-foreground mb-1 block text-xs">
        {label}
      </label>
      {children}
    </div>
  );
}
