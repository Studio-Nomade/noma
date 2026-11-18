export const MILESTONE_STATUSES = [
  "en_prod",
  "pr_abierto",
  "en_desarrollo",
  "pendiente",
  "bloqueado",
] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const ROADMAP_STATUSES = ["en_prod", "parcial", "pendiente"] as const;
export const ROADMAP_KINDS = ["modulo", "mejora", "correccion"] as const;
