"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSignature } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AREA_LABELS, type Area } from "@/types/enums";
import { createProposalFromBrief } from "./from-brief-action";

export type ServiceOption = {
  id: string;
  name: string;
  area: Area;
};

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);
}

/** Pre-selecciona servicios del catálogo que coinciden con los sugeridos por IA. */
function preselect(suggested: string[], services: ServiceOption[]): Set<string> {
  const sugTokens = suggested.map(tokenize);
  const ids = new Set<string>();
  for (const svc of services) {
    const svcTokens = tokenize(svc.name);
    const hit = sugTokens.some(
      (st) => st.length && st.some((t) => svcTokens.includes(t)),
    );
    if (hit) ids.add(svc.id);
  }
  return ids;
}

export function CreateFromBriefDialog({
  projectId,
  projectName,
  suggestedNames,
  services,
  trigger,
}: {
  projectId: string;
  projectName: string;
  suggestedNames: string[];
  services: ServiceOption[];
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState(`Propuesta · ${projectName}`);
  const initial = useMemo(
    () => preselect(suggestedNames, services),
    [suggestedNames, services],
  );
  const [selected, setSelected] = useState<Set<string>>(initial);

  const byArea = useMemo(() => {
    const map = new Map<Area, ServiceOption[]>();
    for (const s of services) {
      if (!map.has(s.area)) map.set(s.area, []);
      map.get(s.area)!.push(s);
    }
    return [...map.entries()];
  }, [services]);

  function toggle(id: string) {
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function create() {
    setCreating(true);
    const res = await createProposalFromBrief(projectId, {
      title,
      serviceIds: [...selected],
    });
    setCreating(false);
    if (res.ok) {
      toast.success("Propuesta creada desde el brief");
      setOpen(false);
      router.push(`/proposals/${res.data.id}`);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crear propuesta desde el brief</DialogTitle>
          <DialogDescription>
            Se heredan contexto, objetivo, alcance y observaciones del brief
            aprobado. Ajusta el título y confirma los servicios a incluir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid gap-1.5">
            <Label>Título de la propuesta</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {suggestedNames.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1.5 text-xs font-medium uppercase">
                Servicios sugeridos por IA
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestedNames.map((s) => (
                  <span
                    key={s}
                    className="bg-muted rounded-full px-2 py-0.5 text-xs"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium uppercase">
              Servicios del catálogo ({selected.size} seleccionados)
            </p>
            <div className="space-y-4">
              {byArea.map(([area, list]) => (
                <div key={area}>
                  <p className="mb-1.5 text-xs font-semibold">
                    {AREA_LABELS[area]}
                  </p>
                  <div className="grid gap-1.5">
                    {list.map((svc) => (
                      <label
                        key={svc.id}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={selected.has(svc.id)}
                          onCheckedChange={() => toggle(svc.id)}
                        />
                        {svc.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {services.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No hay servicios del catálogo en las áreas del brief.
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={creating}
          >
            Cancelar
          </Button>
          <Button onClick={create} disabled={creating || selected.size === 0}>
            <FileSignature className="size-4" />
            {creating ? "Creando…" : "Crear propuesta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
