"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  FileImage,
  FolderOpen,
  Search,
  Shapes,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { EmailStudioProjectListItem } from "./project-queries";
import { EmailStudioProjectStatusButton } from "./project-status-button";

type ProjectFilter = "active" | "archived" | "all";

const dateFormatter = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Santiago",
});

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function EmailStudioProjectHub({
  projects,
}: {
  projects: EmailStudioProjectListItem[];
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProjectFilter>("active");

  const visibleProjects = useMemo(() => {
    const term = normalized(search.trim());
    return projects.filter((project) => {
      const matchesStatus = filter === "all" || project.status === filter;
      const haystack = normalized(
        [
          project.name,
          project.clientName,
          project.nomaProjectName,
          project.description,
        ]
          .filter(Boolean)
          .join(" "),
      );
      return matchesStatus && (!term || haystack.includes(term));
    });
  }, [filter, projects, search]);

  const counts = {
    active: projects.filter((project) => project.status === "active").length,
    archived: projects.filter((project) => project.status === "archived")
      .length,
    all: projects.length,
  };

  return (
    <div className="space-y-5">
      <div className="glass flex flex-col gap-3 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="bg-muted flex w-fit rounded-lg p-1">
          {(
            [
              ["active", "Activos"],
              ["archived", "Archivados"],
              ["all", "Todos"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                filter === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              <span className="ml-1.5 text-xs tabular-nums">
                {counts[value]}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar proyecto o cliente"
            className="pl-9"
            aria-label="Buscar proyectos de correo"
          />
        </div>
      </div>

      {visibleProjects.length === 0 ? (
        <div className="border-border/70 bg-card/50 flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center">
          <FolderOpen className="text-muted-foreground mb-4 size-9" />
          <h2 className="font-display text-xl">
            No hay proyectos en esta vista
          </h2>
          <p className="text-muted-foreground mt-1 max-w-md text-sm">
            {search
              ? "Prueba con otro nombre, cliente o proyecto relacionado."
              : filter === "archived"
                ? "Los proyectos archivados aparecerán aquí."
                : "Crea un proyecto para preparar su diseño y sus assets."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleProjects.map((project) => (
            <article
              key={project.id}
              className="glass group flex min-h-64 flex-col rounded-xl p-5 transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                  <FileImage className="size-5" />
                </div>
                <div className="flex items-center gap-1">
                  <Badge
                    variant={
                      project.status === "archived" ? "outline" : "secondary"
                    }
                  >
                    {project.status === "archived" ? "Archivado" : "Activo"}
                  </Badge>
                  <EmailStudioProjectStatusButton
                    id={project.id}
                    status={project.status}
                    compact
                  />
                </div>
              </div>

              <div className="mt-5 flex-1">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {project.clientName}
                </p>
                <Link
                  href={`/email-studio/${project.id}`}
                  className="mt-1 inline-flex items-start gap-2"
                >
                  <h2 className="font-display text-xl leading-tight">
                    {project.name}
                  </h2>
                  <ArrowUpRight className="mt-1 size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
                {project.description && (
                  <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
                    {project.description}
                  </p>
                )}
              </div>

              <div className="border-border/70 mt-5 grid grid-cols-2 gap-3 border-t pt-4 text-xs">
                <div>
                  <p className="text-muted-foreground">Proyecto Noma</p>
                  <p className="mt-0.5 truncate font-medium">
                    {project.nomaProjectName ?? "Sin vincular"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Blueprint</p>
                  <p className="mt-0.5 flex items-center gap-1 font-medium">
                    <Shapes className="size-3.5" />
                    {project.currentDocumentVersion > 0
                      ? `Versión ${project.currentDocumentVersion}`
                      : "Sin diseño"}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-muted-foreground text-xs">
                  Actualizado {dateFormatter.format(project.updatedAt)}
                </p>
                <Button
                  render={<Link href={`/email-studio/${project.id}`} />}
                  nativeButton={false}
                  variant="ghost"
                  size="sm"
                >
                  Abrir
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
