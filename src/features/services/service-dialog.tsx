"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/currency/format";
import { convertAmount, type Rates } from "@/lib/currency/convert";
import {
  AREAS,
  AREA_LABELS,
  SERVICE_STATUSES,
  type Area,
  type Currency,
  type ServiceStatus,
} from "@/types/enums";
import { cn } from "@/lib/utils";
import { createService, updateService } from "./actions";
import type { ServiceSubarea } from "@/db/schema";
import type { ServiceWithVariants } from "./queries";
import {
  parseStructuredContent,
  serializeStructuredContent,
  type StructuredContentItem,
} from "@/features/proposals/structured-content";
import {
  PREVIOUS_SERVICE_TIER,
  SERVICE_TIERS,
  SERVICE_TIER_META,
  type ServiceTier,
} from "./tiers";
import type { ServiceFormValues, ServiceVariantFormValues } from "./schema";

const ServiceRichTextEditor = dynamic(
  () =>
    import("./rich-text-editor").then((module) => module.ServiceRichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div className="border-border bg-muted/20 h-60 animate-pulse rounded-xl border" />
    ),
  },
);

type VariantDraft = Omit<ServiceVariantFormValues, "exclusions"> & {
  exclusions: StructuredContentItem[];
};

type ServiceDraft = {
  name: string;
  area: Area;
  subarea: string;
  requirements: string;
  status: ServiceStatus;
  variants: Record<ServiceTier, VariantDraft>;
};

function emptyVariant(tier: ServiceTier): VariantDraft {
  return {
    tier,
    enabled: SERVICE_TIER_META[tier].required,
    audience: "",
    focus: "",
    description: "",
    methodology: "",
    deliverables: "",
    exclusions: [],
    estimatedTime: "",
    priceMinAmount: "",
    priceMaxAmount: "",
    priceCurrency: "UF",
  };
}

function copyVariant(source: VariantDraft, tier: ServiceTier): VariantDraft {
  return {
    ...source,
    tier,
    enabled: true,
    methodology: source.methodology,
    deliverables: source.deliverables,
    exclusions: source.exclusions.map((item) => ({ ...item })),
  };
}

function buildDraft(service?: ServiceWithVariants | null): ServiceDraft {
  const variants = Object.fromEntries(
    SERVICE_TIERS.map((tier) => [tier, emptyVariant(tier)]),
  ) as Record<ServiceTier, VariantDraft>;

  const start: VariantDraft = {
    tier: "START",
    enabled: true,
    audience: "",
    focus: "",
    description: service?.description ?? "",
    methodology: service?.methodology ?? "",
    deliverables: service?.deliverables ?? "",
    exclusions: parseStructuredContent(service?.exclusions, "deliverables"),
    estimatedTime: service?.estimatedTime ?? "",
    priceMinAmount: service?.priceMinAmount ?? "",
    priceMaxAmount: service?.priceMaxAmount ?? "",
    priceCurrency: service?.priceCurrency ?? "UF",
  };
  variants.START = start;
  variants.GROWTH = copyVariant(start, "GROWTH");

  for (const row of service?.variants ?? []) {
    if (!SERVICE_TIERS.includes(row.tier as ServiceTier)) continue;
    const tier = row.tier as ServiceTier;
    variants[tier] = {
      tier,
      enabled: row.enabled,
      audience: row.audience ?? "",
      focus: row.focus ?? "",
      description: row.description ?? "",
      methodology: row.methodology ?? "",
      deliverables: row.deliverables ?? "",
      exclusions: parseStructuredContent(row.exclusions, "deliverables"),
      estimatedTime: row.estimatedTime ?? "",
      priceMinAmount: row.priceMinAmount ?? "",
      priceMaxAmount: row.priceMaxAmount ?? "",
      priceCurrency: row.priceCurrency,
    };
  }

  return {
    name: service?.name ?? "",
    area: service?.area ?? "B&D",
    subarea: service?.subarea ?? "",
    requirements: service?.requirements ?? "",
    status: service?.status ?? "Activo",
    variants,
  };
}

export function ServiceDialog({
  service,
  trigger,
  rates,
  subareas,
}: {
  service?: ServiceWithVariants | null;
  trigger: React.ReactElement;
  rates: Rates;
  subareas: ServiceSubarea[];
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ServiceDraft>(() => buildDraft(service));
  const [activeTier, setActiveTier] = useState<ServiceTier>("START");
  const [customizedTiers, setCustomizedTiers] = useState<Set<ServiceTier>>(
    () => new Set(),
  );
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const isEdit = Boolean(service);
  const variant = draft.variants[activeTier];
  const areaSubareas = useMemo(
    () => subareas.filter((item) => item.area === draft.area),
    [draft.area, subareas],
  );

  function resetDraft() {
    setDraft(buildDraft(service));
    setActiveTier("START");
    setCustomizedTiers(new Set());
  }

  function setVariant(patch: Partial<VariantDraft>) {
    setCustomizedTiers((current) => new Set(current).add(activeTier));
    setDraft((current) => ({
      ...current,
      variants: {
        ...current.variants,
        [activeTier]: { ...current.variants[activeTier], ...patch },
      },
    }));
  }

  function selectTier(tier: ServiceTier) {
    if (!isEdit && tier === "GROWTH" && !customizedTiers.has("GROWTH")) {
      setDraft((current) => ({
        ...current,
        variants: {
          ...current.variants,
          GROWTH: copyVariant(current.variants.START, "GROWTH"),
        },
      }));
    }
    setActiveTier(tier);
  }

  function toggleOptionalTier() {
    const previousTier = PREVIOUS_SERVICE_TIER[activeTier];
    if (!variant.enabled && previousTier) {
      setDraft((current) => ({
        ...current,
        variants: {
          ...current.variants,
          [activeTier]: copyVariant(current.variants[previousTier], activeTier),
        },
      }));
      return;
    }
    setVariant({ enabled: false });
  }

  function inheritPrevious() {
    const previousTier = PREVIOUS_SERVICE_TIER[activeTier];
    if (!previousTier) return;
    setDraft((current) => ({
      ...current,
      variants: {
        ...current.variants,
        [activeTier]: copyVariant(current.variants[previousTier], activeTier),
      },
    }));
    setCustomizedTiers((current) => new Set(current).add(activeTier));
    toast.success(
      `Contenido copiado desde ${SERVICE_TIER_META[previousTier].shortLabel}`,
    );
  }

  function changeCurrency(next: Currency) {
    const current = variant.priceCurrency;
    if (next === current) return;
    const converted = {
      priceCurrency: next,
      priceMinAmount: convertPrice(
        variant.priceMinAmount,
        current,
        next,
        rates,
      ),
      priceMaxAmount: convertPrice(
        variant.priceMaxAmount,
        current,
        next,
        rates,
      ),
    };
    setVariant(converted);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const payload: ServiceFormValues = {
      name: draft.name,
      area: draft.area,
      subarea: draft.subarea,
      requirements: draft.requirements,
      status: draft.status,
      variants: SERVICE_TIERS.map((tier) => {
        const item =
          !isEdit && tier === "GROWTH" && !customizedTiers.has("GROWTH")
            ? copyVariant(draft.variants.START, "GROWTH")
            : draft.variants[tier];
        return {
          ...item,
          exclusions: serializeStructuredContent(item.exclusions),
        };
      }),
    };
    setSaving(true);
    const result = isEdit
      ? await updateService(service!.id, payload)
      : await createService(payload);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? "Servicio actualizado" : "Servicio creado");
    setOpen(false);
    if (!isEdit) resetDraft();
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) resetDraft();
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar servicio" : "Nuevo servicio"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nombre del servicio" className="sm:col-span-2">
              <Input
                required
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="Área">
              <Select
                value={draft.area}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    area: value as Area,
                    subarea: "",
                  }))
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
            </FormField>
            <FormField label="Subárea">
              <Select
                value={draft.subarea || "__none"}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    subarea: !value || value === "__none" ? "" : value,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin subárea" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sin subárea</SelectItem>
                  {areaSubareas.map((item) => (
                    <SelectItem key={item.id} value={item.name}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <section className="border-border overflow-hidden rounded-xl border">
            <div className="bg-muted/30 border-border border-b px-4 py-3">
              <p className="font-heading text-sm font-medium">
                Tipo y complejidad del servicio
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Start y Growth son obligatorios. Los niveles superiores se
                activan solo cuando este servicio los necesita.
              </p>
            </div>
            <div className="grid divide-y md:grid-cols-4 md:divide-x md:divide-y-0">
              {SERVICE_TIERS.map((tier, index) => {
                const item = draft.variants[tier];
                const active = tier === activeTier;
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => selectTier(tier)}
                    className={cn(
                      "relative min-h-20 p-4 text-left transition-colors",
                      active ? "bg-primary text-primary-foreground" : "bg-card",
                      !item.enabled && "opacity-55",
                    )}
                  >
                    <span className="text-[10px] font-semibold tracking-widest uppercase opacity-70">
                      Nivel {index + 1}
                    </span>
                    <span className="mt-1 block text-sm font-semibold">
                      {SERVICE_TIER_META[tier].label}
                    </span>
                    <span className="mt-2 flex items-center gap-1 text-[11px]">
                      {item.enabled ? (
                        <>
                          <Check className="size-3" /> Configurado
                        </>
                      ) : (
                        "Opcional · desactivado"
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-heading text-lg font-semibold">
                Variante {SERVICE_TIER_META[activeTier].shortLabel}
              </h3>
              <p className="text-muted-foreground text-xs">
                Esta información se utilizará al seleccionar la variante en una
                propuesta o paquete.
              </p>
            </div>
            <div className="flex gap-2">
              {PREVIOUS_SERVICE_TIER[activeTier] && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={inheritPrevious}
                >
                  <Copy className="size-4" />
                  Copiar nivel anterior
                </Button>
              )}
              {!SERVICE_TIER_META[activeTier].required && (
                <Button
                  type="button"
                  variant={variant.enabled ? "outline" : "default"}
                  onClick={toggleOptionalTier}
                >
                  {variant.enabled ? "Desactivar variante" : "Activar variante"}
                </Button>
              )}
            </div>
          </div>

          <fieldset
            disabled={!variant.enabled}
            className="space-y-5 disabled:opacity-50"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Público / perfil objetivo">
                <Textarea
                  rows={2}
                  value={variant.audience}
                  onChange={(event) =>
                    setVariant({ audience: event.target.value })
                  }
                />
              </FormField>
              <FormField label="Enfoque de la variante">
                <Textarea
                  rows={2}
                  value={variant.focus}
                  onChange={(event) =>
                    setVariant({ focus: event.target.value })
                  }
                />
              </FormField>
            </div>

            <FormField label="Descripción">
              <Textarea
                rows={3}
                value={variant.description}
                onChange={(event) =>
                  setVariant({ description: event.target.value })
                }
              />
            </FormField>

            <ServiceRichTextEditor
              label="Metodología / proceso"
              legacyMode="stages"
              value={variant.methodology ?? ""}
              onChange={(methodology) => setVariant({ methodology })}
              placeholder="Describe el proceso con subtítulos, párrafos y listas…"
            />
            <ServiceRichTextEditor
              label="Entregables incluidos"
              legacyMode="deliverables"
              value={variant.deliverables ?? ""}
              onChange={(deliverables) => setVariant({ deliverables })}
              placeholder="Organiza los entregables con subtítulos y listas…"
            />
            <StructuredServiceEditor
              label="Qué no incluye · excluyentes"
              titlePlaceholder="Elemento excluido"
              descriptionPlaceholder="Aclaración o condición"
              items={variant.exclusions}
              onChange={(exclusions) => setVariant({ exclusions })}
            />

            <FormField label="Tiempo estimado">
              <Input
                placeholder="Ej: 4–6 semanas"
                value={variant.estimatedTime}
                onChange={(event) =>
                  setVariant({ estimatedTime: event.target.value })
                }
              />
            </FormField>

            <PriceEditor
              variant={variant}
              rates={rates}
              onChange={setVariant}
              onCurrencyChange={changeCurrency}
            />
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <FormField label="Requisitos generales para iniciar">
              <Textarea
                rows={2}
                value={draft.requirements}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    requirements: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="Estado">
              <Select
                value={draft.status}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    status: value as ServiceStatus,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Guardando…"
                : isEdit
                  ? "Guardar cambios"
                  : "Guardar servicio"}
            </Button>
          </DialogFooter>
        </form>
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
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function StructuredServiceEditor({
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
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
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
            aria-label={`Quitar elemento de ${label}`}
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
        Agregar elemento
      </Button>
    </div>
  );
}

function PriceEditor({
  variant,
  rates,
  onChange,
  onCurrencyChange,
}: {
  variant: VariantDraft;
  rates: Rates;
  onChange: (patch: Partial<VariantDraft>) => void;
  onCurrencyChange: (currency: Currency) => void;
}) {
  const min = Number(variant.priceMinAmount) || 0;
  const max = Number(variant.priceMaxAmount) || 0;
  return (
    <section className="border-border space-y-4 rounded-xl border p-4">
      <div>
        <h4 className="font-heading text-sm font-medium">Precio referencial</h4>
        <p className="text-muted-foreground mt-1 text-xs">
          La moneda principal es editable; las equivalencias conservan el valor
          económico con las tasas vigentes.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_9rem]">
        <FormField label={`Precio mínimo (${variant.priceCurrency})`}>
          <Input
            type="number"
            min="0"
            step={variant.priceCurrency === "CLP" ? "1" : "0.01"}
            value={variant.priceMinAmount}
            onChange={(event) =>
              onChange({ priceMinAmount: event.target.value })
            }
          />
        </FormField>
        <FormField label={`Precio máximo (${variant.priceCurrency})`}>
          <Input
            type="number"
            min="0"
            step={variant.priceCurrency === "CLP" ? "1" : "0.01"}
            value={variant.priceMaxAmount}
            onChange={(event) =>
              onChange({ priceMaxAmount: event.target.value })
            }
          />
        </FormField>
        <FormField label="Moneda">
          <Select
            value={variant.priceCurrency}
            onValueChange={(value) => onCurrencyChange(value as Currency)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["UF", "CLP", "USD"] as Currency[]).map((currency) => (
                <SelectItem key={currency} value={currency}>
                  {currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {(["UF", "CLP", "USD"] as Currency[]).map((currency) => (
          <PriceEquivalent
            key={currency}
            currency={currency}
            min={convertAmount(min, variant.priceCurrency, currency, rates)}
            max={convertAmount(max, variant.priceCurrency, currency, rates)}
          />
        ))}
      </div>
      {(!rates.ufClp || !rates.usdClp) && (
        <p className="text-destructive text-xs">
          Faltan tasas vigentes; ejecuta npm run rates:sync antes de convertir.
        </p>
      )}
    </section>
  );
}

function PriceEquivalent({
  currency,
  min,
  max,
}: {
  currency: Currency;
  min: number;
  max: number;
}) {
  const hasMin = Number.isFinite(min) && min > 0;
  const hasMax = Number.isFinite(max) && max > 0;
  const value =
    hasMin && hasMax
      ? `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`
      : hasMin
        ? formatMoney(min, currency)
        : hasMax
          ? formatMoney(max, currency)
          : "—";
  return (
    <div className="bg-muted/40 rounded-lg p-3">
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {currency}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function convertPrice(
  value: string | undefined,
  from: Currency,
  to: Currency,
  rates: Rates,
) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return value ?? "";
  const converted = convertAmount(amount, from, to, rates);
  return converted.toFixed(to === "CLP" ? 0 : 2);
}
