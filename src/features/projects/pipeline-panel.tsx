"use client";

import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  CalendarPlus,
  ExternalLink,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/currency/format";
import { PIPELINE_STAGES, type CommercialStage } from "@/types/enums";
import { NewProposalButton } from "@/features/proposals/new-proposal-button";
import { ScheduleMeetingDialog } from "@/features/briefs/schedule-meeting-dialog";
import { ProjectTimeline } from "./project-timeline";
import { ProjectLinks } from "./project-links";
import type { PipelinePanelData, ProjectListItem } from "./queries";

export function PipelinePanel({
  project,
  siblings,
  details,
  team,
  open,
  onOpenChange,
  onSelect,
  onStageChange,
}: {
  project: ProjectListItem | null;
  siblings: ProjectListItem[];
  details?: PipelinePanelData;
  team: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
  onStageChange: (id: string, stage: CommercialStage) => void;
}) {
  if (!project) return null;
  const index = siblings.findIndex((item) => item.id === project.id);
  const contacts = details?.contacts ?? [];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[calc(100%-1rem)] max-w-none gap-0 overflow-y-auto sm:w-full sm:max-w-2xl"
      >
        <SheetHeader className="border-border border-b p-4 pr-12 sm:p-6 sm:pr-14">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="truncate text-xl">
                {project.name}
              </SheetTitle>
              <SheetDescription>{project.clientName}</SheetDescription>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Oportunidad anterior"
                disabled={index <= 0}
                onClick={() => onSelect(siblings[index - 1].id)}
              >
                <ChevronLeft />
              </Button>
              <span className="text-muted-foreground text-xs">
                {index + 1} de {siblings.length}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Oportunidad siguiente"
                disabled={index >= siblings.length - 1}
                onClick={() => onSelect(siblings[index + 1].id)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-1 sm:flex sm:overflow-x-auto sm:pb-1">
            {PIPELINE_STAGES.map((stage) => (
              <button
                key={stage}
                type="button"
                onClick={() => onStageChange(project.id, stage)}
                className={
                  stage === project.commercialStage
                    ? "bg-foreground text-background min-h-10 rounded-lg px-2.5 py-1 text-[10px] font-medium sm:min-h-0 sm:shrink-0 sm:rounded-full"
                    : "bg-accent text-muted-foreground min-h-10 rounded-lg px-2.5 py-1 text-[10px] sm:min-h-0 sm:shrink-0 sm:rounded-full"
                }
              >
                {stage}
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Summary
              label="Monto"
              value={formatMoney(
                project.budgetAmount,
                project.budgetCurrency ?? "UF",
              )}
            />
            <Summary
              label="Responsable"
              value={project.responsible ?? "Sin asignar"}
            />
            <Summary label="Etapa" value={String(project.commercialStage)} />
            <Summary
              label="Antigüedad"
              value={stageAge(project.stageChangedAt)}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <NewProposalButton projectId={project.id} variant="outline" />
            <ScheduleMeetingDialog
              projectId={project.id}
              projectName={project.name}
              defaultArea={project.area}
              teamMembers={team}
              contacts={contacts.map((contact) => ({
                name: contact.name,
                email: contact.email,
              }))}
              trigger={
                <Button variant="outline">
                  <CalendarPlus /> Agendar reunión
                </Button>
              }
            />
            <Select
              value={project.commercialStage}
              onValueChange={(stage) =>
                stage && onStageChange(project.id, stage as CommercialStage)
              }
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {stage}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SheetHeader>
        <Tabs defaultValue="activity" className="min-w-0 p-4 sm:p-6">
          <TabsList
            variant="line"
            className="max-w-full justify-start overflow-x-auto"
          >
            <TabsTrigger value="activity">Actividad</TabsTrigger>
            <TabsTrigger value="client">Cliente</TabsTrigger>
            <TabsTrigger value="proposals">Propuestas</TabsTrigger>
            <TabsTrigger value="brief">Brief</TabsTrigger>
            <TabsTrigger value="links">Enlaces / tareas</TabsTrigger>
            <TabsTrigger value="notes">Notas</TabsTrigger>
          </TabsList>
          <TabsContent value="activity" className="pt-5">
            <ProjectTimeline items={details?.timeline ?? []} />
          </TabsContent>
          <TabsContent value="client" className="space-y-4 pt-5">
            <div>
              <p className="font-medium">{project.clientName}</p>
              {project.clientEmail && (
                <a
                  href={`mailto:${project.clientEmail}`}
                  className="text-muted-foreground text-sm hover:underline"
                >
                  {project.clientEmail}
                </a>
              )}
              {project.clientPhone && (
                <p className="text-muted-foreground text-sm">
                  {project.clientPhone}
                </p>
              )}
            </div>
            {contacts.map((contact) => (
              <div
                key={contact.email}
                className="border-border rounded-lg border p-3"
              >
                <p className="font-medium">{contact.name ?? contact.email}</p>
                <p className="text-muted-foreground text-xs">
                  {contact.role ?? "Contacto"} · {contact.email}
                </p>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="proposals" className="space-y-2 pt-5">
            {details?.proposals.length ? (
              details.proposals.map((proposal) => (
                <Link
                  key={proposal.id}
                  href={`/proposals/${proposal.id}`}
                  className="border-border hover:bg-accent flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{proposal.title}</p>
                    <p className="text-muted-foreground text-xs">
                      v{proposal.version} ·{" "}
                      {formatMoney(proposal.amount, proposal.currency ?? "UF")}
                    </p>
                  </div>
                  <StatusBadge value={proposal.status} size="xs" />
                </Link>
              ))
            ) : (
              <Empty text="Sin propuestas asociadas." />
            )}
          </TabsContent>
          <TabsContent value="brief" className="pt-5">
            {details?.brief ? (
              <Link
                href={`/briefs/${project.id}`}
                className="border-border hover:bg-accent flex items-center justify-between rounded-lg border p-3"
              >
                <span className="font-medium">Brief del proyecto</span>
                <StatusBadge value={details.brief.status} size="xs" />
              </Link>
            ) : (
              <Empty text="Sin brief asociado." />
            )}
          </TabsContent>
          <TabsContent value="links" className="pt-5">
            {details && (
              <ProjectLinks projectId={project.id} links={details.links} />
            )}
          </TabsContent>
          <TabsContent value="notes" className="space-y-4 pt-5">
            {project.description && (
              <Note label="Descripción" value={project.description} />
            )}
            {project.mainObjective && (
              <Note label="Objetivo" value={project.mainObjective} />
            )}
            {project.internalNotes && (
              <Note label="Notas internas" value={project.internalNotes} />
            )}
            {!project.description &&
              !project.mainObjective &&
              !project.internalNotes && <Empty text="Sin notas registradas." />}
            <Link
              href={`/projects/${project.id}`}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
            >
              Abrir ficha completa <ExternalLink className="size-3.5" />
            </Link>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 truncate font-medium">{value}</dd>
    </div>
  );
}
function Note({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
        {label}
      </p>
      <p className="whitespace-pre-wrap">{value}</p>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
      {text}
    </p>
  );
}
export function stageAge(value: Date | string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60000),
  );
  if (minutes < 60) return `${minutes} min en esta etapa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h en esta etapa`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "día" : "días"} en esta etapa`;
}
