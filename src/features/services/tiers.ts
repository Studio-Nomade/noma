export const SERVICE_TIERS = [
  "START",
  "GROWTH",
  "PERFORMANCE",
  "ENTERPRISE",
] as const;

export type ServiceTier = (typeof SERVICE_TIERS)[number];

export const SERVICE_TIER_META: Record<
  ServiceTier,
  {
    label: string;
    shortLabel: string;
    required: boolean;
  }
> = {
  START: {
    label: "Start · Básico",
    shortLabel: "Start",
    required: true,
  },
  GROWTH: {
    label: "Growth · Crecimiento",
    shortLabel: "Growth",
    required: true,
  },
  PERFORMANCE: {
    label: "Performance · Posicionadas",
    shortLabel: "Performance",
    required: false,
  },
  ENTERPRISE: {
    label: "Enterprise · Nivel Pro",
    shortLabel: "Enterprise",
    required: false,
  },
};

export const PREVIOUS_SERVICE_TIER: Partial<
  Record<ServiceTier, ServiceTier>
> = {
  GROWTH: "START",
  PERFORMANCE: "GROWTH",
  ENTERPRISE: "PERFORMANCE",
};
