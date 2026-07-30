import {
  CalendarDays,
  Download,
  FileText,
  HeartHandshake,
  ReceiptText,
  Sparkles,
} from "lucide-react";
import { AvatarCircle } from "@/components/shared/avatar-circle";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { getMyPeoplePortal } from "@/features/people/portal";
import { TimeOffForm } from "@/features/people/time-off-form";
import { requireUser } from "@/lib/auth";
import { AREA_LABELS } from "@/types/enums";

const CATEGORY_LABELS: Record<string, string> = {
  contract: "Contrato",
  annex: "Anexo",
  payroll: "Liquidación",
  payment: "Comprobante de pago",
  pension: "Cotizaciones",
  medical_leave: "Licencia",
  vacation: "Vacaciones",
  certificate: "Certificado",
  other: "Otro",
};

export const metadata = { title: "Mi portal" };

export default async function MyPortalPage() {
  const user = await requireUser();
  const portal = await getMyPeoplePortal(user);

  if (!portal) {
    return (
      <EmptyState
        icon={HeartHandshake}
        title="Tu portal está casi listo"
        description="El área de Personas debe vincular tu cuenta con la ficha laboral. No necesitas crear otra cuenta."
      />
    );
  }

  const payroll = portal.documents.filter(
    (document) => document.category === "payroll",
  );
  const contracts = portal.documents.filter((document) =>
    ["contract", "annex"].includes(document.category),
  );
  const approvedDays = portal.timeOff
    .filter(
      (request) => request.type === "vacation" && request.status === "approved",
    )
    .reduce((total, request) => total + Number(request.days), 0);

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl bg-[rgb(var(--ambient-1))] p-6 text-[rgb(var(--ambient-1-foreground))] sm:p-8">
        <div className="relative z-10 flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <div className="mb-8 flex items-center gap-2 text-xs font-medium tracking-[0.18em] uppercase opacity-75">
              <Sparkles className="size-4" />
              Mi espacio en Noma
            </div>
            <h1 className="font-heading text-3xl sm:text-4xl">
              Hola, {portal.profile.name.split(" ")[0]}
            </h1>
            <p className="mt-2 max-w-xl text-sm opacity-80">
              Tu información laboral, documentos y solicitudes en un solo lugar.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-white/15 p-3 backdrop-blur">
            <AvatarCircle
              name={portal.profile.name}
              photoUrl={portal.profile.photoUrl}
              className="size-12"
            />
            <div>
              <p className="text-sm font-medium">{portal.profile.roleTitle}</p>
              <p className="text-xs opacity-75">
                {portal.profile.area
                  ? AREA_LABELS[portal.profile.area]
                  : "Studio Nomade"}
              </p>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-24 -bottom-40 size-96 rounded-full border-[64px] border-white/10" />
      </section>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PortalStat
          icon={ReceiptText}
          label="Liquidaciones"
          value={payroll.length}
        />
        <PortalStat
          icon={FileText}
          label="Contrato y anexos"
          value={contracts.length}
        />
        <PortalStat
          icon={CalendarDays}
          label="Días de vacaciones tomados"
          value={approvedDays}
        />
        <PortalStat
          icon={HeartHandshake}
          label="Solicitudes pendientes"
          value={
            portal.timeOff.filter((request) => request.status === "pending")
              .length
          }
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="glass rounded-xl p-5">
          <h2 className="font-heading font-medium">Mis documentos</h2>
          <div className="mt-4 space-y-2">
            {portal.documents.map((document) => (
              <div
                key={document.id}
                className="border-border flex items-center justify-between gap-4 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {document.title}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {CATEGORY_LABELS[document.category] ?? document.category}
                    {document.period ? ` · ${document.period}` : ""}
                  </p>
                </div>
                {document.url ? (
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Descargar ${document.title}`}
                    className="hover:bg-muted rounded-md p-2"
                  >
                    <Download className="size-4" />
                  </a>
                ) : (
                  <span className="text-muted-foreground text-xs">
                    No disponible
                  </span>
                )}
              </div>
            ))}
            {!portal.documents.length && (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Personas aún no ha cargado documentos.
              </p>
            )}
          </div>
        </section>

        <section className="glass rounded-xl p-5">
          <h2 className="font-heading font-medium">Solicitar tiempo libre</h2>
          <p className="text-muted-foreground mt-1 mb-4 text-xs">
            Se calculan días hábiles de lunes a viernes.
          </p>
          <TimeOffForm />
        </section>
      </div>

      <section className="glass mt-5 overflow-hidden rounded-xl">
        <div className="border-border border-b px-5 py-4">
          <h2 className="font-heading font-medium">Mis solicitudes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs">
              <tr>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Fechas</th>
                <th className="px-5 py-3">Días</th>
                <th className="px-5 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {portal.timeOff.map((request) => (
                <tr key={request.id}>
                  <td className="px-5 py-3 capitalize">
                    {request.type.replace("_", " ")}
                  </td>
                  <td className="px-5 py-3">
                    {request.startDate} → {request.endDate}
                  </td>
                  <td className="px-5 py-3">{Number(request.days)}</td>
                  <td className="px-5 py-3">
                    <StatusBadge value={request.status} size="xs" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function PortalStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText;
  label: string;
  value: number;
}) {
  return (
    <div className="glass rounded-xl p-4">
      <Icon className="text-muted-foreground size-4" />
      <div className="font-heading mt-4 text-3xl">{value}</div>
      <div className="text-muted-foreground mt-1 text-xs">{label}</div>
    </div>
  );
}
