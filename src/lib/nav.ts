import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  FileSignature,
  Boxes,
  GraduationCap,
  Library,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/projects", label: "Proyectos", icon: FolderKanban },
  { href: "/briefs", label: "Briefs", icon: FileText },
  { href: "/proposals", label: "Propuestas", icon: FileSignature },
  { href: "/services", label: "Servicios", icon: Boxes },
  { href: "/onboarding", label: "Onboarding", icon: GraduationCap },
  { href: "/context-docs", label: "Documentación", icon: Library },
  { href: "/settings", label: "Configuración", icon: Settings },
];
