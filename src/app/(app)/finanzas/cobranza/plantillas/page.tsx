import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import {
  COBRANZA_MOMENTS,
  COBRANZA_MOMENT_LABELS,
  type CobranzaMoment,
} from "@/types/enums";
import { getCobranzaTemplates } from "@/features/finance/cobranza/queries";
import {
  saveCobranzaTemplate,
  deleteCobranzaTemplate,
} from "@/features/finance/cobranza/actions";
import type { CobranzaTemplate } from "@/db/schema";

export default async function PlantillasPage() {
  const templates = await getCobranzaTemplates();

  return (
    <>
      <Link
        href="/finanzas/cobranza"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Volver a cobranza
      </Link>

      <PageHeader
        title="Plantillas de cobranza"
        description="Correos por momento del proyecto. Variables: {cliente} {contacto} {proyecto} {monto} {folio} {mes} {anio} {estudio} {remitente}"
      />

      <div className="mb-10 space-y-4">
        {templates.map((t) => (
          <TemplateForm key={t.id} template={t} />
        ))}
      </div>

      <section>
        <h2 className="font-heading mb-3 text-base font-medium">
          Nueva plantilla
        </h2>
        <TemplateForm />
      </section>
    </>
  );
}

function TemplateForm({ template }: { template?: CobranzaTemplate }) {
  const isNew = !template;
  const editId = isNew ? "new" : `edit-${template!.id}`;
  return (
    <div className="border-border bg-card rounded-xl border p-5">
      {/* Form de borrado separado (los forms no pueden anidarse) */}
      {template && (
        <form id={`del-${template.id}`} action={deleteCobranzaTemplate}>
          <input type="hidden" name="id" value={template.id} />
        </form>
      )}
      <form id={editId} action={saveCobranzaTemplate} className="space-y-3">
        {template && <input type="hidden" name="id" value={template.id} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-muted-foreground mb-1 block text-xs">
            Nombre
          </label>
          <input
            name="name"
            defaultValue={template?.name}
            required
            placeholder="Inicio de proyecto"
            className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-muted-foreground mb-1 block text-xs">
            Momento
          </label>
          <select
            name="moment"
            defaultValue={template?.moment ?? "INICIO"}
            className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
          >
            {COBRANZA_MOMENTS.map((m: CobranzaMoment) => (
              <option key={m} value={m}>
                {COBRANZA_MOMENT_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-muted-foreground mb-1 block text-xs">
          Asunto
        </label>
        <input
          name="subject"
          defaultValue={template?.subject}
          required
          className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-muted-foreground mb-1 block text-xs">
          Cuerpo
        </label>
        <textarea
          name="body"
          defaultValue={template?.body}
          required
          rows={isNew ? 8 : 10}
          className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>
        <div className="flex items-center justify-between">
          <button
            type="submit"
            className="bg-foreground text-background rounded-md px-4 py-2 text-sm font-medium"
          >
            {isNew ? "Crear plantilla" : "Guardar cambios"}
          </button>
          {template && (
            <button
              form={`del-${template.id}`}
              type="submit"
              className="text-muted-foreground hover:text-[var(--status-red)] text-xs"
            >
              Eliminar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
