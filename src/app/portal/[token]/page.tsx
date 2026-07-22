import { notFound } from "next/navigation";
import { Brand } from "@/components/layout/brand";
import { StatusBadge } from "@/components/shared/status-badge";
import { ClientAccountCard } from "@/features/clients/client-account";
import { getPortalData } from "@/features/clients/portal-queries";
import { AREA_LABELS } from "@/types/enums";

/**
 * Portal del cliente: acceso por enlace privado, sin sesión.
 *
 * `noindex` es obligatorio: el enlace es la credencial, y si un buscador lo
 * indexara el estado de cuenta quedaría público.
 */
export const metadata = {
  title: "Portal · Studio Nomade",
  robots: { index: false, follow: false },
};

const fecha = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString("es-CL", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPortalData(token);
  // Token inválido o revocado: 404 sin pistas de si el cliente existe.
  if (!data) notFound();

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Brand />
          <div className="text-right">
            <p className="text-muted-foreground text-xs tracking-wide uppercase">
              Portal de cliente
            </p>
            <p className="font-heading text-lg font-semibold">
              {data.clientName}
            </p>
          </div>
        </header>

        <section className="glass glass-sheen mb-6 rounded-xl p-5 sm:p-6">
          <h2 className="font-heading mb-4 text-sm font-medium">
            Estado de cuenta
          </h2>
          <ClientAccountCard account={data.account} />
        </section>

        <section className="glass glass-sheen rounded-xl p-5 sm:p-6">
          <h2 className="font-heading mb-4 text-sm font-medium">
            Estado de tus proyectos
          </h2>
          {data.projects.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aún no hay proyectos registrados.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {data.projects.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {AREA_LABELS[p.area]}
                      {p.deliveryDate
                        ? ` · Entrega estimada: ${fecha(p.deliveryDate)}`
                        : ""}
                    </p>
                  </div>
                  <StatusBadge value={p.status} size="xs" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="text-muted-foreground/70 mt-8 text-center text-xs">
          <p>
            Este enlace es privado y personal. Si necesitas ayuda, escríbenos a{" "}
            <a
              href="mailto:hola@studionomade.cl"
              className="hover:text-foreground underline"
            >
              hola@studionomade.cl
            </a>
            .
          </p>
        </footer>
      </div>
    </main>
  );
}
