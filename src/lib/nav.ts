import {
  Banknote,
  Boxes,
  Building2,
  ChartNoAxesCombined,
  CircleDollarSign,
  FileSignature,
  FileText,
  FolderKanban,
  GraduationCap,
  HandCoins,
  LayoutDashboard,
  KanbanSquare,
  Landmark,
  Library,
  Plug,
  ReceiptText,
  Settings,
  SlidersHorizontal,
  Upload,
  ClipboardList,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  icon: LucideIcon;
  children: NavItem[];
  requiresFinance?: boolean;
}

/**
 * Ítems sueltos que van ARRIBA de los grupos. El dashboard no pertenece a un
 * departamento: es la portada transversal del estudio (pipeline, finanzas, RRHH,
 * calendario), por eso no vive dentro de "Comercial".
 */
export const NAV_PRIMARY_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Comercial",
    icon: Building2,
    children: [
      { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
      { href: "/clients", label: "Clientes", icon: Users },
      { href: "/briefs", label: "Briefs", icon: FileText },
      { href: "/proposals", label: "Propuestas", icon: FileSignature },
      { href: "/projects", label: "Proyectos", icon: FolderKanban },
    ],
  },
  {
    label: "Finanzas",
    icon: CircleDollarSign,
    requiresFinance: true,
    children: [
      { href: "/finanzas/ingresos", label: "Ingresos", icon: Banknote },
      { href: "/finanzas/egresos", label: "Egresos", icon: ReceiptText },
      { href: "/finanzas/banco", label: "Banco", icon: Landmark },
      { href: "/finanzas/cobranza", label: "Cobranza", icon: HandCoins },
      {
        href: "/finanzas/reportes",
        label: "Reportes",
        icon: ChartNoAxesCombined,
      },
      {
        href: "/finanzas/plan-cuentas",
        label: "Plan de cuentas",
        icon: WalletCards,
      },
      { href: "/finanzas/importar", label: "Importar", icon: Upload },
      {
        href: "/finanzas/configuracion",
        label: "Configuración",
        icon: SlidersHorizontal,
      },
    ],
  },
  {
    label: "RRHH",
    icon: Users,
    children: [
      { href: "/surveys", label: "Encuestas", icon: ClipboardList },
      { href: "/onboarding", label: "Onboarding", icon: GraduationCap },
    ],
  },
  {
    label: "Catálogo",
    icon: Boxes,
    children: [{ href: "/services", label: "Servicios", icon: Boxes }],
  },
];

export const NAV_FOOTER_ITEMS: NavItem[] = [
  { href: "/context-docs", label: "Documentación", icon: Library },
  { href: "/integrations", label: "Integraciones", icon: Plug },
  { href: "/settings", label: "Ajustes", icon: Settings },
];
