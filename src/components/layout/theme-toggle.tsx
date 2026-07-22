"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/**
 * Alterna claro/oscuro. Hasta que el componente monta no se conoce el tema
 * resuelto (el `<html>` lo pinta un script inline de next-themes), así que se
 * renderiza el hueco para no provocar mismatch de hidratación ni saltos de layout.
 */
export function ThemeToggle({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  const label = isDark ? "Activar modo claro" : "Activar modo oscuro";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={collapsed ? label : undefined}
      className={cn(
        "text-muted-foreground hover:text-foreground flex items-center rounded-lg p-2 text-xs transition-all",
        "hover:glass-hairline hover:bg-[var(--glass-bg)]",
        collapsed ? "justify-center" : "w-full gap-2",
        className,
      )}
    >
      <span className="relative flex size-4 items-center justify-center">
        {mounted && (
          <>
            <Sun
              className={cn(
                "absolute size-4 transition-all duration-[var(--dur-base)] ease-[var(--ease-out-expo)]",
                isDark ? "scale-0 rotate-90 opacity-0" : "scale-100 rotate-0",
              )}
            />
            <Moon
              className={cn(
                "absolute size-4 transition-all duration-[var(--dur-base)] ease-[var(--ease-out-expo)]",
                isDark ? "scale-100 rotate-0" : "scale-0 -rotate-90 opacity-0",
              )}
            />
          </>
        )}
      </span>
      {!collapsed && <span>{mounted && isDark ? "Modo claro" : "Modo oscuro"}</span>}
    </button>
  );
}
