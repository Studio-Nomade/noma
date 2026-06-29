"use client";

import { Printer } from "lucide-react";

/**
 * Exporta el deck a PDF vía el diálogo de impresión del navegador
 * (Imprimir → Guardar como PDF). El layout de la preview está optimizado para
 * impresión apaisada. Un PDF server-side (puppeteer) puede venir después.
 */
export function PrintButton() {
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
