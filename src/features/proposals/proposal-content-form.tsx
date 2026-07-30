"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { saveProposalContent, updateMonthlyFeeCondition } from "./actions";
import {
  parseStructuredContent,
  serializeStructuredContent,
  type StructuredContentItem,
} from "./structured-content";

type FieldKey =
  | "title"
  | "context"
  | "mainObjective"
  | "scope"
  | "workStages"
  | "deliverables"
  | "exclusions"
  | "commercialConditions"
  | "nextAction";

const FIELDS: {
  key: FieldKey;
  label: string;
  multiline: boolean;
  placeholder?: string;
}[] = [
  { key: "title", label: "Título", multiline: false },
  { key: "context", label: "Contexto", multiline: true },
  { key: "mainObjective", label: "Objetivo general", multiline: true },
  { key: "scope", label: "Alcance", multiline: true },
  { key: "exclusions", label: "Exclusiones", multiline: true },
  {
    key: "commercialConditions",
    label: "Condiciones comerciales",
    multiline: true,
  },
  {
    key: "nextAction",
    label: "Próxima acción",
    multiline: false,
    placeholder: "Ej: Enviar al cliente · seguimiento en 3 días",
  },
];

export function ProposalContentForm({
  proposalId,
  initial,
  includeMonthlyFeeCondition,
  serviceNames,
}: {
  proposalId: string;
  initial: Partial<Record<FieldKey, string | null>>;
  includeMonthlyFeeCondition: boolean;
  serviceNames: string[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<FieldKey, string>>(() => {
    const v = {} as Record<FieldKey, string>;
    for (const f of FIELDS) v[f.key] = initial[f.key] ?? "";
    return v;
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [workStages, setWorkStages] = useState<StructuredContentItem[]>(() =>
    parseStructuredContent(initial.workStages, "stages"),
  );
  const [deliverables, setDeliverables] = useState<StructuredContentItem[]>(
    () => parseStructuredContent(initial.deliverables, "deliverables"),
  );
  const [monthlyFee, setMonthlyFee] = useState(includeMonthlyFeeCondition);

  function set(key: FieldKey, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    const res = await saveProposalContent(proposalId, {
      ...values,
      workStages: serializeStructuredContent(workStages),
      deliverables: serializeStructuredContent(deliverables),
    });
    setSaving(false);
    if (res.ok) {
      setDirty(false);
      toast.success("Propuesta guardada");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function setFeeCondition(enabled: boolean) {
    setMonthlyFee(enabled);
    const res = await updateMonthlyFeeCondition(proposalId, enabled);
    if (res.ok) {
      toast.success(
        enabled
          ? "Se incluirá la condición para fee mensual"
          : "Condición de fee mensual removida",
      );
      router.refresh();
    } else {
      setMonthlyFee(!enabled);
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-medium">
          Contenido de la propuesta
        </h2>
        <Button size="sm" onClick={save} disabled={saving || !dirty}>
          <Save className="size-4" />
          {saving ? "Guardando…" : dirty ? "Guardar" : "Guardado"}
        </Button>
      </div>

      {FIELDS.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label htmlFor={f.key}>{f.label}</Label>
          {f.multiline ? (
            <Textarea
              id={f.key}
              rows={3}
              value={values[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => set(f.key, e.target.value)}
            />
          ) : (
            <Input
              id={f.key}
              value={values[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => set(f.key, e.target.value)}
            />
          )}
        </div>
      ))}

      <div className="border-border flex items-start gap-3 rounded-lg border p-4">
        <Checkbox
          id="monthly-fee"
          checked={monthlyFee}
          onCheckedChange={(checked) => setFeeCondition(checked === true)}
        />
        <div>
          <Label htmlFor="monthly-fee">
            Cliente o solicitud con fee mensual
          </Label>
          <p className="text-muted-foreground mt-1 text-xs">
            Agrega al PDF una lámina que explica que se cobra solo el recargo de
            prioridad cuando el servicio base ya está cubierto por el fee.
          </p>
        </div>
      </div>

      <StructuredListEditor
        label="Etapas generales del proyecto"
        titlePlaceholder="Nombre de la etapa"
        descriptionPlaceholder="Breve descripción de la etapa"
        items={workStages}
        onChange={(items) => {
          setWorkStages(items);
          setDirty(true);
        }}
      />
      {serviceNames.length > 1 && workStages.length === 0 && (
        <div className="border-border bg-muted/30 rounded-lg border p-3">
          <p className="text-sm font-medium">Propuesta con varios servicios</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Puedes crear una base ordenada por hitos a partir de los servicios y
            editarla libremente.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => {
              setWorkStages(
                serviceNames.map((name, index) => ({
                  title: `Hito ${index + 1}`,
                  description: name,
                })),
              );
              setDirty(true);
            }}
          >
            <Plus className="size-4" />
            Crear etapas desde servicios
          </Button>
        </div>
      )}

      <StructuredListEditor
        label="Entregables generales del proyecto"
        titlePlaceholder="Entregable"
        descriptionPlaceholder="Detalle opcional"
        items={deliverables}
        onChange={(items) => {
          setDeliverables(items);
          setDirty(true);
        }}
      />

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || !dirty}>
          <Save className="size-4" />
          {saving ? "Guardando…" : "Guardar propuesta"}
        </Button>
      </div>
    </div>
  );
}

function StructuredListEditor({
  label,
  titlePlaceholder,
  descriptionPlaceholder,
  items,
  onChange,
}: {
  label: string;
  titlePlaceholder: string;
  descriptionPlaceholder: string;
  items: StructuredContentItem[];
  onChange: (items: StructuredContentItem[]) => void;
}) {
  function update(index: number, patch: Partial<StructuredContentItem>) {
    onChange(
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {items.map((item, index) => (
        <div
          key={index}
          className="border-border grid gap-2 rounded-lg border p-3 sm:grid-cols-[.8fr_1.2fr_auto]"
        >
          <Input
            value={item.title}
            placeholder={titlePlaceholder}
            onChange={(event) => update(index, { title: event.target.value })}
          />
          <Input
            value={item.description}
            placeholder={descriptionPlaceholder}
            onChange={(event) =>
              update(index, { description: event.target.value })
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Quitar ${label.toLocaleLowerCase("es-CL")}`}
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange([...items, { title: "", description: "" }])}
      >
        <Plus className="size-4" />
        Agregar {label.toLocaleLowerCase("es-CL").replace(/s$/, "")}
      </Button>
    </div>
  );
}
