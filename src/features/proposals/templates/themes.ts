import type { Area } from "@/types/enums";

export const proposalTheme = {
  ink: "#1d1d1b",
  paper: "#ecf0ee",
  white: "#ffffff",
  orange: "#f48134",
} as const;

/** Solo B&D tiene un acento estable documentado. El resto usa naranja de marca
 * hasta que Diseño entregue assets oficiales por área. */
export const proposalAreaAccent: Record<Area, string> = {
  "B&D": proposalTheme.orange,
  WD: proposalTheme.orange,
  "A&D": proposalTheme.orange,
  "A&A": proposalTheme.orange,
  CE: proposalTheme.orange,
  MP: proposalTheme.orange,
  SN: proposalTheme.orange,
  CSM: proposalTheme.orange,
  STR: proposalTheme.orange,
};
