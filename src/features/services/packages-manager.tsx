"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Boxes, Plus, Sparkles, Trash2 } from "lucide-react";
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
import { StatusBadge } from "@/components/shared/status-badge";
import type { ServiceStatus } from "@/types/enums";
import type {
  ServicePackageWithItems,
  ServiceWithVariants,
} from "./queries";
import {
  createServicePackage,
  deleteServicePackage,
  suggestServicePackages,
  updateServicePackage,
  type PackageSuggestion,
} from "./catalog-actions";
import type { ServicePackageFormValues } from "./catalog-schema";
import {
  SERVICE_TIERS,
  SERVICE_TIER_META,
  type ServiceTier,
} from "./tiers";

type PackageDraft = ServicePackageFormValues & { id?: string };

function emptyDraft(): PackageDraft {
  return {
    name: "",
    objective: "",
    niche: "",
    description: "",
    status: "Activo",
    suggestedByAi: false,
    items: [],
  };
}

function packageToDraft(item: ServicePackageWithItems): PackageDraft {
  return {
    id: item.id,
    name: item.name,
    objective: item.objective ?? "",
    niche: item.niche ?? "",
    description: item.description ?? "",
    status: item.status,
    suggestedByAi: item.suggestedByAi,
    items: item.items.map((line) => ({
      serviceId: line.serviceId,
      variantTier: line.variantTier as ServiceTier,
      quantity: line.quantity,
    })),
  };
}

export function PackagesManager({
  packages,
  services,
  canEdit,
}: {
  packages: ServicePackageWithItems[];
  services: ServiceWithVariants[];
  canEdit: boolean;
}) {
  const [draft, setDraft] = useState<PackageDraft | null>(null);
  const [suggestions, setSuggestions] = useState<PackageSuggestion[]>([]);
  const [pending, startTransition] = useTransition();

  function requestSuggestions() {
    startTransition(async () => {
      const result = await suggestServicePackages();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSuggestions(result.data.suggestions);
      toast.success(
        `${result.data.suggestions.length} paquetes propuestos encontrados`,
      );
    });
  }

  function acceptSuggestion(suggestion: PackageSuggestion) {
    setDraft({
      name: suggestion.name,
      objective: suggestion.objective,
      niche: suggestion.niche,
      description: suggestion.description,
      status: "Activo",
      suggestedByAi: true,
      items: suggestion.serviceIds.map((serviceId) => ({
        serviceId,
        variantTier: "START",
        quantity: 1,
      })),
    });
  }

  function remove(id: string, name: string) {
    if (!window.confirm(`¿Eliminar el paquete “${name}”?`)) return;
    startTransition(async () => {
      const result = await deleteServicePackage(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Paquete eliminado");
    });
  }

  return (
    <div className="space-y-8">
      <section className="glass relative overflow-hidden rounded-2xl p-6">
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <div className="bg-primary text-primary-foreground mb-4 flex size-10 items-center justify-center rounded-xl">
              <Sparkles className="size-5" />
            </div>
            <h2 className="font-heading text-xl font-semibold">
              Paquetes propuestos
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Noma analiza combinaciones frecuentes de servicios en las últimas
              propuestas. Solo envía IDs, nombres y áreas; nunca contenido de
              clientes ni precios.
            </p>
          </div>
          {canEdit && (
            <Button onClick={requestSuggestions} disabled={pending}>
              <Sparkles className="size-4" />
              {pending ? "Analizando…" : "Analizar propuestas"}
            </Button>
          )}
        </div>
        {suggestions.length > 0 && (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {suggestions.map((suggestion) => (
              <button
                key={`${suggestion.name}-${suggestion.serviceIds.join("-")}`}
                type="button"
                onClick={() => acceptSuggestion(suggestion)}
                className="bg-card border-border hover-lift rounded-xl border p-4 text-left"
              >
                <p className="font-medium">{suggestion.name}</p>
                <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                  {suggestion.description}
                </p>
                <p className="text-primary mt-3 text-xs font-medium">
                  Revisar y crear · {suggestion.serviceIds.length} servicios
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-lg font-semibold">
              Paquetes guardados
            </h2>
            <p className="text-muted-foreground text-sm">
              Combinaciones reutilizables por objetivo o nicho.
            </p>
          </div>
          {canEdit && (
            <Button onClick={() => setDraft(emptyDraft())}>
              <Plus className="size-4" />
              Nuevo paquete
            </Button>
          )}
        </div>

        {packages.length === 0 ? (
          <div className="glass text-muted-foreground rounded-xl p-10 text-center">
            <Boxes className="mx-auto mb-3 size-8" />
            <p className="text-sm">Todavía no hay paquetes guardados.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {packages.map((item) => (
              <article key={item.id} className="glass rounded-xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-heading font-semibold">{item.name}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.niche && (
                        <span className="bg-accent text-muted-foreground rounded-full px-2 py-0.5 text-[10px]">
                          {item.niche}
                        </span>
                      )}
                      {item.suggestedByAi && (
                        <span className="bg-accent text-muted-foreground rounded-full px-2 py-0.5 text-[10px]">
                          Sugerido por IA
                        </span>
                      )}
                    </div>
                  </div>
                  <StatusBadge value={item.status} size="xs" />
                </div>
                {item.objective && (
                  <p className="text-muted-foreground mt-3 line-clamp-2 text-sm">
                    {item.objective}
                  </p>
                )}
                <ul className="border-border mt-4 space-y-2 border-t pt-4">
                  {item.items.slice(0, 5).map((line) => (
                    <li
                      key={line.id}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="truncate">{line.serviceName}</span>
                      <span className="text-muted-foreground shrink-0">
                        {line.area} ·{" "}
                        {
                          SERVICE_TIER_META[
                            line.variantTier as ServiceTier
                          ].shortLabel
                        }
                      </span>
                    </li>
                  ))}
                </ul>
                {canEdit && (
                  <div className="mt-5 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDraft(packageToDraft(item))}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(item.id, item.name)}
                    >
                      <Trash2 className="size-3.5" />
                      Eliminar
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <PackageDialog
        draft={draft}
        services={services}
        pending={pending}
        onClose={() => setDraft(null)}
      />
    </div>
  );
}

function PackageDialog({
  draft,
  services,
  pending,
  onClose,
}: {
  draft: PackageDraft | null;
  services: ServiceWithVariants[];
  pending: boolean;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<PackageDraft | null>(draft);
  const [serviceToAdd, setServiceToAdd] = useState("");
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    setLocal(draft);
  }, [draft]);

  const available = useMemo(
    () =>
      services.filter(
        (service) =>
          !local?.items.some((item) => item.serviceId === service.id),
      ),
    [local?.items, services],
  );

  function addService() {
    if (!local || !serviceToAdd) return;
    setLocal({
      ...local,
      items: [
        ...local.items,
        { serviceId: serviceToAdd, variantTier: "START", quantity: 1 },
      ],
    });
    setServiceToAdd("");
  }

  function save() {
    if (!local) return;
    startSaving(async () => {
      const result = local.id
        ? await updateServicePackage(local.id, local)
        : await createServicePackage(local);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(local.id ? "Paquete actualizado" : "Paquete creado");
      onClose();
      setLocal(null);
    });
  }

  return (
    <Dialog
      open={Boolean(draft)}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setLocal(null);
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {local?.id ? "Editar paquete" : "Nuevo paquete"}
          </DialogTitle>
        </DialogHeader>
        {local && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Nombre" className="sm:col-span-2">
                <Input
                  value={local.name}
                  onChange={(event) =>
                    setLocal({ ...local, name: event.target.value })
                  }
                />
              </FormField>
              <FormField label="Nicho">
                <Input
                  placeholder="Ej: Restaurantes"
                  value={local.niche}
                  onChange={(event) =>
                    setLocal({ ...local, niche: event.target.value })
                  }
                />
              </FormField>
              <FormField label="Estado">
                <Select
                  value={local.status}
                  onValueChange={(value) =>
                    setLocal({
                      ...local,
                      status: value as ServiceStatus,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Activo">Activo</SelectItem>
                    <SelectItem value="Inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <FormField label="Objetivo">
              <Textarea
                rows={2}
                value={local.objective}
                onChange={(event) =>
                  setLocal({ ...local, objective: event.target.value })
                }
              />
            </FormField>
            <FormField label="Descripción">
              <Textarea
                rows={2}
                value={local.description}
                onChange={(event) =>
                  setLocal({ ...local, description: event.target.value })
                }
              />
            </FormField>

            <div className="space-y-3">
              <Label>Servicios del paquete</Label>
              <div className="flex gap-2">
                <Select
                  value={serviceToAdd}
                  onValueChange={(value) => setServiceToAdd(value ?? "")}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleccionar servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.area} · {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!serviceToAdd}
                  onClick={addService}
                >
                  <Plus className="size-4" />
                  Agregar
                </Button>
              </div>
              {local.items.map((line, index) => {
                const service = services.find(
                  (item) => item.id === line.serviceId,
                );
                const enabledTiers = SERVICE_TIERS.filter((tier) => {
                  const row = service?.variants.find(
                    (variant) => variant.tier === tier,
                  );
                  return row?.enabled ?? tier === "START";
                });
                return (
                  <div
                    key={line.serviceId}
                    className="border-border grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_11rem_6rem_auto] sm:items-center"
                  >
                    <div>
                      <p className="text-sm font-medium">{service?.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {service?.area} · {service?.subarea ?? "Sin subárea"}
                      </p>
                    </div>
                    <Select
                      value={line.variantTier}
                      onValueChange={(value) =>
                        setLocal({
                          ...local,
                          items: local.items.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  variantTier: value as ServiceTier,
                                }
                              : item,
                          ),
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {enabledTiers.map((tier) => (
                          <SelectItem key={tier} value={tier}>
                            {SERVICE_TIER_META[tier].shortLabel}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="1"
                      value={line.quantity}
                      aria-label={`Cantidad de ${service?.name}`}
                      onChange={(event) =>
                        setLocal({
                          ...local,
                          items: local.items.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  quantity: Math.max(
                                    1,
                                    Number(event.target.value),
                                  ),
                                }
                              : item,
                          ),
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setLocal({
                          ...local,
                          items: local.items.filter((_, i) => i !== index),
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={
              pending ||
              saving ||
              !local?.name.trim() ||
              local.items.length === 0
            }
            onClick={save}
          >
            {saving ? "Guardando…" : "Guardar paquete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
