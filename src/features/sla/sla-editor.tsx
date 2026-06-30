"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Save, PenLine, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SLA_STATUSES, type SlaStatus } from "@/types/enums";
import type { Sla } from "@/db/schema";
import type { SlaParams } from "./generate";
import {
  generateSla,
  updateSlaSection,
  signSla,
  setSlaStatus,
} from "./actions";

export function SlaEditor({
  proposalId,
  sla,
}: {
  proposalId: string;
  sla: Sla | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [params, setParams] = useState<SlaParams>(sla?.params ?? {});
  const [signer, setSigner] = useState(sla?.signedByName ?? "Anna Sanhueza");

  function run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    ok?: string,
  ) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        if (ok) toast.success(ok);
        router.refresh();
      } else {
        toast.error(res.error ?? "Error");
      }
    });
  }

  // Sin SLA: pantalla de generación
  if (!sla) {
    return (
      <div className="space-y-4">
        <ParamsForm params={params} setParams={setParams} />
        <Button
          onClick={() =>
            run(() => generateSla(proposalId, params), "SLA generado")
          }
          disabled={pending}
        >
          <FileText className="size-4" />
          {pending ? "Generando…" : "Generar SLA"}
        </Button>
      </div>
    );
  }

  const signed = Boolean(sla.signedAt);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StatusBadge value={sla.status} />
          {signed && (
            <span className="text-muted-foreground text-xs">
              Firmado por {sla.signedByName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={sla.status}
            onValueChange={(v) =>
              v && run(() => setSlaStatus(sla.id, proposalId, v as SlaStatus))
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SLA_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <a
            href={`/proposals/${proposalId}/sla/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border hover:bg-accent inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium"
          >
            <FileText className="size-4" />
            PDF
          </a>
        </div>
      </div>

      {/* Parámetros + regenerar */}
      <div className="border-border rounded-xl border p-4">
        <ParamsForm params={params} setParams={setParams} />
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() =>
            run(() => generateSla(proposalId, params), "SLA regenerado")
          }
          disabled={pending}
        >
          <RefreshCw className="size-4" />
          Regenerar texto desde parámetros
        </Button>
        <p className="text-muted-foreground mt-2 text-xs">
          Regenerar reescribe las secciones con los parámetros (pierde ediciones
          manuales).
        </p>
      </div>

      {/* Secciones editables */}
      <div className="space-y-4">
        {(sla.sections ?? []).map((sec, i) => (
          <SectionEditor
            key={i}
            label={sec.label}
            body={sec.body}
            onSave={(body) =>
              run(
                () => updateSlaSection(sla.id, proposalId, i, body),
                "Sección guardada",
              )
            }
          />
        ))}
      </div>

      {/* Firma */}
      <div className="border-border bg-accent/40 rounded-xl border p-4">
        <Label>Firma electrónica (Representante Legal)</Label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input
            value={signer}
            onChange={(e) => setSigner(e.target.value)}
            className="w-60"
            disabled={signed}
          />
          <Button
            onClick={() =>
              run(() => signSla(sla.id, proposalId, signer), "SLA firmado")
            }
            disabled={pending || signed}
          >
            <PenLine className="size-4" />
            {signed ? "Firmado" : "Firmar"}
          </Button>
        </div>
        {signed && (
          <p className="text-muted-foreground mt-2 text-xs">
            Firmado el {new Date(sla.signedAt!).toLocaleString("es-CL")}.
          </p>
        )}
      </div>
    </div>
  );
}

function ParamsForm({
  params,
  setParams,
}: {
  params: SlaParams;
  setParams: (p: SlaParams) => void;
}) {
  const set = (patch: Partial<SlaParams>) => setParams({ ...params, ...patch });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Lugar de suscripción</Label>
        <Input
          value={params.lugar ?? ""}
          onChange={(e) => set({ lugar: e.target.value })}
          placeholder="Santiago"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Rondas de cambios</Label>
        <Input
          type="number"
          value={params.rondasCambios ?? ""}
          onChange={(e) =>
            set({ rondasCambios: Number(e.target.value) || undefined })
          }
          placeholder="2"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Plazo de aprobación (días)</Label>
        <Input
          type="number"
          value={params.plazoAprobacionDias ?? ""}
          onChange={(e) =>
            set({ plazoAprobacionDias: Number(e.target.value) || undefined })
          }
          placeholder="3"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Vigencia (meses)</Label>
        <Input
          type="number"
          value={params.vigenciaMeses ?? ""}
          onChange={(e) =>
            set({ vigenciaMeses: Number(e.target.value) || undefined })
          }
          placeholder="6"
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Condiciones de pago</Label>
        <Input
          value={params.condicionesPago ?? ""}
          onChange={(e) => set({ condicionesPago: e.target.value })}
          placeholder="50% al inicio y 50% contra entrega final."
        />
      </div>
    </div>
  );
}

function SectionEditor({
  label,
  body,
  onSave,
}: {
  label: string;
  body: string;
  onSave: (body: string) => void;
}) {
  const [value, setValue] = useState(body);
  const [dirty, setDirty] = useState(false);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-medium">{label}</p>
        {dirty && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onSave(value);
              setDirty(false);
            }}
          >
            <Save className="size-4" />
            Guardar
          </Button>
        )}
      </div>
      <Textarea
        rows={4}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setDirty(true);
        }}
      />
    </div>
  );
}
