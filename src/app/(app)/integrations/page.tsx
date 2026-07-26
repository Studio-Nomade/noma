import {
  Bot,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  FolderOpen,
  MessagesSquare,
  Workflow,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";
import { AITestButton } from "@/features/integrations/ai-test-button";
import { UserConnectionsCard } from "@/features/integrations/connections-card";
import { getIntegrationOverview } from "@/features/integrations/queries";

export const metadata = { title: "Integraciones" };

const ERROR_MESSAGES: Record<string, string> = {
  unsupported_provider: "El proveedor solicitado no está disponible.",
  invalid_oauth_state:
    "La conexión expiró o no pudo validarse. Vuelve a intentarlo.",
  asana_not_configured: "Asana OAuth aún no está configurado en el entorno.",
  slack_not_configured: "Slack OAuth aún no está configurado en el entorno.",
  asana_denied: "La autorización de Asana fue cancelada.",
  slack_denied: "La autorización de Slack fue cancelada.",
  asana_oauth_failed: "No se pudo completar la conexión con Asana.",
  slack_oauth_failed: "No se pudo completar la conexión con Slack.",
};

function Status({
  active,
  activeLabel = "Configurado",
  inactiveLabel = "No configurado",
}: {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  return (
    <Badge variant={active ? "secondary" : "outline"}>
      {active ? (
        <CheckCircle2 data-icon="inline-start" />
      ) : (
        <CircleDashed data-icon="inline-start" />
      )}
      {active ? activeLabel : inactiveLabel}
    </Badge>
  );
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const user = await requireUser();
  const [overview, params] = await Promise.all([
    getIntegrationOverview(user.id),
    searchParams,
  ]);
  const canTestAI = roleFor(user.email).isAdmin;
  const errorMessage = params.error
    ? (ERROR_MESSAGES[params.error] ?? "No se pudo completar la conexión.")
    : null;

  return (
    <>
      <PageHeader
        title="Integraciones"
        description="Conexiones reales del estudio y cuentas personales asociadas a tu usuario."
      />

      {(errorMessage || params.connected) && (
        <div
          role="status"
          className={`mb-6 rounded-xl border p-4 text-sm ${
            errorMessage
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-border bg-accent/50"
          }`}
        >
          {errorMessage ??
            `${params.connected === "asana" ? "Asana" : "Slack"} quedó conectado correctamente.`}
        </div>
      )}

      {!overview.encryptionConfigured && (
        <div className="border-border bg-accent/40 mb-6 rounded-xl border p-4 text-sm">
          <strong>Conexiones personales deshabilitadas:</strong> falta
          configurar <code>NOMA_TOKEN_ENCRYPTION_KEY</code>. Noma no guardará
          ningún token hasta contar con cifrado válido.
        </div>
      )}

      <section>
        <div className="mb-3">
          <h2 className="font-heading text-sm font-medium">
            Inteligencia artificial · cuenta del estudio
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Las credenciales viven solo en variables de entorno. No se conectan
            cuentas personales de ChatGPT o Gemini.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="glass rounded-xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Bot className="size-4" />
                <p className="font-medium">OpenAI</p>
              </div>
              <Status active={overview.ai.openai.configured} />
            </div>
            <p className="text-muted-foreground mt-3 text-sm">
              Cuenta API central de Studio Nomade. La key nunca se expone al
              navegador ni se persiste en la base.
            </p>
            {canTestAI && (
              <div className="mt-4">
                <AITestButton
                  provider="openai"
                  configured={overview.ai.openai.configured}
                />
              </div>
            )}
          </div>

          <div className="glass rounded-xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <BrainCircuit className="size-4" />
                <p className="font-medium">Gemini</p>
              </div>
              <Status active={overview.ai.gemini.configured} />
            </div>
            <p className="text-muted-foreground mt-3 text-sm">
              Cuenta API central para futuras funciones de lectura y
              procesamiento asistido.
            </p>
            {canTestAI && (
              <div className="mt-4">
                <AITestButton
                  provider="gemini"
                  configured={overview.ai.gemini.configured}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <UserConnectionsCard
        connections={overview.personal}
        encryptionConfigured={overview.encryptionConfigured}
        redirectTo="/integrations"
      />

      <section className="mt-8">
        <div className="mb-3">
          <h2 className="font-heading text-sm font-medium">
            Servicios compartidos del estudio
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Configuración global o conexión ya existente en Noma.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              name: "Google Workspace",
              icon: CalendarDays,
              active: overview.google.connected,
              configured: overview.google.configured,
              description:
                "SSO, Gmail, Calendar, Meet y Drive mediante la cuenta Google de cada usuario.",
              activeLabel: "Conectado",
            },
            {
              name: "Asana operacional",
              icon: Workflow,
              active: overview.centralAsana.configured,
              configured: overview.centralAsana.configured,
              description:
                "Token central usado por el traspaso a operación y el resumen de proyectos.",
              activeLabel: "Activo",
            },
            {
              name: "Google Drive",
              icon: FolderOpen,
              active: overview.google.connected,
              configured: overview.google.configured,
              description:
                "Lectura autorizada por usuario; los enlaces de proyecto siguen viviendo en Noma.",
              activeLabel: "Disponible",
            },
            {
              name: "Canales y colaboración",
              icon: MessagesSquare,
              active: overview.personal.some(
                (connection) =>
                  connection.provider === "slack" && connection.connected,
              ),
              configured:
                overview.personal.find(
                  (connection) => connection.provider === "slack",
                )?.configured ?? false,
              description:
                "Slack personal queda preparado aquí; los canales y no leídos se habilitan en P3.",
              activeLabel: "Conectado",
            },
          ].map((integration) => {
            const Icon = integration.icon;
            return (
              <div key={integration.name} className="glass rounded-xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon className="size-4" />
                    <p className="font-medium">{integration.name}</p>
                  </div>
                  <Status
                    active={integration.active}
                    activeLabel={integration.activeLabel}
                    inactiveLabel={
                      integration.configured ? "Sin conectar" : "No configurado"
                    }
                  />
                </div>
                <p className="text-muted-foreground mt-3 text-sm">
                  {integration.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
