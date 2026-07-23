import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Integraciones" };

type Status = "Activo" | "Planificado";

const INTEGRATIONS: {
  name: string;
  status: Status;
  today: string;
  future: string;
}[] = [
  {
    name: "Gmail / Google Workspace",
    status: "Activo",
    today:
      "Login con Google SSO. Envío de propuestas por correo como el usuario, con el PDF adjunto.",
    future:
      "Lectura de minutas (Gemini) y sincronización del equipo desde el directorio.",
  },
  {
    name: "Google Drive",
    status: "Planificado",
    today: "Enlaces manuales a carpetas por proyecto/cliente (campo de links).",
    future: "Crear/leer carpetas por área→cliente→proyecto automáticamente.",
  },
  {
    name: "Google Calendar",
    status: "Planificado",
    today: "Enlaces manuales a reuniones.",
    future: "Mostrar próximas reuniones asociadas a cliente/proyecto.",
  },
  {
    name: "Asana",
    status: "Planificado",
    today: "Enlace al proyecto de Asana desde el proyecto en Noma.",
    future:
      "Extraer estado de avance para el dashboard y el portal cliente (V2).",
  },
  {
    name: "Slack",
    status: "Planificado",
    today: "Enlace a canales por cliente/proyecto.",
    future:
      "Alertas y resúmenes automáticos (próximas acciones, propuestas enviadas).",
  },
  {
    name: "Canva",
    status: "Planificado",
    today: "Enlace a presentaciones asociadas a propuestas/proyectos.",
    future: "—",
  },
  {
    name: "Nubox (contable)",
    status: "Planificado",
    today: "—",
    future: "Vincular cotización aprobada con facturación.",
  },
  {
    name: "Chipax (finanzas)",
    status: "Planificado",
    today: "—",
    future: "Estado de cuentas por cobrar por cliente/proyecto.",
  },
];

function Badge({ status }: { status: Status }) {
  const active = status === "Activo";
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        color: active ? "var(--status-emerald)" : "var(--status-slate)",
        background: active
          ? "var(--status-emerald-bg)"
          : "var(--status-slate-bg)",
      }}
    >
      {status}
    </span>
  );
}

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader
        title="Integraciones"
        description="Mapa de herramientas del estudio y su estado de conexión con Noma."
      />

      <div className="border-border bg-accent/40 mb-6 rounded-xl border p-4 text-sm">
        <strong>Enfoque V1:</strong> Noma centraliza y <em>enlaza</em> a las
        herramientas existentes (links por cliente/proyecto). Las integraciones
        por API se habilitan por etapas; la arquitectura ya las deja preparadas.
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {INTEGRATIONS.map((it) => (
          <div key={it.name} className="glass rounded-xl p-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium">{it.name}</p>
              <Badge status={it.status} />
            </div>
            <p className="text-sm">
              <span className="text-muted-foreground">Hoy:</span> {it.today}
            </p>
            <p className="mt-1 text-sm">
              <span className="text-muted-foreground">Futuro:</span> {it.future}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
