import {
  LayoutDashboard,
  Users,
  FolderKanban,
  KanbanSquare,
  FileText,
  FileSignature,
  Boxes,
  GraduationCap,
  Library,
  Plug,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Solo visible para el área de Finanzas (módulo CFO). */
  requiresFinance?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/projects", label: "Proyectos", icon: FolderKanban },
  { href: "/briefs", label: "Briefs", icon: FileText },
  { href: "/proposals", label: "Propuestas", icon: FileSignature },
  { href: "/services", label: "Servicios", icon: Boxes },
  { href: "/finanzas", label: "Finanzas", icon: Wallet, requiresFinance: true },
  { href: "/onboarding", label: "Onboarding", icon: GraduationCap },
  { href: "/integrations", label: "Integraciones", icon: Plug },
  { href: "/context-docs", label: "Documentación", icon: Library },
  { href: "/settings", label: "Configuración", icon: Settings },
];
