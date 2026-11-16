/**
 * Validación del borrador de la IA contra el catálogo real (pura, testeable).
 *
 * La IA puede equivocarse en ids, niveles o cantidades: aquí se corrige lo que
 * se puede y se descarta lo que no, dejando cada ajuste anotado en `warnings`
 * para mostrarlo al equipo junto al borrador.
 */

import type { Area, Currency } from "@/types/enums";
import { SERVICE_TIERS, type ServiceTier } from "@/features/services/tiers";
import { serializeRichTextDocument } from "@/features/services/rich-text";
import type { DraftLine, ProposalDraft } from "./schema";

export type CatalogRef = {
  id: string;
  name: string;
  area: Area;
  enabledTiers: { tier: ServiceTier; min: number | null; currency: Currency }[];
};

export type CustomServiceInput = {
  name: string;
  area: Area;
  subarea: string | null;
  unit: string | null;
  description: string;
  methodology: string;
  deliverables: string;
  exclusions: string;
  estimatedTime: string | null;
  basedOnServiceId: string | null;
};

export type NormalizedLine = {
  kind: "catalogo" | "personalizado";
  serviceId: string | null;
  custom: CustomServiceInput | null;
  tier: ServiceTier;
  quantity: number;
  /** null = valor del catálogo para ese nivel. */
  unitPrice: number | null;
  currency: Currency;
  rationale: string;
  label: string;
};

export type NormalizedDraft = {
  lines: NormalizedLine[];
  discount: {
    label: string;
    kind: "percent" | "uf";
    value: number;
    rationale: string;
  } | null;
  appliedLearningIds: string[];
  precedentIds: string[];
  team: { memberId: string; role: string }[];
  warnings: string[];
};

/** Lista de textos → texto enriquecido de Noma (lista numerada o viñetas). */
export function listToRichText(items: string[], ordered: boolean): string {
  const clean = items
    .map((item) => item.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
  if (!clean.length) return "";
  return serializeRichTextDocument({
    type: "doc",
    content: [
      {
        type: ordered ? "orderedList" : "bulletList",
        content: clean.map((text) => ({
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text }] }],
        })),
      },
    ],
  });
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

function toQuantity(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(999, Math.max(1, Math.round(value)));
}

function toCustom(line: DraftLine): CustomServiceInput | null {
  const c = line.custom;
  if (!c || !c.name.trim()) return null;
  return {
    name: c.name.trim().slice(0, 160),
    area: c.area,
    subarea: c.subarea?.trim() || null,
    unit: c.unit?.trim() || null,
    description: c.description.trim(),
    methodology: listToRichText(c.methodology, true),
    deliverables: listToRichText(c.deliverables, false),
    exclusions: c.exclusions
      .map((x) => `• ${x.trim()}`)
      .filter((x) => x.length > 2)
      .join("\n"),
    estimatedTime: c.estimated_time?.trim() || null,
    basedOnServiceId: c.based_on_service_id?.trim() || null,
  };
}

export function normalizeDraft(
  draft: ProposalDraft,
  catalog: CatalogRef[],
  known: { learningIds: string[]; precedentIds: string[]; teamIds: string[] },
): NormalizedDraft {
  const byId = new Map(catalog.map((entry) => [entry.id, entry]));
  const warnings: string[] = [];
  const lines: NormalizedLine[] = [];
  const usedServices = new Set<string>();

  for (const raw of draft.lines) {
    const quantity = toQuantity(raw.quantity);
    const price =
      raw.unit_price != null &&
      Number.isFinite(raw.unit_price) &&
      raw.unit_price >= 0
        ? roundMoney(raw.unit_price)
        : null;
    const catalogEntry = raw.service_id
      ? byId.get(raw.service_id.trim())
      : undefined;

    if (raw.kind === "catalogo" && catalogEntry) {
      if (usedServices.has(catalogEntry.id)) {
        warnings.push(
          `«${catalogEntry.name}» venía repetido; se dejó una sola línea.`,
        );
        continue;
      }
      const enabled = catalogEntry.enabledTiers;
      const tierRow =
        enabled.find((t) => t.tier === raw.tier) ??
        enabled.find((t) => t.tier === "START") ??
        enabled[0];
      if (!tierRow) {
        warnings.push(
          `«${catalogEntry.name}» no tiene niveles habilitados; se omitió.`,
        );
        continue;
      }
      if (tierRow.tier !== raw.tier) {
        warnings.push(
          `«${catalogEntry.name}»: el nivel ${raw.tier} no está habilitado; se usó ${tierRow.tier}.`,
        );
      }
      usedServices.add(catalogEntry.id);
      const samePrice =
        price != null &&
        tierRow.min != null &&
        Math.abs(price - tierRow.min) < 0.005 &&
        raw.currency === tierRow.currency;
      lines.push({
        kind: "catalogo",
        serviceId: catalogEntry.id,
        custom: null,
        tier: tierRow.tier,
        quantity,
        unitPrice: samePrice ? null : price,
        currency: price != null ? raw.currency : tierRow.currency,
        rationale: raw.rationale.trim(),
        label: catalogEntry.name,
      });
      continue;
    }

    const custom = toCustom(raw);
    if (!custom) {
      warnings.push(
        raw.service_id
          ? `Se omitió una línea con un servicio que no existe en el catálogo (${raw.service_id.slice(0, 8)}…).`
          : "Se omitió una línea personalizada sin ficha.",
      );
      continue;
    }
    if (raw.kind === "catalogo") {
      warnings.push(
        `«${custom.name}» no está en el catálogo; se agregó como servicio en revisión.`,
      );
    }
    if (custom.basedOnServiceId && !byId.has(custom.basedOnServiceId)) {
      custom.basedOnServiceId = null;
    }
    if (price == null) {
      warnings.push(
        `«${custom.name}» viene sin valor: hay que definirlo antes de enviar.`,
      );
    }
    lines.push({
      kind: "personalizado",
      serviceId: null,
      custom,
      tier: "START",
      quantity,
      unitPrice: price,
      currency: raw.currency,
      rationale: raw.rationale.trim(),
      label: custom.name,
    });
  }

  let discount: NormalizedDraft["discount"] = null;
  if (
    draft.discount &&
    Number.isFinite(draft.discount.value) &&
    draft.discount.value > 0
  ) {
    const value =
      draft.discount.kind === "percent"
        ? Math.min(50, roundMoney(draft.discount.value))
        : roundMoney(draft.discount.value);
    if (draft.discount.kind === "percent" && draft.discount.value > 50) {
      warnings.push("El descuento sugerido superaba el 50 %; se acotó.");
    }
    discount = {
      label: draft.discount.label.trim() || "Descuento comercial",
      kind: draft.discount.kind,
      value,
      rationale: draft.discount.rationale.trim(),
    };
  }

  const teamSet = new Set(known.teamIds);
  const seenMembers = new Set<string>();
  const team: NormalizedDraft["team"] = [];
  for (const member of draft.team) {
    const id = member.member_id.trim();
    if (!teamSet.has(id) || seenMembers.has(id)) continue;
    seenMembers.add(id);
    team.push({ memberId: id, role: member.role.trim().slice(0, 120) });
  }

  const learningSet = new Set(known.learningIds);
  const precedentSet = new Set(known.precedentIds);
  return {
    lines,
    discount,
    appliedLearningIds: [...new Set(draft.applied_learning_ids)].filter((id) =>
      learningSet.has(id),
    ),
    precedentIds: [...new Set(draft.precedent_ids)].filter((id) =>
      precedentSet.has(id),
    ),
    team,
    warnings,
  };
}

export function isServiceTier(value: string): value is ServiceTier {
  return (SERVICE_TIERS as readonly string[]).includes(value);
}
