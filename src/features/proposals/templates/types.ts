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
  deliverables: string[];
  exclusions: string[];
  amount: number;
  currency: Currency;
  cadence: BillingCadence;
  valueLabel: string;
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
    nextSteps?: string;
  };
  gantt: GanttData | null;
  totals: {
    oneTimeUf: number;
    monthlyUf: number;
    quarterlyUf: number;
    directClp: number;
    netClp: number;
    ivaClp: number;
    totalClp: number;
    ufClp: number;
  };
};
