import {
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  ListTodo,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConnectionButton } from "@/features/integrations/connection-button";
import type { IntegrationOverview } from "@/features/integrations/queries";
import type { MyAsanaTasksResult } from "./my-tasks";

function formatDueDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function MyAsanaTasksCard({
  result,
  connection,
  encryptionConfigured,
}: {
  result: MyAsanaTasksResult;
  connection: IntegrationOverview["personal"][number];
  encryptionConfigured: boolean;
}) {
  return (
    <section className="glass mt-8 rounded-xl p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading flex items-center gap-2 text-sm font-medium">
            <ListTodo className="size-4" />
            Mis tareas · Asana
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Tareas abiertas de tu cuenta personal, ordenadas por vencimiento.
          </p>
        </div>
        <ConnectionButton
          provider="asana"
          connected={connection.connected}
          configured={connection.configured}
          encryptionConfigured={encryptionConfigured}
          redirectTo="/"
        />
      </div>

      {!result.connected ? (
        <div className="border-border rounded-lg border border-dashed p-5">
          <p className="text-sm font-medium">Asana personal no disponible</p>
          <p className="text-muted-foreground mt-1 text-xs">{result.reason}</p>
        </div>
      ) : result.tasks.length === 0 ? (
        <div className="border-border flex items-center gap-3 rounded-lg border border-dashed p-5">
          <CheckCircle2 className="text-primary size-5" />
          <div>
            <p className="text-sm font-medium">No tienes tareas abiertas</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Tu lista personal de Asana está al día.
            </p>
          </div>
        </div>
      ) : (
        <>
          <ul className="divide-border divide-y">
            {result.tasks.slice(0, 8).map((task) => {
              const content = (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {task.name}
                  </span>
                  {task.dueOn && (
                    <Badge variant="outline">
                      <CalendarDays data-icon="inline-start" />
                      {formatDueDate(task.dueOn)}
                    </Badge>
                  )}
                  {task.url && <ExternalLink className="size-3.5 shrink-0" />}
                </>
              );
              return (
                <li key={task.id}>
                  {task.url ? (
                    <a
                      href={task.url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:bg-accent/50 flex min-w-0 items-center gap-3 rounded-lg px-2 py-3 transition-colors"
                    >
                      {content}
                    </a>
                  ) : (
                    <div className="flex min-w-0 items-center gap-3 px-2 py-3">
                      {content}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {result.tasks.length > 8 && (
            <p className="text-muted-foreground mt-3 text-xs">
              Mostrando 8 de {result.tasks.length} tareas abiertas.
            </p>
          )}
        </>
      )}
    </section>
  );
}
