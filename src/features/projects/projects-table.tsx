"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InlineStatusSelect } from "@/components/shared/inline-status-select";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataPagination } from "@/components/shared/data-pagination";
import {
  MobileDetailsCard,
  MobileField,
} from "@/components/shared/mobile-details-card";
import { usePagination } from "@/hooks/use-pagination";
import {
  SortButton,
  type SortDirection,
} from "@/components/shared/sort-button";
import {
  AREAS,
  COMMERCIAL_STAGES,
  PRIORITIES,
  PROJECT_STATUSES,
  type CommercialStage,
  type Priority,
  type ProjectStatus,
} from "@/types/enums";
import {
  setCommercialStage,
  setProjectPriority,
  setProjectStatus,
} from "./actions";
import type { ProjectListItem } from "./queries";

type ProjectSortKey =
  | "name"
  | "clientName"
  | "area"
  | "status"
  | "commercialStage"
  | "priority"
  | "responsible";

function compareValues(a: unknown, b: unknown) {
  return String(a ?? "").localeCompare(String(b ?? ""), "es", {
    numeric: true,
    sensitivity: "base",
  });
}

export function ProjectsTable({ projects }: { projects: ProjectListItem[] }) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("all");
  const [stage, setStage] = useState("all");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [responsible, setResponsible] = useState("all");
  const [sortKey, setSortKey] = useState<ProjectSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const router = useRouter();

  const responsibleOptions = useMemo(
    () =>
      [
        ...new Set(
          projects.map((project) => project.responsible).filter(Boolean),
        ),
      ].sort((a, b) => compareValues(a, b)) as string[],
    [projects],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();
    return projects
      .filter((project) => {
        if (area !== "all" && project.area !== area) return false;
        if (stage !== "all" && project.commercialStage !== stage) return false;
        if (status !== "all" && project.status !== status) return false;
        if (priority !== "all" && project.priority !== priority) return false;
        if (responsible !== "all" && project.responsible !== responsible) {
          return false;
        }
        if (!normalizedQuery) return true;
        return [
          project.name,
          project.clientName,
          project.nextAction,
          project.responsible,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => {
        const comparison = compareValues(a[sortKey], b[sortKey]);
        return sortDirection === "asc" ? comparison : -comparison;
      });
  }, [
    area,
    priority,
    projects,
    query,
    responsible,
    sortDirection,
    sortKey,
    stage,
    status,
  ]);
  const pagination = usePagination(
    filtered,
    "noma:projects:page-size",
    `${query}:${area}:${stage}:${status}:${priority}:${responsible}:${sortKey}:${sortDirection}`,
  );

  function sortBy(key: ProjectSortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  const headers: Array<{ key: ProjectSortKey; label: string }> = [
    { key: "name", label: "Proyecto" },
    { key: "clientName", label: "Cliente" },
    { key: "area", label: "Área" },
    { key: "status", label: "Estado" },
    { key: "commercialStage", label: "Etapa" },
    { key: "priority", label: "Prioridad" },
    { key: "responsible", label: "Responsable" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-[1_1_16rem]">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder="Buscar proyecto o cliente…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
        <FilterSelect
          value={area}
          onValueChange={setArea}
          allLabel="Todas las áreas"
          options={AREAS}
        />
        <FilterSelect
          value={stage}
          onValueChange={setStage}
          allLabel="Todas las etapas"
          options={COMMERCIAL_STAGES}
        />
        <FilterSelect
          value={status}
          onValueChange={setStatus}
          allLabel="Todos los estados"
          options={PROJECT_STATUSES}
        />
        <FilterSelect
          value={priority}
          onValueChange={setPriority}
          allLabel="Todas las prioridades"
          options={PRIORITIES}
        />
        <FilterSelect
          value={responsible}
          onValueChange={setResponsible}
          allLabel="Todos los responsables"
          options={responsibleOptions}
        />
      </div>

      <div className="space-y-2 md:hidden">
        {pagination.pageItems.map((project) => (
          <MobileDetailsCard
            key={project.id}
            title={project.name}
            subtitle={project.clientName}
            badge={<StatusBadge value={project.status} size="xs" />}
            actions={
              <button
                type="button"
                onClick={() => router.push(`/projects/${project.id}`)}
                className="hover:bg-accent min-h-10 rounded-md px-3 text-sm font-medium"
              >
                Ver proyecto
              </button>
            }
          >
            <dl className="space-y-3">
              <MobileField label="Estado">
                <InlineStatusSelect<ProjectStatus>
                  entityId={project.id}
                  value={project.status as ProjectStatus}
                  options={PROJECT_STATUSES}
                  label={`Estado de ${project.name}`}
                  successMessage={(value) => `Estado actualizado a “${value}”`}
                  action={setProjectStatus}
                />
              </MobileField>
              <MobileField label="Área">{project.area}</MobileField>
              <MobileField label="Etapa">
                <InlineStatusSelect<CommercialStage>
                  entityId={project.id}
                  value={project.commercialStage as CommercialStage}
                  options={COMMERCIAL_STAGES}
                  label={`Etapa de ${project.name}`}
                  successMessage={(value) => `Etapa actualizada a “${value}”`}
                  action={setCommercialStage}
                />
              </MobileField>
              <MobileField label="Prioridad">
                <InlineStatusSelect<Priority>
                  entityId={project.id}
                  value={project.priority as Priority}
                  options={PRIORITIES}
                  label={`Prioridad de ${project.name}`}
                  successMessage={(value) =>
                    `Prioridad actualizada a “${value}”`
                  }
                  action={setProjectPriority}
                />
              </MobileField>
              <MobileField label="Responsable">
                {project.responsible ?? "—"}
              </MobileField>
              {project.nextAction && (
                <MobileField label="Próxima acción">
                  {project.nextAction}
                </MobileField>
              )}
            </dl>
          </MobileDetailsCard>
        ))}
        {filtered.length === 0 && (
          <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
            Sin proyectos que coincidan.
          </p>
        )}
      </div>

      <div className="glass-solid hidden overflow-hidden rounded-xl md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {headers.map((header) => (
                <TableHead key={header.key} className="min-w-28">
                  <SortButton
                    label={header.label}
                    active={sortKey === header.key}
                    direction={sortDirection}
                    onClick={() => sortBy(header.key)}
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.pageItems.map((project) => (
              <TableRow
                key={project.id}
                onClick={(event) => {
                  if (
                    (event.target as HTMLElement).closest(
                      "button, a, input, [role='combobox'], [data-slot='select-trigger']",
                    )
                  ) {
                    return;
                  }
                  router.push(`/projects/${project.id}`);
                }}
                className="hover:bg-accent/50 cursor-pointer"
              >
                <TableCell>
                  <div className="font-medium">{project.name}</div>
                  {project.nextAction && (
                    <div className="text-muted-foreground text-xs">
                      → {project.nextAction}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {project.clientName}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {project.area}
                </TableCell>
                <TableCell>
                  <InlineStatusSelect<ProjectStatus>
                    entityId={project.id}
                    value={project.status as ProjectStatus}
                    options={PROJECT_STATUSES}
                    label={`Estado de ${project.name}`}
                    successMessage={(value) =>
                      `Estado actualizado a “${value}”`
                    }
                    action={setProjectStatus}
                  />
                </TableCell>
                <TableCell>
                  <InlineStatusSelect<CommercialStage>
                    entityId={project.id}
                    value={project.commercialStage as CommercialStage}
                    options={COMMERCIAL_STAGES}
                    label={`Etapa de ${project.name}`}
                    successMessage={(value) => `Etapa actualizada a “${value}”`}
                    action={setCommercialStage}
                  />
                </TableCell>
                <TableCell>
                  <InlineStatusSelect<Priority>
                    entityId={project.id}
                    value={project.priority as Priority}
                    options={PRIORITIES}
                    label={`Prioridad de ${project.name}`}
                    successMessage={(value) =>
                      `Prioridad actualizada a “${value}”`
                    }
                    action={setProjectPriority}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {project.responsible ?? "—"}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground py-8 text-center text-sm"
                >
                  Sin proyectos que coincidan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataPagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pagination.total}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />
    </div>
  );
}

function FilterSelect({
  value,
  onValueChange,
  allLabel,
  options,
}: {
  value: string;
  onValueChange: (value: string) => void;
  allLabel: string;
  options: readonly string[];
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onValueChange(next ?? "all")}
    >
      <SelectTrigger
        size="sm"
        aria-label={allLabel}
        className="min-h-10 min-w-0 flex-1 sm:max-w-52 sm:min-w-36 sm:flex-none"
      >
        <SelectValue>{value === "all" ? allLabel : value}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
