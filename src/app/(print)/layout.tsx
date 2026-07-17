import { requireUser } from "@/lib/auth";

/**
 * Layout para vistas imprimibles (deck de cotización): sin sidebar, full-bleed.
 * Protegido por auth igual que el resto de la app.
 */
export default async function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return <div className="bg-muted min-h-screen">{children}</div>;
}
