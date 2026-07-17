"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

/**
 * Exporta el deck a PDF vía el diálogo de impresión del navegador
 * (Imprimir → Guardar como PDF). El navegador usa `document.title` como nombre
 * por defecto del archivo, así que lo fijamos al formato pedido:
 *   AREA_AAMMDD | Cliente - Proyecto
 */
export function PrintButton({ filename }: { filename?: string }) {
  useEffect(() => {
    if (!filename) return;
    const prev = document.title;
    document.title = filename;
    return () => {
      document.title = prev;
    };
  }, [filename]);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="bg-foreground text-background inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
    >
      <Printer className="size-4" />
      Exportar PDF
    </button>
  );
}
