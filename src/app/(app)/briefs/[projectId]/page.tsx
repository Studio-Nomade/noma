import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AREA_LABELS } from "@/types/enums";
import {
  getProjectForBrief,
  getBriefByProject,
} from "@/features/briefs/queries";
import { BriefForm } from "@/features/briefs/brief-form";

export const metadata = { title: "Brief" };

export default async function BriefEditorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProjectForBrief(projectId);
  if (!project) notFound();
  const brief = await getBriefByProject(projectId);

  return (
    <>
      <Link
        href={`/projects/${projectId}`}
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        Volver al proyecto
      </Link>

      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Brief · {project.name}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {project.clientName} · {AREA_LABELS[project.area]}
        </p>
      </div>

      <div className="border-border bg-card rounded-xl border p-6">
        <BriefForm projectId={projectId} area={project.area} brief={brief} />
      </div>
    </>
  );
}
