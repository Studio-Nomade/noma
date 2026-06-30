"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BRIEF_STATUSES, type Area, type BriefStatus } from "@/types/enums";
import type { Brief } from "@/db/schema";
import { BRIEF_FIELDS_BY_AREA } from "./fields";
import { saveBrief } from "./actions";

const GENERAL: { key: string; label: string; multiline?: boolean }[] = [
  { key: "mainObjective", label: "Objetivo principal", multiline: true },
  {
    key: "problem",
    label: "Problema o necesidad del cliente",
    multiline: true,
  },
  { key: "targetAudience", label: "Público objetivo", multiline: true },
  { key: "expectedOutcome", label: "¿Qué espera lograr?", multiline: true },
  { key: "idealDeadline", label: "Plazo ideal" },
  { key: "availableMaterials", label: "Material disponible", multiline: true },
  { key: "generalComments", label: "Comentarios generales", multiline: true },
];

export function BriefForm({
  projectId,
  area,
  brief,
}: {
  projectId: string;
  area: Area;
  brief: Brief | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<BriefStatus>(
    brief?.status ?? "Borrador",
  );

  const [general, setGeneral] = useState<Record<string, string>>(() => {
    const g: Record<string, string> = {};
    for (const f of GENERAL)
      g[f.key] = ((brief as Record<string, unknown>)?.[f.key] as string) ?? "";
    return g;
  });

  const areaFields = BRIEF_FIELDS_BY_AREA[area] ?? [];
  const [specific, setSpecific] = useState<Record<string, string>>(() => {
    const sf = (brief?.specificFields ?? {}) as Record<string, string>;
    const s: Record<string, string> = {};
    for (const f of areaFields) s[f.key] = sf[f.key] ?? "";
    return s;
  });

  async function save() {
    setSaving(true);
    const res = await saveBrief(projectId, {
      mainObjective: general.mainObjective,
      problem: general.problem,
      targetAudience: general.targetAudience,
      expectedOutcome: general.expectedOutcome,
      idealDeadline: general.idealDeadline,
      availableMaterials: general.availableMaterials,
      generalComments: general.generalComments,
      specificFields: specific,
      status,
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Brief guardado");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  function field(
    f: { key: string; label: string; multiline?: boolean },
    store: Record<string, string>,
    setStore: (v: Record<string, string>) => void,
  ) {
    return (
      <div key={f.key} className="space-y-1.5">
        <Label>{f.label}</Label>
        {f.multiline ? (
          <Textarea
            rows={2}
            value={store[f.key] ?? ""}
            onChange={(e) => setStore({ ...store, [f.key]: e.target.value })}
          />
        ) : (
          <Input
            value={store[f.key] ?? ""}
            onChange={(e) => setStore({ ...store, [f.key]: e.target.value })}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-muted-foreground">Estado</Label>
          <Select
            value={status}
            onValueChange={(v) => v && setStatus(v as BriefStatus)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BRIEF_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={save} disabled={saving}>
          <Save className="size-4" />
          {saving ? "Guardando…" : "Guardar brief"}
        </Button>
      </div>

      <div>
        <h2 className="font-heading mb-3 text-sm font-medium tracking-wide uppercase">
          Información general
        </h2>
        <div className="space-y-4">
          {GENERAL.map((f) => field(f, general, setGeneral))}
        </div>
      </div>

      {areaFields.length > 0 && (
        <div>
          <h2 className="font-heading mb-3 text-sm font-medium tracking-wide uppercase">
            Preguntas específicas · {area}
          </h2>
          <div className="space-y-4">
            {areaFields.map((f) => field(f, specific, setSpecific))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          <Save className="size-4" />
          {saving ? "Guardando…" : "Guardar brief"}
        </Button>
      </div>
    </div>
  );
}
