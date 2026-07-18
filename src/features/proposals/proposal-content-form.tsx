"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { saveProposalContent } from "./actions";
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
}: {
  proposalId: string;
  initial: Partial<Record<FieldKey, string | null>>;
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

      <StructuredListEditor
        label="Etapas de trabajo"
        titlePlaceholder="Nombre de la etapa"
        descriptionPlaceholder="Breve descripción de la etapa"
        items={workStages}
        onChange={(items) => {
          setWorkStages(items);
          setDirty(true);
        }}
      />

      <StructuredListEditor
        label="Entregables"
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
