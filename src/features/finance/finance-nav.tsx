"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/finanzas", label: "Dashboard" },
  { href: "/finanzas/ingresos", label: "Ingresos" },
  { href: "/finanzas/egresos", label: "Egresos" },
  { href: "/finanzas/banco", label: "Banco" },
  { href: "/finanzas/plan-cuentas", label: "Plan de cuentas" },
  { href: "/finanzas/reportes", label: "Reportes" },
  { href: "/finanzas/cobranza", label: "Cobranza" },
  { href: "/finanzas/importar", label: "Importar" },
  { href: "/finanzas/configuracion", label: "Configuración" },
];

export function FinanceNav() {
  const pathname = usePathname();
  return (
    <nav className="border-border mb-8 flex gap-1 overflow-x-auto border-b">
      {TABS.map((t) => {
        const active =
          t.href === "/finanzas"
            ? pathname === "/finanzas"
            : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
              active
                ? "border-foreground text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
