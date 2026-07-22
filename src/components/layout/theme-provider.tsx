"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Tema claro/oscuro. `attribute="class"` porque los tokens viven en `.dark`
 * (ver globals.css) y `@custom-variant dark` de Tailwind se engancha ahí.
 * `disableTransitionOnChange` evita que todas las transiciones de la app se
 * disparen a la vez al alternar el tema.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="noma:theme"
    >
      {children}
    </NextThemesProvider>
  );
}
