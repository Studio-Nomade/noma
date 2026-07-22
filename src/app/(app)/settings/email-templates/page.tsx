import { Plus, Pencil, Mail } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { AREA_LABELS, type Area } from "@/types/enums";
import { listEmailTemplates } from "@/features/email/queries";
import { TemplateDialog } from "@/features/email/template-dialog";
import { TemplateDeleteButton } from "@/features/email/template-delete-button";

export const metadata = { title: "Plantillas de correo" };

export default async function EmailTemplatesPage() {
  const templates = await listEmailTemplates();

  const newButton = (
    <TemplateDialog
      trigger={
        <Button>
          <Plus className="size-4" />
          Nueva plantilla
        </Button>
      }
    />
  );

  return (
    <>
      <PageHeader
        title="Plantillas de correo"
        description="Cuerpos de email para enviar propuestas; varían según el servicio/área."
        action={newButton}
      />

      {templates.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="Sin plantillas aún"
          description="Crea una plantilla para el envío de propuestas."
          action={newButton}
        />
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="glass flex items-start justify-between gap-4 rounded-xl p-4"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  {t.name}
                  <span className="text-muted-foreground text-xs">
                    {t.area ? AREA_LABELS[t.area as Area] : "Global"}
                  </span>
                </p>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  {t.subject}
                </p>
                <p className="text-muted-foreground mt-1 line-clamp-2 text-xs whitespace-pre-wrap">
                  {t.body}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <TemplateDialog
                  template={t}
                  trigger={
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Editar"
                    >
                      <Pencil className="size-4" />
                    </button>
                  }
                />
                <TemplateDeleteButton id={t.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
