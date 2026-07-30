import type { Area, Currency } from "@/types/enums";
import type { GanttData } from "../gantt";
import type { StructuredContentItem } from "../structured-content";

export type BillingCadence = "one-time" | "monthly" | "quarterly";

export type ProposalTemplateService = {
  id: string;
  area: Area;
  name: string;
  subarea: string | null;
  description: string | null;
  methodology: StructuredContentItem[];
  deliverables: StructuredContentItem[];
  exclusions: string[];
  unitAmount: number;
  baseTotal: number;
  surchargeAmount: number;
  amount: number; // monto efectivo de la línea (base × cantidad × recargo)
  currency: Currency;
  cadence: BillingCadence;
  valueLabel: string;
  quantity: number;
  priority: string; // etiqueta de prioridad (ej. "Contra Reloj")
  surcharge: number; // recargo por prioridad (0, 0.15, 0.3, 0.5)
};

export type ProposalTemplateData = {
  templateVersion: "studio-nomade-2026";
  title: string;
  clientName: string;
  projectName: string;
  proposalCode: string;
  date: string;
  year: number;
  version: number;
  areas: Area[];
  areaLabel: string;
  services: ProposalTemplateService[];
  team: { id: string; name: string; role: string; photoUrl: string | null }[];
  sections: {
    context?: string;
    objective?: string;
    scope?: string;
    methodology?: StructuredContentItem[];
    deliverables?: StructuredContentItem[];
    exclusions?: string;
    commercialConditions?: string;
    includeMonthlyFeeCondition?: boolean;
    nextSteps?: string;
  };
  gantt: GanttData | null;
  totals: {
    oneTimeUf: number;
    monthlyUf: number;
    quarterlyUf: number;
    directClp: number;
    directUsd: number;
    baseNetClp: number;
    surchargeClp: number;
    netClp: number;
    discountClp: number;
    discountLabel: string | null;
    ivaClp: number;
    totalClp: number;
    ufClp: number;
    usdClp: number;
  };
};
