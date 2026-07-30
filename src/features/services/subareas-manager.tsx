"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Service, ServiceSubarea } from "@/db/schema";
import { AREAS, AREA_LABELS, type Area } from "@/types/enums";
import {
  createServiceSubarea,
  deleteServiceSubarea,
  updateServiceSubarea,
} from "./catalog-actions";

type EditDraft = {
  id?: string;
  area: Area;
  name: string;
  description: string;
};

export function SubareasManager({
  subareas,
  services,
  canEdit,
}: {
  subareas: ServiceSubarea[];
  services: Service[];
  canEdit: boolean;
}) {
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [deleting, setDeleting] = useState<ServiceSubarea | null>(null);
  const [moveToId, setMoveToId] = useState("");
  const [pending, startTransition] = useTransition();

  function save() {
    if (!draft) return;
    startTransition(async () => {
      const result = draft.id
        ? await updateServiceSubarea(draft.id, draft)
        : await createServiceSubarea(draft);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(draft.id ? "Subárea actualizada" : "Subárea creada");
      setDraft(null);
    });
  }

  function remove() {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteServiceSubarea({
        id: deleting.id,
        moveToId: moveToId || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Subárea eliminada y servicios reasignados");
      setDeleting(null);
      setMoveToId("");
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold">
            Mantenedor de subáreas
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Organiza el catálogo sin perder servicios. Al eliminar una subárea
            ocupada, Noma exige reasignar su contenido.
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() =>
              setDraft({
                area: "B&D",
                name: "",
                description: "",
              })
            }
          >
            <Plus className="size-4" />
            Nueva subárea
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {AREAS.map((area) => {
          const items = subareas.filter((item) => item.area === area);
          if (items.length === 0 && !canEdit) return null;
          return (
            <section key={area} className="glass rounded-xl p-4">
              <h3 className="text-sm font-semibold">
                {area} · {AREA_LABELS[area]}
              </h3>
              <div className="mt-4 space-y-2">
                {items.length === 0 && (
                  <p className="text-muted-foreground py-3 text-sm">
                    Sin subáreas configuradas.
                  </p>
                )}
                {items.map((item) => {
                  const count = services.filter(
                    (service) =>
                      service.area === item.area &&
                      service.subarea === item.name,
                  ).length;
                  return (
                    <div
                      key={item.id}
                      className="border-border flex items-start justify-between gap-3 rounded-lg border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {count} {count === 1 ? "servicio" : "servicios"}
                        </p>
                        {item.description && (
                          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                            {item.description}
                          </p>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Editar ${item.name}`}
                            onClick={() =>
                              setDraft({
                                id: item.id,
                                area: item.area,
                                name: item.name,
                                description: item.description ?? "",
                              })
                            }
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Eliminar ${item.name}`}
                            onClick={() => setDeleting(item)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <Dialog open={Boolean(draft)} onOpenChange={() => setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? "Editar subárea" : "Nueva subárea"}
            </DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Área</Label>
                <Select
                  value={draft.area}
                  onValueChange={(value) =>
                    setDraft({ ...draft, area: value as Area })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AREAS.map((area) => (
                      <SelectItem key={area} value={area}>
                        {area} · {AREA_LABELS[area]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={draft.description}
                  onChange={(event) =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button
              disabled={pending || !draft?.name.trim()}
              onClick={save}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleting)}
        onOpenChange={() => {
          setDeleting(null);
          setMoveToId("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar subárea</DialogTitle>
          </DialogHeader>
          {deleting && (
            <div className="space-y-4">
              <p className="text-sm">
                Vas a eliminar <strong>{deleting.name}</strong>. Los servicios
                nunca se eliminan.
              </p>
              {services.some(
                (service) =>
                  service.area === deleting.area &&
                  service.subarea === deleting.name,
              ) && (
                <div className="space-y-2">
                  <Label>Mover servicios a</Label>
                  <Select
                    value={moveToId}
                    onValueChange={(value) => setMoveToId(value ?? "")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona una subárea" />
                    </SelectTrigger>
                    <SelectContent>
                      {subareas
                        .filter(
                          (item) =>
                            item.area === deleting.area &&
                            item.id !== deleting.id,
                        )
                        .map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={pending} onClick={remove}>
              Eliminar y reasignar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
