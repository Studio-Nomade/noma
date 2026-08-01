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
  Mail,
  MessageSquareText,
  Plug,
  ReceiptText,
  Settings,
  SlidersHorizontal,
  Upload,
  ClipboardList,
  BookOpenCheck,
  Contact,
  Users,
  UserRoundPlus,
  WalletCards,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  requiresPeople?: boolean;
  requiresPeopleManager?: boolean;
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
  { href: "/mi-portal", label: "Mi portal", icon: Contact },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Administración",
    icon: Building2,
    children: [
      { href: "/clients", label: "Clientes", icon: Users },
      { href: "/services", label: "Catálogo", icon: Boxes },
    ],
  },
  {
    label: "Comercial",
    icon: ChartNoAxesCombined,
    children: [
      { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
      { href: "/projects", label: "Proyectos", icon: FolderKanban },
      { href: "/briefs", label: "Briefs", icon: FileText },
      { href: "/proposals", label: "Propuestas", icon: FileSignature },
    ],
  },
  {
    label: "Operaciones",
    icon: Workflow,
    children: [
      {
        href: "/email-studio",
        label: "Email Studio",
        icon: Mail,
      },
      {
        href: "/solicitudes",
        label: "Solicitudes",
        icon: MessageSquareText,
      },
    ],
  },
  {
    label: "Finanzas",
    icon: CircleDollarSign,
    requiresFinance: true,
    children: [
      { href: "/finanzas", label: "Dashboard", icon: LayoutDashboard },
      { href: "/finanzas/ingresos", label: "Ingresos", icon: Banknote },
      { href: "/finanzas/egresos", label: "Egresos", icon: ReceiptText },
      { href: "/finanzas/banco", label: "Banco", icon: Landmark },
      { href: "/finanzas/cobranza", label: "Cobranza", icon: HandCoins },
      {
        href: "/finanzas/notas-de-venta",
        label: "Notas de venta",
        icon: FileSignature,
      },
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
        href: "/personas/empleados",
        label: "Remuneraciones",
        icon: UserRoundPlus,
      },
      {
        href: "/personas/honorarios",
        label: "Honorarios",
        icon: ReceiptText,
      },
      {
        href: "/finanzas/configuracion",
        label: "Configuración",
        icon: SlidersHorizontal,
      },
    ],
  },
  {
    label: "Personas",
    icon: Contact,
    children: [
      {
        href: "/personas",
        label: "Dashboard",
        icon: LayoutDashboard,
        requiresPeopleManager: true,
      },
      {
        href: "/personas/colaboradores",
        label: "Colaboradores",
        icon: Users,
        requiresPeople: true,
      },
      { href: "/surveys", label: "Encuestas", icon: ClipboardList },
      { href: "/training", label: "Capacitaciones", icon: BookOpenCheck },
      { href: "/onboarding", label: "Onboarding", icon: GraduationCap },
    ],
  },
  {
    label: "Sistema",
    icon: Settings,
    children: [
      { href: "/context-docs", label: "Documentación", icon: Library },
      { href: "/integrations", label: "Integraciones", icon: Plug },
      { href: "/settings", label: "Ajustes", icon: SlidersHorizontal },
    ],
  },
];

export const NAV_FOOTER_ITEMS: NavItem[] = [];
