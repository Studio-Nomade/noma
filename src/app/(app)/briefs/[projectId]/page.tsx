import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AREA_LABELS, type Area } from "@/types/enums";
import {
  getProjectForBrief,
  getBriefByProject,
  listBriefMeetings,
  listBriefNotes,
  listBriefVersions,
} from "@/features/briefs/queries";
import { listTeamMembers } from "@/features/projects/queries";
import { getClientContacts } from "@/features/clients/queries";
import { listServices } from "@/features/services/queries";
import { BriefHub, type BriefHubData } from "@/features/briefs/brief-hub";

export const metadata = { title: "Brief" };

const GENERAL_KEYS = [
  "contextGeneral",
  "mainObjective",
  "problem",
  "targetAudience",
  "expectedOutcome",
  "idealDeadline",
  "availableMaterials",
  "budgetMentioned",
  "decisionMakers",
  "urgency",
  "restrictions",
  "generalComments",
  "pendingInfo",
  "recommendedNextAction",
] as const;

export default async function BriefEditorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProjectForBrief(projectId);
  if (!project) notFound();

  const [brief, meetings, notes, team, contacts, allServices] =
    await Promise.all([
      getBriefByProject(projectId),
      listBriefMeetings(projectId),
      listBriefNotes(projectId),
      listTeamMembers(),
      getClientContacts(project.clientId),
      listServices(),
    ]);
  const versions = brief ? await listBriefVersions(brief.id) : [];

  // Áreas relevantes = principal + involucradas del brief.
  const briefAreas = new Set<Area>([
    project.area,
    ...((brief?.involvedAreas as Area[]) ?? []),
  ]);
  const catalogServices = allServices
    .filter((s) => s.status === "Activo" && briefAreas.has(s.area))
    .map((s) => ({ id: s.id, name: s.name, area: s.area }));
  const aiExt = brief?.aiExtraction as { suggestedServices?: string[] } | null;

  const general: Record<string, string> = {};
  for (const k of GENERAL_KEYS) {
    general[k] = (brief?.[k] as string | null) ?? "";
  }

  const latestApproved = versions.find((v) => v.isApproved);

  const data: BriefHubData = {
    projectId,
    projectName: project.name,
    clientName: project.clientName,
    mainArea: project.area,
    status: brief?.status ?? "Sin reunión agendada",
    general,
    areaBlocks:
      (brief?.areaBlocks as Record<string, Record<string, string>>) ?? {},
    involvedAreas: (brief?.involvedAreas as Area[]) ?? [],
    commercialRecs: brief?.commercialRecs ?? "",
    risks: brief?.risks ?? "",
    nextSteps: brief?.nextSteps ?? "",
    aiExtraction: (brief?.aiExtraction as BriefHubData["aiExtraction"]) ?? null,
    approved: {
      at: brief?.approvedAt ? brief.approvedAt.toISOString() : null,
      by: latestApproved?.approvedByEmail ?? null,
    },
    meetings: meetings.map((m) => ({
      id: m.id,
      title: m.title,
      startsAt: m.startsAt ? m.startsAt.toISOString() : null,
      durationMin: m.durationMin,
      meetLink: m.meetLink,
    })),
    notes: notes.map((nt) => ({
      id: nt.id,
      source: nt.source,
      fileName: nt.fileName,
      driveUrl: nt.driveUrl,
      rawText: nt.rawText,
      importedByEmail: nt.importedByEmail,
      createdAt: nt.createdAt.toISOString(),
    })),
    versions: versions.map((v) => ({
      id: v.id,
      version: v.version,
      approvedByEmail: v.approvedByEmail,
      approvedAt: v.approvedAt ? v.approvedAt.toISOString() : null,
    })),
    teamMembers: team,
    contacts: contacts.map((c) => ({ name: c.name, email: c.email })),
    catalogServices,
    suggestedServices: aiExt?.suggestedServices ?? [],
  };

  return (
    <>
      <Link
        href={`/projects/${projectId}`}
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        Volver a la oportunidad
      </Link>

      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Brief · {project.name}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {project.clientName} · {AREA_LABELS[project.area]}
        </p>
      </div>

      <BriefHub data={data} />
    </>
  );
}
